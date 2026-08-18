const db = require('../database/db.sqlite');

class UserSqliteRepository {
  findById(id) {
    const stmt = db.prepare('SELECT id, username, email, password_hash, created_at, updated_at FROM users WHERE id = ?');
    return stmt.get(id);
  }

  findByEmail(email) {
    const stmt = db.prepare('SELECT id, username, email, password_hash, created_at, updated_at FROM users WHERE email = ?');
    return stmt.get(email);
  }

  findByUsername(username) {
    const stmt = db.prepare('SELECT id, username, email, password_hash, created_at, updated_at FROM users WHERE username = ?');
    return stmt.get(username);
  }

  create(username, email, passwordHash) {
    const stmt = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    const info = stmt.run(username, email, passwordHash);
    return {
      id: info.lastInsertRowid,
      username,
      email
    };
  }
}

module.exports = new UserSqliteRepository();
