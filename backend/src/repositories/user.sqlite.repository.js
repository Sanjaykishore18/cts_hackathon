const db = require('../database/db.sqlite');

class UserSqliteRepository {
  _ensureRoleColumn() {
    try {
      const pragma = db.pragma('table_info(users)');
      const hasRole = pragma.some(col => col.name === 'role');
      if (!hasRole) {
        db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'analyst'");
      }
    } catch (e) {
      // Ignore if table does not exist
    }
  }

  findById(id) {
    this._ensureRoleColumn();
    const stmt = db.prepare('SELECT id, username, email, role, password_hash, created_at, updated_at FROM users WHERE id = ?');
    return stmt.get(id);
  }

  findByEmail(email) {
    this._ensureRoleColumn();
    const stmt = db.prepare('SELECT id, username, email, role, password_hash, created_at, updated_at FROM users WHERE email = ?');
    return stmt.get(email);
  }

  findByUsername(username) {
    this._ensureRoleColumn();
    const stmt = db.prepare('SELECT id, username, email, role, password_hash, created_at, updated_at FROM users WHERE username = ?');
    return stmt.get(username);
  }

  create(username, email, passwordHash, role = 'analyst') {
    this._ensureRoleColumn();
    const stmt = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)');
    const info = stmt.run(username, email, passwordHash, role);
    return {
      id: info.lastInsertRowid,
      username,
      email,
      role
    };
  }
}

module.exports = new UserSqliteRepository();
