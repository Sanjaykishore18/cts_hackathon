require('dotenv').config();
const http = require('http');
const assert = require('assert');
const app = require('../app');
const patientRepository = require('../repositories/patient.repository');

async function runTests() {
  console.log('--- Starting Patient REST API Integration Tests (Fabric Gold) ---');

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
    const res = await patientRepository.findAll();
    assert.ok(res.length > 0, 'Should return patient records from Fabric');
    // P00001 is a real Fabric ID, not present in legacy PostgreSQL
    const p1 = res.find(p => p.patient_id === 'P00001');
    assert.ok(p1, 'Should find patient P00001 which is unique to Fabric Gold data');
  });

  // A. GET /api/patients
  await test('GET /api/patients returns all patients (no filters)', async () => {
    const res = await fetch(`${baseUrl}/patients`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  await test('GET /api/patients with programId filter', async () => {
    const res = await fetch(`${baseUrl}/patients?programId=PG01`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    body.data.forEach(p => {
      assert.strictEqual(p.program_id, 'PG01');
    });
  });

  await test('GET /api/patients with programType filter', async () => {
    const res = await fetch(`${baseUrl}/patients?programType=Copay%20Card`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    body.data.forEach(p => {
      assert.strictEqual(p.program_type.toLowerCase(), 'copay card');
    });
  });

  await test('GET /api/patients with insuranceType filter', async () => {
    const res = await fetch(`${baseUrl}/patients?insuranceType=Commercial`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    body.data.forEach(p => {
      assert.strictEqual(p.insurance_type.toLowerCase(), 'commercial');
    });
  });

  await test('GET /api/patients with enrollmentStatus filter', async () => {
    const res = await fetch(`${baseUrl}/patients?enrollmentStatus=Enrolled`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    body.data.forEach(p => {
      assert.strictEqual(p.enrollment_status.toLowerCase(), 'enrolled');
    });
  });

  // B. GET /api/patients/:patientId
  await test('GET /api/patients/:patientId returns single structured patient object', async () => {
    const res = await fetch(`${baseUrl}/patients/P00001`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data === 'object' && body.data !== null && !Array.isArray(body.data));
    assert.strictEqual(body.data.patient_id, 'P00001');
    assert.ok(Array.isArray(body.data.programs));
    assert.ok(body.data.programs.length > 0);
  });

  await test('GET /api/patients/:patientId returns 404 for non-existent patient', async () => {
    const res = await fetch(`${baseUrl}/patients/P99999`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'PATIENT_NOT_FOUND');
  });

  await test('GET /api/patients/:patientId returns 400 for invalid patientId format', async () => {
    const res = await fetch(`${baseUrl}/patients/invalidId`);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  // C. GET /api/patients/:patientId/programs
  await test('GET /api/patients/:patientId/programs returns programs list', async () => {
    const res = await fetch(`${baseUrl}/patients/P00001/programs`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  await test('GET /api/patients/:patientId/programs returns 404 for non-existent patient', async () => {
    const res = await fetch(`${baseUrl}/patients/P99999/programs`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'PATIENT_PROGRAMS_NOT_FOUND');
  });

  // D. GET /api/programs/:programId/patients
  await test('GET /api/programs/:programId/patients returns program patients list', async () => {
    const res = await fetch(`${baseUrl}/programs/PG01/patients`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  await test('GET /api/programs/:programId/patients returns 404 for non-existent program', async () => {
    const res = await fetch(`${baseUrl}/programs/PG99/patients`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'PROGRAM_PATIENTS_NOT_FOUND');
  });

  // E. Validation
  await test('GET /api/patients returns 400 for invalid enrollmentStatus', async () => {
    const res = await fetch(`${baseUrl}/patients?enrollmentStatus=invalid_status`);
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'enrollmentStatus'));
  });

  // F. Error handling
  await test('GET /api/patients returns 500 without exposing SQL details on repo failure', async () => {
    const origFindAll = patientRepository.findAll;
    patientRepository.findAll = async () => {
      throw new Error('SELECT * FROM dbo.dim_patient; -- Internal Database Exception');
    };

    try {
      const res = await fetch(`${baseUrl}/patients`);
      assert.strictEqual(res.status, 500);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(!JSON.stringify(body).includes('SELECT'), 'SQL query details must not be exposed');
      assert.ok(!JSON.stringify(body).includes('dbo.dim_patient'), 'Table structures must not be exposed');
    } finally {
      patientRepository.findAll = origFindAll;
    }
  });

  if (server.closeAllConnections) {
    server.closeAllConnections();
  }
  
  server.close(() => {
    globalThis.fetch = originalFetch;
    console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  });
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
