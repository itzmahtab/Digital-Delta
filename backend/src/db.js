import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'data', 'digital_delta.db');

let db = null;

export function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        reject(err);
        return;
      }
      console.log('SQLite database connected:', dbPath);
      
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            role TEXT DEFAULT 'volunteer',
            public_key TEXT,
            device_id TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `, (err) => {
          if (err) console.error('Create users table error:', err);
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            event_type TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp INTEGER DEFAULT (strftime('%s', 'now')),
            prev_hash TEXT,
            hash TEXT,
            metadata TEXT
          )
        `, (err) => {
          if (err) console.error('Create audit_logs table error:', err);
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            lat REAL,
            lng REAL,
            is_flooded INTEGER DEFAULT 0
          )
        `, (err) => {
          if (err) console.error('Create nodes table error:', err);
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS edges (
            id TEXT PRIMARY KEY,
            source_id TEXT,
            target_id TEXT,
            edge_type TEXT,
            base_weight_mins INTEGER,
            is_flooded INTEGER DEFAULT 0,
            risk_score REAL DEFAULT 0,
            original_weight_mins INTEGER,
            FOREIGN KEY(source_id) REFERENCES nodes(id),
            FOREIGN KEY(target_id) REFERENCES nodes(id)
          )
        `, (err) => {
          if (err) console.error('Create edges table error:', err);
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS deliveries (
            id TEXT PRIMARY KEY,
            cargo_type TEXT,
            priority TEXT,
            from_node_id TEXT,
            to_node_id TEXT,
            assigned_vehicle_id TEXT,
            current_node_id TEXT,
            status TEXT,
            sla_hours INTEGER,
            eta_minutes INTEGER,
            sla_breached INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `, (err) => {
          if (err) console.error('Create deliveries table error:', err);
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS pod_receipts (
            id TEXT PRIMARY KEY,
            delivery_id TEXT,
            driver_sig TEXT,
            recipient_sig TEXT,
            nonce TEXT UNIQUE,
            payload_hash TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `, (err) => {
          if (err) console.error('Create pod_receipts table error:', err);
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS vehicles (
            id TEXT PRIMARY KEY,
            type TEXT,
            current_node_id TEXT,
            battery_pct INTEGER DEFAULT 100,
            payload_weight_kg INTEGER DEFAULT 0,
            max_payload_kg INTEGER DEFAULT 100
          )
        `, (err) => {
          if (err) console.error('Create vehicles table error:', err);
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS crdt_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_type TEXT NOT NULL,
            record_id TEXT NOT NULL,
            value TEXT,
            vector_clock TEXT,
            node_id TEXT,
            timestamp INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `, (err) => {
          if (err) console.error('Create crdt_ledger table error:', err);
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS ml_predictions (
            id TEXT PRIMARY KEY,
            edge_id TEXT,
            probability REAL,
            label INTEGER,
            features_json TEXT,
            predicted_at INTEGER,
            expires_at INTEGER
          )
        `, (err) => {
          if (err) console.error('Create ml_predictions table error:', err);
        });

        seedDefaultUsers();
        resolve(db);
      });
    });
  });
}

function seedDefaultUsers() {
  const defaultUsers = [
    { id: 'user-001', username: 'admin', password_hash: 'demo', role: 'admin' },
    { id: 'user-002', username: 'commander1', password_hash: 'demo', role: 'commander' },
    { id: 'user-003', username: 'manager1', password_hash: 'demo', role: 'manager' },
    { id: 'user-004', username: 'drone1', password_hash: 'demo', role: 'drone_operator' },
    { id: 'user-005', username: 'volunteer1', password_hash: 'demo', role: 'volunteer' },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, role) 
    VALUES (?, ?, ?, ?)
  `);

  defaultUsers.forEach(user => {
    stmt.run(user.id, user.username, user.password_hash, user.role);
  });
  stmt.finalize();
  console.log('Default users seeded');
}

export function getDb() {
  return db;
}

export function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function getAllUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM users', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function createUser(user) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, public_key, device_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.username,
      user.password_hash || null,
      user.role || 'volunteer',
      user.public_key || null,
      user.device_id || null
    , (err) => {
      if (err) reject(err);
      else resolve(user);
    });
    stmt.finalize();
  });
}

export function updateUserPublicKey(username, publicKey, deviceId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET public_key = ?, device_id = ? WHERE username = ?',
      [publicKey, deviceId, username],
      (err) => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
}

export function addAuditLog(userId, action, status, metadata = {}) {
  return new Promise((resolve, reject) => {
    db.get('SELECT MAX(id) as maxId FROM audit_logs', [], (err, row) => {
      const lastHash = row?.maxId ? null : 'GENESIS';
      
      db.get('SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1', [], (err, lastRow) => {
        const prevHash = lastRow?.hash || 'GENESIS';
        const timestamp = Date.now();
        const data = `${userId}|${action}|${status}|${timestamp}|${prevHash}`;
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(data).digest('hex');

        const stmt = db.prepare(`
          INSERT INTO audit_logs (user_id, event_type, status, timestamp, prev_hash, hash, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          userId,
          action,
          status,
          timestamp,
          prevHash,
          hash,
          JSON.stringify(metadata),
          (err) => {
            if (err) reject(err);
            else resolve(hash);
          }
        );
        stmt.finalize();
      });
    });
  });
}

export function getAuditLogs(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function closeDatabase() {
  if (db) {
    db.close();
    console.log('Database closed');
  }
}