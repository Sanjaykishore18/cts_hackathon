require('dotenv').config();
const http = require('http');
const assert = require('assert');
const app = require('../app');
const programRepository = require('../repositories/program.repository');

async function runTests() {
  console.log('--- Starting Program REST API Integration Tests (Fabric Gold) ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  const originalFetch = globalThis.fetch;
  let authToken = null;

  globalThis.fetch = async (url, options = {}) => {
    if (url.startsWith(baseUrl) && !url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/health')) {
      if (!authToken) {
        const uniqueId = Math.random().toString(36).substring(7);
        await originalFetch(`${baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `testuser_${uniqueId}`,
            email: `test_${uniqueId}@example.com`,
            password: 'password123',
            turnstileToken: '1x00000000000000000000AA'
          })
        });
        const loginRes = await originalFetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `testuser_${uniqueId}`,
            password: 'password123',
            turnstileToken: '1x00000000000000000000AA'
          })
        });
        const loginData = await loginRes.json();
        authToken = loginData.data.token;
      }
      options.headers = options.headers || {};
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    return originalFetch(url, options);
  };

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Verification that Fabric is the source
  await test('Verify Repository is using Microsoft Fabric', async () => {
    const res = await programRepository.findAll();
    assert.ok(res.length > 0, 'Should return program records from Fabric');
    const pg1 = res.find(p => p.program_id === 'PG01');
    assert.ok(pg1, 'Should find program PG01 which is unique to Fabric Gold data');
  });

  // 1. GET /api/programs success
  await test('GET /api/programs returns distinct program list', async () => {
    const res = await fetch(`${baseUrl}/programs`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
    assert.ok(body.data[0].program_id);
    assert.ok(body.data[0].program_type);
  });

  // 2. GET /api/programs/:programId success
  await test('GET /api/programs/:programId returns single program info', async () => {
    const res = await fetch(`${baseUrl}/programs/PG01`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.program_id, 'PG01');
    assert.ok(body.data.program_type);
  });

  // 3. GET /api/programs/:programId not found
  await test('GET /api/programs/:programId returns 404 for non-existent program', async () => {
    const res = await fetch(`${baseUrl}/programs/PG99`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'PROGRAM_NOT_FOUND');
  });

  // 4. Invalid programId
  await test('GET /api/programs/:programId returns 400 for invalid format', async () => {
    const res = await fetch(`${baseUrl}/programs/invalidId`);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  // 5. Database failure handling
  await test('GET /api/programs handles repository database failure with masked 500 error', async () => {
    const originalFindAll = programRepository.findAll;
    programRepository.findAll = async () => {
      throw new Error('SELECT * FROM dbo.dim_program; -- Query Exception');
    };

    try {
      const res = await fetch(`${baseUrl}/programs`);
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.message, 'Internal Server Error');
      assert.ok(!JSON.stringify(body).includes('SELECT'), 'SQL details must be masked');
    } finally {
      programRepository.findAll = originalFindAll;
    }
  });

  if (server.closeAllConnections) {
    server.closeAllConnections();
  }
  server.close(() => {
    globalThis.fetch = originalFetch;
    console.log(`\nProgram tests finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  });
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
