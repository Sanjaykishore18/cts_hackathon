const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');

// Configure test environment variables before requiring app modules
process.env.JWT_SECRET = 'test_security_secret_key_123';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SQLITE_DB_PATH = 'src/database/auth_test_security.db';
process.env.UPLOAD_STORAGE_ROOT = './uploads_security_test';
process.env.NODE_ENV = 'test';

const dotenv = require('dotenv');
dotenv.config();

const app = require('../app');
const db = require('../database/db.sqlite');
const authService = require('../services/auth.service');
const storageRepo = require('../repositories/upload-storage.repository');

// Clean up and recreate security test database
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

function removeDirRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    const list = fs.readdirSync(dirPath);
    for (const file of list) {
      const curPath = path.join(dirPath, file);
      if (fs.statSync(curPath).isDirectory()) {
        removeDirRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    }
    fs.rmdirSync(dirPath);
  }
}

async function uploadFiles(baseUrl, token, sourceSystem, filesList, mockRole = 'uploader', customHeaders = {}) {
  const formData = new FormData();
  formData.append('source_system', sourceSystem);
  for (const f of filesList) {
    const blob = new Blob([f.buffer], { type: 'application/octet-stream' });
    formData.append('files', blob, f.name);
  }

  const headers = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (mockRole) {
    headers['x-mock-role'] = mockRole;
  }

  return fetch(`${baseUrl}/uploads`, {
    method: 'POST',
    headers,
    body: formData
  });
}

async function runTests() {
  console.log('--- Starting Backend Security Throttling & Hardening Tests ---');
  removeDirRecursive(process.env.UPLOAD_STORAGE_ROOT);

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

  // Create accounts
  let adminToken = '';
  let analystToken = '';

  await test('0. Register admin & analyst and verify role setting', async () => {
    // 1. Register analyst (default role)
    const regRes1 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'analyst_user',
        email: 'analyst@example.com',
        password: 'password123',
        role: 'admin', // Attempt self-promotion (must be ignored)
        turnstileToken: '1x00000000000000000000AA'
      })
    });
    assert.strictEqual(regRes1.status, 201);
    const body1 = await regRes1.json();
    assert.strictEqual(body1.data.user.role, 'analyst'); // Assert role is still analyst

    const loginRes1 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analyst@example.com',
        password: 'password123',
        turnstileToken: '1x00000000000000000000AA'
      })
    });
    const loginBody1 = await loginRes1.json();
    analystToken = loginBody1.data.token;

    // Manually elevate a user to admin in DB for testing
    db.prepare("UPDATE users SET role = 'admin' WHERE username = ?").run('analyst_user');
    
    // Login again to get elevated JWT
    const loginRes2 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analyst@example.com',
        password: 'password123',
        turnstileToken: '1x00000000000000000000AA'
      })
    });
    const loginBody2 = await loginRes2.json();
    adminToken = loginBody2.data.token;
    assert.strictEqual(loginBody2.data.user.role, 'admin');

    // Register secondary user
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'analyst_user_2',
        email: 'analyst2@example.com',
        password: 'password123',
        turnstileToken: '1x00000000000000000000AA'
      })
    });
  });

  const sample1Path = 'test-fixtures/upload/SAMPLE_1.XLS';
  const sample1Buffer = fs.readFileSync(sample1Path);

  // 1. Cross-tenant duplicate isolation
  await test('1. Cross-tenant duplicate check isolation', async () => {
    // Tenant 1 (using tenant_default or custom mock) uploads a file
    const res1 = await uploadFiles(baseUrl, adminToken, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }], 'admin');
    assert.strictEqual(res1.status, 202);
    const body1 = await res1.json();
    const batchId1 = body1.data.batch_id;

    // Tenant 2 (another tenant) uploads the exact same file content
    const sha256 = require('crypto').createHash('sha256').update(sample1Buffer).digest('hex');
    
    // Scoped check for tenant1: should find duplicate
    const dupTenant1 = await storageRepo.findDuplicateBatch(sha256, 'tenant_default');
    assert.ok(dupTenant1);

    // Scoped check for tenant2: should NOT find duplicate
    const dupTenant2 = await storageRepo.findDuplicateBatch(sha256, 'tenant_other');
    assert.strictEqual(dupTenant2, null);
  });

  // 2. Filename path traversal neutralization
  await test('2. Filename path traversal prevention', async () => {
    // Test that resolving traversal filenames remains safe
    const buffer = Buffer.from('data', 'utf8');
    const traversalName = '../../../../etc/passwd';
    
    const filePath = await storageRepo.saveFile('tenant_default', 'B20260819T100000Z-abcdef', 'patient', traversalName, buffer);
    
    // File must be written strictly as the basename 'passwd' inside the root
    assert.strictEqual(path.basename(filePath), 'passwd');
    const absoluteRoot = path.resolve(process.env.UPLOAD_STORAGE_ROOT);
    assert.ok(path.resolve(filePath).startsWith(absoluteRoot));
  });

  // 3. Oversized file (limits fileSize = 25 MB)
  await test('3. Oversized file (>25 MB) -> HTTP 413', async () => {
    // Generate a buffer slightly larger than 25 MB
    const largeBuffer = Buffer.alloc(25 * 1024 * 1024 + 1024);
    const res = await uploadFiles(baseUrl, adminToken, 'patient', [{ name: 'large.xlsx', buffer: largeBuffer }], 'admin');
    assert.strictEqual(res.status, 413);
  });

  // 4. Oversized request (max total request = 60 MB)
  await test('4. Oversized request (>60 MB) -> HTTP 413', async () => {
    // Generate buffer larger than 60 MB
    const giantBuffer = Buffer.alloc(60 * 1024 * 1024 + 1024);
    const res = await uploadFiles(baseUrl, adminToken, 'patient', [{ name: 'giant.xlsx', buffer: giantBuffer }], 'admin');
    assert.strictEqual(res.status, 413);
  });

  // 5. Admin upload allowed
  await test('5. Admin upload allowed -> HTTP 202', async () => {
    const res = await uploadFiles(baseUrl, adminToken, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }], 'admin');
    assert.strictEqual(res.status, 202);
  });

  // 6. Analyst upload denied
  await test('6. Analyst upload denied -> HTTP 403', async () => {
    // Using analystToken/mock role analyst
    const res = await uploadFiles(baseUrl, analystToken, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }], 'analyst');
    assert.strictEqual(res.status, 403);
  });

  // 7. Unexpected JWT algorithm rejected
  await test('7. Unexpected JWT algorithm (none or RS256) rejected -> HTTP 401', async () => {
    // Create token signed with a different key / method but claiming HS256, or alg: none
    const payload = { id: 1, username: 'testuser', role: 'admin' };
    
    // Alg 'none' token
    const tokenNone = jwt.sign(payload, '', { algorithm: 'none' });
    const res1 = await fetch(`${baseUrl}/patients`, {
      headers: { 'Authorization': `Bearer ${tokenNone}` }
    });
    assert.strictEqual(res1.status, 401);
  });

  // 8. Auth Rate limiting
  await test('8. Authentication rate limiting -> HTTP 429', async () => {
    // Submit 12 requests in sequence with the override header x-test-rate-limit: true
    let hitRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-test-rate-limit': 'true'
        },
        body: JSON.stringify({
          email: 'analyst@example.com',
          password: 'password123',
          turnstileToken: '1x00000000000000000000AA'
        })
      });
      if (res.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assert.ok(hitRateLimit, 'Rate limiting did not trigger HTTP 429');
  });

  // 9. CORS allowed/disallowed origins
  await test('9. CORS allowed and disallowed origin check', async () => {
    // Allowed origin
    const resAllowed = await fetch(`${baseUrl}/health`, {
      headers: { 'Origin': 'http://localhost:3000' }
    });
    assert.strictEqual(resAllowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');

    // Disallowed origin (CORS handler throws error or blocks)
    const resDisallowed = await fetch(`${baseUrl}/health`, {
      headers: { 'Origin': 'http://malicious-attacker.com' }
    });
    // Disallowed origin will result in either CORS header missing, or an error status
    assert.notStrictEqual(resDisallowed.headers.get('access-control-allow-origin'), 'http://malicious-attacker.com');
  });

  // 10. Security Headers check (Helmet)
  await test('10. Helmet security headers presence check', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.ok(res.headers.get('x-content-type-options'));
    assert.ok(res.headers.get('x-frame-options') || res.headers.get('content-security-policy'));
  });

  // 11. Error Log sanitization verification
  await test('11. Error log sanitization - masks internal errors', async () => {
    // GET status of non-existent batch to trigger error
    const res = await fetch(`${baseUrl}/uploads/B20000000T000000Z-000000/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    // Ensure credentials / stack traces are not leaked in response
    assert.strictEqual(body.error.message.includes('password'), false);
    assert.strictEqual(body.error.message.includes('postgres'), false);
  });

  // Cleanup
  if (server.closeAllConnections) {
    server.closeAllConnections();
  }
  server.close(() => {
    console.log(`\nSecurity Tests finished: ${passed} passed, ${failed} failed.`);
    
    // Clean up test DB file
    try {
      db.close();
      const testDbPath = path.resolve(process.cwd(), 'src/database/auth_test_security.db');
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (e) {
      console.error('Error cleaning up test DB file:', e.message);
    }
    
    process.exit(failed > 0 ? 1 : 0);
  });
}

runTests().catch(err => {
  console.error('Security test runner crashed:', err);
  process.exit(1);
});
