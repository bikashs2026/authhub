// src/links.js — owner-managed "favorite links" shown on the hub page below
// the built-in site links. Lets B add/remove arbitrary bookmarks (a broker
// dashboard, a doc, whatever) without touching code or .env.
'use strict';
const crypto = require('crypto');

class Links {
  constructor(store) {
    this.store = store;
    this.data = store.load('links', { links: [] });
  }
  _save() { this.store.save('links', this.data); }

  all() {
    return [...this.data.links].sort((a, b) => a.label.localeCompare(b.label));
  }

  add(label, url) {
    label = String(label || '').trim();
    url = String(url || '').trim();
    if (!label) throw new Error('Give the link a name.');
    if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://');
    const link = { id: crypto.randomUUID(), label, url, createdAt: new Date().toISOString() };
    this.data.links.push(link);
    this._save();
    return link;
  }

  remove(id) {
    const before = this.data.links.length;
    this.data.links = this.data.links.filter(l => l.id !== id);
    if (this.data.links.length === before) throw new Error('No such link.');
    this._save();
  }
}

module.exports = { Links };
