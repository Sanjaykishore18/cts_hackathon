const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const crypto = require('crypto');

// Set env variables for tests before importing modules
process.env.JWT_SECRET = 'test_secret_key_upload_status_fabric';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SQLITE_DB_PATH = 'src/database/auth_test_status_fabric.db';
process.env.UPLOAD_STORAGE_ROOT = './uploads_status_fabric_test';
process.env.UPLOAD_UNKNOWN_SHEET_BEHAVIOR = 'ignore';
process.env.NODE_ENV = 'test';

const dotenv = require('dotenv');
dotenv.config();

const app = require('../app');
const db = require('../database/db.sqlite');
const authService = require('../services/auth.service');
const uploadStatusRepository = require('../repositories/upload-status.repository');
const { statusQuery } = require('../config/fabric');

// Clean up and recreate SQLite test DB schema
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

async function uploadFiles(baseUrl, token, sourceSystem, filesList, mockRole = 'uploader') {
  const formData = new FormData();
  formData.append('source_system', sourceSystem);
  for (const f of filesList) {
    const blob = new Blob([f.buffer], { type: 'application/octet-stream' });
    formData.append('files', blob, f.name);
  }

  const headers = {};
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

function generateBatchId() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const MM = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const HH = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const hex = crypto.randomBytes(3).toString('hex').toLowerCase();
  return `B${yyyy}${MM}${dd}T${HH}${mm}${ss}Z-${hex}`;
}

async function runTests() {
  console.log('--- Starting Fabric ETL Status API Integration Tests ---');

  // Clean test uploads storage directory
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

  // Set up mock authenticated user and token
  const username = 'testfabuser';
  const email = 'testfabuser@example.com';
  const password = 'Password123!';
  const registerRes = await authService.register(username, email, password);
  const loginRes = await authService.login(email, password);
  const token = loginRes.token;

  // Read valid spreadsheet buffers from test fixtures
  const sample1Path = 'test-fixtures/upload/SAMPLE_1.XLS';
  const sample1Buffer = fs.readFileSync(sample1Path);

  // 1-8. Direct SQL-based lifecycle tests
  const testBatchId = generateBatchId();
  const tenantId = 'tenant_default';
  const uploadedAt = new Date();

  await test('Repository: createBatch creates a pending batch event in Fabric', async () => {
    const success = await uploadStatusRepository.createBatch(testBatchId, tenantId, username, uploadedAt);
    assert.strictEqual(success, true);
  });

  await test('Repository: getStatus reads the pending status and checks elapsed_seconds is null', async () => {
    const status = await uploadStatusRepository.getStatus(testBatchId, tenantId);
    assert.ok(status);
    assert.strictEqual(status.batch_id, testBatchId);
    assert.strictEqual(status.status, 'pending');
    assert.strictEqual(status.stage, 'uploaded');
    assert.strictEqual(status.progress_pct, 5);
    assert.strictEqual(status.tables_expected, 18);
    assert.strictEqual(status.uploaded_by, username);
    assert.strictEqual(status.is_terminal, false);
    assert.strictEqual(status.elapsed_seconds, null); // NULL elapsed_seconds when pending
  });

  await test('Repository: insertEvent appends a running event in Fabric', async () => {
    const success = await uploadStatusRepository.insertEvent({
      batch_id: testBatchId,
      tenant_id: tenantId,
      sequence_no: 2,
      status: 'running',
      stage: 'silver',
      progress_pct: 50,
      tables_expected: 18,
      tables_loaded: 2,
      rows_loaded: 1200,
      dq_error_count: 0,
      uploaded_by: username,
      uploaded_at: uploadedAt,
      event_at: new Date(Date.now() - 5000) // 5 seconds ago
    });
    assert.strictEqual(success, true);
  });

  await test('Repository: getStatus reads running status and checks elapsed_seconds is populated', async () => {
    const status = await uploadStatusRepository.getStatus(testBatchId, tenantId);
    assert.ok(status);
    assert.strictEqual(status.status, 'running');
    assert.strictEqual(status.stage, 'silver');
    assert.strictEqual(status.progress_pct, 50);
    assert.strictEqual(status.is_terminal, false);
    assert.ok(status.elapsed_seconds !== null && status.elapsed_seconds !== undefined);
    assert.ok(status.elapsed_seconds >= 4);
  });

  await test('Repository: insertEvent appends a success event in Fabric', async () => {
    const success = await uploadStatusRepository.insertEvent({
      batch_id: testBatchId,
      tenant_id: tenantId,
      sequence_no: 3,
      status: 'success',
      stage: 'complete',
      progress_pct: 100,
      tables_expected: 18,
      tables_loaded: 18,
      rows_loaded: 5400,
      dq_error_count: 1,
      uploaded_by: username,
      uploaded_at: uploadedAt,
      event_at: new Date()
    });
    assert.strictEqual(success, true);
  });

  await test('Repository: getStatus reads success status and checks is_terminal is true', async () => {
    const status = await uploadStatusRepository.getStatus(testBatchId, tenantId);
    assert.ok(status);
    assert.strictEqual(status.status, 'success');
    assert.strictEqual(status.stage, 'complete');
    assert.strictEqual(status.progress_pct, 100);
    assert.strictEqual(status.is_terminal, true);
  });

  await test('Repository: verify timeline ordering from dbo.vw_etl_batch_timeline', async () => {
    const timelineRes = await statusQuery(
      'SELECT * FROM dbo.vw_etl_batch_timeline WHERE batch_id = @param1 ORDER BY sequence_no',
      [testBatchId]
    );
    const timeline = timelineRes.rows;
    assert.strictEqual(timeline.length, 3);
    assert.strictEqual(timeline[0].status, 'pending');
    assert.strictEqual(timeline[1].status, 'running');
    assert.strictEqual(timeline[2].status, 'success');
  });

  await test('Repository/API: tenant isolation filters status queries properly', async () => {
    // Isolated batch with tenant_other
    const otherBatchId = generateBatchId();
    await uploadStatusRepository.createBatch(otherBatchId, 'tenant_other', username, uploadedAt);

    // Query status with mismatch tenant (tenant_default)
    const status = await uploadStatusRepository.getStatus(otherBatchId, 'tenant_default');
    assert.strictEqual(status, null);

    // Query via endpoint (which defaults to tenantId=tenant_default)
    const statusRes = await fetch(`${baseUrl}/uploads/${otherBatchId}/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(statusRes.status, 404);
  });

  // 9. Unknown batch status return 404
  await test('GET /uploads/unknown-batch/status returns 404 Not Found', async () => {
    const unknownBatchId = 'B20260819T120000Z-abcdef';
    const statusRes = await fetch(`${baseUrl}/uploads/${unknownBatchId}/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(statusRes.status, 404);
  });

  // 10. Malformed batch ID returns 400
  await test('GET /uploads/invalid-id/status returns 400 Bad Request', async () => {
    const statusRes = await fetch(`${baseUrl}/uploads/invalid-id/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(statusRes.status, 400);
    const body = await statusRes.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  // 11. Fabric connection failure handling
  await test('GET /uploads/:batchId/status handles connection failure gracefully', async () => {
    const originalGetStatus = uploadStatusRepository.getStatus;
    uploadStatusRepository.getStatus = async () => {
      throw new Error('Fabric connection failed');
    };

    try {
      const statusRes = await fetch(`${baseUrl}/uploads/${testBatchId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      assert.strictEqual(statusRes.status, 500);
      const body = await statusRes.json();
      assert.strictEqual(body.success, false);
    } finally {
      uploadStatusRepository.getStatus = originalGetStatus;
    }
  });

  // 12. REAL API End-to-End Flow: POST /uploads → GET status
  await test('REAL API flow: POST /uploads creates pending status row and GET checks it', async () => {
    const uploadRes = await uploadFiles(baseUrl, token, 'patient', [
      { name: 'SAMPLE_1.XLS', buffer: sample1Buffer }
    ]);
    assert.strictEqual(uploadRes.status, 202);
    const body = await uploadRes.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.batch_id);

    const batchId = body.data.batch_id;

    // Retrieve via endpoint
    const statusRes = await fetch(`${baseUrl}/uploads/${batchId}/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(statusRes.status, 200);
    const sBody = await statusRes.json();
    assert.strictEqual(sBody.success, true);
    assert.strictEqual(sBody.data.batch_id, batchId);
    assert.strictEqual(sBody.data.status, 'pending');
    assert.strictEqual(sBody.data.stage, 'uploaded');
    assert.strictEqual(sBody.data.progress_pct, 5);
    assert.strictEqual(sBody.data.tables_expected, 18);
    assert.strictEqual(sBody.data.uploaded_by, username);
    assert.strictEqual(sBody.data.is_terminal, false);
    assert.strictEqual(sBody.data.elapsed_seconds, null);
    assert.strictEqual(sBody.data.fabric_run_url, null); // backward compatibility compatibility field
  });

  server.close();
  console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
