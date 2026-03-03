

'use strict';

const http        = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const admin       = require('firebase-admin');
const crypto      = require('crypto');

// ── Firebase Admin init ───────────────────────────────────────────
admin.initializeApp({
    credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
});
const db = admin.firestore();

// ── HTTP server (required by Render to keep the service alive) ────
const httpServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200); res.end('OK');
        return;
    }

    // ── Admin API (used by admin.html) ──────────────────────────
    if (req.url.startsWith('/admin/')) {
        handleAdminHttp(req, res);
        return;
    }

    res.writeHead(404); res.end('Not found');
});

// ── Admin HTTP endpoints ──────────────────────────────────────────
async function handleAdminHttp(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const secret = req.headers['x-admin-secret'];
    if (secret !== process.env.ADMIN_SECRET) {
        res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return;
    }

    let body = '';
    req.on('data', c => body += c);
    await new Promise(r => req.on('end', r));

    try {
        const path = req.url;

        // GET /admin/keys — list all keys
        if (req.method === 'GET' && path === '/admin/keys') {
            const snap = await db.collection('licenseKeys').get();
            const keys = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(keys));
            return;
        }

        // POST /admin/keys — create a key
        if (req.method === 'POST' && path === '/admin/keys') {
            const { email, note } = JSON.parse(body);
            if (!email) { res.writeHead(400); res.end(JSON.stringify({ error: 'email required' })); return; }
            const key = 'VBM-' + crypto.randomBytes(10).toString('hex').toUpperCase();
            await db.collection('licenseKeys').doc(key).set({
                email:     email.toLowerCase(),
                note:      note || '',
                active:    true,
                sessions:  [],
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ key }));
            return;
        }

        // DELETE /admin/keys/:key — revoke a key
        if (req.method === 'DELETE' && path.startsWith('/admin/keys/')) {
            const key = path.split('/')[3];
            await db.collection('licenseKeys').doc(key).update({ active: false });
            res.writeHead(200); res.end(JSON.stringify({ ok: true }));
            return;
        }

        // PATCH /admin/keys/:key/restore — re-activate
        if (req.method === 'PATCH' && path.endsWith('/restore')) {
            const key = path.split('/')[3];
            await db.collection('licenseKeys').doc(key).update({ active: true });
            res.writeHead(200); res.end(JSON.stringify({ ok: true }));
            return;
        }

        res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
    } catch (e) {
        console.error('[Admin]', e);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
}

// ── Session tracking (in-memory, per key) ────────────────────────
// sessionMap: licenseKey → Set of sessionIds
const sessionMap = new Map();
const MAX_SESSIONS = 2;

function addSession(licenseKey, sessionId) {
    if (!sessionMap.has(licenseKey)) sessionMap.set(licenseKey, new Set());
    sessionMap.get(licenseKey).add(sessionId);
}
function removeSession(licenseKey, sessionId) {
    if (sessionMap.has(licenseKey)) sessionMap.get(licenseKey).delete(sessionId);
}
function sessionCount(licenseKey) {
    return sessionMap.has(licenseKey) ? sessionMap.get(licenseKey).size : 0;
}

// ── WebSocket server (client connects here) ───────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (clientWs) => {
    let authed      = false;
    let licenseKey  = null;
    let sessionId   = crypto.randomBytes(8).toString('hex');
    let bots        = {};   // botId → { ws, intervals[] }
    let botIdSeq    = 0;

    function send(obj) {
        if (clientWs.readyState === WebSocket.OPEN)
            clientWs.send(JSON.stringify(obj));
    }

    function cleanup() {
        // Kill all bots for this session
        for (const id of Object.keys(bots)) destroyBot(id, false);
        if (licenseKey) removeSession(licenseKey, sessionId);
        console.log(`[Session ${sessionId}] disconnected`);
    }

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);

    clientWs.on('message', async (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        // ── AUTH message ─────────────────────────────────────────
        if (msg.type === 'AUTH') {
            try {
                // 1. Verify Firebase ID token
                const decoded = await admin.auth().verifyIdToken(msg.idToken);
                const userEmail = decoded.email.toLowerCase();

                // 2. Validate license key
                const keyDoc = await db.collection('licenseKeys').doc(msg.licenseKey).get();
                if (!keyDoc.exists) { send({ type: 'AUTH_FAIL', reason: 'Invalid license key.' }); clientWs.close(); return; }
                const keyData = keyDoc.data();
                if (!keyData.active)                          { send({ type: 'AUTH_FAIL', reason: 'License key revoked.' });       clientWs.close(); return; }
                if (keyData.email !== userEmail)              { send({ type: 'AUTH_FAIL', reason: 'Key not assigned to this account.' }); clientWs.close(); return; }
                if (sessionCount(msg.licenseKey) >= MAX_SESSIONS) { send({ type: 'AUTH_FAIL', reason: 'Max sessions reached (2).' }); clientWs.close(); return; }

                // 3. All good
                authed     = true;
                licenseKey = msg.licenseKey;
                addSession(licenseKey, sessionId);
                send({ type: 'AUTH_OK', sessionId });
                console.log(`[Session ${sessionId}] authed — ${userEmail} / ${licenseKey}`);
            } catch (e) {
                console.error('[Auth error]', e.message);
                send({ type: 'AUTH_FAIL', reason: 'Authentication failed.' });
                clientWs.close();
            }
            return;
        }

        if (!authed) { send({ type: 'ERROR', reason: 'Not authenticated.' }); return; }

        // ── DEPLOY message ───────────────────────────────────────
        if (msg.type === 'DEPLOY') {
            const { gameUrl, count, timerSecs } = msg;
            if (!gameUrl || !gameUrl.startsWith('wss://')) {
                send({ type: 'ERROR', reason: 'Invalid game URL.' }); return;
            }
            const n = Math.max(1, Math.min(50, count || 1));
            for (let i = 0; i < n; i++) {
                setTimeout(() => {
                    const id = ++botIdSeq;
                    spawnBot(id, gameUrl, timerSecs || 35);
                }, i * 250);
            }
            return;
        }

        // ── KILL message ─────────────────────────────────────────
        if (msg.type === 'KILL') {
            if (msg.botId === 'ALL') {
                for (const id of Object.keys(bots)) destroyBot(id, true);
            } else {
                destroyBot(msg.botId, true);
            }
            return;
        }
    });

    // ── Bot logic (lives entirely on the server) ─────────────────
    const HANDSHAKE    = Buffer.from([0x03, 0x87, 0x03, 0x02, 0x05]);
    const HEARTBEAT_MS = 2500;
    const TICK_MS      = 50;
    const JUMP_EVERY   = 60;
    const PLACE_AFTER  = 8;

    function buildPacket(bot, opts) {
        opts = opts || {};
        const isSlot = opts.slot !== undefined;
        const buf = Buffer.alloc(isSlot ? 22 : 21);
        // Sequence (5-byte big-endian)
        buf[0] = (bot.seq / 0x100000000) >>> 0 & 0xFF;
        buf[1] = (bot.seq >>> 24) & 0xFF;
        buf[2] = (bot.seq >>> 16) & 0xFF;
        buf[3] = (bot.seq >>>  8) & 0xFF;
        buf[4] = (bot.seq >>>  0) & 0xFF;
        buf[5]=0; buf[6]=0; buf[7]=0; buf[8]=0;
        // Pitch: looking down (bf c9 0f db)
        buf[9]=0xbf; buf[10]=0xc9; buf[11]=0x0f; buf[12]=0xdb;
        // Yaw
        buf.writeFloatBE(bot.yaw, 13);
        buf[17] = 0x7f; buf[18] = 0x7f;
        if (isSlot)        { buf[19]=0x01; buf[20]=0x00; buf[21]=opts.slot & 0xFF; }
        else if (opts.jump)  { buf[19]=0x02; buf[20]=0x03; }
        else if (opts.place) { buf[19]=0x00; buf[20]=0x00; }
        else                 { buf[19]=0x00; buf[20]=0x03; }
        bot.seq++;
        return buf;
    }

    function spawnBot(id, gameUrl, timerSecs) {
        const bot = { id, seq: 0, yaw: Math.random() * Math.PI * 2, alive: false, timerStarted: false };
        const intervals = [];
        bots[id] = { bot, intervals, ws: null };

        send({ type: 'BOT_STATUS', botId: id, status: 'CONN', cls: 'connecting' });

        let gameWs;
        try {
            gameWs = new WebSocket(gameUrl);
            bots[id].ws = gameWs;
        } catch (e) {
            send({ type: 'BOT_STATUS', botId: id, status: 'ERR', cls: 'dead' });
            send({ type: 'LOG', msg: `Bot #${String(id).padStart(2,'0')} WS error: ${e.message}`, level: 'error' });
            return;
        }

        gameWs.on('open', () => {
            bot.alive = true;
            bot.seq   = 0;
            gameWs.send(HANDSHAKE);
            send({ type: 'BOT_STATUS', botId: id, status: 'LIVE', cls: '' });
            send({ type: 'LOG', msg: `Bot #${String(id).padStart(2,'0')} connected`, level: 'success' });
            send({ type: 'BOT_ALIVE', botId: id, alive: true });

            // Heartbeat
            const ht = setInterval(() => {
                if (gameWs.readyState === WebSocket.OPEN) gameWs.send(Buffer.from([0x06]));
            }, HEARTBEAT_MS);
            intervals.push(ht);

            // Tick
            let tickCycle = 0;
            const tt = setInterval(() => {
                if (gameWs.readyState !== WebSocket.OPEN) return;
                bot.yaw += 0.008;
                if (bot.yaw > Math.PI * 2) bot.yaw -= Math.PI * 2;
                tickCycle++;
                const phase = tickCycle % JUMP_EVERY;
                if      (phase === 1)          gameWs.send(buildPacket(bot, { jump: true }));
                else if (phase === PLACE_AFTER) gameWs.send(buildPacket(bot, { place: true }));
                else                            gameWs.send(buildPacket(bot));
            }, TICK_MS);
            setTimeout(() => intervals.push(tt), 600);
        });

        gameWs.on('message', (data) => {
            if (!Buffer.isBuffer(data) && !(data instanceof ArrayBuffer)) return;
            if (bot.timerStarted) return;
            bot.timerStarted = true;

            // Switch to slot 4
            gameWs.send(buildPacket(bot, { slot: 3 }));

            let secsLeft = Math.max(5, timerSecs);
            send({ type: 'BOT_TIMER', botId: id, secs: secsLeft });
            send({ type: 'LOG', msg: `Bot #${String(id).padStart(2,'0')} fully joined — ${secsLeft}s timer`, level: 'success' });

            const kt = setInterval(() => {
                secsLeft--;
                send({ type: 'BOT_TIMER', botId: id, secs: secsLeft });
                if (secsLeft <= 0) {
                    clearInterval(kt);
                    destroyBot(id, true);
                }
            }, 1000);
            intervals.push(kt);
        });

        gameWs.on('error', () => {
            send({ type: 'LOG', msg: `Bot #${String(id).padStart(2,'0')} socket error`, level: 'error' });
        });

        gameWs.on('close', (code) => {
            bot.alive = false;
            intervals.forEach(clearInterval);
            send({ type: 'BOT_STATUS', botId: id, status: 'DEAD', cls: 'dead' });
            send({ type: 'BOT_ALIVE',  botId: id, alive: false });
            send({ type: 'LOG', msg: `Bot #${String(id).padStart(2,'0')} closed (${code})`, level: 'warn' });
            delete bots[id];
            send({ type: 'STATS_UPDATE' });
        });
    }

    function destroyBot(id, notify) {
        if (!bots[id]) return;
        const { bot, intervals, ws } = bots[id];
        intervals.forEach(clearInterval);
        if (ws) try { ws.close(); } catch {}
        bot.alive = false;
        delete bots[id];
        if (notify) {
            send({ type: 'BOT_REMOVED', botId: id });
            send({ type: 'LOG', msg: `Bot #${String(id).padStart(2,'0')} killed`, level: 'warn' });
        }
        send({ type: 'STATS_UPDATE' });
    }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`[VBM Proxy] listening on :${PORT}`));
