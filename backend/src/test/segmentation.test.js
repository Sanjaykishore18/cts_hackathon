const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('../app');

// Valid baseline payload containing exactly 44 features
const validPayload = {
  Patient_ID: 'PAT-00001',
  Age: 54,
  Gender: 'Female',
  Age_Group: '18-29',
  Region: 'Midwest',
  State: 'California',
  City_Market: 'California Metro 1',
  Insurance_Type: 'Commercial',
  Insurance_Plan: 'Aetna Signature',
  Disease_Condition: 'Acne Vulgaris',
  Baseline_Risk: 0.72,
  Patient_Start_Date: '2026-01-11',
  Income_Band: '$100K-$150K',
  Financial_Assistance_Eligible: true,
  Employment_Status: 'Employed Full-Time',
  Total_Enrollment_Duration: 360,
  Num_Programs_Enrolled: 2,
  Total_Enrollments: 3,
  Num_Withdrawals: 1,
  Num_Discontinuations: 0,
  Primary_Enrollment_Channel: 'Call Center',
  Primary_Enrollment_Reason: 'Affordability Barrier',
  Num_Claims: 15,
  Num_Refills: 12,
  Average_Days_Supply: 30,
  Total_Patient_Paid: 350.00,
  Average_Patient_Paid: 29.16,
  Average_Refill_Gap: 2.5,
  Maximum_Refill_Gap: 7,
  Copay_Claims_Count: 10,
  Total_Copay_Used: 1000.00,
  Total_Copay_Savings: 800.00,
  Fund_Exhausted_Any: 0,
  Copay_Utilization_Rate: 0.67,
  Num_Interactions: 12,
  Num_Financial_Assistance_Interactions: 4,
  Num_Adherence_Counseling_Interactions: 2,
  Follow_Up_Rate: 0.58,
  Resolution_Rate: 0.75,
  No_Response_Rate: 0.15,
  Escalation_Rate: 0.05,
  PDC: 0.85,
  Persistence_Days: 240,
  Persistence_Months: 8
};

// Valid churn payload for regression checking
const validChurnPayload = {
  age: 54,
  gender: 'Female',
  region: 'South',
  insuranceType: 'Commercial',
  diseaseCondition: 'Condition_A',
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
  console.log('--- Starting Patient Segmentation Tests ---');
  
  // Start server on dynamic port
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

  // 1. GET /api/health regression
  await test('GET /api/health works correctly', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
  });

  // 2. Churn Prediction API regression
  await test('POST /api/ml/churn-prediction regression check', async () => {
    const res = await fetch(`${baseUrl}/ml/churn-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validChurnPayload)
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.churnPrediction, 'Churned');
  });

  // 3. Missing Patient_ID
  await test('POST /api/ml/patient-segmentation fails on missing Patient_ID', async () => {
    const invalidPayload = { ...validPayload };
    delete invalidPayload.Patient_ID;

    const res = await fetch(`${baseUrl}/ml/patient-segmentation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'Patient_ID'));
  });

  // 4. Missing required feature
  await test('POST /api/ml/patient-segmentation fails on missing feature', async () => {
    const invalidPayload = { ...validPayload };
    delete invalidPayload.Age;

    const res = await fetch(`${baseUrl}/ml/patient-segmentation`, {
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

  // 5. Invalid numeric feature
  await test('POST /api/ml/patient-segmentation fails on non-numeric age value', async () => {
    const invalidPayload = { ...validPayload, Age: 'fifty-four' };

    const res = await fetch(`${baseUrl}/ml/patient-segmentation`, {
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

  // 6. Invalid range for rate/proportion fields
  await test('POST /api/ml/patient-segmentation fails on PDC range violation (> 1)', async () => {
    const invalidPayload = { ...validPayload, PDC: 1.25 };

    const res = await fetch(`${baseUrl}/ml/patient-segmentation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.some(d => d.field === 'PDC'));
  });

  // 7. Verify missing model artifacts error code
  await test('POST /api/ml/patient-segmentation returns 503 if artifacts are missing', async () => {
    const origDir = process.env.SEGMENTATION_MODEL_DIR;
    process.env.SEGMENTATION_MODEL_DIR = 'non_existent_folder';
    
    try {
      const res = await fetch(`${baseUrl}/ml/patient-segmentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload)
      });
      assert.strictEqual(res.status, 503);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'SEGMENTATION_MODEL_UNAVAILABLE');
    } finally {
      if (origDir === undefined) {
        delete process.env.SEGMENTATION_MODEL_DIR;
      } else {
        process.env.SEGMENTATION_MODEL_DIR = origDir;
      }
    }
  });

  // 8. Real model invocation
  await test('POST /api/ml/patient-segmentation successfully invokes Python and returns segment', async () => {
    const res = await fetch(`${baseUrl}/ml/patient-segmentation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload)
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.patient_id, 'PAT-00001');
    assert.ok(typeof body.data.cluster_id === 'number');
    assert.ok(body.data.cluster_id >= 0 && body.data.cluster_id <= 3);
    assert.ok(typeof body.data.segment_name === 'string');
    assert.strictEqual(res.headers.get('x-ml-fallback'), null);
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
