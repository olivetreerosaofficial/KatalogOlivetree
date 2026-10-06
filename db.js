const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync(path.join(__dirname, 'data.json'));
const db = low(adapter);

// Struktur data awal (cuma dibuat sekali kalau file data.json belum ada)
db.defaults({ items: [], nextId: 1 }).write();

module.exports = db;
