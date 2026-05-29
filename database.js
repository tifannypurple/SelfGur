const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, 'selfgur.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_licenses_token ON licenses(token);
  CREATE INDEX IF NOT EXISTS idx_uploads_license_id ON uploads(license_id);
`);

// Funções para gerenciar licenças
const licenses = {
  create: (token, name) => {
    const stmt = db.prepare('INSERT INTO licenses (token, name) VALUES (?, ?)');
    return stmt.run(token, name);
  },

  findByToken: (token) => {
    const stmt = db.prepare('SELECT * FROM licenses WHERE token = ?');
    return stmt.get(token);
  },

  getAll: () => {
    const stmt = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC');
    return stmt.all();
  },

  update: (id, data) => {
    const fields = [];
    const values = [];
    
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    
    if (data.active !== undefined) {
      fields.push('active = ?');
      values.push(data.active);
    }
    
    if (fields.length === 0) return;
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE licenses SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM licenses WHERE id = ?');
    return stmt.run(id);
  },

  getStats: (licenseId) => {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_uploads,
        SUM(size) as total_size,
        COUNT(CASE WHEN type = 'image' THEN 1 END) as total_images,
        COUNT(CASE WHEN type = 'audio' THEN 1 END) as total_audios
      FROM uploads 
      WHERE license_id = ?
    `);
    return stmt.get(licenseId);
  }
};

// Funções para gerenciar uploads
const uploads = {
  create: (licenseId, filename, originalName, type, size, url) => {
    const stmt = db.prepare(`
      INSERT INTO uploads (license_id, filename, original_name, type, size, url) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(licenseId, filename, originalName, type, size, url);
  },

  getAll: () => {
    const stmt = db.prepare(`
      SELECT u.*, l.name as license_name, l.token 
      FROM uploads u
      JOIN licenses l ON u.license_id = l.id
      ORDER BY u.created_at DESC
    `);
    return stmt.all();
  },

  getByLicense: (licenseId) => {
    const stmt = db.prepare(`
      SELECT * FROM uploads 
      WHERE license_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(licenseId);
  },

  delete: (id) => {
    const stmt = db.prepare('DELETE FROM uploads WHERE id = ?');
    return stmt.run(id);
  },

  deleteByLicense: (licenseId) => {
    const stmt = db.prepare('DELETE FROM uploads WHERE license_id = ?');
    return stmt.run(licenseId);
  },

  findById: (id) => {
    const stmt = db.prepare('SELECT * FROM uploads WHERE id = ?');
    return stmt.get(id);
  }
};

// Funções para gerenciar usuários admin
const adminUsers = {
  create: (username, hashedPassword) => {
    const stmt = db.prepare('INSERT INTO admin_users (username, password) VALUES (?, ?)');
    return stmt.run(username, hashedPassword);
  },

  findByUsername: (username) => {
    const stmt = db.prepare('SELECT * FROM admin_users WHERE username = ?');
    return stmt.get(username);
  },

  getFirst: () => {
    const stmt = db.prepare('SELECT * FROM admin_users ORDER BY id ASC LIMIT 1');
    return stmt.get();
  },

  updatePassword: (id, hashedPassword) => {
    const stmt = db.prepare('UPDATE admin_users SET password = ? WHERE id = ?');
    return stmt.run(hashedPassword, id);
  },

  updateCredentials: (id, username, hashedPassword) => {
    const stmt = db.prepare('UPDATE admin_users SET username = ?, password = ? WHERE id = ?');
    return stmt.run(username, hashedPassword, id);
  },

  exists: () => {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM admin_users');
    return stmt.get().count > 0;
  }
};

module.exports = {
  db,
  licenses,
  uploads,
  adminUsers
};
