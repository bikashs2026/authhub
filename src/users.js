// src/users.js — user accounts: self-registration (pending until approved),
// owner/viewer roles, password change, and the admin-manual-link password-
// reset flow (no email sending yet).
'use strict';
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('./passwords');

class Users {
  constructor(store, { ownerUsername, ownerPassword }) {
    this.store = store;
    this.data = store.load('users', { users: [], resetRequests: [] });
    this._ensureOwner(ownerUsername, ownerPassword);
  }

  _save() { this.store.save('users', this.data); }

  // Re-synced from .env on every restart, so rotating the owner password is
  // just "edit .env, restart" — no separate admin flow needed for your own account.
  _ensureOwner(username, password) {
    username = String(username || '').trim();
    if (!username || !password) return;
    let owner = this.data.users.find(u => u.role === 'owner');
    if (!owner) {
      owner = {
        id: crypto.randomUUID(), username, role: 'owner', status: 'active',
        passwordHash: hashPassword(password), createdAt: new Date().toISOString(),
      };
      this.data.users.push(owner);
    } else {
      owner.username = username;
      owner.passwordHash = hashPassword(password);
      owner.status = 'active';
    }
    this._save();
  }

  all() { return this.data.users; }
  byUsername(username) {
    const u = String(username || '').trim().toLowerCase();
    return this.data.users.find(x => x.username.toLowerCase() === u);
  }
  byId(id) { return this.data.users.find(x => x.id === id); }

  register(username, password) {
    username = String(username || '').trim();
    if (!username || username.length < 3) throw new Error('Pick a user ID of at least 3 characters.');
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (this.byUsername(username)) throw new Error('That user ID is already taken or pending.');
    const user = {
      id: crypto.randomUUID(), username, role: 'viewer', status: 'pending',
      passwordHash: hashPassword(password), createdAt: new Date().toISOString(),
    };
    this.data.users.push(user);
    this._save();
    return user;
  }

  verifyLogin(username, password) {
    const user = this.byUsername(username);
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    if (user.status !== 'active') return null;
    return user;
  }

  _setStatus(id, status) {
    const user = this.byId(id);
    if (!user) throw new Error('No such user.');
    if (user.role === 'owner' && status !== 'active') throw new Error('The owner account cannot be disabled.');
    user.status = status;
    this._save();
    return user;
  }
  approve(id) { return this._setStatus(id, 'active'); }
  reject(id) { return this._setStatus(id, 'rejected'); }
  disable(id) { return this._setStatus(id, 'disabled'); }
  reinstate(id) { return this._setStatus(id, 'active'); }

  changePassword(id, newPassword) {
    const user = this.byId(id);
    if (!user) throw new Error('No such user.');
    if (!newPassword || newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
    user.passwordHash = hashPassword(newPassword);
    this._save();
    return user;
  }

  // "Forgot password" with no email infra yet: a request just queues up for
  // the admin, who generates a one-time link and sends it however they like.
  requestReset(username) {
    const user = this.byUsername(username);
    if (!user) return; // silently no-op — don't leak which IDs are registered
    this.data.resetRequests = this.data.resetRequests.filter(r => r.userId !== user.id || r.consumedAt);
    this.data.resetRequests.push({
      id: crypto.randomUUID(), userId: user.id, username: user.username,
      requestedAt: new Date().toISOString(), token: null, tokenExpiresAt: null, consumedAt: null,
    });
    this._save();
  }

  pendingResetRequests() {
    return this.data.resetRequests.filter(r => !r.consumedAt);
  }

  issueResetLink(requestId, byUserId) {
    const req = this.data.resetRequests.find(r => r.id === requestId);
    if (!req) throw new Error('No such request.');
    req.token = crypto.randomBytes(24).toString('hex');
    req.tokenExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    req.issuedBy = byUserId;
    this._save();
    return req.token;
  }

  consumeResetToken(token) {
    const req = this.data.resetRequests.find(r => r.token === token && !r.consumedAt);
    if (!req) return null;
    if (new Date(req.tokenExpiresAt).getTime() < Date.now()) return null;
    return req;
  }

  finishReset(token, newPassword) {
    const req = this.consumeResetToken(token);
    if (!req) throw new Error('This reset link is invalid or has expired.');
    this.changePassword(req.userId, newPassword);
    req.consumedAt = new Date().toISOString();
    this._save();
  }
}

module.exports = { Users };
