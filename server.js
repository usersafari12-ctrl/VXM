/**
 * Voxiom Bot Manager — Server
 * Deploy on Render. Start command: node server.js
 *
 * Env vars needed:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, ADMIN_SECRET
 */

'use strict';

const http   = require('http');
const admin  = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
});
const db = admin.firestore();

// ── XOR ───────────────────────────────────────────────────────────
function xorEncrypt(text, key) {
    const tb = Buffer.from(text, 'utf8');
    const kb = Buffer.from(key,  'utf8');
    const out = Buffer.alloc(tb.length);
    for (let i = 0; i < tb.length; i++) out[i] = tb[i] ^ kb[i % kb.length];
    return out.toString('base64');
}

// ── Bot payload (runs in browser on voxiom.io after decryption) ───
const BOT_PAYLOAD = `(function(){
var HANDSHAKE=new Uint8Array([0x03,0x87,0x03,0x02,0x05]);
var HEARTBEAT_MS=2500,TICK_MS=50,JUMP_EVERY=60,PLACE_AFTER=8;
var bots={},botIdCounter=0,totalDeployed=0,cycleEnabled=false;
function updateStats(){var v=Object.values(bots),el;
  el=document.getElementById('vbm-active');if(el)el.textContent=v.filter(function(b){return b.alive;}).length;
  el=document.getElementById('vbm-total'); if(el)el.textContent=totalDeployed;
  el=document.getElementById('vbm-dead');  if(el)el.textContent=v.filter(function(b){return !b.alive;}).length;
  el=document.getElementById('vbm-kill');  if(el)el.disabled=v.length===0;}
function log(msg,type){var el=document.getElementById('vbm-log');if(!el)return;
  var line=document.createElement('div');line.className='vbm-li '+(type||'info');
  line.textContent='['+new Date().toTimeString().slice(0,8)+'] '+msg;
  el.appendChild(line);el.scrollTop=el.scrollHeight;
  while(el.children.length>150)el.removeChild(el.firstChild);}
function createCard(id){var grid=document.getElementById('vbm-bot-grid');
  var empty=grid.querySelector('.vbm-empty');if(empty)empty.remove();
  var card=document.createElement('div');card.className='vbm-bot connecting';card.id='vbm-b-'+id;
  card.innerHTML='<span class="vbm-bot-id">#'+String(id).padStart(2,'0')+'</span>'+
    '<span class="vbm-bot-st" id="vbm-bs-'+id+'">CONN</span>'+
    '<span class="vbm-bot-cd" id="vbm-cd-'+id+'"></span>';
  card.addEventListener('click',function(){killBot(id);});grid.appendChild(card);}
function setCardState(id,s,cls){var c=document.getElementById('vbm-b-'+id),st=document.getElementById('vbm-bs-'+id);
  if(!c)return;c.className='vbm-bot '+(cls||'');if(st)st.textContent=s;}
function removeCard(id){var c=document.getElementById('vbm-b-'+id);if(c)c.remove();
  var g=document.getElementById('vbm-bot-grid');
  if(!g.children.length)g.innerHTML='<div class="vbm-empty">NO BOTS DEPLOYED</div>';}
function buildPacket(bot,opts){opts=opts||{};var isSlot=opts.slot!==undefined;
  var buf=new ArrayBuffer(isSlot?22:21),dv=new DataView(buf),u8=new Uint8Array(buf);
  dv.setUint8(0,(bot.seq/0x100000000)>>>0&0xFF);dv.setUint8(1,(bot.seq>>>24)&0xFF);
  dv.setUint8(2,(bot.seq>>>16)&0xFF);dv.setUint8(3,(bot.seq>>>8)&0xFF);dv.setUint8(4,(bot.seq>>>0)&0xFF);
  u8[5]=0;u8[6]=0;u8[7]=0;u8[8]=0;
  u8[9]=0xbf;u8[10]=0xc9;u8[11]=0x0f;u8[12]=0xdb;
  dv.setFloat32(13,bot.yaw,false);u8[17]=0x7f;u8[18]=0x7f;
  if(isSlot){u8[19]=0x01;u8[20]=0x00;u8[21]=opts.slot&0xFF;}
  else if(opts.jump){u8[19]=0x02;u8[20]=0x03;}
  else if(opts.place){u8[19]=0x00;u8[20]=0x00;}
  else{u8[19]=0x00;u8[20]=0x03;}
  bot.seq++;return buf;}
function createBot(id,url,timerSecs){
  var bot={id:id,ws:null,alive:false,seq:0,yaw:Math.random()*Math.PI*2,ht:null,tt:null,killTimer:null,timerStarted:false};
  try{bot.ws=new WebSocket(url);bot.ws.binaryType='arraybuffer';}
  catch(e){log('Bot #'+id+' WS error: '+e.message,'error');setCardState(id,'ERR','dead');return bot;}
  bot.ws.onopen=function(){bot.alive=true;bot.seq=0;bot.ws.send(HANDSHAKE.buffer);
    setCardState(id,'LIVE','');log('Bot #'+String(id).padStart(2,'0')+' connected','success');
    bot.ht=setInterval(function(){if(bot.ws&&bot.ws.readyState===1)bot.ws.send(new Uint8Array([0x06]).buffer);},HEARTBEAT_MS);
    setTimeout(function(){var tc=0;bot.tt=setInterval(function(){
      if(!bot.ws||bot.ws.readyState!==1)return;
      bot.yaw+=0.008;if(bot.yaw>Math.PI*2)bot.yaw-=Math.PI*2;tc++;
      var p=tc%JUMP_EVERY;
      if(p===1)bot.ws.send(buildPacket(bot,{jump:true}));
      else if(p===PLACE_AFTER)bot.ws.send(buildPacket(bot,{place:true}));
      else bot.ws.send(buildPacket(bot));},TICK_MS);},600);updateStats();};
  bot.ws.onmessage=function(e){if(!(e.data instanceof ArrayBuffer))return;
    if(bot.timerStarted)return;bot.timerStarted=true;
    bot.ws.send(buildPacket(bot,{slot:3}));
    var s=Math.max(5,timerSecs||35);
    log('Bot #'+String(id).padStart(2,'00')+' fully joined \u2014 '+s+'s timer','success');
    var cdEl=function(){return document.getElementById('vbm-cd-'+id);};
    if(cdEl())cdEl().textContent=s+'s';
    bot.killTimer=setInterval(function(){s--;var el=cdEl();
      if(el)el.textContent=s>0?s+'s':'BYE';
      if(s<=0){clearInterval(bot.killTimer);killBot(id);}},1000);};
  bot.ws.onerror=function(){log('Bot #'+String(id).padStart(2,'0')+' socket error','error');};
  bot.ws.onclose=function(e){bot.alive=false;clearInterval(bot.ht);clearInterval(bot.tt);
    setCardState(id,'DEAD','dead');log('Bot #'+String(id).padStart(2,'0')+' closed ('+e.code+')','warn');updateStats();};
  bot.kill=function(){clearInterval(bot.ht);clearInterval(bot.tt);clearInterval(bot.killTimer);if(bot.ws)bot.ws.close();bot.alive=false;};
  return bot;}
function deployBot(url,timerSecs){var id=++botIdCounter;totalDeployed++;createCard(id);bots[id]=createBot(id,url,timerSecs);updateStats();}
function killBot(id){if(!bots[id])return;bots[id].kill();log('Bot #'+String(id).padStart(2,'0')+' left','warn');
  delete bots[id];removeCard(id);updateStats();
  if(cycleEnabled){var url=document.getElementById('vbm-url').value.trim();
    var secs=Math.max(5,parseInt(document.getElementById('vbm-timer').value)||35);
    if(url.startsWith('wss://')){log('Cycle: redeploying...','info');setTimeout(function(){deployBot(url,secs);},500);}}}
document.getElementById('vbm-deploy').addEventListener('click',function(){
  var url=document.getElementById('vbm-url').value.trim();
  var count=Math.max(1,Math.min(50,parseInt(document.getElementById('vbm-count').value)||1));
  var secs=Math.max(5,parseInt(document.getElementById('vbm-timer').value)||35);
  if(!url.startsWith('wss://')){log('URL must start with wss://','error');return;}
  log('Deploying '+count+' bot(s)','info');
  for(var i=0;i<count;i++){(function(d){setTimeout(function(){deployBot(url,secs);},d);})(i*250);}});
document.getElementById('vbm-kill').addEventListener('click',function(){
  var ids=Object.keys(bots);if(!ids.length)return;
  log('Force killing all '+ids.length+' bot(s)','error');
  ids.forEach(function(id){bots[id].kill();removeCard(id);delete bots[id];});updateStats();});
document.getElementById('vbm-cycle').addEventListener('change',function(){
  cycleEnabled=this.checked;document.getElementById('vbm-cycle-ind').textContent=cycleEnabled?'●':'';
  log(cycleEnabled?'Cycle ON':'Cycle OFF',cycleEnabled?'success':'warn');});
log('Bot engine active.','success');updateStats();
})();`;

// ── HTTP server ───────────────────────────────────────────────────
const httpServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret, x-id-token, x-license-key');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200); res.end('OK'); return;
    }

    if (req.url.startsWith('/admin/')) {
        handleAdminHttp(req, res); return;
    }

    // ── GET /payload — validate auth, return XOR-encrypted bot JS ─
    if (req.method === 'GET' && req.url === '/payload') {
        const idToken    = req.headers['x-id-token'];
        const licenseKey = req.headers['x-license-key'];
        if (!idToken || !licenseKey) {
            res.writeHead(401); res.end(JSON.stringify({ error: 'Missing credentials.' })); return;
        }
        try {
            const decoded   = await admin.auth().verifyIdToken(idToken);
            const userEmail = decoded.email.toLowerCase();
            const keyDoc    = await db.collection('licenseKeys').doc(licenseKey).get();
            if (!keyDoc.exists)                         { res.writeHead(403); res.end(JSON.stringify({ error: 'Invalid license key.' }));             return; }
            if (!keyDoc.data().active)                  { res.writeHead(403); res.end(JSON.stringify({ error: 'License key revoked.' }));             return; }
            if (keyDoc.data().email !== userEmail)      { res.writeHead(403); res.end(JSON.stringify({ error: 'Key not assigned to this account.' })); return; }
            const encrypted = xorEncrypt(BOT_PAYLOAD, licenseKey);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ payload: encrypted }));
            console.log(`[Payload] served to ${userEmail}`);
        } catch (e) {
            console.error('[Payload error]', e.message);
            res.writeHead(401); res.end(JSON.stringify({ error: 'Authentication failed.' }));
        }
        return;
    }

    res.writeHead(404); res.end('Not found');
});

// ── Admin endpoints ───────────────────────────────────────────────
async function handleAdminHttp(req, res) {
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
        res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return;
    }
    let body = '';
    req.on('data', c => body += c);
    await new Promise(r => req.on('end', r));
    try {
        const path = req.url;
        if (req.method === 'GET' && path === '/admin/keys') {
            const snap = await db.collection('licenseKeys').get();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(snap.docs.map(d => ({ id: d.id, ...d.data() })))); return;
        }
        if (req.method === 'POST' && path === '/admin/keys') {
            const { email, note } = JSON.parse(body);
            if (!email) { res.writeHead(400); res.end(JSON.stringify({ error: 'email required' })); return; }
            const key = 'VBM-' + crypto.randomBytes(10).toString('hex').toUpperCase();
            await db.collection('licenseKeys').doc(key).set({
                email: email.toLowerCase(), note: note || '', active: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ key })); return;
        }
        if (req.method === 'DELETE' && path.startsWith('/admin/keys/')) {
            await db.collection('licenseKeys').doc(path.split('/')[3]).update({ active: false });
            res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
        }
        if (req.method === 'PATCH' && path.endsWith('/restore')) {
            await db.collection('licenseKeys').doc(path.split('/')[3]).update({ active: true });
            res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
        }
        res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
    } catch (e) {
        console.error('[Admin]', e);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`[VBM] listening on :${PORT}`));
