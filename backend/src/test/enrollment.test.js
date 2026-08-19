require('dotenv').config();
const http = require('http');
const assert = require('assert');
const app = require('../app');
const enrollmentRepository = require('../repositories/enrollment.repository');

async function runTests() {
  console.log('--- Starting Enrollment REST API Integration Tests (Fabric Gold) ---');

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
    const res = await enrollmentRepository.findAll();
    assert.ok(res.length > 0, 'Should return enrollment records from Fabric');
    const p1 = res.find(e => e.patient_id === 'P00001');
    assert.ok(p1, 'Should find patient P00001 in Fabric Gold enrollment data');
  });

  // 1. GET /api/enrollments success
  await test('GET /api/enrollments returns list', async () => {
    const res = await fetch(`${baseUrl}/enrollments`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  // 2. GET /api/enrollments with status filter
  await test('GET /api/enrollments with status filter works', async () => {
    const res = await fetch(`${baseUrl}/enrollments?enrollmentStatus=Enrolled`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    body.data.forEach(e => {
      assert.strictEqual(e.enrollment_status.toLowerCase(), 'enrolled');
    });
  });

  // 3. GET /api/enrollments/:patientId/:programId success
  await test('GET /api/enrollments/:patientId/:programId returns single enrollment record', async () => {
    const res = await fetch(`${baseUrl}/enrollments/P00001/PG01`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.patient_id, 'P00001');
    assert.strictEqual(body.data.program_id, 'PG01');
  });

  // 4. GET enrollment not found
  await test('GET /api/enrollments/:patientId/:programId returns 404 if not found', async () => {
    const res = await fetch(`${baseUrl}/enrollments/P99999/PG99`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'ENROLLMENT_NOT_FOUND');
  });

  // 5. POST enrollment (write route) -> should return 404 (de-registered)
  await test('POST /api/enrollments returns 404 (write route unmounted)', async () => {
    const res = await fetch(`${baseUrl}/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: 'P00001',
        programId: 'PG01',
        enrollmentStatus: 'Enrolled'
      })
    });
    // Express returns 404 for unmounted routes
    assert.strictEqual(res.status, 404);
  });

  // 6. PUT enrollment (write route) -> should return 404 (de-registered)
  await test('PUT /api/enrollments/:patientId/:programId returns 404 (write route unmounted)', async () => {
    const res = await fetch(`${baseUrl}/enrollments/P00001/PG01`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollmentStatus: 'Dropped'
      })
    });
    assert.strictEqual(res.status, 404);
  });

  // 7. Invalid patientId/programId -> 400
  await test('GET /api/enrollments checks patientId format', async () => {
    const res = await fetch(`${baseUrl}/enrollments/invalidPatient/PG01`);
    assert.strictEqual(res.status, 400);
  });

  // 8. Database failure -> 500 without exposing SQL details
  await test('GET /api/enrollments handles database failures securely', async () => {
    const originalFindAll = enrollmentRepository.findAll;
    enrollmentRepository.findAll = async () => {
      throw new Error('SELECT * FROM dbo.fact_enrollment; -- Query Exception');
    };

    try {
      const res = await fetch(`${baseUrl}/enrollments`);
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.message, 'Internal Server Error');
      assert.ok(!JSON.stringify(body).includes('SELECT'), 'SQL details must not be exposed');
    } finally {
      enrollmentRepository.findAll = originalFindAll;
    }
  });

  if (server.closeAllConnections) {
    server.closeAllConnections();
  }
  server.close(() => {
    globalThis.fetch = originalFetch;
    console.log(`\nEnrollment tests finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  });
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
