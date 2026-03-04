// ==UserScript==
// @name         Voxiom Bot Manager login
// @namespace    http://tampermonkey.net/
// @version      4.1.1
// @description  In-page bot manager UI for Voxiom private servers (Firebase auth)
// @author       You
// @match        *://voxiom.io/*
// @grant        none
// @run-at       document-end
// @require      https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js
// @require      https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js
// ==/UserScript==

(function () {
    'use strict';

    // ══════════════════════════════════════════════════════════════
    //  FIREBASE CONFIG — replace all values below with your own
    //  Firebase Console → Project Settings → Your Apps → SDK setup
    // ══════════════════════════════════════════════════════════════
    const FIREBASE_CONFIG = {
        apiKey:            "AIzaSyDfNjDMioxAAaEy2G2XQtL-ZJVO-e81A2k",
        authDomain:        "dm-me-if-you-find-this.firebaseapp.com",
        projectId:         "dm-me-if-you-find-this",
        storageBucket:     "dm-me-if-you-find-this.firebasestorage.app",
        messagingSenderId: "1080373258928",
        appId:             "1:1080373258928:web:8a3ab1efd82452555f2975"
    };

    // ══════════════════════════════════════════════════════════════
    //  ALLOWLIST — add every email address that may access the tool
    // ══════════════════════════════════════════════════════════════
    const ALLOWED_EMAILS = [
        "nicecar@gmail.com",
        "alanxdua7@gmail.com"
        // add more here…
    ];

    // Firebase SDK loaded via @require — call bootstrap directly
    bootstrap();

    // ── Styles ────────────────────────────────────────────────────
    function injectStyles() {
        var style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');

            /* ── Login overlay ── */
            #vbm-auth-overlay {
                position: fixed; inset: 0; z-index: 1000000;
                background: rgba(3, 7, 14, 0.92);
                backdrop-filter: blur(6px);
                display: flex; align-items: center; justify-content: center;
            }
            #vbm-auth-box {
                width: 320px;
                background: #060b14;
                border: 1px solid #0f2040;
                border-radius: 3px;
                font-family: 'Share Tech Mono', monospace;
                box-shadow: 0 0 60px rgba(0,0,0,0.9), 0 0 30px rgba(0,212,255,0.07);
                overflow: hidden;
                animation: vbm-fadein 0.25s ease;
            }
            @keyframes vbm-fadein {
                from { opacity: 0; transform: translateY(-10px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            #vbm-auth-box::before {
                content: ''; display: block; height: 1px;
                background: linear-gradient(90deg, transparent, #00d4ff, transparent); opacity: 0.6;
            }
            #vbm-auth-header {
                padding: 16px 18px 12px;
                border-bottom: 1px solid #0f2040;
            }
            #vbm-auth-title {
                font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 900;
                letter-spacing: 0.25em; color: #00d4ff;
                text-shadow: 0 0 10px rgba(0,212,255,0.5);
            }
            #vbm-auth-title span { color: #ff3c6e; }
            #vbm-auth-subtitle {
                font-size: 8px; letter-spacing: 0.25em; color: #3a5275;
                text-transform: uppercase; margin-top: 4px;
            }
            #vbm-auth-body { padding: 18px; }
            .vbm-auth-label {
                font-size: 8px; letter-spacing: 0.3em; color: #3a5275;
                text-transform: uppercase; display: block; margin-bottom: 5px;
            }
            .vbm-auth-field { margin-bottom: 14px; }
            .vbm-auth-input {
                width: 100%; box-sizing: border-box;
                background: rgba(0,212,255,0.03); border: 1px solid #0f2040;
                border-radius: 2px; padding: 9px 11px;
                color: #00d4ff; font-family: 'Share Tech Mono', monospace; font-size: 11px;
                outline: none;
            }
            .vbm-auth-input:focus { border-color: #00d4ff; box-shadow: 0 0 10px rgba(0,212,255,0.2); }
            .vbm-auth-input::placeholder { color: #2a3f5a; }
            #vbm-auth-error {
                font-size: 9px; letter-spacing: 0.15em; color: #ff3c6e;
                min-height: 16px; margin-bottom: 12px; display: block;
                text-align: center;
            }
            #vbm-auth-submit {
                width: 100%; padding: 10px;
                border: 1px solid #00d4ff; border-radius: 2px;
                background: transparent; color: #00d4ff;
                font-family: 'Share Tech Mono', monospace; font-size: 10px;
                letter-spacing: 0.25em; text-transform: uppercase;
                cursor: pointer; transition: all 0.15s;
            }
            #vbm-auth-submit:hover { background: rgba(0,212,255,0.08); box-shadow: 0 0 15px rgba(0,212,255,0.2); }
            #vbm-auth-submit:disabled { opacity: 0.4; cursor: not-allowed; }
            #vbm-auth-loader {
                display: none; text-align: center; margin-top: 10px;
                font-size: 8px; letter-spacing: 0.3em; color: #3a5275;
            }

            /* ── Main panel ── */
            #vbm-panel {
                position: fixed; top: 20px; right: 20px; width: 340px;
                background: #060b14; border: 1px solid #0f2040; border-radius: 3px;
                z-index: 999999; font-family: 'Share Tech Mono', monospace;
                box-shadow: 0 0 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,212,255,0.05);
                user-select: none; display: none;
            }
            #vbm-panel::before {
                content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
                background: linear-gradient(90deg, transparent, #00d4ff, transparent); opacity: 0.6;
            }
            #vbm-header {
                padding: 10px 14px; display: flex; align-items: center;
                justify-content: space-between; border-bottom: 1px solid #0f2040; cursor: move;
            }
            #vbm-title {
                font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 900;
                letter-spacing: 0.2em; color: #00d4ff; text-shadow: 0 0 10px rgba(0,212,255,0.5);
            }
            #vbm-title span { color: #ff3c6e; }
            .vbm-header-btns { display: flex; gap: 6px; align-items: center; }
            #vbm-signout {
                background: none; border: 1px solid #2a1520; border-radius: 2px;
                color: #ff3c6e; cursor: pointer; font-size: 7px;
                letter-spacing: 0.2em; font-family: 'Share Tech Mono', monospace;
                padding: 2px 6px; text-transform: uppercase; opacity: 0.6; transition: all 0.15s;
            }
            #vbm-signout:hover { opacity: 1; border-color: #ff3c6e; background: rgba(255,60,110,0.08); }
            #vbm-toggle {
                background: none; border: none; color: #3a5275; cursor: pointer;
                font-size: 14px; padding: 0 4px; line-height: 1; font-family: monospace;
            }
            #vbm-toggle:hover { color: #00d4ff; }
            #vbm-body { padding: 14px; }
            #vbm-body.collapsed { display: none; }
            .vbm-label {
                font-size: 9px; letter-spacing: 0.3em; color: #3a5275;
                text-transform: uppercase; margin-bottom: 5px; display: block;
            }
            .vbm-field { margin-bottom: 12px; }
            .vbm-input {
                width: 100%; background: rgba(0,212,255,0.03); border: 1px solid #0f2040;
                border-radius: 2px; padding: 8px 10px; color: #00d4ff;
                font-family: 'Share Tech Mono', monospace; font-size: 11px;
                outline: none; box-sizing: border-box;
            }
            .vbm-input:focus { border-color: #00d4ff; box-shadow: 0 0 10px rgba(0,212,255,0.2); }
            .vbm-input::placeholder { color: #3a5275; }
            .vbm-row { display: flex; gap: 8px; margin-bottom: 4px; }
            .vbm-sublabels { display: flex; gap: 8px; margin-bottom: 10px; }
            .vbm-sublabel {
                width: 70px; text-align: center; font-size: 8px;
                letter-spacing: 0.15em; color: #3a5275; flex-shrink: 0;
            }
            .vbm-count {
                width: 70px; background: rgba(0,255,136,0.03); border: 1px solid #0f2040;
                border-radius: 2px; padding: 8px 10px; color: #00ff88;
                font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 700;
                outline: none; text-align: center; flex-shrink: 0;
            }
            .vbm-count:focus { border-color: #00ff88; }
            .vbm-timer-input {
                width: 70px; background: rgba(255,170,0,0.03); border: 1px solid #3a2800;
                border-radius: 2px; padding: 8px 10px; color: #ffaa00;
                font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 700;
                outline: none; text-align: center; flex-shrink: 0;
            }
            .vbm-timer-input:focus { border-color: #ffaa00; }
            .vbm-btn {
                flex: 1; padding: 9px 12px; border: 1px solid; border-radius: 2px;
                font-family: 'Share Tech Mono', monospace; font-size: 10px;
                letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer;
                background: transparent; transition: all 0.15s;
            }
            .vbm-deploy { border-color: #00ff88; color: #00ff88; }
            .vbm-deploy:hover { background: rgba(0,255,136,0.08); box-shadow: 0 0 15px rgba(0,255,136,0.2); }
            .vbm-kill { border-color: #ff3c6e; color: #ff3c6e; }
            .vbm-kill:hover { background: rgba(255,60,110,0.08); box-shadow: 0 0 15px rgba(255,60,110,0.2); }
            .vbm-kill:disabled { opacity: 0.3; cursor: not-allowed; }
            .vbm-cycle-row { display: flex; align-items: center; margin-bottom: 12px; }
            .vbm-cycle-label {
                display: flex; align-items: center; gap: 8px; cursor: pointer;
                font-size: 10px; letter-spacing: 0.2em; color: #3a5275; text-transform: uppercase;
            }
            .vbm-cycle-label input[type="checkbox"] {
                appearance: none; width: 14px; height: 14px; border: 1px solid #3a5275;
                border-radius: 2px; background: transparent; cursor: pointer;
                position: relative; flex-shrink: 0;
            }
            .vbm-cycle-label input[type="checkbox"]:checked { border-color: #00ff88; background: rgba(0,255,136,0.15); }
            .vbm-cycle-label input[type="checkbox"]:checked::after {
                content: 'v'; position: absolute; top: -2px; left: 1px; font-size: 11px; color: #00ff88;
            }
            .vbm-cycle-label input[type="checkbox"]:checked ~ .vbm-cycle-text { color: #00ff88; }
            .vbm-cycle-ind { font-family: 'Orbitron', monospace; font-size: 10px; color: #00ff88; }
            .vbm-stats {
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px;
            }
            .vbm-stat {
                background: rgba(0,212,255,0.03); border: 1px solid #0f2040;
                border-radius: 2px; padding: 8px 6px; text-align: center;
            }
            .vbm-stat-val {
                font-family: 'Orbitron', monospace; font-size: 16px; font-weight: 700;
                display: block; color: #00d4ff;
            }
            .vbm-stat-val.g { color: #00ff88; }
            .vbm-stat-val.r { color: #ff3c6e; }
            .vbm-stat-lbl { font-size: 8px; letter-spacing: 0.2em; color: #3a5275; display: block; margin-top: 2px; }
            #vbm-bot-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
                gap: 5px; max-height: 120px; overflow-y: auto; margin-bottom: 10px;
                scrollbar-width: thin; scrollbar-color: #0f2040 transparent;
            }
            .vbm-bot {
                background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.2);
                border-radius: 2px; padding: 6px 4px; text-align: center; font-size: 9px;
                color: #00ff88; cursor: pointer; position: relative; transition: all 0.15s;
            }
            .vbm-bot:hover { background: rgba(255,60,110,0.08); border-color: rgba(255,60,110,0.3); color: #ff3c6e; }
            .vbm-bot.connecting { color: #00d4ff; border-color: rgba(0,212,255,0.2); background: rgba(0,212,255,0.04); }
            .vbm-bot.dead { color: #ff3c6e; border-color: rgba(255,60,110,0.2); opacity: 0.5; }
            .vbm-bot-id { font-family: 'Orbitron', monospace; font-size: 11px; font-weight: 700; display: block; }
            .vbm-bot-st { font-size: 7px; letter-spacing: 0.1em; color: #3a5275; display: block; }
            .vbm-bot-cd { font-size: 7px; color: #ffaa00; display: block; }
            .vbm-empty {
                grid-column: 1/-1; text-align: center; padding: 16px;
                color: #3a5275; font-size: 9px; letter-spacing: 0.3em;
            }
            #vbm-log {
                height: 90px; overflow-y: auto; font-size: 7px; line-height: 1.7;
                color: #3a5275; border-top: 1px solid #0f2040; padding-top: 8px;
                scrollbar-width: thin; scrollbar-color: #0f2040 transparent;
            }
            .vbm-li.info    { color: #00d4ff; }
            .vbm-li.success { color: #00ff88; }
            .vbm-li.error   { color: #ff3c6e; }
            .vbm-li.warn    { color: #ffaa00; }
            #vbm-user-badge {
                font-size: 7px; letter-spacing: 0.1em; color: #3a5275;
                padding: 2px 8px 6px; text-align: right; border-bottom: 1px solid #060f1a;
            }
            #vbm-user-badge span { color: #00d4ff; }
        `;
        document.head.appendChild(style);
    }

    // ── Auth overlay HTML ─────────────────────────────────────────
    function buildAuthOverlay() {
        var overlay = document.createElement('div');
        overlay.id = 'vbm-auth-overlay';
        overlay.innerHTML = `
            <div id="vbm-auth-box">
                <div id="vbm-auth-header">
                    <div id="vbm-auth-title">VOXIOM <span>BOT</span> MGR</div>
                    <div id="vbm-auth-subtitle">Authentication Required</div>
                </div>
                <div id="vbm-auth-body">
                    <div class="vbm-auth-field">
                        <label class="vbm-auth-label" for="vbm-auth-email">Email</label>
                        <input class="vbm-auth-input" id="vbm-auth-email" type="email" placeholder="you@example.com" autocomplete="email" />
                    </div>
                    <div class="vbm-auth-field">
                        <label class="vbm-auth-label" for="vbm-auth-pass">Password</label>
                        <input class="vbm-auth-input" id="vbm-auth-pass" type="password" placeholder="••••••••" autocomplete="current-password" />
                    </div>
                    <span id="vbm-auth-error"></span>
                    <button id="vbm-auth-submit">ACCESS SYSTEM</button>
                    <div id="vbm-auth-loader">AUTHENTICATING…</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    // ── Main panel HTML ───────────────────────────────────────────
    function buildPanel() {
        var panel = document.createElement('div');
        panel.id = 'vbm-panel';
        panel.innerHTML = `
            <div id="vbm-header">
                <div id="vbm-title">VOXIOM <span>BOT</span> MGR</div>
                <div class="vbm-header-btns">
                    <button id="vbm-signout">SIGN OUT</button>
                    <button id="vbm-toggle">&#8722;</button>
                </div>
            </div>
            <div id="vbm-user-badge">signed in as <span id="vbm-email-display"></span></div>
            <div id="vbm-body">
                <div class="vbm-field">
                    <span class="vbm-label">Server URL</span>
                    <input class="vbm-input" id="vbm-url" type="text"
                        value="wss://game-server-bZetD.voxiom.io:443"
                        placeholder="wss://game-server-XXXXX.voxiom.io:443" />
                </div>
                <div class="vbm-row">
                    <input class="vbm-count"       id="vbm-count" type="number" min="1"  max="50"  value="1"  title="Bot count">
                    <input class="vbm-timer-input" id="vbm-timer" type="number" min="5"  max="300" value="35" title="Seconds per bot">
                    <button class="vbm-btn vbm-deploy" id="vbm-deploy">DEPLOY</button>
                    <button class="vbm-btn vbm-kill"   id="vbm-kill"   disabled>KILL ALL</button>
                </div>
                <div class="vbm-sublabels">
                    <span class="vbm-sublabel">BOTS</span>
                    <span class="vbm-sublabel">SECS/BOT</span>
                </div>
                <div class="vbm-cycle-row">
                    <label class="vbm-cycle-label">
                        <input type="checkbox" id="vbm-cycle">
                        <span class="vbm-cycle-text">CYCLE <span class="vbm-cycle-ind" id="vbm-cycle-ind"></span></span>
                    </label>
                </div>
                <div class="vbm-stats">
                    <div class="vbm-stat">
                        <span class="vbm-stat-val g" id="vbm-active">0</span>
                        <span class="vbm-stat-lbl">ACTIVE</span>
                    </div>
                    <div class="vbm-stat">
                        <span class="vbm-stat-val"   id="vbm-total">0</span>
                        <span class="vbm-stat-lbl">TOTAL</span>
                    </div>
                    <div class="vbm-stat">
                        <span class="vbm-stat-val r" id="vbm-dead">0</span>
                        <span class="vbm-stat-lbl">DEAD</span>
                    </div>
                </div>
                <div id="vbm-bot-grid"><div class="vbm-empty">NO BOTS DEPLOYED</div></div>
                <div id="vbm-log"></div>
            </div>
        `;
        document.body.appendChild(panel);
        return panel;
    }

    // ── Main bootstrap (runs after Firebase loads) ────────────────
    function bootstrap() {
        if (typeof firebase === 'undefined') {
            console.error('[VBM] Firebase SDK not available. Check @require URLs.');
            return;
        }
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }

        injectStyles();

        var overlay = buildAuthOverlay();
        var panel   = buildPanel();
        var auth    = firebase.auth();

        // ── Auth helpers ─────────────────────────────────────────
        function setAuthError(msg) {
            document.getElementById('vbm-auth-error').textContent = msg;
        }
        function setAuthLoading(on) {
            document.getElementById('vbm-auth-submit').disabled = on;
            document.getElementById('vbm-auth-loader').style.display = on ? 'block' : 'none';
        }

        function isAllowed(email) {
            return ALLOWED_EMAILS.map(function(e){ return e.toLowerCase(); })
                                 .indexOf((email || '').toLowerCase()) !== -1;
        }

        function showPanel(user) {
            document.getElementById('vbm-email-display').textContent = user.email;
            overlay.style.display = 'none';
            panel.style.display   = 'block';
        }

        function showOverlay() {
            panel.style.display   = 'none';
            overlay.style.display = 'flex';
            document.getElementById('vbm-auth-email').value = '';
            document.getElementById('vbm-auth-pass').value  = '';
            setAuthError('');
        }

        // ── Firebase auth state listener ─────────────────────────
        auth.onAuthStateChanged(function(user) {
            if (user) {
                if (isAllowed(user.email)) {
                    showPanel(user);
                    initBotManager();
                } else {
                    auth.signOut();
                    showOverlay();
                    setAuthError('ACCESS DENIED — email not on allowlist.');
                }
            } else {
                showOverlay();
            }
        });

        // ── Login form submit ────────────────────────────────────
        document.getElementById('vbm-auth-submit').addEventListener('click', function() {
            var email = document.getElementById('vbm-auth-email').value.trim();
            var pass  = document.getElementById('vbm-auth-pass').value;
            setAuthError('');

            if (!email || !pass) { setAuthError('Enter email and password.'); return; }
            if (!isAllowed(email)) { setAuthError('ACCESS DENIED — email not on allowlist.'); return; }

            setAuthLoading(true);
            auth.signInWithEmailAndPassword(email, pass)
                .then(function() { setAuthLoading(false); })
                .catch(function(err) {
                    setAuthLoading(false);
                    var msg = {
                        'auth/user-not-found':    'No account found for that email.',
                        'auth/wrong-password':    'Incorrect password.',
                        'auth/invalid-email':     'Invalid email address.',
                        'auth/too-many-requests': 'Too many attempts. Try again later.',
                        'auth/user-disabled':     'This account has been disabled.'
                    }[err.code] || err.message;
                    setAuthError(msg);
                });
        });

        // Allow Enter key to submit
        ['vbm-auth-email', 'vbm-auth-pass'].forEach(function(id) {
            document.getElementById(id).addEventListener('keydown', function(e) {
                if (e.key === 'Enter') document.getElementById('vbm-auth-submit').click();
            });
        });

        // ── Sign out ─────────────────────────────────────────────
        document.getElementById('vbm-signout').addEventListener('click', function() {
            auth.signOut();
        });

        // ── Bot manager (only wired up after auth) ────────────────
        var botManagerInited = false;
        function initBotManager() {
            if (botManagerInited) return;
            botManagerInited = true;

            // Drag
            var dragging = false, ox = 0, oy = 0;
            panel.querySelector('#vbm-header').addEventListener('mousedown', function(e) {
                if (e.target.id === 'vbm-toggle' || e.target.id === 'vbm-signout') return;
                dragging = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
            });
            document.addEventListener('mousemove', function(e) {
                if (!dragging) return;
                panel.style.left  = (e.clientX - ox) + 'px';
                panel.style.top   = (e.clientY - oy) + 'px';
                panel.style.right = 'auto';
            });
            document.addEventListener('mouseup', function() { dragging = false; });

            // Collapse
            var collapsed = false;
            document.getElementById('vbm-toggle').addEventListener('click', function() {
                collapsed = !collapsed;
                document.getElementById('vbm-body').className = collapsed ? 'collapsed' : '';
                document.getElementById('vbm-toggle').textContent = collapsed ? '+' : '\u2212';
            });

            // Log
            function log(msg, type) {
                type = type || 'info';
                var el = document.getElementById('vbm-log');
                var line = document.createElement('div');
                line.className = 'vbm-li ' + type;
                line.textContent = '[' + new Date().toTimeString().slice(0,8) + '] ' + msg;
                el.appendChild(line);
                el.scrollTop = el.scrollHeight;
                while (el.children.length > 150) el.removeChild(el.firstChild);
            }

            // State
            var bots = {};
            var botIdCounter = 0;
            var totalDeployed = 0;
            var cycleEnabled = false;

            function updateStats() {
                var vals = Object.values(bots);
                document.getElementById('vbm-active').textContent = vals.filter(function(b){ return b.alive; }).length;
                document.getElementById('vbm-total').textContent  = totalDeployed;
                document.getElementById('vbm-dead').textContent   = vals.filter(function(b){ return !b.alive; }).length;
                document.getElementById('vbm-kill').disabled = vals.length === 0;
            }

            // Bot cards
            function createCard(id) {
                var grid = document.getElementById('vbm-bot-grid');
                var empty = grid.querySelector('.vbm-empty');
                if (empty) empty.remove();
                var card = document.createElement('div');
                card.className = 'vbm-bot connecting';
                card.id = 'vbm-b-' + id;
                card.innerHTML =
                    '<span class="vbm-bot-id">#' + String(id).padStart(2,'0') + '</span>' +
                    '<span class="vbm-bot-st" id="vbm-bs-' + id + '">CONN</span>' +
                    '<span class="vbm-bot-cd" id="vbm-cd-' + id + '"></span>';
                card.addEventListener('click', function(){ killBot(id); });
                grid.appendChild(card);
            }

            function setCardState(id, status, cls) {
                var card = document.getElementById('vbm-b-' + id);
                var st   = document.getElementById('vbm-bs-' + id);
                if (!card) return;
                card.className = 'vbm-bot ' + (cls || '');
                if (st) st.textContent = status;
            }

            function removeCard(id) {
                var c = document.getElementById('vbm-b-' + id);
                if (c) c.remove();
                var grid = document.getElementById('vbm-bot-grid');
                if (!grid.children.length) grid.innerHTML = '<div class="vbm-empty">NO BOTS DEPLOYED</div>';
            }

            // Protocol constants
            var HANDSHAKE    = new Uint8Array([0x03, 0x87, 0x03, 0x02, 0x05]);
            var HEARTBEAT_MS = 2500;
            var TICK_MS      = 50;
            var JUMP_EVERY   = 60;
            var PLACE_AFTER  = 8;

            function createBot(id, url) {
                var bot = {
                    id: id, url: url, ws: null, alive: false, seq: 0,
                    yaw: Math.random() * Math.PI * 2,
                    ht: null, tt: null, killTimer: null, timerStarted: false
                };

                function buildPacket(opts) {
                    opts = opts || {};
                    var isSlot = opts.slot !== undefined;
                    var buf = new ArrayBuffer(isSlot ? 22 : 21);
                    var dv  = new DataView(buf);
                    var u8  = new Uint8Array(buf);
                    dv.setUint8(0, (bot.seq / 0x100000000) >>> 0 & 0xFF);
                    dv.setUint8(1, (bot.seq >>> 24) & 0xFF);
                    dv.setUint8(2, (bot.seq >>> 16) & 0xFF);
                    dv.setUint8(3, (bot.seq >>>  8) & 0xFF);
                    dv.setUint8(4, (bot.seq >>>  0) & 0xFF);
                    u8[5]=0; u8[6]=0; u8[7]=0; u8[8]=0;
                    u8[9]=0xbf; u8[10]=0xc9; u8[11]=0x0f; u8[12]=0xdb;
                    dv.setFloat32(13, bot.yaw, false);
                    u8[17] = 0x7f;
                    u8[18] = 0x7f;
                    if (isSlot)        { u8[19] = 0x01; u8[20] = 0x00; u8[21] = opts.slot & 0xFF; }
                    else if (opts.jump)  { u8[19] = 0x02; u8[20] = 0x03; }
                    else if (opts.place) { u8[19] = 0x00; u8[20] = 0x00; }
                    else                 { u8[19] = 0x00; u8[20] = 0x03; }
                    bot.seq++;
                    return buf;
                }

                var tickCycle = 0;
                function tick() {
                    if (!bot.ws || bot.ws.readyState !== 1) return;
                    bot.yaw += 0.008;
                    if (bot.yaw > Math.PI * 2) bot.yaw -= Math.PI * 2;
                    tickCycle++;
                    var phase = tickCycle % JUMP_EVERY;
                    if (phase === 1)           { bot.ws.send(buildPacket({ jump: true })); }
                    else if (phase === PLACE_AFTER) { bot.ws.send(buildPacket({ place: true })); }
                    else                            { bot.ws.send(buildPacket()); }
                }

                try {
                    bot.ws = new WebSocket(url);
                    bot.ws.binaryType = 'arraybuffer';
                } catch(e) {
                    log('Bot #' + id + ' WS error: ' + e.message, 'error');
                    setCardState(id, 'ERR', 'dead');
                    return bot;
                }

                bot.ws.onopen = function() {
                    bot.alive = true;
                    bot.seq = 0;
                    bot.ws.send(HANDSHAKE.buffer);
                    setCardState(id, 'LIVE', '');
                    log('Bot #' + String(id).padStart(2,'0') + ' connected', 'success');
                    bot.ht = setInterval(function() {
                        if (bot.ws && bot.ws.readyState === 1) bot.ws.send(new Uint8Array([0x06]).buffer);
                    }, HEARTBEAT_MS);
                    setTimeout(function() { bot.tt = setInterval(tick, TICK_MS); }, 600);
                    updateStats();
                };

                bot.ws.onmessage = function(e) {
                    if (!(e.data instanceof ArrayBuffer)) return;
                    if (bot.timerStarted) return;
                    bot.timerStarted = true;
                    bot.ws.send(buildPacket({ slot: 3 }));
                    var secsLeft = Math.max(5, parseInt(document.getElementById('vbm-timer').value) || 35);
                    log('Bot #' + String(id).padStart(2,'0') + ' fully joined — ' + secsLeft + 's timer started', 'success');
                    var cdEl = function() { return document.getElementById('vbm-cd-' + id); };
                    if (cdEl()) cdEl().textContent = secsLeft + 's';
                    bot.killTimer = setInterval(function() {
                        secsLeft--;
                        var el = cdEl();
                        if (el) el.textContent = secsLeft > 0 ? secsLeft + 's' : 'BYE';
                        if (secsLeft <= 0) { clearInterval(bot.killTimer); killBot(id); }
                    }, 1000);
                };

                bot.ws.onerror = function() {
                    log('Bot #' + String(id).padStart(2,'0') + ' socket error', 'error');
                };

                bot.ws.onclose = function(e) {
                    bot.alive = false;
                    clearInterval(bot.ht);
                    clearInterval(bot.tt);
                    setCardState(id, 'DEAD', 'dead');
                    log('Bot #' + String(id).padStart(2,'0') + ' closed (' + e.code + ')', 'warn');
                    updateStats();
                };

                bot.kill = function() {
                    clearInterval(bot.ht);
                    clearInterval(bot.tt);
                    clearInterval(bot.killTimer);
                    if (bot.ws) bot.ws.close();
                    bot.alive = false;
                };

                return bot;
            }

            function deployBot(url) {
                var id = ++botIdCounter;
                totalDeployed++;
                createCard(id);
                bots[id] = createBot(id, url);
                updateStats();
            }

            function killBot(id) {
                if (!bots[id]) return;
                bots[id].kill();
                log('Bot #' + String(id).padStart(2,'0') + ' left', 'warn');
                delete bots[id];
                removeCard(id);
                updateStats();
                if (cycleEnabled) {
                    var url = document.getElementById('vbm-url').value.trim();
                    if (url.startsWith('wss://')) {
                        log('Cycle: redeploying...', 'info');
                        setTimeout(function() { deployBot(url); }, 500);
                    }
                }
            }

            document.getElementById('vbm-deploy').addEventListener('click', function() {
                var url   = document.getElementById('vbm-url').value.trim();
                var count = Math.max(1, Math.min(50, parseInt(document.getElementById('vbm-count').value) || 1));
                if (!url.startsWith('wss://')) { log('URL must start with wss://', 'error'); return; }
                log('Deploying ' + count + ' bot(s)', 'info');
                for (var i = 0; i < count; i++) {
                    (function(delay){ setTimeout(function(){ deployBot(url); }, delay); })(i * 250);
                }
            });

            document.getElementById('vbm-kill').addEventListener('click', function() {
                var ids = Object.keys(bots);
                if (!ids.length) return;
                log('Force killing all ' + ids.length + ' bot(s)', 'error');
                ids.forEach(function(id) { bots[id].kill(); removeCard(id); delete bots[id]; });
                updateStats();
            });

            document.getElementById('vbm-cycle').addEventListener('change', function() {
                cycleEnabled = this.checked;
                document.getElementById('vbm-cycle-ind').textContent = cycleEnabled ? '●' : '';
                log(cycleEnabled ? 'Cycle ON — bots redeploy after timer expires' : 'Cycle OFF', cycleEnabled ? 'success' : 'warn');
            });

            log('Bot Manager v4.1 loaded.', 'success');
        } // end initBotManager
    } // end bootstrap

})();
