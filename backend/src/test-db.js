import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'data', 'digital_delta.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      console.error('Query error:', err);
    } else {
      console.log('Users in database:');
      console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
  });
});