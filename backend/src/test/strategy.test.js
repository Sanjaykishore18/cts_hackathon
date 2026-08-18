const http = require('http');
const assert = require('assert');
const app = require('../app');

const validPayload = {
  Age: 45,
  Baseline_Risk: 0.35,
  Enrolled_PG01: 1,
  Enrolled_PG02: 0,
  Enrolled_PG03: 0,
  Enrolled_PG04: 0,
  Enrolled_PG05: 0,
  Enrolled_PG06: 0,
  Variable_Cost_Per_Patient_30d: 150,
  Copay_Max_Per_Patient_30d: 100,
  Num_Claims_30d: 3,
  Num_Refills_30d: 2,
  Average_Days_Supply_30d: 30,
  Total_Patient_Paid_30d: 60,
  Average_Patient_Paid_30d: 30,
  Average_Refill_Gap_30d: 1.5,
  Maximum_Refill_Gap_30d: 4,
  Copay_Claims_Count_30d: 2,
  Total_Copay_Used_30d: 200,
  Total_Copay_Savings_30d: 180,
  Fund_Exhausted_Any_30d: 0,
  Copay_Utilization_Rate_30d: 0.5,
  Num_Interactions_30d: 4,
  Num_Financial_Assistance_Interactions_30d: 2,
  Num_Adherence_Counseling_Interactions_30d: 1,
  Follow_Up_Rate_30d: 0.75,
  Resolution_Rate_30d: 0.8,
  No_Response_Rate_30d: 0.15,
  Escalation_Rate_30d: 0.05,
  
  Gender: 'Female',
  Age_Group: '18-29',
  Region: 'Midwest',
  State: 'California',
  City_Market: 'California Metro 1',
  Insurance_Type: 'Commercial',
  Insurance_Plan: 'Aetna Signature',
  Disease_Condition: 'Acne Vulgaris',
  Income_Band: '$100K-$150K',
  Financial_Assistance_Eligible: true,
  Employment_Status: 'Employed Full-Time',
  Segment_Name: 'Commercially Insured / Copay Dependent',
  Primary_Enrollment_Channel: 'Call Center',
  Primary_Enrollment_Reason: 'Affordability Barrier'
};

async function runTests() {
  console.log('--- Starting Strategy Effectiveness Integration Tests ---');
  
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

  // 2. Success POST Strategy Effectiveness
  await test('POST /api/ml/strategy-effectiveness returns 200 with valid payload', async () => {
    const res = await fetch(`${baseUrl}/ml/strategy-effectiveness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload)
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(typeof body.data.predicted_pdc, 'number');
    assert.ok(Number.isFinite(body.data.predicted_pdc));
  });

  // 3. Missing numerical field
  await test('POST /api/ml/strategy-effectiveness fails on missing fields', async () => {
    const invalidPayload = { ...validPayload };
    delete invalidPayload.Age;
    
    const res = await fetch(`${baseUrl}/ml/strategy-effectiveness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'Age'));
  });

  // 4. Invalid range field
  await test('POST /api/ml/strategy-effectiveness fails on invalid Baseline_Risk range (> 1)', async () => {
    const invalidPayload = { ...validPayload, Baseline_Risk: 1.25 };
    
    const res = await fetch(`${baseUrl}/ml/strategy-effectiveness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'Baseline_Risk'));
  });

  // 5. Invalid categorical value
  await test('POST /api/ml/strategy-effectiveness fails on invalid Gender option', async () => {
    const invalidPayload = { ...validPayload, Gender: 'UnknownGender' };
    
    const res = await fetch(`${baseUrl}/ml/strategy-effectiveness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'Gender'));
  });

  // 6. Python provider errors (e.g., when executable or artifacts are missing/invalid)
  await test('Strategy API returns 503 error on missing model artifacts', async () => {
    // Temporarily point model dir to a non-existent folder
    const origDir = process.env.STRATEGY_MODEL_DIR;
    process.env.STRATEGY_MODEL_DIR = 'non_existent_folder';
    
    try {
      const res = await fetch(`${baseUrl}/ml/strategy-effectiveness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload)
      });
      assert.strictEqual(res.status, 503);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'STRATEGY_MODEL_UNAVAILABLE');
    } finally {
      process.env.STRATEGY_MODEL_DIR = origDir;
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
