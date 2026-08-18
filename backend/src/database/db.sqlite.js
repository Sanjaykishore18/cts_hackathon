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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
