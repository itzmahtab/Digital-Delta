import sqlite3 from 'sqlite3';
import crypto from 'crypto';
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
            otp_secret TEXT,
            public_key TEXT,
            device_id TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `, (err) => {
          if (err) console.error('Create users table error:', err);
          
          // Migration: Ensure new columns exist for existing databases
          ['otp_secret', 'public_key', 'device_id'].forEach(col => {
            db.run(`ALTER TABLE users ADD COLUMN ${col} TEXT`, (err) => {
              // Ignore "duplicate column" errors
              if (err && !err.message.includes('duplicate column name')) {
                // Only log if it's not a expected error
                if (!err.message.includes('already exists')) {
                  console.log(`Migration: Users table already has ${col} column`);
                }
              }
            });
          });
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
          CREATE TABLE IF NOT EXISTS inventory (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            quantity INTEGER DEFAULT 0,
            unit TEXT,
            min_stock INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `, (err) => {
          if (err) console.error('Create inventory table error:', err);
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
        seedInitialData();
        resolve(db);
      });
    });
  });
}

function seedDefaultUsers() {
  const defaultUsers = [
    { id: 'user-001', username: 'admin', password_hash: 'demo', role: 'admin', otp_secret: 'JBSWY3DPEHPK3PXP' },
    { id: 'user-002', username: 'commander1', password_hash: 'demo', role: 'commander', otp_secret: 'KRSXG5CTMVRXEZLU' },
    { id: 'user-003', username: 'manager1', password_hash: 'demo', role: 'manager', otp_secret: 'MFRGGZDFMZTWQ2LK' },
    { id: 'user-004', username: 'drone1', password_hash: 'demo', role: 'drone_operator', otp_secret: 'OVZWS3THOJSG42LQ' },
    { id: 'user-005', username: 'volunteer1', password_hash: 'demo', role: 'volunteer', otp_secret: 'W46DXS3X' },
  ];

  const stmt = db.prepare(`
    INSERT INTO users (id, username, password_hash, role, otp_secret) 
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET otp_secret = excluded.otp_secret
  `);

  defaultUsers.forEach(user => {
    stmt.run(user.id, user.username, user.password_hash, user.role, user.otp_secret);
  });
  stmt.finalize();
  console.log('Default users seeded and secrets synchronized');
}

function seedInitialData() {
  // Seed Inventory
  const initialInventory = [
    ['INV001', 'Medical Kits', 'medical', 150, 'boxes', 50],
    ['INV002', 'Water Containers', 'water', 320, 'units', 100],
    ['INV003', 'Food Packages', 'food', 45, 'boxes', 100],
    ['INV004', 'Blankets', 'shelter', 200, 'units', 80],
    ['INV005', 'Fuel Canisters', 'fuel', 30, 'units', 20],
  ];
  const invStmt = db.prepare(`INSERT OR IGNORE INTO inventory (id, name, category, quantity, unit, min_stock) VALUES (?, ?, ?, ?, ?, ?)`);
  initialInventory.forEach(i => invStmt.run(...i));
  invStmt.finalize();

  // Seed Deliveries
  const initialDeliveries = [
    ['D001', 'Medical Supplies', 'P0', 'N1', 'N3', 'V001', 'N1', 'in_transit', 2, 45],
    ['D002', 'Food Packages', 'P1', 'N1', 'N4', null, 'N1', 'pending', 6, null],
    ['D003', 'Water Containers', 'P2', 'N2', 'N3', null, 'N2', 'pending', 24, null],
  ];
  const delStmt = db.prepare(`INSERT OR IGNORE INTO deliveries (id, cargo_type, priority, from_node_id, to_node_id, assigned_vehicle_id, current_node_id, status, sla_hours, eta_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  initialDeliveries.forEach(d => delStmt.run(...d));
  delStmt.finalize();

  // Seed Nodes
  const initialNodes = [
    ['N1', 'Central Hub', 'depot', 25.0, 91.5],
    ['N2', 'West Clinic', 'medical', 25.1, 91.3],
    ['N3', 'North Shelter', 'shelter', 25.3, 91.6],
    ['N4', 'South Port', 'port', 24.8, 91.4],
    ['N5', 'East Bridge', 'waypoint', 25.0, 91.8],
    ['N6', 'Airport', 'airdrop', 25.4, 91.2],
  ];
  const nodeStmt = db.prepare(`INSERT OR IGNORE INTO nodes (id, name, type, lat, lng) VALUES (?, ?, ?, ?, ?)`);
  initialNodes.forEach(n => nodeStmt.run(...n));
  nodeStmt.finalize();

  // Seed Edges (Multimodal)
  const initialEdges = [
    ['E1', 'N1', 'N2', 'land', 15, 15],
    ['E2', 'N1', 'N3', 'air', 10, 10],
    ['E3', 'N2', 'N3', 'land', 20, 20],
    ['E4', 'N3', 'N5', 'water', 30, 30],
    ['E5', 'N1', 'N4', 'land', 25, 25],
    ['E6', 'N4', 'N5', 'water', 40, 40],
  ];
  const edgeStmt = db.prepare(`INSERT OR IGNORE INTO edges (id, source_id, target_id, edge_type, base_weight_mins, original_weight_mins) VALUES (?, ?, ?, ?, ?, ?)`);
  initialEdges.forEach(e => edgeStmt.run(...e));
  edgeStmt.finalize();

  // Seed Vehicles
  const initialVehicles = [
    ['V001', 'truck', 'N1', 85],
    ['V002', 'boat', 'N4', 100],
    ['V003', 'drone', 'N6', 45],
  ];
  const vehStmt = db.prepare(`INSERT OR IGNORE INTO vehicles (id, type, current_node_id, battery_pct) VALUES (?, ?, ?, ?)`);
  initialVehicles.forEach(v => vehStmt.run(...v));
  vehStmt.finalize();

  console.log('Initial platform data seeded');
}

export function getDb() { return db; }

// --- Inventory Helpers ---
export function getInventory(category) {
  return new Promise((resolve, reject) => {
    const query = category ? 'SELECT * FROM inventory WHERE category = ?' : 'SELECT * FROM inventory';
    db.all(query, category ? [category] : [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

export function updateInventoryItem(id, quantity) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE inventory SET quantity = ?, updated_at = (strftime(\'%s\', \'now\')) WHERE id = ?', [quantity, id], (err) => {
      if (err) reject(err); else resolve(true);
    });
  });
}

// --- Delivery Helpers ---
export function getDeliveries(status) {
  return new Promise((resolve, reject) => {
    const query = status ? 'SELECT * FROM deliveries WHERE status = ?' : 'SELECT * FROM deliveries';
    db.all(query, status ? [status] : [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

export function createDelivery(d) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO deliveries (id, cargo_type, priority, from_node_id, to_node_id, status, sla_hours) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(d.id, d.cargo_type, d.priority, d.from_node_id, d.to_node_id, 'pending', d.sla_hours || 24, (err) => {
      if (err) reject(err); else resolve(d);
    });
    stmt.finalize();
  });
}

export function updateDeliveryStatus(id, status) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE deliveries SET status = ? WHERE id = ?', [status, id], (err) => {
      if (err) reject(err); else resolve(true);
    });
  });
}

// --- Sync/CRDT Helpers ---
export function getLedgerDelta(sinceVectorClock) {
  return new Promise((resolve, reject) => {
    // In a real crdt, we'd compare clocks. For demo, we return all recent or un-synced.
    db.all('SELECT * FROM crdt_ledger ORDER BY timestamp DESC LIMIT 100', [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

export function appendLedgerMutation(m) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO crdt_ledger (record_type, record_id, value, vector_clock, node_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run(m.type, m.record_id, JSON.stringify(m.data), JSON.stringify(m.vectorClock), m.nodeId, m.timestamp || Date.now(), (err) => {
      if (err) reject(err); else resolve(true);
    });
    stmt.finalize();
  });
}

// --- Fleet/Map Helpers ---
export function getNodes() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM nodes', [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

export function getEdges() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM edges', [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

export function getVehicles() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM vehicles', [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
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
      INSERT INTO users (id, username, password_hash, role, otp_secret, public_key, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.username,
      user.password_hash || null,
      user.role || 'volunteer',
      user.otp_secret || null,
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
      db.get('SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1', [], (err, lastRow) => {
        const prevHash = lastRow?.hash || 'GENESIS';
        const timestamp = Date.now();
        const data = `${userId}|${action}|${status}|${timestamp}|${prevHash}`;
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
    const query = `
      SELECT al.*, u.username as user 
      FROM audit_logs al 
      LEFT JOIN users u ON al.user_id = u.id 
      ORDER BY al.id DESC LIMIT ?
    `;
    db.all(query, [limit], (err, rows) => {
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