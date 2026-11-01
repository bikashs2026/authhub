// src/store.js — tiny generic JSON-file store. Atomic writes (tmp file +
// rename) so a crash mid-save never leaves a half-written file behind.
'use strict';
const fs = require('fs');
const path = require('path');

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }
  _file(name) { return path.join(this.dir, `${name}.json`); }

  load(name, fallback) {
    try {
      return JSON.parse(fs.readFileSync(this._file(name), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return fallback;
      throw e;
    }
  }

  save(name, data) {
    const file = this._file(name);
    const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }
}

module.exports = { Store };
