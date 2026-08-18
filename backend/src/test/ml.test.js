const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('../app');

// Valid baseline payload containing exactly 20 features matching the model
const validPayload = {
  age: 54,
  gender: 'Female',
  region: 'Midwest',
  insuranceType: 'Commercial',
  diseaseCondition: 'Acne Vulgaris',
  baselineRisk: 0.72,
  numProgramsEnrolled: 2,
  numEnrollments: 3,
  numWithdrawn: 1,
  enrollmentChannel: 'Call Center',
  enrollmentReason: 'Affordability Barrier',
  totalInteractions: 12,
  pctFollowUpRequired: 0.58,
  pctResolved: 0.75,
  pctNoResponse: 0.08,
  pctEscalated: 0.05,
  numFinancialAssistInteractions: 4,
  numAdherenceCounseling: 2,
  numProgramsEligible: 3,
  pctEnrollmentEligible: 0.67
};

async function runTests() {
  console.log('--- Starting Phase 3 Integration Tests (Real Python Model) ---');
  
  // Start server on a dynamic port
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
            password: 'password123'
          })
        });
        const loginRes = await originalFetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `testuser_${uniqueId}`,
            password: 'password123'
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

  // 1. GET /api/health
  await test('GET /api/health works correctly', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
  });

  // 2. Valid Churn Prediction Request via Python Churn Provider
  await test('POST /api/ml/churn-prediction returns 200 with real Python inference', async () => {
    process.env.ML_PROVIDER = 'python';
    const res = await fetch(`${baseUrl}/ml/churn-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload)
    });
    
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.churnPrediction, 'Churned');
    
    // Assert real model probability output 0.61936... is returned with tolerance
    const prob = body.data.churnProbability;
    assert.ok(typeof prob === 'number');
    assert.ok(prob >= 0.0 && prob <= 1.0);
    assert.ok(Math.abs(prob - 0.6193628907203674) < 1e-4, `Expected prob close to 0.61936, got ${prob}`);
    
    // Confirm no mock/fallback headers are returned
    assert.strictEqual(res.headers.get('x-ml-fallback'), null);
  });

  // 3. Missing required field
  await test('POST /api/ml/churn-prediction fails on missing fields', async () => {
    const invalidPayload = { ...validPayload };
    delete invalidPayload.age; // age is required
    
    const res = await fetch(`${baseUrl}/ml/churn-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'age'));
  });

  // 4. Invalid probability/risk range
  await test('POST /api/ml/churn-prediction fails on invalid baselineRisk range (> 1)', async () => {
    const invalidPayload = { ...validPayload, baselineRisk: 1.5 };
    
    const res = await fetch(`${baseUrl}/ml/churn-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'baselineRisk'));
  });

  // 5. Invalid numeric field (negative integer validation)
  await test('POST /api/ml/churn-prediction fails on negative integer', async () => {
    const invalidPayload = { ...validPayload, numProgramsEnrolled: -2 };
    
    const res = await fetch(`${baseUrl}/ml/churn-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'numProgramsEnrolled'));
  });

  // 6. Classification Rule Check (Active case)
  await test('Classification rule correctly maps probability < 0.5 to Active', async () => {
    // For a patient with lower risk variables
    const activePayload = {
      ...validPayload,
      baselineRisk: 0.1,
      totalInteractions: 1,
      pctFollowUpRequired: 0.05
    };
    process.env.ML_PROVIDER = 'python';
    
    const res = await fetch(`${baseUrl}/ml/churn-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activePayload)
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.churnProbability < 0.5);
    assert.strictEqual(body.data.churnPrediction, 'Active');
  });

  // 7. ML Provider Failure on Missing Artifacts
  await test('ML Service returns 503 error on missing model artifacts', async () => {
    const origDir = process.env.CHURN_MODEL_DIR;
    process.env.CHURN_MODEL_DIR = 'non_existent_folder';
    
    try {
      const res = await fetch(`${baseUrl}/ml/churn-prediction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload)
      });
      assert.strictEqual(res.status, 503);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'ML_SERVICE_UNAVAILABLE');
    } finally {
      if (origDir === undefined) {
        delete process.env.CHURN_MODEL_DIR;
      } else {
        process.env.CHURN_MODEL_DIR = origDir;
      }
    }
  });

  // Cleanup
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
