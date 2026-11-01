// src/pages.js — server-rendered HTML. Dark theme matching BoldTick/TradeForge.
'use strict';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function layout(title, body, { user } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Ishan Sahoo</title>
<style>
  :root {
    --bg:#0E0F11; --panel:#15161A; --panel-2:#17181B; --raised:#1A1B1F; --hairline:#24262A;
    --border:#2E3035; --text:#E8E6E1; --text-hi:#F2F0EB; --text-dim:#A19E96; --text-faint:#8E8B84;
    --accent:#E9B949; --good:#6FCF97; --bad:#EB6A6A;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; background:var(--bg); }
  body { color:var(--text); font-family:system-ui,-apple-system,"Segoe UI",sans-serif; font-size:15px; min-height:100vh; }
  a { color:var(--accent); }
  header.top { display:flex; align-items:center; gap:16px; padding:0 24px; min-height:56px; border-bottom:1px solid var(--hairline); background:#121316; }
  header.top .brand { font-weight:600; font-size:17px; }
  header.top .spacer { flex-grow:1; }
  header.top nav a { color:var(--text-dim); text-decoration:none; font-size:14px; margin-left:18px; }
  header.top nav a:hover { color:var(--text-hi); }
  main { max-width:760px; margin:0 auto; padding:32px 24px; }
  .panel { background:var(--panel); border:1px solid var(--hairline); border-radius:10px; padding:24px; margin-bottom:20px; }
  h1 { font-size:22px; margin:0 0 6px; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-dim); margin:0 0 16px; }
  p.lead { color:var(--text-dim); margin:0 0 24px; }
  label { display:block; font-size:13px; color:var(--text-dim); margin-bottom:6px; }
  input[type=text], input[type=password], input[type=url] {
    width:100%; height:40px; padding:0 12px; background:var(--panel-2); border:1px solid var(--border);
    border-radius:6px; color:var(--text-hi); font-size:14px; margin-bottom:16px;
  }
  button, .btn {
    display:inline-block; height:40px; padding:0 18px; background:var(--accent); border:none; border-radius:6px;
    color:#1A1500; font-weight:600; font-size:14px; cursor:pointer; text-decoration:none; line-height:40px;
  }
  button.secondary, .btn.secondary { background:var(--raised); color:var(--text-hi); border:1px solid var(--border); }
  button.danger, .btn.danger { background:var(--bad); color:#2A0A0A; }
  .msg { padding:12px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; }
  .msg.err { background:rgba(235,106,106,0.1); border:1px solid var(--bad); color:#F3B8B8; }
  .msg.ok { background:rgba(111,207,151,0.1); border:1px solid var(--good); color:#BCEBD0; }
  .linkgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:10px; }
  .linkcard {
    display:flex; flex-direction:column; gap:3px; padding:14px 16px; background:var(--raised); border:1px solid var(--border);
    border-radius:8px; text-decoration:none; color:var(--text-hi);
  }
  .linkcard:hover { border-color:var(--accent); }
  .linkcard .name { font-weight:600; font-size:14px; }
  .linkcard .sub { font-size:12px; color:var(--text-faint); }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; color:var(--text-dim); font-weight:500; padding:8px 10px 8px 0; border-bottom:1px solid var(--border); }
  td { padding:10px 10px 10px 0; border-bottom:1px solid var(--hairline); vertical-align:middle; }
  .pill { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
  .pill.owner { background:rgba(233,185,73,0.15); color:var(--accent); }
  .pill.viewer { background:rgba(142,139,132,0.15); color:var(--text-dim); }
  .pill.pending { background:rgba(233,185,73,0.15); color:var(--accent); }
  .pill.active { background:rgba(111,207,151,0.15); color:var(--good); }
  .pill.rejected, .pill.disabled { background:rgba(235,106,106,0.15); color:var(--bad); }
  form.inline { display:inline; }
  .row { display:flex; gap:8px; align-items:center; }
  .emptytext { color:var(--text-faint); font-size:13px; padding:8px 0; }
  .favform { display:flex; gap:10px; align-items:flex-end; margin-top:14px; flex-wrap:wrap; }
  .favform label { margin-bottom:6px; }
  .favform .f1 { flex:1 1 180px; } .favform .f2 { flex:2 1 240px; }
  .favform input { margin-bottom:0; }
  .delbtn { background:none; border:none; color:var(--text-faint); cursor:pointer; font-size:16px; line-height:1; padding:4px 8px; }
  .delbtn:hover { color:var(--bad); }
</style>
</head>
<body>
<header class="top">
  <span class="brand">Ishan Sahoo</span>
  <div class="spacer"></div>
  <nav>
    ${user ? `<a href="/">Links</a><a href="/account">Account</a>${user.role === 'owner' ? '<a href="/admin">Admin</a>' : ''}<a href="/logout">Log out</a>` : `<a href="/login">Log in</a>`}
  </nav>
</header>
<main>
${body}
</main>
</body>
</html>`;
}

function message(title, text, { backHref = '/', backLabel = 'Back', user } = {}) {
  return layout(title, `
    <div class="panel">
      <h1>${esc(title)}</h1>
      <p class="lead">${esc(text)}</p>
      <a class="btn" href="${esc(backHref)}">${esc(backLabel)}</a>
    </div>
  `, { user });
}

function login({ error, returnTo } = {}) {
  return layout('Log in', `
    <div class="panel">
      <h1>Log in</h1>
      ${error ? `<div class="msg err">${esc(error)}</div>` : ''}
      <form method="post" action="/login">
        <input type="hidden" name="return" value="${esc(returnTo || '')}">
        <label>User ID</label>
        <input type="text" name="username" autocomplete="username" required autofocus>
        <label>Password</label>
        <input type="password" name="password" autocomplete="current-password" required>
        <button type="submit">Log in</button>
      </form>
      <p style="margin-top:18px; font-size:13px; color:var(--text-dim)">
        No account yet? <a href="/register">Create a user ID</a> · Forgot your password? <a href="/forgot">Reset it</a>
      </p>
    </div>
  `);
}

function register({ error } = {}) {
  return layout('Create a user ID', `
    <div class="panel">
      <h1>Create a user ID</h1>
      <p class="lead">New accounts are view-only until the admin approves them.</p>
      ${error ? `<div class="msg err">${esc(error)}</div>` : ''}
      <form method="post" action="/register">
        <label>User ID</label>
        <input type="text" name="username" autocomplete="username" required autofocus>
        <label>Password</label>
        <input type="password" name="password" autocomplete="new-password" required>
        <button type="submit">Create account</button>
      </form>
      <p style="margin-top:18px; font-size:13px; color:var(--text-dim)"><a href="/login">Back to log in</a></p>
    </div>
  `);
}

function forgot({ error, sent } = {}) {
  return layout('Forgot password', `
    <div class="panel">
      <h1>Forgot password</h1>
      <p class="lead">There's no automatic email yet — your request goes to the admin, who'll send you a one-time reset link directly.</p>
      ${error ? `<div class="msg err">${esc(error)}</div>` : ''}
      ${sent ? `<div class="msg ok">If that user ID exists, a reset request has been sent to the admin.</div>` : `
      <form method="post" action="/forgot">
        <label>User ID</label>
        <input type="text" name="username" autocomplete="username" required autofocus>
        <button type="submit">Request reset</button>
      </form>`}
      <p style="margin-top:18px; font-size:13px; color:var(--text-dim)"><a href="/login">Back to log in</a></p>
    </div>
  `);
}

function resetForm({ token, error } = {}) {
  return layout('Reset password', `
    <div class="panel">
      <h1>Set a new password</h1>
      ${error ? `<div class="msg err">${esc(error)}</div>` : ''}
      <form method="post" action="/reset/${esc(token)}">
        <label>New password</label>
        <input type="password" name="password" autocomplete="new-password" required autofocus>
        <button type="submit">Set password</button>
      </form>
    </div>
  `);
}

function resetLink({ url }) {
  return layout('Reset link', `
    <div class="panel">
      <h1>One-time reset link</h1>
      <p class="lead">Valid for 1 hour, usable once. Copy and send it to the person however you like.</p>
      <input type="text" readonly value="${esc(url)}" onclick="this.select()" style="font-family:monospace">
      <a class="btn secondary" href="/admin">Back to admin</a>
    </div>
  `);
}

function account(user, { error, saved } = {}) {
  return layout('Account', `
    <div class="panel">
      <h1>Account</h1>
      <p class="lead">Signed in as <strong>${esc(user.username)}</strong> · <span class="pill ${user.role}">${esc(user.role)}</span></p>
      ${error ? `<div class="msg err">${esc(error)}</div>` : ''}
      ${saved ? `<div class="msg ok">Password updated.</div>` : ''}
      <h2 style="margin-top:8px">Change password</h2>
      <form method="post" action="/account/password">
        <label>Current password</label>
        <input type="password" name="current" autocomplete="current-password" required>
        <label>New password</label>
        <input type="password" name="next" autocomplete="new-password" required>
        <button type="submit">Update password</button>
      </form>
    </div>
  `, { user });
}

// Everything lands on this one page: built-in site links (role-gated) plus
// owner-managed favorites, so there's one place to jump off to anything.
function hub(user, { siteLinks, favLinks, isOwner }) {
  const siteCards = siteLinks.map(l => `
    <a class="linkcard" href="${esc(l.url)}" target="_blank" rel="noopener">
      <span class="name">${esc(l.name)}</span>
      ${l.sub ? `<span class="sub">${esc(l.sub)}</span>` : ''}
    </a>`).join('');

  const favCards = favLinks.map(l => `
    <div class="linkcard" style="position:relative">
      <a href="${esc(l.url)}" target="_blank" rel="noopener" style="text-decoration:none; color:inherit">
        <span class="name">${esc(l.label)}</span>
        <span class="sub">${esc(l.url.replace(/^https?:\/\//, ''))}</span>
      </a>
      ${isOwner ? `<form class="inline" method="post" action="/links/${esc(l.id)}/delete" style="position:absolute; top:6px; right:6px" onsubmit="return confirm('Remove ${esc(l.label).replace(/'/g, '')}?')">
        <button type="submit" class="delbtn" title="Remove">&times;</button>
      </form>` : ''}
    </div>`).join('');

  return layout('Links', `
    <div class="panel">
      <h1>Welcome, ${esc(user.username)}</h1>
      <p class="lead">${user.role === 'owner' ? 'Owner access — full control everywhere.' : 'Viewer access — read-only on BoldTick and TradeForge.'}</p>
    </div>
    <div class="panel">
      <h2>Sites</h2>
      <div class="linkgrid">${siteCards || '<p class="emptytext">No sites configured.</p>'}</div>
    </div>
    <div class="panel">
      <h2>Favorites</h2>
      <div class="linkgrid">${favCards || '<p class="emptytext">No favorite links yet.</p>'}</div>
      ${isOwner ? `
      <form class="favform" method="post" action="/links">
        <div class="f1"><label>Name</label><input type="text" name="label" placeholder="e.g. Schwab" required></div>
        <div class="f2"><label>URL</label><input type="url" name="url" placeholder="https://…" required></div>
        <button type="submit">Add link</button>
      </form>` : ''}
    </div>
  `, { user });
}

function admin(user, { users, resets }) {
  const rows = users.map(u => `
    <tr>
      <td>${esc(u.username)}</td>
      <td><span class="pill ${u.role}">${esc(u.role)}</span></td>
      <td><span class="pill ${u.status}">${esc(u.status)}</span></td>
      <td class="row">
        ${u.role === 'owner' ? '<span class="emptytext">—</span>' : `
          ${u.status === 'pending' ? `
            <form class="inline" method="post" action="/admin/users/${esc(u.id)}/approve"><button type="submit">Approve</button></form>
            <form class="inline" method="post" action="/admin/users/${esc(u.id)}/reject"><button type="submit" class="secondary">Reject</button></form>
          ` : u.status === 'active' ? `
            <form class="inline" method="post" action="/admin/users/${esc(u.id)}/disable"><button type="submit" class="danger">Disable</button></form>
          ` : `
            <form class="inline" method="post" action="/admin/users/${esc(u.id)}/reinstate"><button type="submit" class="secondary">Reinstate</button></form>
          `}
        `}
      </td>
    </tr>`).join('');

  const resetRows = resets.map(r => `
    <tr>
      <td>${esc(r.username)}</td>
      <td class="emptytext">${esc(new Date(r.requestedAt).toLocaleString())}</td>
      <td><form class="inline" method="post" action="/admin/reset/${esc(r.id)}/link"><button type="submit">Generate link</button></form></td>
    </tr>`).join('');

  return layout('Admin', `
    <div class="panel">
      <h1>Admin</h1>
      <h2 style="margin-top:0">Users</h2>
      <table>
        <thead><tr><th>User ID</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="emptytext">No users yet.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="panel">
      <h2 style="margin-top:0">Password-reset requests</h2>
      <table>
        <thead><tr><th>User ID</th><th>Requested</th><th></th></tr></thead>
        <tbody>${resetRows || '<tr><td colspan="3" class="emptytext">None pending.</td></tr>'}</tbody>
      </table>
    </div>
  `, { user });
}

module.exports = { esc, layout, message, login, register, forgot, resetForm, resetLink, account, hub, admin };
