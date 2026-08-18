require('dotenv').config();
const assert = require('assert');
const app = require('../app');

async function runE2eRestTests() {
  console.log('--- Starting Final End-to-End REST ML Integration Verification ---');

  // Start the server on a free port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Server started dynamically on ${baseUrl}`);

  let token = null;

  try {
    // 1. Perform Authentication Login (or Register if needed)
    console.log('\nRegistering a test user for auth...');
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `test_e2e_${Date.now()}`,
        email: `e2e_${Date.now()}@example.com`,
        password: 'securePassword123'
      })
    });
    const regJson = await regRes.json();
    assert.strictEqual(regRes.status, 201, `Registration failed: ${JSON.stringify(regJson)}`);

    console.log('Logging in to acquire JWT token...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: regJson.data.user.username,
        password: 'securePassword123'
      })
    });
    const loginJson = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, `Login failed: ${JSON.stringify(loginJson)}`);
    token = loginJson.data.token;
    console.log('JWT Token successfully acquired!');

    // Helper headers
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Test 1: Authentication Check (401 Unauthorized)
    console.log('\nTesting Authentication Check (No Token)...');
    const noAuthRes = await fetch(`${baseUrl}/api/ml/churn-prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Patient_ID: 'P00001' })
    });
    assert.strictEqual(noAuthRes.status, 401, 'Expected 401 for request without token');
    console.log('✅ Auth check (no token) passed.');

    console.log('Testing Authentication Check (Invalid Token)...');
    const badAuthRes = await fetch(`${baseUrl}/api/ml/churn-prediction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid_token_xyz'
      },
      body: JSON.stringify({ Patient_ID: 'P00001' })
    });
    assert.strictEqual(badAuthRes.status, 401, 'Expected 401 for invalid token');
    console.log('✅ Auth check (invalid token) passed.');

    // Test 2: Churn Prediction End-to-End
    console.log('\nTesting Churn Prediction E2E (POST /api/ml/churn-prediction)...');
    const churnRes = await fetch(`${baseUrl}/api/ml/churn-prediction`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ Patient_ID: 'P00001' })
    });
    const churnJson = await churnRes.json();
    assert.strictEqual(churnRes.status, 200, `Churn E2E failed: ${JSON.stringify(churnJson)}`);
    assert.ok(churnJson.success, 'Response success should be true');
    assert.ok(typeof churnJson.data.churnProbability === 'number', 'churnProbability should be a number');
    assert.ok(churnJson.data.churnProbability >= 0 && churnJson.data.churnProbability <= 1, 'churnProbability range invalid');
    assert.ok(['Active', 'Churned'].includes(churnJson.data.churnPrediction), 'churnPrediction status invalid');
    console.log('✅ Churn E2E Result:', churnJson.data);

    // Test 3: Patient Segmentation End-to-End
    console.log('\nTesting Patient Segmentation E2E (POST /api/ml/patient-segmentation)...');
    const segRes = await fetch(`${baseUrl}/api/ml/patient-segmentation`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ Patient_ID: 'P00001' })
    });
    const segJson = await segRes.json();
    assert.strictEqual(segRes.status, 200, `Segmentation E2E failed: ${JSON.stringify(segJson)}`);
    assert.ok(segJson.success, 'Response success should be true');
    assert.strictEqual(segJson.data.patient_id, 'P00001');
    assert.ok(typeof segJson.data.cluster_id === 'number', 'cluster_id must be a number');
    assert.ok(segJson.data.cluster_id >= 0 && segJson.data.cluster_id <= 3, 'cluster_id out of range');
    assert.ok(typeof segJson.data.segment_name === 'string', 'segment_name must be a string');
    console.log('✅ Segmentation E2E Result:', segJson.data);

    // Test 4: Strategy Effectiveness End-to-End
    console.log('\nTesting Strategy Effectiveness E2E (POST /api/ml/strategy-effectiveness)...');
    const strategyRes = await fetch(`${baseUrl}/api/ml/strategy-effectiveness`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ Patient_ID: 'P00001', treatmentStartDate: '2026-08-15' })
    });
    const strategyJson = await strategyRes.json();
    assert.strictEqual(strategyRes.status, 200, `Strategy E2E failed: ${JSON.stringify(strategyJson)}`);
    assert.ok(strategyJson.success, 'Response success should be true');
    assert.ok(typeof strategyJson.data.predicted_pdc === 'number', 'predicted_pdc must be a number');
    console.log('✅ Strategy E2E Result:', strategyJson.data);

    // Test 5: Failure cases (Non-existent patient)
    console.log('\nTesting Failure Case (Non-existent patient ID)...');
    const badPatientRes = await fetch(`${baseUrl}/api/ml/churn-prediction`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ Patient_ID: 'P99999' })
    });
    const badPatientJson = await badPatientRes.json();
    assert.strictEqual(badPatientRes.status, 404, `Expected 404, got ${badPatientRes.status}`);
    assert.strictEqual(badPatientJson.success, false);
    assert.strictEqual(badPatientJson.error.code, 'PATIENT_NOT_FOUND');
    console.log('✅ Failure case (non-existent patient ID) passed.');

  } catch (err) {
    console.error('\n❌ E2E REST Verification failed:', err.message);
    server.close();
    process.exit(1);
  }

  console.log('\n--- All REST end-to-end integration tests completed successfully! ---');
  server.close();
  process.exit(0);
}

runE2eRestTests();
