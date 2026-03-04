const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.ADMIN_ORIGIN || '*',
  credentials: true
}));

// ─── In-memory DB (replace with MongoDB/PostgreSQL in production) ─────────────
const db = {
  licenses: new Map(),
  sessions: new Map(),
  scriptVersions: [],
  analytics: {
    totalValidations: 0,
    failedValidations: 0,
    dailyActive: new Map(),
    validationHistory: []
  },
  adminKey: process.env.ADMIN_KEY || 'CHANGE_THIS_IN_ENV'
};

// ─── Seed a default license for testing ──────────────────────────────────────
db.licenses.set('TEST-XXXX-YYYY-ZZZZ', {
  key: 'TEST-XXXX-YYYY-ZZZZ',
  status: 'active',
  hwid: null,
  ip_whitelist: [],
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  last_used: null,
  uses: 0,
  note: 'Demo license'
});

db.scriptVersions.push({
  version: '1.0.0',
  url: 'https://your-cdn.com/script-v1.0.0.js',
  checksum: 'abc123def456',
  changelog: 'Initial release',
  created_at: new Date().toISOString(),
  active: true
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many requests' }
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Rate limit exceeded' }
});

// ─── Middleware: Admin Auth ────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== db.adminKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// ─── Helper: Generate License Key ─────────────────────────────────────────────
function generateKey() {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${seg()}${seg()}-${seg()}${seg()}-${seg()}${seg()}-${seg()}${seg()}`;
}

// ─── Helper: Get client IP ────────────────────────────────────────────────────
function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.socket.remoteAddress;
}

// ─── Helper: Track analytics ──────────────────────────────────────────────────
function trackEvent(type, data) {
  const today = new Date().toISOString().split('T')[0];
  if (type === 'success') db.analytics.totalValidations++;
  if (type === 'failure') db.analytics.failedValidations++;

  const count = db.analytics.dailyActive.get(today) || 0;
  db.analytics.dailyActive.set(today, count + 1);

  db.analytics.validationHistory.unshift({
    type, ...data, timestamp: new Date().toISOString()
  });

  if (db.analytics.validationHistory.length > 500) {
    db.analytics.validationHistory = db.analytics.validationHistory.slice(0, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS (called by loader script)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/validate — Main license validation
app.post('/api/validate', validateLimiter, (req, res) => {
  const { license_key, hwid, version } = req.body;
  const ip = getIP(req);

  if (!license_key || !hwid) {
    trackEvent('failure', { reason: 'missing_params', ip });
    return res.status(400).json({ success: false, error: 'Missing required fields' });
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

  // Check expiry
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    license.status = 'expired';
    trackEvent('failure', { reason: 'expired', ip, key: license_key });
    return res.status(403).json({ success: false, error: 'License has expired' });
  }

  // HWID lock: bind on first use, then enforce
  if (!license.hwid) {
    license.hwid = hwid;
  } else if (license.hwid !== hwid) {
    trackEvent('failure', { reason: 'hwid_mismatch', ip, key: license_key });
    return res.status(403).json({ success: false, error: 'Hardware ID mismatch. Contact support to reset.' });
  }

  // IP whitelist check (skip if list is empty = allow all)
  if (license.ip_whitelist && license.ip_whitelist.length > 0) {
    if (!license.ip_whitelist.includes(ip)) {
      trackEvent('failure', { reason: 'ip_blocked', ip, key: license_key });
      return res.status(403).json({ success: false, error: 'IP address not whitelisted' });
    }
  }

  // Update usage stats
  license.last_used = new Date().toISOString();
  license.uses = (license.uses || 0) + 1;
  license.last_ip = ip;

  // Track active session
  const sessionId = crypto.randomBytes(16).toString('hex');
  db.sessions.set(sessionId, {
    session_id: sessionId,
    license_key,
    hwid,
    ip,
    version: version || 'unknown',
    started_at: new Date().toISOString(),
    last_ping: new Date().toISOString()
  });

  // Get latest active script version
  const activeVersion = db.scriptVersions.find(v => v.active) || db.scriptVersions[db.scriptVersions.length - 1];

  trackEvent('success', { ip, key: license_key, hwid });

  return res.json({
    success: true,
    session_id: sessionId,
    expires_at: license.expires_at,
    script: activeVersion ? {
      version: activeVersion.version,
      url: activeVersion.url,
      checksum: activeVersion.checksum
    } : null
  });
});

// POST /api/ping — Keep session alive
app.post('/api/ping', validateLimiter, (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ success: false });

  const session = db.sessions.get(session_id);
  if (!session) return res.status(403).json({ success: false, error: 'Session not found' });

  session.last_ping = new Date().toISOString();
  return res.json({ success: true });
});

// GET /api/version — Get latest script version info
app.get('/api/version', (req, res) => {
  const active = db.scriptVersions.find(v => v.active);
  if (!active) return res.status(404).json({ success: false });
  return res.json({
    success: true,
    version: active.version,
    checksum: active.checksum
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/stats
app.get('/admin/stats', adminLimiter, requireAdmin, (req, res) => {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;

  const activeSessions = [...db.sessions.values()].filter(s =>
    new Date(s.last_ping).getTime() > fiveMinAgo
  );

  const licenses = [...db.licenses.values()];
  const dailyData = [];
  for (const [date, count] of [...db.analytics.dailyActive.entries()].slice(-7)) {
    dailyData.push({ date, count });
  }

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
      recent_events: db.analytics.validationHistory.slice(0, 20)
    }
  });
});

// GET /admin/licenses
app.get('/admin/licenses', adminLimiter, requireAdmin, (req, res) => {
  const licenses = [...db.licenses.values()];
  res.json({ success: true, licenses });
});

// POST /admin/licenses/create
app.post('/admin/licenses/create', adminLimiter, requireAdmin, (req, res) => {
  const { expires_days, note, ip_whitelist } = req.body;
  const key = generateKey();

  const license = {
    key,
    status: 'active',
    hwid: null,
    ip_whitelist: ip_whitelist || [],
    expires_at: expires_days
      ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
      : null,
    created_at: new Date().toISOString(),
    last_used: null,
    uses: 0,
    note: note || ''
  };

  db.licenses.set(key, license);
  res.json({ success: true, license });
});

// POST /admin/licenses/bulk-create
app.post('/admin/licenses/bulk-create', adminLimiter, requireAdmin, (req, res) => {
  const { count = 1, expires_days, note } = req.body;
  const created = [];

  for (let i = 0; i < Math.min(count, 100); i++) {
    const key = generateKey();
    const license = {
      key,
      status: 'active',
      hwid: null,
      ip_whitelist: [],
      expires_at: expires_days
        ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
        : null,
      created_at: new Date().toISOString(),
      last_used: null,
      uses: 0,
      note: note || ''
    };
    db.licenses.set(key, license);
    created.push(license);
  }

  res.json({ success: true, created, count: created.length });
});

// PATCH /admin/licenses/:key
app.patch('/admin/licenses/:key', adminLimiter, requireAdmin, (req, res) => {
  const key = req.params.key.toUpperCase();
  const license = db.licenses.get(key);
  if (!license) return res.status(404).json({ success: false, error: 'License not found' });

  const { status, expires_days, ip_whitelist, note, reset_hwid } = req.body;

  if (status) license.status = status;
  if (note !== undefined) license.note = note;
  if (ip_whitelist !== undefined) license.ip_whitelist = ip_whitelist;
  if (reset_hwid) license.hwid = null;
  if (expires_days !== undefined) {
    license.expires_at = expires_days
      ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
      : null;
  }

  res.json({ success: true, license });
});

// DELETE /admin/licenses/:key (revoke)
app.delete('/admin/licenses/:key', adminLimiter, requireAdmin, (req, res) => {
  const key = req.params.key.toUpperCase();
  const license = db.licenses.get(key);
  if (!license) return res.status(404).json({ success: false, error: 'Not found' });
  license.status = 'revoked';
  res.json({ success: true });
});

// GET /admin/sessions
app.get('/admin/sessions', adminLimiter, requireAdmin, (req, res) => {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const sessions = [...db.sessions.values()].map(s => ({
    ...s,
    active: new Date(s.last_ping).getTime() > fiveMinAgo
  }));
  res.json({ success: true, sessions });
});

// DELETE /admin/sessions/:id
app.delete('/admin/sessions/:id', adminLimiter, requireAdmin, (req, res) => {
  db.sessions.delete(req.params.id);
  res.json({ success: true });
});

// GET /admin/versions
app.get('/admin/versions', adminLimiter, requireAdmin, (req, res) => {
  res.json({ success: true, versions: db.scriptVersions });
});

// POST /admin/versions
app.post('/admin/versions', adminLimiter, requireAdmin, (req, res) => {
  const { version, url, changelog } = req.body;
  if (!version || !url) return res.status(400).json({ success: false, error: 'version and url required' });

  const checksum = crypto.createHash('sha256').update(url + version).digest('hex').slice(0, 16);

  // Deactivate old versions
  db.scriptVersions.forEach(v => v.active = false);

  const newVersion = {
    version, url, checksum, changelog: changelog || '',
    created_at: new Date().toISOString(),
    active: true
  };

  db.scriptVersions.push(newVersion);
  res.json({ success: true, version: newVersion });
});

// PATCH /admin/versions/:version/activate
app.patch('/admin/versions/:version/activate', adminLimiter, requireAdmin, (req, res) => {
  db.scriptVersions.forEach(v => v.active = false);
  const v = db.scriptVersions.find(v => v.version === req.params.version);
  if (!v) return res.status(404).json({ success: false, error: 'Version not found' });
  v.active = true;
  res.json({ success: true, version: v });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min inactive
  for (const [id, session] of db.sessions.entries()) {
    if (new Date(session.last_ping).getTime() < cutoff) {
      db.sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔐 License server running on port ${PORT}`));
const path = require('path');
app.use('/admin-ui', express.static(path.join(__dirname, 'public')));
