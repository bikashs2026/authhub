// server.js — AuthHub: one login for BoldTick, TradeForge, and the Schwab
// auth routes. Issues a signed cookie (shared across *.ishansahoo.com) that
// each app verifies independently with the same AUTH_COOKIE_SECRET.
'use strict';
require('dotenv').config();
const express = require('express');
const { sign, cookieHeader, sessionFromRequest, COOKIE_NAME } = require('./src/sessionAuth');
const { Store } = require('./src/store');
const { Users } = require('./src/users');
const { Links } = require('./src/links');
const pages = require('./src/pages');

const PORT = Number(process.env.AUTH_PORT || 3200);
const BIND = process.env.AUTH_BIND || '127.0.0.1';
const COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET || '';
const COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || '.ishansahoo.com';
const SESSION_DAYS = Number(process.env.AUTH_SESSION_DAYS || 7);
const OWNER_USER = process.env.AUTH_OWNER_USER || '';
const OWNER_PASSWORD = process.env.AUTH_OWNER_PASSWORD || '';

if (!COOKIE_SECRET) { console.error('AUTH_COOKIE_SECRET is not set. Generate one with: openssl rand -hex 32'); process.exit(1); }
if (!OWNER_USER || !OWNER_PASSWORD) { console.error('AUTH_OWNER_USER / AUTH_OWNER_PASSWORD are not set.'); process.exit(1); }

const store = new Store(process.env.AUTH_DATA_DIR || require('path').join(__dirname, 'data'));
const users = new Users(store, { ownerUsername: OWNER_USER, ownerPassword: OWNER_PASSWORD });
const links = new Links(store);

// Built-in site links. Each is configurable via .env so ports/hosts can
// change without touching code; HUB_AUTH_URL / HUB_MARKETDATA_URL mint live
// Schwab credentials on TradeForge, so those two are owner-only.
function siteLinksFor(role) {
  const all = [
    { name: 'BoldTick', sub: process.env.HUB_BOLDTICK_URL || 'https://boldtick.ishansahoo.com', url: process.env.HUB_BOLDTICK_URL || 'https://boldtick.ishansahoo.com', ownerOnly: false },
    { name: 'BoldTick (local)', sub: process.env.HUB_BOLDTICK_LOCAL_URL || 'http://localhost:3100', url: process.env.HUB_BOLDTICK_LOCAL_URL || 'http://localhost:3100', ownerOnly: false },
    { name: 'TradeForge', sub: process.env.HUB_TRADEFORGE_URL || 'https://www.ishansahoo.com', url: process.env.HUB_TRADEFORGE_URL || 'https://www.ishansahoo.com', ownerOnly: false },
    { name: 'TradeForge (local)', sub: process.env.HUB_TRADEFORGE_LOCAL_URL || 'http://localhost:3000', url: process.env.HUB_TRADEFORGE_LOCAL_URL || 'http://localhost:3000', ownerOnly: false },
    { name: 'Auth (Schwab trading)', sub: 'Mints live trading credentials', url: process.env.HUB_AUTH_URL || 'https://www.ishansahoo.com/auth/trading', ownerOnly: true },
    { name: 'Marketdata (Schwab)', sub: 'Mints live market-data credentials', url: process.env.HUB_MARKETDATA_URL || 'https://www.ishansahoo.com/auth/marketdata', ownerOnly: true },
  ];
  return all.filter(l => !l.ownerOnly || role === 'owner');
}

// Keeps post-login/register redirects from being turned into an open
// redirect: only a same-origin path, or an https URL on *.ishansahoo.com.
function safeReturn(url) {
  if (!url) return '/';
  try {
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    const u = new URL(url);
    if (u.protocol === 'https:' && (u.hostname === 'ishansahoo.com' || u.hostname.endsWith('.ishansahoo.com'))) return url;
  } catch { /* fall through */ }
  return '/';
}

const app = express();
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: false }));

function currentUser(req) {
  const session = sessionFromRequest(req, COOKIE_SECRET);
  if (!session) return null;
  const user = users.byId(session.uid);
  if (!user || user.status !== 'active') return null;
  return user;
}

function requireLogin(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    const back = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    return res.redirect(`/login?return=${encodeURIComponent(back)}`);
  }
  req.user = user;
  next();
}
function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') return res.status(403).send(pages.message('Owner only', 'This page is restricted to the owner account.', { user: req.user }));
  next();
}

function setSessionCookie(res, user) {
  const token = sign({ uid: user.id, username: user.username, role: user.role, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 3600 }, COOKIE_SECRET);
  res.setHeader('Set-Cookie', cookieHeader(token, { domain: COOKIE_DOMAIN, maxAgeSeconds: SESSION_DAYS * 24 * 3600 }));
}

// ── Hub ──────────────────────────────────────────────────────────────────
app.get('/', requireLogin, (req, res) => {
  res.send(pages.hub(req.user, {
    siteLinks: siteLinksFor(req.user.role),
    favLinks: links.all(),
    isOwner: req.user.role === 'owner',
  }));
});

app.post('/links', requireLogin, requireOwner, (req, res) => {
  try { links.add(req.body.label, req.body.url); res.redirect('/'); }
  catch (e) { res.status(400).send(pages.message('Could not add link', e.message, { user: req.user })); }
});
app.post('/links/:id/delete', requireLogin, requireOwner, (req, res) => {
  try { links.remove(req.params.id); } catch { /* already gone */ }
  res.redirect('/');
});

// ── Login / logout ───────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (currentUser(req)) return res.redirect('/');
  res.send(pages.login({ returnTo: req.query.return || '' }));
});
app.post('/login', (req, res) => {
  const user = users.verifyLogin(req.body.username, req.body.password);
  if (!user) return res.status(401).send(pages.login({ error: 'Wrong user ID or password, or the account is not active yet.', returnTo: req.body.return }));
  setSessionCookie(res, user);
  res.redirect(safeReturn(req.body.return));
});
app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', cookieHeader('', { domain: COOKIE_DOMAIN, clear: true }));
  res.redirect('/login');
});

// ── Register ─────────────────────────────────────────────────────────────
app.get('/register', (req, res) => { if (currentUser(req)) return res.redirect('/'); res.send(pages.register()); });
app.post('/register', (req, res) => {
  try {
    users.register(req.body.username, req.body.password);
    res.send(pages.message('Account created', 'Your account is pending approval. You will be able to log in once the admin approves it.', { backHref: '/login', backLabel: 'Back to log in' }));
  } catch (e) {
    res.status(400).send(pages.register({ error: e.message }));
  }
});

// ── Forgot / reset password ──────────────────────────────────────────────
app.get('/forgot', (req, res) => res.send(pages.forgot()));
app.post('/forgot', (req, res) => {
  users.requestReset(req.body.username);
  res.send(pages.forgot({ sent: true }));
});
app.get('/reset/:token', (req, res) => {
  if (!users.consumeResetToken(req.params.token)) return res.status(400).send(pages.message('Link expired', 'This reset link is invalid or has expired. Ask the admin for a new one.', { backHref: '/login', backLabel: 'Back to log in' }));
  res.send(pages.resetForm({ token: req.params.token }));
});
app.post('/reset/:token', (req, res) => {
  try {
    users.finishReset(req.params.token, req.body.password);
    res.send(pages.message('Password updated', 'Your password has been reset. You can log in now.', { backHref: '/login', backLabel: 'Log in' }));
  } catch (e) {
    res.status(400).send(pages.resetForm({ token: req.params.token, error: e.message }));
  }
});

// ── Account ──────────────────────────────────────────────────────────────
app.get('/account', requireLogin, (req, res) => res.send(pages.account(req.user)));
app.post('/account/password', requireLogin, (req, res) => {
  const fresh = users.verifyLogin(req.user.username, req.body.current);
  if (!fresh) return res.status(400).send(pages.account(req.user, { error: 'Current password is wrong.' }));
  try {
    users.changePassword(req.user.id, req.body.next);
    res.send(pages.account(req.user, { saved: true }));
  } catch (e) {
    res.status(400).send(pages.account(req.user, { error: e.message }));
  }
});

// ── Admin ────────────────────────────────────────────────────────────────
app.get('/admin', requireLogin, requireOwner, (req, res) => {
  res.send(pages.admin(req.user, { users: users.all(), resets: users.pendingResetRequests() }));
});
function adminAction(fn) {
  return (req, res) => {
    try { fn(req.params.id); } catch (e) { return res.status(400).send(pages.message('Action failed', e.message, { backHref: '/admin', user: req.user })); }
    res.redirect('/admin');
  };
}
app.post('/admin/users/:id/approve', requireLogin, requireOwner, adminAction(id => users.approve(id)));
app.post('/admin/users/:id/reject', requireLogin, requireOwner, adminAction(id => users.reject(id)));
app.post('/admin/users/:id/disable', requireLogin, requireOwner, adminAction(id => users.disable(id)));
app.post('/admin/users/:id/reinstate', requireLogin, requireOwner, adminAction(id => users.reinstate(id)));
app.post('/admin/reset/:id/link', requireLogin, requireOwner, (req, res) => {
  try {
    const token = users.issueResetLink(req.params.id, req.user.id);
    const url = `${req.protocol}://${req.get('host')}/reset/${token}`;
    res.send(pages.resetLink({ url }));
  } catch (e) {
    res.status(400).send(pages.message('Could not generate link', e.message, { backHref: '/admin', user: req.user }));
  }
});

app.listen(PORT, BIND, () => console.log(`authhub listening on ${BIND}:${PORT}`));
