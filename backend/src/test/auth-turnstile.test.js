const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

// Configure environment for tests before requiring app modules
process.env.JWT_SECRET = 'test_turnstile_secret_key_123';
process.env.JWT_EXPIRES_IN = '10s';
process.env.SQLITE_DB_PATH = 'src/database/auth_test_turnstile.db';
process.env.NODE_ENV = 'test';

const dotenv = require('dotenv');
dotenv.config();

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
      role TEXT DEFAULT 'analyst',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Setup global fetch mock for Cloudflare siteverify endpoint
const originalFetch = global.fetch;
let mockFetchResponse = null;

global.fetch = async (url, options) => {
  if (typeof url === 'string' && url.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) {
    if (mockFetchResponse) {
      if (typeof mockFetchResponse === 'function') {
        return mockFetchResponse(url, options);
      }
      return mockFetchResponse;
    }
    // Default mock response: success
    return {
      ok: true,
      json: async () => ({ success: true })
    };
  }
  return originalFetch(url, options);
};

async function runTests() {
  console.log('--- Starting Cloudflare Turnstile Integration Tests ---');

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
    } finally {
      // Reset mock fetch response after each test
      mockFetchResponse = null;
    }
  }

  // 1. Login missing turnstileToken (expected 400)
  await test('1. Login missing turnstileToken -> HTTP 400 Validation Error', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.message, 'Human verification failed');
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  // 2. Register missing turnstileToken (expected 400)
  await test('2. Register missing turnstileToken -> HTTP 400 Validation Error', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.message, 'Human verification failed');
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  // 3. Invalid Turnstile token (Cloudflare returns success: false)
  await test('3. Invalid Turnstile token -> HTTP 400 Validation Error', async () => {
    mockFetchResponse = {
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] })
    };

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        turnstileToken: 'invalid-token-value'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.message, 'Human verification failed');
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  // 4. Cloudflare verification failure
  await test('4. Cloudflare verification failure -> HTTP 400 Validation Error', async () => {
    mockFetchResponse = {
      ok: true,
      json: async () => ({ success: false })
    };

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        turnstileToken: 'failure-token'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.message, 'Human verification failed');
  });

  // 5. Cloudflare service/network failure (e.g. status 503 or abort/network throw)
  await test('5. Cloudflare service/network failure -> HTTP 400 Validation Error', async () => {
    mockFetchResponse = {
      ok: false,
      status: 503,
      json: async () => ({})
    };

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        turnstileToken: 'network-failure-token'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.message, 'Human verification failed');
  });

  // 6. Mocked successful Turnstile verification
  await test('6. Mocked successful Turnstile verification endpoint', async () => {
    let mockFetchCalled = false;
    mockFetchResponse = (url, options) => {
      mockFetchCalled = true;
      assert.ok(options.body.includes('response=valid-token'));
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    };

    const res = await fetch(`${baseUrl}/auth/config`);
    assert.strictEqual(res.status, 200);
    const configBody = await res.json();
    assert.strictEqual(configBody.success, true);
    assert.ok(configBody.data.turnstileSiteKey);

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123',
        turnstileToken: 'valid-token'
      })
    });

    // It should pass Turnstile and reach user lookup (returning 401 because user doesn't exist)
    assert.strictEqual(loginRes.status, 401);
    assert.ok(mockFetchCalled);
    const loginBody = await loginRes.json();
    assert.strictEqual(loginBody.success, false);
    assert.strictEqual(loginBody.error, 'Invalid credentials');
  });

  // 7. Successful registration after valid Turnstile verification
  await test('7. Successful registration after valid Turnstile verification -> HTTP 201', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'turnstile_user',
        email: 'turnstile_user@example.com',
        password: 'password123',
        turnstileToken: 'valid-reg-token'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.username, 'turnstile_user');
    assert.strictEqual(body.data.user.email, 'turnstile_user@example.com');
  });

  // 8. Successful login after valid Turnstile verification -> HTTP 200 with JWT
  await test('8. Successful login after valid Turnstile verification -> HTTP 200 with JWT', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'turnstile_user@example.com',
        password: 'password123',
        turnstileToken: 'valid-login-token'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token);
    assert.strictEqual(body.data.user.username, 'turnstile_user');
  });

  // Cleanup
  if (server.closeAllConnections) {
    server.closeAllConnections();
  }

  // Restore global fetch
  global.fetch = originalFetch;

  server.close(() => {
    console.log(`\nTurnstile Tests finished: ${passed} passed, ${failed} failed.`);
    // Clean up test DB file
    try {
      db.close();
      const testDbPath = path.resolve(process.cwd(), 'src/database/auth_test_turnstile.db');
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
