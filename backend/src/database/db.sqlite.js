const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPathSetting = process.env.SQLITE_DB_PATH || 'src/database/auth.db';
const dbPath = path.isAbsolute(dbPathSetting) 
  ? dbPathSetting 
  : path.resolve(process.cwd(), dbPathSetting);

// Ensure the directory for the SQLite database exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: process.env.NODE_ENV !== 'production' ? console.log : null });

// Create the users table if it does not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'analyst',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe migration: check if role column exists, and if not, add it
try {
  const pragma = db.pragma('table_info(users)');
  const hasRole = pragma.some(col => col.name === 'role');
  if (!hasRole) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'analyst'");
    console.log('Successfully migrated SQLite schema: added role column to users table.');
  }
} catch (err) {
  console.error('Error migrating users database schema:', err.message);
}

module.exports = db;
