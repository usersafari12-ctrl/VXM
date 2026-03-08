const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));

// ─── Admin Panel HTML ─────────────────────────────────────────────────────────
const ADMIN_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>LicenseForge \u2014 Admin</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap\" rel=\"stylesheet\">\n<style>\n  :root {\n    --bg: #0a0a0f; --surface: #111118; --surface2: #18181f;\n    --border: #2a2a38; --accent: #7c3aed; --accent2: #06b6d4;\n    --accent3: #f59e0b; --danger: #ef4444; --success: #10b981;\n    --text: #e2e8f0; --muted: #64748b;\n    --mono: 'Space Mono', monospace; --sans: 'Syne', sans-serif;\n  }\n  * { margin:0; padding:0; box-sizing:border-box; }\n  body { background:var(--bg); color:var(--text); font-family:var(--sans); min-height:100vh; overflow-x:hidden; }\n  body::before {\n    content:''; position:fixed; inset:0; pointer-events:none; z-index:0;\n    background-image: linear-gradient(rgba(124,58,237,0.03) 1px,transparent 1px), linear-gradient(90deg,rgba(124,58,237,0.03) 1px,transparent 1px);\n    background-size:40px 40px;\n  }\n\n  /* LOGIN */\n  #login-screen { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:100; background:var(--bg); }\n  .login-box { background:var(--surface); border:1px solid var(--border); border-top:2px solid var(--accent); padding:48px; width:420px; position:relative; }\n  .login-box::before { content:''; position:absolute; top:-2px; left:-1px; right:-1px; height:2px; background:linear-gradient(90deg,var(--accent),var(--accent2)); }\n  .login-logo { font-size:28px; font-weight:800; letter-spacing:-1px; margin-bottom:8px; background:linear-gradient(135deg,var(--accent),var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }\n  .login-sub { color:var(--muted); font-size:13px; margin-bottom:36px; font-family:var(--mono); }\n\n  /* FORMS */\n  .field-group { margin-bottom:20px; }\n  .field-group label { display:block; font-size:11px; font-family:var(--mono); color:var(--muted); text-transform:uppercase; letter-spacing:2px; margin-bottom:8px; }\n  .field-group input, .field-group select, .field-group textarea { width:100%; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:10px 14px; font-family:var(--mono); font-size:13px; outline:none; transition:border-color 0.2s; }\n  .field-group input:focus, .field-group select:focus, .field-group textarea:focus { border-color:var(--accent); }\n  .field-group textarea { resize:vertical; min-height:80px; }\n  .field-group select { cursor:pointer; }\n  .field-group select option { background:var(--surface); }\n\n  /* BUTTONS */\n  .btn { display:inline-flex; align-items:center; gap:8px; padding:10px 20px; font-family:var(--mono); font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; border:none; cursor:pointer; transition:all 0.15s; }\n  .btn-primary { background:var(--accent); color:#fff; }\n  .btn-primary:hover { background:#6d28d9; }\n  .btn-secondary { background:transparent; color:var(--text); border:1px solid var(--border); }\n  .btn-secondary:hover { border-color:var(--accent); color:var(--accent); }\n  .btn-danger { background:transparent; color:var(--danger); border:1px solid var(--danger); }\n  .btn-danger:hover { background:var(--danger); color:#fff; }\n  .btn-success { background:var(--success); color:#fff; }\n  .btn-success:hover { background:#059669; }\n  .btn-full { width:100%; justify-content:center; }\n  .btn-sm { padding:6px 12px; font-size:10px; }\n  .error-msg { background:rgba(239,68,68,0.1); border:1px solid var(--danger); color:var(--danger); padding:10px 14px; font-family:var(--mono); font-size:12px; margin-top:12px; display:none; }\n\n  /* LAYOUT */\n  #app { display:none; min-height:100vh; position:relative; z-index:1; }\n  .sidebar { position:fixed; left:0; top:0; bottom:0; width:220px; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; z-index:10; }\n  .sidebar-logo { padding:24px 20px; border-bottom:1px solid var(--border); font-weight:800; font-size:18px; letter-spacing:-0.5px; background:linear-gradient(135deg,var(--accent),var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }\n  .sidebar-tag { font-family:var(--mono); font-size:9px; color:var(--muted); -webkit-text-fill-color:var(--muted); display:block; margin-top:2px; letter-spacing:2px; }\n  .nav-section { padding:16px 0; border-bottom:1px solid var(--border); }\n  .nav-label { font-size:9px; font-family:var(--mono); color:var(--muted); text-transform:uppercase; letter-spacing:2px; padding:0 20px 8px; }\n  .nav-item { display:flex; align-items:center; gap:10px; padding:9px 20px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; transition:all 0.15s; border-left:2px solid transparent; }\n  .nav-item:hover { color:var(--text); background:var(--surface2); }\n  .nav-item.active { color:var(--accent); border-left-color:var(--accent); background:rgba(124,58,237,0.08); }\n  .nav-item .icon { font-size:15px; width:18px; text-align:center; }\n  .sidebar-footer { margin-top:auto; padding:16px 20px; border-top:1px solid var(--border); font-family:var(--mono); font-size:10px; color:var(--muted); }\n  .status-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--success); margin-right:6px; animation:pulse 2s infinite; }\n  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }\n  .main { margin-left:220px; padding:32px; min-height:100vh; }\n  .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; }\n  .page-title { font-size:24px; font-weight:800; letter-spacing:-0.5px; }\n  .page-sub { font-family:var(--mono); font-size:11px; color:var(--muted); margin-top:3px; }\n\n  /* STATS */\n  .stats-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:16px; margin-bottom:28px; }\n  .stat-card { background:var(--surface); border:1px solid var(--border); padding:20px; position:relative; overflow:hidden; }\n  .stat-card::after { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--accent),transparent); }\n  .stat-label { font-family:var(--mono); font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:2px; margin-bottom:10px; }\n  .stat-value { font-size:32px; font-weight:800; letter-spacing:-1px; font-family:var(--mono); }\n  .stat-sub { font-size:11px; color:var(--muted); margin-top:4px; font-family:var(--mono); }\n  .stat-accent { color:var(--accent); } .stat-success { color:var(--success); } .stat-danger { color:var(--danger); } .stat-warning { color:var(--accent3); } .stat-cyan { color:var(--accent2); }\n\n  /* CARDS & TABLES */\n  .card { background:var(--surface); border:1px solid var(--border); margin-bottom:20px; }\n  .card-header { padding:16px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }\n  .card-title { font-size:14px; font-weight:700; letter-spacing:0.5px; }\n  .card-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }\n  .search-input { background:var(--bg); border:1px solid var(--border); color:var(--text); padding:7px 12px; font-family:var(--mono); font-size:12px; outline:none; width:220px; transition:border-color 0.2s; }\n  .search-input:focus { border-color:var(--accent); }\n  table { width:100%; border-collapse:collapse; font-size:12px; }\n  th { padding:10px 16px; text-align:left; font-family:var(--mono); font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:2px; border-bottom:1px solid var(--border); background:var(--surface2); white-space:nowrap; }\n  td { padding:12px 16px; border-bottom:1px solid rgba(42,42,56,0.5); font-family:var(--mono); font-size:11px; vertical-align:middle; }\n  tr:last-child td { border-bottom:none; }\n  tr:hover td { background:rgba(124,58,237,0.04); }\n\n  .badge { display:inline-block; padding:2px 8px; font-size:9px; font-family:var(--mono); font-weight:700; letter-spacing:1px; text-transform:uppercase; border:1px solid; }\n  .badge-active { color:var(--success); border-color:var(--success); background:rgba(16,185,129,0.08); }\n  .badge-revoked { color:var(--danger); border-color:var(--danger); background:rgba(239,68,68,0.08); }\n  .badge-expired { color:var(--muted); border-color:var(--muted); }\n  .badge-online { color:var(--accent2); border-color:var(--accent2); background:rgba(6,182,212,0.08); }\n  .badge-offline { color:var(--muted); border-color:var(--muted); }\n  .badge-script { color:var(--accent); border-color:var(--accent); background:rgba(124,58,237,0.08); }\n\n  .key-display { font-family:var(--mono); font-size:11px; color:var(--accent2); cursor:pointer; transition:color 0.15s; }\n  .key-display:hover { color:var(--accent); }\n  .copy-btn { background:none; border:none; color:var(--muted); cursor:pointer; font-size:12px; padding:0 4px; transition:color 0.15s; }\n  .copy-btn:hover { color:var(--accent); }\n\n  /* SCRIPTS GRID */\n  .scripts-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; margin-bottom:20px; }\n  .script-card { background:var(--surface); border:1px solid var(--border); padding:20px; position:relative; overflow:hidden; transition:border-color 0.2s; }\n  .script-card:hover { border-color:var(--accent); }\n  .script-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--accent),var(--accent2)); }\n  .script-name { font-size:15px; font-weight:700; margin-bottom:4px; }\n  .script-id { font-family:var(--mono); font-size:10px; color:var(--accent2); margin-bottom:8px; }\n  .script-desc { font-size:12px; color:var(--muted); margin-bottom:16px; min-height:32px; }\n  .script-meta { display:flex; gap:12px; font-family:var(--mono); font-size:10px; color:var(--muted); margin-bottom:16px; }\n  .script-actions { display:flex; gap:8px; }\n\n  /* VERSIONS */\n  .versions-list { padding:12px 20px; }\n  .version-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); }\n  .version-row:last-child { border-bottom:none; }\n  .version-num { font-family:var(--mono); font-size:12px; color:var(--accent2); width:60px; flex-shrink:0; }\n  .version-url { font-family:var(--mono); font-size:10px; color:var(--muted); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n  .version-actions { display:flex; gap:6px; flex-shrink:0; }\n\n  /* MODAL */\n  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:50; display:none; align-items:center; justify-content:center; backdrop-filter:blur(4px); }\n  .modal-overlay.open { display:flex; }\n  .modal { background:var(--surface); border:1px solid var(--border); border-top:2px solid var(--accent); width:500px; max-width:90vw; max-height:85vh; overflow-y:auto; }\n  .modal-header { padding:20px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }\n  .modal-title { font-size:16px; font-weight:700; }\n  .modal-close { background:none; border:none; color:var(--muted); font-size:20px; cursor:pointer; transition:color 0.15s; }\n  .modal-close:hover { color:var(--text); }\n  .modal-body { padding:24px; }\n  .modal-footer { padding:16px 24px; border-top:1px solid var(--border); display:flex; gap:10px; justify-content:flex-end; }\n\n  /* CHART */\n  .chart-container { height:180px; display:flex; align-items:flex-end; gap:6px; padding:20px; }\n  .chart-bar-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; justify-content:flex-end; }\n  .chart-bar { width:100%; background:linear-gradient(180deg,var(--accent),rgba(124,58,237,0.3)); transition:height 0.5s cubic-bezier(0.34,1.56,0.64,1); min-height:2px; }\n  .chart-label { font-family:var(--mono); font-size:8px; color:var(--muted); white-space:nowrap; }\n\n  /* TOAST */\n  #toast-container { position:fixed; bottom:24px; right:24px; z-index:999; display:flex; flex-direction:column; gap:8px; }\n  .toast { padding:12px 20px; font-family:var(--mono); font-size:12px; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--success); animation:slideIn 0.2s ease; min-width:260px; }\n  .toast.error { border-left-color:var(--danger); }\n  @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }\n\n  .tab-page { display:none; } .tab-page.active { display:block; }\n  .flex { display:flex; } .gap-2 { gap:8px; } .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }\n  .text-muted { color:var(--muted); } .text-mono { font-family:var(--mono); font-size:11px; }\n  .mt-4 { margin-top:16px; }\n  .empty-state { text-align:center; padding:48px; color:var(--muted); font-family:var(--mono); font-size:12px; }\n\n  @media(max-width:900px) {\n    .stats-grid { grid-template-columns:repeat(2,1fr); }\n    .sidebar { width:180px; } .main { margin-left:180px; padding:20px; }\n    .grid-2 { grid-template-columns:1fr; }\n  }\n</style>\n</head>\n<body>\n\n<!-- LOGIN -->\n<div id=\"login-screen\">\n  <div class=\"login-box\">\n    <div class=\"login-logo\">LicenseForge</div>\n    <div class=\"login-sub\">// ADMIN CONSOLE v2.0.0</div>\n    <div class=\"field-group\">\n      <label>Backend URL</label>\n      <input type=\"text\" id=\"login-url\" placeholder=\"https://your-app.onrender.com\" />\n    </div>\n    <div class=\"field-group\">\n      <label>Admin Key</label>\n      <input type=\"password\" id=\"login-key\" placeholder=\"Your ADMIN_KEY\" />\n    </div>\n    <button class=\"btn btn-primary btn-full\" onclick=\"doLogin()\">\u26a1 Connect</button>\n    <div class=\"error-msg\" id=\"login-error\"></div>\n  </div>\n</div>\n\n<!-- APP -->\n<div id=\"app\">\n  <aside class=\"sidebar\">\n    <div class=\"sidebar-logo\">LicenseForge<span class=\"sidebar-tag\">// ADMIN v2</span></div>\n    <div class=\"nav-section\">\n      <div class=\"nav-label\">Overview</div>\n      <div class=\"nav-item active\" onclick=\"showTab('dashboard',this)\"><span class=\"icon\">\ud83d\udcca</span> Dashboard</div>\n      <div class=\"nav-item\" onclick=\"showTab('analytics',this)\"><span class=\"icon\">\ud83d\udcc8</span> Analytics</div>\n    </div>\n    <div class=\"nav-section\">\n      <div class=\"nav-label\">Products</div>\n      <div class=\"nav-item\" onclick=\"showTab('scripts',this)\"><span class=\"icon\">\ud83d\udce6</span> Scripts</div>\n      <div class=\"nav-item\" onclick=\"showTab('licenses',this)\"><span class=\"icon\">\ud83d\udd11</span> Licenses</div>\n      <div class=\"nav-item\" onclick=\"showTab('sessions',this)\"><span class=\"icon\">\ud83d\udc65</span> Sessions</div>\n    </div>\n    <div class=\"sidebar-footer\">\n      <span class=\"status-dot\"></span>Connected\n      <div style=\"margin-top:8px;\" id=\"sidebar-url\" class=\"text-muted\"></div>\n    </div>\n  </aside>\n\n  <main class=\"main\">\n\n    <!-- DASHBOARD -->\n    <div id=\"tab-dashboard\" class=\"tab-page active\">\n      <div class=\"page-header\">\n        <div><div class=\"page-title\">Dashboard</div><div class=\"page-sub\">// Real-time overview</div></div>\n        <button class=\"btn btn-secondary\" onclick=\"loadAll()\">\u27f3 Refresh</button>\n      </div>\n      <div class=\"stats-grid\">\n        <div class=\"stat-card\"><div class=\"stat-label\">Scripts</div><div class=\"stat-value stat-cyan\" id=\"stat-scripts\">\u2014</div><div class=\"stat-sub\">products</div></div>\n        <div class=\"stat-card\"><div class=\"stat-label\">Total Licenses</div><div class=\"stat-value stat-accent\" id=\"stat-total\">\u2014</div><div class=\"stat-sub\">all time</div></div>\n        <div class=\"stat-card\"><div class=\"stat-label\">Active</div><div class=\"stat-value stat-success\" id=\"stat-active\">\u2014</div><div class=\"stat-sub\">valid keys</div></div>\n        <div class=\"stat-card\"><div class=\"stat-label\">Live Sessions</div><div class=\"stat-value stat-warning\" id=\"stat-sessions\">\u2014</div><div class=\"stat-sub\">last 5 min</div></div>\n        <div class=\"stat-card\"><div class=\"stat-label\">Failed Auths</div><div class=\"stat-value stat-danger\" id=\"stat-failed\">\u2014</div><div class=\"stat-sub\">blocked</div></div>\n      </div>\n      <div class=\"card\">\n        <div class=\"card-header\"><div class=\"card-title\">Recent Auth Events</div><button class=\"btn btn-secondary btn-sm\" onclick=\"loadStats()\">\u27f3</button></div>\n        <table><thead><tr><th>Time</th><th>Type</th><th>Script</th><th>Key</th><th>Reason</th><th>IP</th></tr></thead>\n        <tbody id=\"events-table\"><tr><td colspan=\"6\" class=\"empty-state\">Loading...</td></tr></tbody></table>\n      </div>\n    </div>\n\n    <!-- ANALYTICS -->\n    <div id=\"tab-analytics\" class=\"tab-page\">\n      <div class=\"page-header\"><div><div class=\"page-title\">Analytics</div><div class=\"page-sub\">// 7-day activity</div></div></div>\n      <div class=\"card\">\n        <div class=\"card-header\"><div class=\"card-title\">Daily Validations</div></div>\n        <div class=\"chart-container\" id=\"chart-container\"><div class=\"empty-state\">No data yet</div></div>\n      </div>\n      <div class=\"grid-2\">\n        <div class=\"card\"><div class=\"card-header\"><div class=\"card-title\">Success Rate</div></div>\n          <div style=\"padding:24px;text-align:center;\"><div class=\"stat-value stat-success\" id=\"success-rate\">\u2014</div><div class=\"stat-sub\">passing</div></div></div>\n        <div class=\"card\"><div class=\"card-header\"><div class=\"card-title\">Total Requests</div></div>\n          <div style=\"padding:24px;text-align:center;\"><div class=\"stat-value stat-accent\" id=\"total-requests\">\u2014</div><div class=\"stat-sub\">all time</div></div></div>\n      </div>\n    </div>\n\n    <!-- SCRIPTS -->\n    <div id=\"tab-scripts\" class=\"tab-page\">\n      <div class=\"page-header\">\n        <div><div class=\"page-title\">Scripts</div><div class=\"page-sub\">// Manage your products & versions</div></div>\n        <button class=\"btn btn-primary\" onclick=\"openModal('new-script-modal')\">+ New Script</button>\n      </div>\n      <div class=\"scripts-grid\" id=\"scripts-grid\"><div class=\"empty-state\">Loading...</div></div>\n    </div>\n\n    <!-- LICENSES -->\n    <div id=\"tab-licenses\" class=\"tab-page\">\n      <div class=\"page-header\">\n        <div><div class=\"page-title\">License Keys</div><div class=\"page-sub\">// Manage access keys</div></div>\n        <div class=\"flex gap-2\">\n          <button class=\"btn btn-secondary\" onclick=\"openModal('bulk-modal')\">\u26a1 Bulk Create</button>\n          <button class=\"btn btn-primary\" onclick=\"openModal('create-modal')\">+ New Key</button>\n        </div>\n      </div>\n      <div class=\"card\">\n        <div class=\"card-header\">\n          <div class=\"card-title\" id=\"license-count\">Keys</div>\n          <div class=\"card-actions\">\n            <input class=\"search-input\" type=\"text\" id=\"license-search\" placeholder=\"Search keys...\" oninput=\"filterLicenses()\">\n            <select class=\"search-input\" style=\"width:160px;\" id=\"license-filter-script\" onchange=\"filterLicenses()\">\n              <option value=\"\">All Scripts</option>\n            </select>\n            <select class=\"search-input\" style=\"width:120px;\" id=\"license-filter-status\" onchange=\"filterLicenses()\">\n              <option value=\"\">All Status</option>\n              <option value=\"active\">Active</option>\n              <option value=\"revoked\">Revoked</option>\n              <option value=\"expired\">Expired</option>\n            </select>\n          </div>\n        </div>\n        <table><thead><tr><th>Key</th><th>Script</th><th>Status</th><th>Locked IP</th><th>Expires</th><th>Uses</th><th>Last Used</th><th>Note</th><th>Actions</th></tr></thead>\n        <tbody id=\"licenses-table\"><tr><td colspan=\"8\" class=\"empty-state\">Loading...</td></tr></tbody></table>\n      </div>\n    </div>\n\n    <!-- SESSIONS -->\n    <div id=\"tab-sessions\" class=\"tab-page\">\n      <div class=\"page-header\">\n        <div><div class=\"page-title\">Active Sessions</div><div class=\"page-sub\">// Users currently online</div></div>\n        <button class=\"btn btn-secondary\" onclick=\"loadSessions()\">\u27f3 Refresh</button>\n      </div>\n      <div class=\"card\">\n        <div class=\"card-header\"><div class=\"card-title\" id=\"sessions-count\">Sessions</div></div>\n        <table><thead><tr><th>Session ID</th><th>License Key</th><th>Script</th><th>IP</th><th>Started</th><th>Last Ping</th><th>Status</th><th>Actions</th></tr></thead>\n        <tbody id=\"sessions-table\"><tr><td colspan=\"8\" class=\"empty-state\">Loading...</td></tr></tbody></table>\n      </div>\n    </div>\n\n  </main>\n</div>\n\n<!-- MODALS -->\n\n<!-- New Script -->\n<div class=\"modal-overlay\" id=\"new-script-modal\">\n  <div class=\"modal\">\n    <div class=\"modal-header\"><div class=\"modal-title\">New Script Product</div><button class=\"modal-close\" onclick=\"closeModal('new-script-modal')\">\u00d7</button></div>\n    <div class=\"modal-body\">\n      <div class=\"field-group\"><label>Script ID (slug, no spaces)</label><input type=\"text\" id=\"ns-id\" placeholder=\"my-script\" /></div>\n      <div class=\"field-group\"><label>Name</label><input type=\"text\" id=\"ns-name\" placeholder=\"My Awesome Script\" /></div>\n      <div class=\"field-group\"><label>Description</label><input type=\"text\" id=\"ns-desc\" placeholder=\"What does this script do?\" /></div>\n    </div>\n    <div class=\"modal-footer\">\n      <button class=\"btn btn-secondary\" onclick=\"closeModal('new-script-modal')\">Cancel</button>\n      <button class=\"btn btn-primary\" onclick=\"createScript()\">Create Script</button>\n    </div>\n  </div>\n</div>\n\n<!-- Deploy Version -->\n<div class=\"modal-overlay\" id=\"version-modal\">\n  <div class=\"modal\">\n    <div class=\"modal-header\"><div class=\"modal-title\">Deploy Version \u2014 <span id=\"version-modal-script\"></span></div><button class=\"modal-close\" onclick=\"closeModal('version-modal')\">\u00d7</button></div>\n    <div class=\"modal-body\">\n      <input type=\"hidden\" id=\"version-script-id\">\n      <div class=\"field-group\"><label>Version Number</label><input type=\"text\" id=\"version-num\" placeholder=\"1.2.0\" /></div>\n      <div class=\"field-group\"><label>Script URL (CDN)</label><input type=\"text\" id=\"version-url\" placeholder=\"https://cdn.example.com/script.js\" /></div>\n      <div class=\"field-group\"><label>Changelog</label><textarea id=\"version-changelog\" placeholder=\"What changed...\"></textarea></div>\n    </div>\n    <div class=\"modal-footer\">\n      <button class=\"btn btn-secondary\" onclick=\"closeModal('version-modal')\">Cancel</button>\n      <button class=\"btn btn-primary\" onclick=\"deployVersion()\">\ud83d\ude80 Deploy</button>\n    </div>\n  </div>\n</div>\n\n<!-- Create License -->\n<div class=\"modal-overlay\" id=\"create-modal\">\n  <div class=\"modal\">\n    <div class=\"modal-header\"><div class=\"modal-title\">Create License Key</div><button class=\"modal-close\" onclick=\"closeModal('create-modal')\">\u00d7</button></div>\n    <div class=\"modal-body\">\n      <div class=\"field-group\"><label>Script (product)</label>\n        <select id=\"create-script\"><option value=\"\">\u2014 Any script \u2014</option></select></div>\n      <div class=\"field-group\"><label>Expiry (days)</label><input type=\"number\" id=\"create-days\" placeholder=\"30 (leave empty = never)\" /></div>\n      <div class=\"field-group\"><label>Note</label><input type=\"text\" id=\"create-note\" placeholder=\"Customer name, order ID...\" /></div>\n      <div class=\"field-group\"><label>IP Whitelist (comma-separated)</label><input type=\"text\" id=\"create-ips\" placeholder=\"leave empty = allow all\" /></div>\n    </div>\n    <div class=\"modal-footer\">\n      <button class=\"btn btn-secondary\" onclick=\"closeModal('create-modal')\">Cancel</button>\n      <button class=\"btn btn-primary\" onclick=\"createLicense()\">Create Key</button>\n    </div>\n  </div>\n</div>\n\n<!-- Bulk Create -->\n<div class=\"modal-overlay\" id=\"bulk-modal\">\n  <div class=\"modal\">\n    <div class=\"modal-header\"><div class=\"modal-title\">Bulk Create Keys</div><button class=\"modal-close\" onclick=\"closeModal('bulk-modal')\">\u00d7</button></div>\n    <div class=\"modal-body\">\n      <div class=\"field-group\"><label>Script (product)</label>\n        <select id=\"bulk-script\"><option value=\"\">\u2014 Any script \u2014</option></select></div>\n      <div class=\"field-group\"><label>Count (max 100)</label><input type=\"number\" id=\"bulk-count\" value=\"10\" min=\"1\" max=\"100\" /></div>\n      <div class=\"field-group\"><label>Expiry (days)</label><input type=\"number\" id=\"bulk-days\" placeholder=\"30 (leave empty = never)\" /></div>\n      <div class=\"field-group\"><label>Note</label><input type=\"text\" id=\"bulk-note\" placeholder=\"Batch label...\" /></div>\n      <div id=\"bulk-result\" style=\"display:none;\" class=\"mt-4\">\n        <div class=\"field-group\"><label>Generated Keys</label>\n          <textarea id=\"bulk-keys-output\" readonly style=\"height:200px;font-size:11px;\"></textarea></div>\n      </div>\n    </div>\n    <div class=\"modal-footer\">\n      <button class=\"btn btn-secondary\" onclick=\"closeModal('bulk-modal')\">Close</button>\n      <button class=\"btn btn-primary\" onclick=\"bulkCreate()\">Generate</button>\n    </div>\n  </div>\n</div>\n\n<div id=\"toast-container\"></div>\n\n<script>\n  let API_URL = '', ADMIN_KEY = '', licensesData = [], scriptsData = [];\n\n  // \u2500\u2500 Auth \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  async function doLogin() {\n    const url = document.getElementById('login-url').value.trim().replace(/\\/$/, '');\n    const key = document.getElementById('login-key').value.trim();\n    const err = document.getElementById('login-error');\n    if (!url || !key) { showErr(err, 'Fill in all fields'); return; }\n    try {\n      const res = await fetch(`${url}/admin/stats`, { headers: { 'x-admin-key': key } });\n      if (!res.ok) { showErr(err, 'Invalid admin key or server error'); return; }\n      API_URL = url; ADMIN_KEY = key;\n      document.getElementById('sidebar-url').textContent = url.replace('https://', '');\n      document.getElementById('login-screen').style.display = 'none';\n      document.getElementById('app').style.display = 'block';\n      loadAll();\n    } catch(e) { showErr(err, 'Cannot connect \u2014 check URL'); }\n  }\n\n  function showErr(el, msg) { el.textContent = '\u26a0 ' + msg; el.style.display = 'block'; }\n\n  async function api(method, path, body) {\n    const opts = { method, headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY } };\n    if (body) opts.body = JSON.stringify(body);\n    const res = await fetch(API_URL + path, opts);\n    return res.json();\n  }\n\n  // \u2500\u2500 Navigation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  function showTab(name, el) {\n    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));\n    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));\n    document.getElementById('tab-' + name).classList.add('active');\n    if (el) el.classList.add('active');\n    if (name === 'dashboard') loadAll();\n    if (name === 'scripts') loadScripts();\n    if (name === 'licenses') loadLicenses();\n    if (name === 'sessions') loadSessions();\n    if (name === 'analytics') loadStats();\n  }\n\n  async function loadAll() { await Promise.all([loadStats(), loadScripts(), loadLicenses(), loadSessions()]); }\n\n  // \u2500\u2500 Stats \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  async function loadStats() {\n    const data = await api('GET', '/admin/stats');\n    if (!data.success) return;\n    const s = data.stats;\n    document.getElementById('stat-scripts').textContent = s.total_scripts || 0;\n    document.getElementById('stat-total').textContent = s.total_licenses;\n    document.getElementById('stat-active').textContent = s.active_licenses;\n    document.getElementById('stat-sessions').textContent = s.active_sessions;\n    document.getElementById('stat-failed').textContent = s.failed_validations;\n    const total = s.total_validations + s.failed_validations;\n    const sr = document.getElementById('success-rate');\n    if (sr) sr.textContent = total > 0 ? Math.round(s.total_validations/total*100)+'%' : '\u2014';\n    const tr = document.getElementById('total-requests');\n    if (tr) tr.textContent = total;\n    const tbody = document.getElementById('events-table');\n    if (s.recent_events && s.recent_events.length) {\n      tbody.innerHTML = s.recent_events.map(e => `<tr>\n        <td>${new Date(e.timestamp).toLocaleTimeString()}</td>\n        <td><span class=\"badge ${e.type==='success'?'badge-active':'badge-revoked'}\">${e.type}</span></td>\n        <td class=\"text-muted\">${e.script_id||'\u2014'}</td>\n        <td class=\"key-display\">${e.key?e.key.slice(0,9)+'...':'\u2014'}</td>\n        <td class=\"text-muted\">${e.reason||'\u2713 OK'}</td>\n        <td>${e.ip||'\u2014'}</td></tr>`).join('');\n    } else { tbody.innerHTML = '<tr><td colspan=\"6\" class=\"empty-state\">No events yet</td></tr>'; }\n    renderChart(s.daily_activity || []);\n  }\n\n  function renderChart(data) {\n    const c = document.getElementById('chart-container');\n    if (!c) return;\n    if (!data.length) { c.innerHTML = '<div class=\"empty-state\">No data yet</div>'; return; }\n    const max = Math.max(...data.map(d => d.count), 1);\n    c.innerHTML = data.map(d => `<div class=\"chart-bar-wrap\">\n      <div style=\"font-family:var(--mono);font-size:9px;color:var(--accent)\">${d.count}</div>\n      <div class=\"chart-bar\" style=\"height:${(d.count/max)*100}%\"></div>\n      <div class=\"chart-label\">${d.date.slice(5)}</div></div>`).join('');\n  }\n\n  // \u2500\u2500 Scripts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  async function loadScripts() {\n    const data = await api('GET', '/admin/scripts');\n    if (!data.success) return;\n    scriptsData = data.scripts;\n    renderScripts(scriptsData);\n    populateScriptDropdowns(scriptsData);\n  }\n\n  function populateScriptDropdowns(scripts) {\n    ['create-script','bulk-script','license-filter-script'].forEach(id => {\n      const el = document.getElementById(id);\n      if (!el) return;\n      const isFilter = id === 'license-filter-script';\n      const firstOpt = isFilter ? '<option value=\"\">All Scripts</option>' : '<option value=\"\">\u2014 Any script \u2014</option>';\n      el.innerHTML = firstOpt + scripts.map(s => `<option value=\"${s.id}\">${s.name}</option>`).join('');\n    });\n  }\n\n  function renderScripts(scripts) {\n    const grid = document.getElementById('scripts-grid');\n    if (!scripts.length) { grid.innerHTML = '<div class=\"empty-state\">No scripts yet \u2014 create one above</div>'; return; }\n    grid.innerHTML = scripts.map(s => {\n      const activeVer = s.versions.find(v => v.active);\n      const verCount = s.versions.length;\n      const versionsHtml = s.versions.length ? s.versions.map(v => `\n        <div class=\"version-row\">\n          <span class=\"version-num\">v${v.version}</span>\n          <span class=\"version-url\" title=\"${v.url}\">${v.url}</span>\n          <span style=\"font-family:var(--mono);font-size:9px;flex-shrink:0;\">${v.active ? '<span style=\\'color:var(--success)\\'>\u25cf live</span>' : ''}</span>\n          ${!v.active ? `<button class=\"btn btn-success btn-sm\" data-script=\"${s.id}\" data-version=\"${v.version}\" onclick=\"activateVersion(this)\">Set Live</button>` : ''}\n        </div>`).join('') : '<div style=\"padding:12px 0;color:var(--muted);font-size:11px;font-family:var(--mono);\">No versions yet</div>';\n      return `<div class=\"script-card\">\n        <div class=\"script-name\">${s.name}</div>\n        <div class=\"script-id\">ID: ${s.id}</div>\n        <div class=\"script-desc\">${s.description || 'No description'}</div>\n        <div class=\"script-meta\">\n          <span>\ud83d\udce6 ${verCount} version${verCount!==1?'s':''}</span>\n          <span>${activeVer ? '\ud83d\udfe2 v'+activeVer.version+' live' : '\u26a0 No active version'}</span>\n        </div>\n        <div class=\"script-actions\" style=\"margin-bottom:12px;\">\n          <button class=\"btn btn-primary btn-sm\" data-script=\"${s.id}\" data-name=\"${s.name.replace(/\"/g,'&quot;')}\" onclick=\"openVersionsModal(this.dataset.script, this.dataset.name)\">+ Deploy Version</button>\n          <button class=\"btn btn-danger btn-sm\" data-script=\"${s.id}\" onclick=\"deleteScript(this.dataset.script)\">Delete</button>\n        </div>\n        <div style=\"border-top:1px solid var(--border);margin:0 -20px;padding:0 20px;\">${versionsHtml}</div>\n      </div>`;\n    }).join('');\n  }\n\n  async function createScript() {\n    const id = document.getElementById('ns-id').value.trim();\n    const name = document.getElementById('ns-name').value.trim();\n    const description = document.getElementById('ns-desc').value.trim();\n    if (!id || !name) { toast('ID and Name are required', 'error'); return; }\n    const data = await api('POST', '/admin/scripts', { id, name, description });\n    if (data.success) { closeModal('new-script-modal'); toast(`Script \"${name}\" created`); loadScripts(); }\n    else toast('Error: ' + data.error, 'error');\n  }\n\n  async function deleteScript(id) {\n    if (!confirm(`Delete script \"${id}\"? This cannot be undone.`)) return;\n    await api('DELETE', `/admin/scripts/${id}`);\n    toast('Script deleted');\n    loadScripts();\n  }\n\n  function openVersionsModal(scriptId, scriptName) {\n    document.getElementById('version-script-id').value = scriptId;\n    document.getElementById('version-modal-script').textContent = scriptName;\n    document.getElementById('version-num').value = '';\n    document.getElementById('version-url').value = '';\n    document.getElementById('version-changelog').value = '';\n    openModal('version-modal');\n  }\n\n  async function deployVersion() {\n    const scriptId = document.getElementById('version-script-id').value;\n    const version = document.getElementById('version-num').value.trim();\n    const url = document.getElementById('version-url').value.trim();\n    const changelog = document.getElementById('version-changelog').value.trim();\n    if (!scriptId) { toast('No script selected \u2014 open Versions from a script card', 'error'); return; }\n    if (!version || !url) { toast('Version and URL required', 'error'); return; }\n    try {\n      const data = await api('POST', `/admin/scripts/${scriptId}/versions`, { version, url, changelog });\n      if (data.success) { closeModal('version-modal'); toast(`v${version} deployed for ${scriptId} \u2713`); loadScripts(); }\n      else toast('Server error: ' + (data.error || JSON.stringify(data)), 'error');\n    } catch(e) { toast('Request failed: ' + e.message, 'error'); }\n  }\n\n  async function activateVersion(btn) {\n    const scriptId = btn.dataset.script;\n    const version = btn.dataset.version;\n    const data = await api('PATCH', `/admin/scripts/${scriptId}/versions/${version}/activate`, {});\n    if (data.success) { toast(`v${version} is now live`); loadScripts(); }\n    else toast('Error: ' + data.error, 'error');\n  }\n\n  // \u2500\u2500 Licenses \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  async function loadLicenses() {\n    const data = await api('GET', '/admin/licenses');\n    if (!data.success) return;\n    licensesData = data.licenses;\n    renderLicenses(licensesData);\n  }\n\n  function filterLicenses() {\n    const search = document.getElementById('license-search').value.toLowerCase();\n    const scriptFilter = document.getElementById('license-filter-script').value;\n    const statusFilter = document.getElementById('license-filter-status').value;\n    const filtered = licensesData.filter(l => {\n      const ms = !search || l.key.toLowerCase().includes(search) || (l.note&&l.note.toLowerCase().includes(search));\n      const msc = !scriptFilter || l.script_id === scriptFilter;\n      const mst = !statusFilter || l.status === statusFilter;\n      return ms && msc && mst;\n    });\n    renderLicenses(filtered);\n  }\n\n  function getScriptName(id) {\n    if (!id) return '\u2014';\n    const s = scriptsData.find(s => s.id === id);\n    return s ? s.name : id;\n  }\n\n  function renderLicenses(licenses) {\n    document.getElementById('license-count').textContent = `Keys (${licenses.length})`;\n    const tbody = document.getElementById('licenses-table');\n    if (!licenses.length) { tbody.innerHTML = '<tr><td colspan=\"8\" class=\"empty-state\">No licenses found</td></tr>'; return; }\n    tbody.innerHTML = licenses.map(l => {\n      const exp = l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '\u221e Never';\n      const lu = l.last_used ? new Date(l.last_used).toLocaleDateString() : '\u2014';\n      const lockedIp = l.locked_ip ? l.locked_ip : '<span class=\"text-muted\">unbound</span>';\n      return `<tr>\n        <td><span class=\"key-display\" title=\"${l.key}\" onclick=\"copyText('${l.key}')\">${l.key.slice(0,16)}\u2026</span>\n            <button class=\"copy-btn\" onclick=\"copyText('${l.key}')\">\u29c9</button></td>\n        <td>${l.script_id ? `<span class=\"badge badge-script\">${getScriptName(l.script_id)}</span>` : '<span class=\"text-muted\">any</span>'}</td>\n        <td><span class=\"badge badge-${l.status}\">${l.status}</span></td>\n        <td class=\"text-mono\">${lockedIp}</td>\n        <td class=\"text-mono\">${exp}</td>\n        <td class=\"text-mono\">${l.uses||0}</td>\n        <td class=\"text-mono\">${lu}</td>\n        <td class=\"text-muted\" style=\"max-width:120px;overflow:hidden;text-overflow:ellipsis;\">${l.note||''}</td>\n        <td><div class=\"flex gap-2\">\n          ${l.status==='active'\n            ? `<button class=\"btn btn-danger btn-sm\" onclick=\"revokeKey('${l.key}')\">Revoke</button>`\n            : `<button class=\"btn btn-success btn-sm\" onclick=\"activateKey('${l.key}')\">Activate</button>`}\n          ${l.locked_ip ? `<button class=\"btn btn-secondary btn-sm\" onclick=\"resetIP('${l.key}')\">\u21ba IP</button>` : ''}\n        </div></td></tr>`;\n    }).join('');\n  }\n\n  async function createLicense() {\n    const script_id = document.getElementById('create-script').value || null;\n    const days = parseInt(document.getElementById('create-days').value) || null;\n    const note = document.getElementById('create-note').value;\n    const ipsRaw = document.getElementById('create-ips').value;\n    const ip_whitelist = ipsRaw ? ipsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];\n    const data = await api('POST', '/admin/licenses/create', { expires_days: days, note, ip_whitelist, script_id });\n    if (data.success) {\n      closeModal('create-modal');\n      toast(`Key created: ${data.license.key}`);\n      copyText(data.license.key);\n      loadLicenses();\n    } else toast('Error: ' + data.error, 'error');\n  }\n\n  async function bulkCreate() {\n    const script_id = document.getElementById('bulk-script').value || null;\n    const count = parseInt(document.getElementById('bulk-count').value) || 1;\n    const days = parseInt(document.getElementById('bulk-days').value) || null;\n    const note = document.getElementById('bulk-note').value;\n    const data = await api('POST', '/admin/licenses/bulk-create', { count, expires_days: days, note, script_id });\n    if (data.success) {\n      document.getElementById('bulk-result').style.display = 'block';\n      document.getElementById('bulk-keys-output').value = data.created.map(l=>l.key).join('\\n');\n      toast(`Created ${data.count} keys`);\n      loadLicenses();\n    } else toast('Error: ' + data.error, 'error');\n  }\n\n  async function revokeKey(key) {\n    if (!confirm(`Revoke ${key}?`)) return;\n    await api('DELETE', `/admin/licenses/${key}`);\n    toast('Key revoked'); loadLicenses();\n  }\n\n  async function activateKey(key) {\n    await api('PATCH', `/admin/licenses/${key}`, { status: 'active' });\n    toast('Key activated'); loadLicenses();\n  }\n\n  async function resetIP(key) {\n    if (!confirm(`Reset locked IP for ${key}? The next login from any IP will become the new locked IP.`)) return;\n    await api('PATCH', `/admin/licenses/${key}`, { reset_ip: true });\n    toast('IP lock reset'); loadLicenses();\n  }\n\n  // \u2500\u2500 Sessions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  async function loadSessions() {\n    const data = await api('GET', '/admin/sessions');\n    if (!data.success) return;\n    const sessions = data.sessions;\n    const active = sessions.filter(s=>s.active).length;\n    document.getElementById('sessions-count').textContent = `Sessions (${active} online / ${sessions.length} total)`;\n    const tbody = document.getElementById('sessions-table');\n    if (!sessions.length) { tbody.innerHTML = '<tr><td colspan=\"8\" class=\"empty-state\">No sessions</td></tr>'; return; }\n    tbody.innerHTML = sessions.map(s => `<tr>\n      <td class=\"text-mono\">${s.session_id.slice(0,10)}...</td>\n      <td class=\"key-display\">${s.license_key.slice(0,12)}...</td>\n      <td>${s.script_id ? `<span class=\"badge badge-script\">${getScriptName(s.script_id)}</span>` : '\u2014'}</td>\n      <td class=\"text-mono\">${s.ip}</td>\n      <td class=\"text-mono\">${new Date(s.started_at).toLocaleString()}</td>\n      <td class=\"text-mono\">${new Date(s.last_ping).toLocaleTimeString()}</td>\n      <td><span class=\"badge ${s.active?'badge-online':'badge-offline'}\">${s.active?'online':'idle'}</span></td>\n      <td><button class=\"btn btn-danger btn-sm\" onclick=\"killSession('${s.session_id}')\">Kill</button></td></tr>`).join('');\n  }\n\n  async function killSession(id) {\n    await api('DELETE', `/admin/sessions/${id}`);\n    toast('Session terminated'); loadSessions();\n  }\n\n  // \u2500\u2500 Modals \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  function openModal(id) { document.getElementById(id).classList.add('open'); }\n  function closeModal(id) { document.getElementById(id).classList.remove('open'); }\n  document.querySelectorAll('.modal-overlay').forEach(el => {\n    el.addEventListener('click', e => { if (e.target===el) el.classList.remove('open'); });\n  });\n\n  // \u2500\u2500 Utils \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  function toast(msg, type='success') {\n    const div = document.createElement('div');\n    div.className = `toast ${type!=='success'?type:''}`;\n    div.textContent = msg;\n    document.getElementById('toast-container').appendChild(div);\n    setTimeout(() => div.remove(), 3500);\n  }\n\n  function copyText(text) {\n    navigator.clipboard.writeText(text).then(() => toast('Copied: ' + text.slice(0,16)+'...'));\n  }\n\n  document.addEventListener('keydown', e => {\n    if (e.key==='Enter' && document.getElementById('login-screen').style.display!=='none') doLogin();\n  });\n\n  setInterval(() => {\n    const active = document.querySelector('.tab-page.active');\n    if (active?.id==='tab-sessions') loadSessions();\n    if (active?.id==='tab-dashboard') loadStats();\n  }, 15000);\n</script>\n</body>\n</html>\n";

// ─── In-memory DB ─────────────────────────────────────────────────────────────
const db = {
  licenses: new Map(),
  sessions: new Map(),
  scripts: new Map(),      // product scripts (e.g. "voxiom-bot", "another-script")
  analytics: {
    totalValidations: 0,
    failedValidations: 0,
    dailyActive: new Map(),
    validationHistory: []
  },
  adminKey: process.env.ADMIN_KEY || 'CHANGE_THIS_IN_ENV'
};

// ─── Seed: default script product ─────────────────────────────────────────────
db.scripts.set('voxiom-bot', {
  id: 'voxiom-bot',
  name: 'Voxiom Bot Manager',
  description: 'In-game bot manager for Voxiom private servers',
  created_at: new Date().toISOString(),
  versions: [{
    version: '4.1.1',
    url: 'https://your-cdn.com/voxiom-bot.js',
    checksum: 'abc123def456',
    changelog: 'Initial release',
    created_at: new Date().toISOString(),
    active: true
  }]
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const validateLimiter = rateLimit({ windowMs: 60*1000, max: 10, message: { success: false, error: 'Too many requests' } });
const adminLimiter    = rateLimit({ windowMs: 60*1000, max: 60, message: { success: false, error: 'Rate limit exceeded' } });

// ─── Admin Auth ───────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== db.adminKey) return res.status(401).json({ success: false, error: 'Unauthorized' });
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateKey() {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${seg()}${seg()}-${seg()}${seg()}-${seg()}${seg()}-${seg()}${seg()}`;
}

function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

function trackEvent(type, data) {
  const today = new Date().toISOString().split('T')[0];
  if (type === 'success') db.analytics.totalValidations++;
  if (type === 'failure') db.analytics.failedValidations++;
  const count = db.analytics.dailyActive.get(today) || 0;
  db.analytics.dailyActive.set(today, count + 1);
  db.analytics.validationHistory.unshift({ type, ...data, timestamp: new Date().toISOString() });
  if (db.analytics.validationHistory.length > 500)
    db.analytics.validationHistory = db.analytics.validationHistory.slice(0, 500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVE ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(ADMIN_HTML);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/validate — validate license key, returns active script version for that product
app.post('/api/validate', validateLimiter, (req, res) => {
  const { license_key, script_id, version } = req.body;
  const ip = getIP(req);

  if (!license_key) {
    trackEvent('failure', { reason: 'missing_params', ip });
    return res.status(400).json({ success: false, error: 'Missing license_key' });
  }

  const license = db.licenses.get(license_key.toUpperCase());

  if (!license) {
    trackEvent('failure', { reason: 'invalid_key', ip, key: license_key });
    return res.status(403).json({ success: false, error: 'Invalid license key' });
  }

  if (license.status === 'revoked') {
    trackEvent('failure', { reason: 'revoked', ip, key: license_key });
    return res.status(403).json({ success: false, error: 'License has been revoked' });
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    license.status = 'expired';
    trackEvent('failure', { reason: 'expired', ip, key: license_key });
    return res.status(403).json({ success: false, error: 'License has expired' });
  }

  // Check script access — if license has a script_id, enforce it
  const requestedScript = script_id || license.script_id || null;
  if (license.script_id && requestedScript && license.script_id !== requestedScript) {
    trackEvent('failure', { reason: 'wrong_script', ip, key: license_key });
    return res.status(403).json({ success: false, error: 'License not valid for this script' });
  }

  if (license.ip_whitelist && license.ip_whitelist.length > 0) {
    if (!license.ip_whitelist.includes(ip)) {
      trackEvent('failure', { reason: 'ip_blocked', ip, key: license_key });
      return res.status(403).json({ success: false, error: 'IP address not whitelisted' });
    }
  }

  // IP lock: bind on first use, then enforce
  if (!license.locked_ip) {
    license.locked_ip = ip;
  } else if (license.locked_ip !== ip) {
    trackEvent('failure', { reason: 'ip_mismatch', ip, key: license_key });
    return res.status(403).json({ success: false, error: 'IP address mismatch. Contact support to reset.' });
  }

  license.last_used = new Date().toISOString();
  license.uses = (license.uses || 0) + 1;
  license.last_ip = ip;

  const sessionId = crypto.randomBytes(16).toString('hex');
  db.sessions.set(sessionId, {
    session_id: sessionId, license_key,
    script_id: requestedScript || 'unknown',
    ip, version: version || 'unknown',
    started_at: new Date().toISOString(),
    last_ping: new Date().toISOString()
  });

  // Get active version for the script
  let activeVersion = null;
  if (requestedScript && db.scripts.has(requestedScript)) {
    const script = db.scripts.get(requestedScript);
    activeVersion = script.versions.find(v => v.active) || script.versions[script.versions.length - 1];
  }

  trackEvent('success', { ip, key: license_key, script_id: requestedScript });

  return res.json({
    success: true,
    session_id: sessionId,
    expires_at: license.expires_at,
    script_id: requestedScript,
    script: activeVersion ? { version: activeVersion.version, url: activeVersion.url, checksum: activeVersion.checksum } : null
  });
});

app.post('/api/ping', validateLimiter, (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ success: false });
  const session = db.sessions.get(session_id);
  if (!session) return res.status(403).json({ success: false, error: 'Session not found' });
  session.last_ping = new Date().toISOString();
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — SCRIPTS (products)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/admin/scripts', adminLimiter, requireAdmin, (req, res) => {
  res.json({ success: true, scripts: [...db.scripts.values()] });
});

app.post('/admin/scripts', adminLimiter, requireAdmin, (req, res) => {
  const { id, name, description } = req.body;
  if (!id || !name) return res.status(400).json({ success: false, error: 'id and name required' });
  const slug = id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (db.scripts.has(slug)) return res.status(409).json({ success: false, error: 'Script ID already exists' });
  const script = { id: slug, name, description: description || '', created_at: new Date().toISOString(), versions: [] };
  db.scripts.set(slug, script);
  res.json({ success: true, script });
});

app.delete('/admin/scripts/:id', adminLimiter, requireAdmin, (req, res) => {
  if (!db.scripts.has(req.params.id)) return res.status(404).json({ success: false, error: 'Not found' });
  db.scripts.delete(req.params.id);
  res.json({ success: true });
});

// ─── Script Versions ──────────────────────────────────────────────────────────

app.post('/admin/scripts/:id/versions', adminLimiter, requireAdmin, (req, res) => {
  const script = db.scripts.get(req.params.id);
  if (!script) return res.status(404).json({ success: false, error: 'Script not found' });
  const { version, url, changelog } = req.body;
  if (!version || !url) return res.status(400).json({ success: false, error: 'version and url required' });
  const checksum = crypto.createHash('sha256').update(url + version).digest('hex').slice(0, 16);
  script.versions.forEach(v => v.active = false);
  const newVer = { version, url, checksum, changelog: changelog || '', created_at: new Date().toISOString(), active: true };
  script.versions.push(newVer);
  res.json({ success: true, version: newVer });
});

app.patch('/admin/scripts/:id/versions/:version/activate', adminLimiter, requireAdmin, (req, res) => {
  const script = db.scripts.get(req.params.id);
  if (!script) return res.status(404).json({ success: false, error: 'Script not found' });
  script.versions.forEach(v => v.active = false);
  const v = script.versions.find(v => v.version === req.params.version);
  if (!v) return res.status(404).json({ success: false, error: 'Version not found' });
  v.active = true;
  res.json({ success: true, version: v });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — LICENSES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/admin/stats', adminLimiter, requireAdmin, (req, res) => {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const activeSessions = [...db.sessions.values()].filter(s => new Date(s.last_ping).getTime() > fiveMinAgo);
  const licenses = [...db.licenses.values()];
  const dailyData = [...db.analytics.dailyActive.entries()].slice(-7).map(([date, count]) => ({ date, count }));
  res.json({
    success: true,
    stats: {
      total_licenses: licenses.length,
      active_licenses: licenses.filter(l => l.status === 'active').length,
      revoked_licenses: licenses.filter(l => l.status === 'revoked').length,
      expired_licenses: licenses.filter(l => l.status === 'expired').length,
      active_sessions: activeSessions.length,
      total_validations: db.analytics.totalValidations,
      failed_validations: db.analytics.failedValidations,
      daily_activity: dailyData,
      recent_events: db.analytics.validationHistory.slice(0, 20),
      total_scripts: db.scripts.size
    }
  });
});

app.get('/admin/licenses', adminLimiter, requireAdmin, (req, res) => {
  res.json({ success: true, licenses: [...db.licenses.values()] });
});

app.post('/admin/licenses/create', adminLimiter, requireAdmin, (req, res) => {
  const { expires_days, note, ip_whitelist, script_id } = req.body;
  const key = generateKey();
  const license = {
    key, status: 'active', ip_whitelist: ip_whitelist || [],
    script_id: script_id || null,
    expires_at: expires_days ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString() : null,
    created_at: new Date().toISOString(), last_used: null, uses: 0, note: note || ''
  };
  db.licenses.set(key, license);
  res.json({ success: true, license });
});

app.post('/admin/licenses/bulk-create', adminLimiter, requireAdmin, (req, res) => {
  const { count = 1, expires_days, note, script_id } = req.body;
  const created = [];
  for (let i = 0; i < Math.min(count, 100); i++) {
    const key = generateKey();
    const license = {
      key, status: 'active', ip_whitelist: [],
      script_id: script_id || null,
      expires_at: expires_days ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString() : null,
      created_at: new Date().toISOString(), last_used: null, uses: 0, note: note || ''
    };
    db.licenses.set(key, license);
    created.push(license);
  }
  res.json({ success: true, created, count: created.length });
});

app.patch('/admin/licenses/:key', adminLimiter, requireAdmin, (req, res) => {
  const key = req.params.key.toUpperCase();
  const license = db.licenses.get(key);
  if (!license) return res.status(404).json({ success: false, error: 'License not found' });
  const { status, expires_days, ip_whitelist, note, script_id, reset_ip } = req.body;
  if (status) license.status = status;
  if (note !== undefined) license.note = note;
  if (ip_whitelist !== undefined) license.ip_whitelist = ip_whitelist;
  if (script_id !== undefined) license.script_id = script_id;
  if (reset_ip) license.locked_ip = null;
  if (expires_days !== undefined)
    license.expires_at = expires_days ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString() : null;
  res.json({ success: true, license });
});

app.delete('/admin/licenses/:key', adminLimiter, requireAdmin, (req, res) => {
  const key = req.params.key.toUpperCase();
  const license = db.licenses.get(key);
  if (!license) return res.status(404).json({ success: false, error: 'Not found' });
  license.status = 'revoked';
  res.json({ success: true });
});

app.get('/admin/sessions', adminLimiter, requireAdmin, (req, res) => {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const sessions = [...db.sessions.values()].map(s => ({ ...s, active: new Date(s.last_ping).getTime() > fiveMinAgo }));
  res.json({ success: true, sessions });
});

app.delete('/admin/sessions/:id', adminLimiter, requireAdmin, (req, res) => {
  db.sessions.delete(req.params.id);
  res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Clean stale sessions ─────────────────────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, session] of db.sessions.entries())
    if (new Date(session.last_ping).getTime() < cutoff) db.sessions.delete(id);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔐 License server running on port ${PORT}`));
