const fs = require('fs');
const path = require('path');

// Set env variables for tests before importing modules
process.env.JWT_SECRET = 'test_secret_key_123';
process.env.JWT_EXPIRES_IN = '10s'; // Short expiration for testing
process.env.SQLITE_DB_PATH = 'src/database/auth_test.db';

const dotenv = require('dotenv');
dotenv.config();

const http = require('http');
const assert = require('assert');
const app = require('../app');
const db = require('../database/db.sqlite');

// Clean up and recreate test DB schema
db.exec('DROP TABLE IF EXISTS users');
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

async function runTests() {
  console.log('--- Starting Authentication Integration Tests ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err);
      failed++;
    }
  }

  // 1. Registration success -> 201
  let token = '';
  await test('Registration success -> 201', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.username, 'testuser');
    assert.strictEqual(body.data.user.email, 'test@example.com');
    assert.ok(body.data.user.id);
    assert.strictEqual(body.data.user.password_hash, undefined);
  });

  // 2. Duplicate username -> 409
  await test('Duplicate username -> 409', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'another@example.com',
        password: 'password123'
      })
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('taken'));
  });

  // 3. Duplicate email -> 409
  await test('Duplicate email -> 409', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'anotheruser',
        email: 'test@example.com',
        password: 'password123'
      })
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('registered'));
  });

  // 4. Password stored only as hash
  await test('Password stored only as hash', async () => {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser');
    assert.ok(row);
    assert.notStrictEqual(row.password_hash, 'password123');
    assert.ok(row.password_hash.startsWith('$2a$') || row.password_hash.startsWith('$2b$'));
  });

  // 5. Login succeeds with correct credentials -> JWT
  await test('Login succeeds with correct credentials -> JWT', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token);
    assert.strictEqual(body.data.user.username, 'testuser');
    token = body.data.token;
  });

  // 6. Login fails with incorrect credentials -> generic "Invalid credentials"
  await test('Login fails with incorrect credentials -> generic "Invalid credentials"', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrongpassword'
      })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, 'Invalid credentials');
  });

  // 7. /me with valid JWT -> sanitized user
  await test('/me with valid JWT -> sanitized user', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.username, 'testuser');
    assert.strictEqual(body.data.email, 'test@example.com');
    assert.strictEqual(body.data.password_hash, undefined);
  });

  // 8. /me without token -> 401
  await test('/me without token -> 401', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // 9. /me with malformed token -> 401
  await test('/me with malformed token -> 401', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': 'Bearer not_a_real_token' }
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // 10. /me with expired token -> 401
  await test('/me with expired token -> 401', async () => {
    // Wait for the token to expire (expires in 10s)
    console.log('Waiting 11 seconds for token expiration test...');
    await new Promise((resolve) => setTimeout(resolve, 11000));

    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // 11. /me with valid token but deleted user -> 401
  await test('/me with valid token but deleted user -> 401', async () => {
    // Register and login another user
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'tempuser',
        email: 'temp@example.com',
        password: 'password123'
      })
    });
    assert.strictEqual(regRes.status, 201);

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'temp@example.com',
        password: 'password123'
      })
    });
    const loginBody = await loginRes.json();
    const tempToken = loginBody.data.token;

    // Delete the user from DB
    db.prepare('DELETE FROM users WHERE username = ?').run('tempuser');

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${tempToken}` }
    });
    assert.strictEqual(meRes.status, 401);
    const meBody = await meRes.json();
    assert.strictEqual(meBody.success, false);
  });

  // 12. Logout returns the documented response
  await test('Logout returns the documented response', async () => {
    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.message.includes('Logout successful'));
  });

  // 13. Protected Patient API without JWT -> 401
  await test('Protected Patient API without JWT -> 401', async () => {
    const res = await fetch(`${baseUrl}/patients`);
    assert.strictEqual(res.status, 401);
  });

  // 14. Protected Program API without JWT -> 401
  await test('Protected Program API without JWT -> 401', async () => {
    const res = await fetch(`${baseUrl}/programs`);
    assert.strictEqual(res.status, 401);
  });

  // 15. Protected Enrollment READ API without JWT -> 401
  await test('Protected Enrollment READ API without JWT -> 401', async () => {
    const res = await fetch(`${baseUrl}/enrollments`);
    assert.strictEqual(res.status, 401);
  });

  // 16. Protected ML API without JWT -> 401
  await test('Protected ML API without JWT -> 401', async () => {
    const res = await fetch(`${baseUrl}/ml/churn-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 401);
  });

  // Cleanup
  if (server.closeAllConnections) {
    server.closeAllConnections();
  }

  server.close(() => {
    console.log(`\nAuth Tests finished: ${passed} passed, ${failed} failed.`);
    // Clean up test DB file
    try {
      db.close();
      const testDbPath = path.resolve(process.cwd(), 'src/database/auth_test.db');
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (e) {
      console.error('Error cleaning up test DB file:', e.message);
    }
    if (failed > 0) {
      process.exit(1);
    }
  });
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
