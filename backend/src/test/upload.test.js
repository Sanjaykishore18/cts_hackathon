const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const xlsx = require('xlsx');

// Set env variables for tests before importing modules
process.env.JWT_SECRET = 'test_secret_key_upload';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SQLITE_DB_PATH = 'src/database/auth_test_upload.db';
process.env.UPLOAD_STORAGE_ROOT = './uploads_test';
process.env.UPLOAD_UNKNOWN_SHEET_BEHAVIOR = 'ignore';
process.env.NODE_ENV = 'test';

const dotenv = require('dotenv');
dotenv.config();

const app = require('../app');
const db = require('../database/db.sqlite');
const authService = require('../services/auth.service');

// Clean up and recreate test DB schema
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

  const res = await fetch(`${baseUrl}/uploads`, {
    method: 'POST',
    headers,
    body: formData
  });
  return res;
}

async function runTests() {
  console.log('--- Starting File Upload Integration Tests ---');

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
  let token = '';
  let userId = '';
  try {
    const userRes = await authService.register('uploaduser', 'upload@example.com', 'password123');
    userId = userRes.id;
    const loginRes = await authService.login('upload@example.com', 'password123');
    token = loginRes.token;
  } catch (e) {
    console.error('Failed to register mock user:', e);
    process.exit(1);
  }

  const sample1Path = 'test-fixtures/upload/SAMPLE_1.XLS';
  const sample2Path = 'test-fixtures/upload/SAMPLE_2.XLS';

  const sample1Buffer = fs.readFileSync(sample1Path);
  const sample2Buffer = fs.readFileSync(sample2Path);

  // 1. Valid patient XLSX (HTTP 202)
  await test('1. Valid patient XLSX -> HTTP 202', async () => {
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }]);
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.batch_id);
    assert.strictEqual(body.data.status, 'Accepted');
  });

  // 2. Valid business XLSX (HTTP 202)
  await test('2. Valid business XLSX -> HTTP 202', async () => {
    const res = await uploadFiles(baseUrl, token, 'business', [{ name: 'SAMPLE_2.XLS', buffer: sample2Buffer }]);
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.batch_id);
    assert.strictEqual(body.data.status, 'Accepted');
  });

  // Helper to extract CSV buffers from Excel
  const getCsvBuffersFromExcel = (buffer) => {
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const list = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const csvStr = xlsx.utils.sheet_to_csv(sheet);
      list.push({
        name: `${sheetName}.csv`,
        buffer: Buffer.from(csvStr, 'utf8')
      });
    }
    return list;
  };

  // 3. Valid CSV upload (HTTP 202)
  await test('3. Valid CSV upload -> HTTP 202', async () => {
    const csvFiles = getCsvBuffersFromExcel(sample1Buffer);
    const res = await uploadFiles(baseUrl, token, 'patient', csvFiles);
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });

  // 4. Multiple CSV files in one request (sharing one batch_id)
  await test('4. Multiple CSV files share same batch_id', async () => {
    const csvFiles = getCsvBuffersFromExcel(sample1Buffer);
    const res = await uploadFiles(baseUrl, token, 'patient', csvFiles);
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    const batchId = body.data.batch_id;

    // Verify manifest links them under same batch path
    const manifestPath = path.join(process.env.UPLOAD_STORAGE_ROOT, String(userId), batchId, 'patient', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.batch_id, batchId);
    assert.strictEqual(manifest.files.length, csvFiles.length);
  });

  // 5. Per-file size >25 MB (HTTP 413)
  await test('5. Per-file size >25 MB -> HTTP 413', async () => {
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26 MB
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'large.xlsx', buffer: largeBuffer }]);
    assert.strictEqual(res.status, 413);
  });

  // 6. Request size >60 MB (HTTP 413)
  await test('6. Request size >60 MB -> HTTP 413', async () => {
    const size = 21 * 1024 * 1024;
    const res = await uploadFiles(baseUrl, token, 'patient', [
      { name: 'large1.xlsx', buffer: Buffer.alloc(size) },
      { name: 'large2.xlsx', buffer: Buffer.alloc(size) },
      { name: 'large3.xlsx', buffer: Buffer.alloc(size) }
    ]);
    assert.strictEqual(res.status, 413);
  });

  // 7. Unsupported file type (HTTP 422)
  await test('7. Unsupported file type -> HTTP 422', async () => {
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'invalid.txt', buffer: Buffer.from('hello') }]);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'UPLOAD_VALIDATION_ERROR');
  });

  // 8. Malformed workbook (HTTP 422)
  await test('8. Malformed workbook -> HTTP 422', async () => {
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: Buffer.from('malformed content') }]);
    assert.strictEqual(res.status, 422);
  });

  // Helper to modify workbook in memory
  const getModifiedWorkbookBuffer = (originalBuffer, modifyFn) => {
    const wb = xlsx.read(originalBuffer, { type: 'buffer' });
    modifyFn(wb);
    return xlsx.write(wb, { type: 'buffer', bookType: 'xls' });
  };

  // 9. Missing required sheet (HTTP 422)
  await test('9. Missing required sheet -> HTTP 422', async () => {
    const modBuffer = getModifiedWorkbookBuffer(sample1Buffer, (wb) => {
      delete wb.Sheets['Patient'];
      wb.SheetNames = wb.SheetNames.filter(n => n !== 'Patient');
    });
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: modBuffer }]);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.ok(JSON.stringify(body).includes('missing required sheets'));
  });

  // 10. Missing required column (HTTP 422)
  await test('10. Missing required column -> HTTP 422', async () => {
    const modBuffer = getModifiedWorkbookBuffer(sample1Buffer, (wb) => {
      const sheet = wb.Sheets['Patient'];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const ageIdx = data[0].indexOf('Age');
      if (ageIdx !== -1) {
        for (const row of data) {
          row.splice(ageIdx, 1);
        }
      }
      wb.Sheets['Patient'] = xlsx.utils.aoa_to_sheet(data);
    });
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: modBuffer }]);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.ok(JSON.stringify(body).includes('Column header mismatch'));
  });

  // 11. Extra column check (fails HTTP 422 because headers do not match exactly)
  await test('11. Extra column -> HTTP 422', async () => {
    const modBuffer = getModifiedWorkbookBuffer(sample1Buffer, (wb) => {
      const sheet = wb.Sheets['Patient'];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      data[0].push('Extra_Column');
      for (let i = 1; i < data.length; i++) {
        data[i].push('some-value');
      }
      wb.Sheets['Patient'] = xlsx.utils.aoa_to_sheet(data);
    });
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: modBuffer }]);
    assert.strictEqual(res.status, 422);
  });

  // 12. Datatype mismatch (HTTP 422)
  await test('12. Datatype mismatch -> HTTP 422', async () => {
    const modBuffer = getModifiedWorkbookBuffer(sample1Buffer, (wb) => {
      const sheet = wb.Sheets['Patient'];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const ageIdx = data[0].indexOf('Age');
      data[1][ageIdx] = 'not-a-number';
      wb.Sheets['Patient'] = xlsx.utils.aoa_to_sheet(data);
    });
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: modBuffer }]);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.ok(JSON.stringify(body).includes('not valid for type \'number\''));
  });

  // 13. Non-nullable field violation (HTTP 422)
  await test('13. Non-nullable field violation -> HTTP 422', async () => {
    const modBuffer = getModifiedWorkbookBuffer(sample1Buffer, (wb) => {
      const sheet = wb.Sheets['Patient'];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const idIdx = data[0].indexOf('Patient_ID');
      data[1][idIdx] = '';
      wb.Sheets['Patient'] = xlsx.utils.aoa_to_sheet(data);
    });
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: modBuffer }]);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.ok(JSON.stringify(body).includes('is non-nullable but contains empty/null value'));
  });

  // 14. SHA-256 duplicate (idempotent duplicate batch ID return)
  await test('14. SHA-256 duplicate returns identical batch_id', async () => {
    // 1. Upload first time
    const res1 = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }]);
    const body1 = await res1.json();
    const batchId1 = body1.data.batch_id;

    // 2. Upload same file again
    const res2 = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }]);
    const body2 = await res2.json();
    const batchId2 = body2.data.batch_id;

    assert.strictEqual(batchId1, batchId2);
  });

  // 15. New batch generates new batch_id
  await test('15. Modified content generates new batch_id', async () => {
    const res1 = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }]);
    const body1 = await res1.json();
    const batchId1 = body1.data.batch_id;

    // Modify a cell slightly (e.g. baseline risk value) but keep types/nulls valid
    const modBuffer = getModifiedWorkbookBuffer(sample1Buffer, (wb) => {
      const sheet = wb.Sheets['Patient'];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const riskIdx = data[0].indexOf('Baseline_Risk');
      data[1][riskIdx] = 0.99;
      wb.Sheets['Patient'] = xlsx.utils.aoa_to_sheet(data);
    });

    const res2 = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: modBuffer }]);
    const body2 = await res2.json();
    const batchId2 = body2.data.batch_id;

    assert.notStrictEqual(batchId1, batchId2);
  });

  // 16. Manifest generation
  await test('16. Manifest has correct metadata structure', async () => {
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }]);
    const body = await res.json();
    const batchId = body.data.batch_id;

    const manifestPath = path.join(process.env.UPLOAD_STORAGE_ROOT, String(userId), batchId, 'patient', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.strictEqual(manifest.batch_id, batchId);
    assert.strictEqual(manifest.tenant_id, userId);
    assert.strictEqual(manifest.source_system, 'patient');
    assert.ok(manifest.upload_timestamp);
    assert.strictEqual(manifest.status, 'Accepted');
    assert.strictEqual(manifest.files[0].original_name, 'SAMPLE_1.XLS');
    assert.ok(manifest.files[0].sha256);
    assert.strictEqual(manifest.files[0].format, 'XLS');
    assert.ok(manifest.policy_warnings);
  });

  // 17. Correct storage path
  await test('17. Stored files are written to correct partition path', async () => {
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }]);
    const body = await res.json();
    const batchId = body.data.batch_id;

    const expectedFilePath = path.join(process.env.UPLOAD_STORAGE_ROOT, String(userId), batchId, 'patient', 'SAMPLE_1.XLS');
    assert.ok(fs.existsSync(expectedFilePath));
  });

  // 18. Unauthenticated request (HTTP 401)
  await test('18. Unauthenticated request -> HTTP 401', async () => {
    const res = await uploadFiles(baseUrl, null, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }]);
    assert.strictEqual(res.status, 401);
  });

  // 19. Unauthorized request (HTTP 403)
  await test('19. Unauthorized request -> HTTP 403', async () => {
    // Send request with valid token but x-mock-role set to unauthorized
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }], 'unauthorized');
    assert.strictEqual(res.status, 403);
  });

  // 20. Sample fixture is accepted at Tier-1 even if it would fail Tier-2 referential integrity
  await test('20. Original SAMPLE_1.XLS passes Tier-1 validation', async () => {
    const res = await uploadFiles(baseUrl, token, 'patient', [{ name: 'SAMPLE_1.XLS', buffer: sample1Buffer }]);
    assert.strictEqual(res.status, 202);
  });

  // Cleanup
  if (server.closeAllConnections) {
    server.closeAllConnections();
  }

  server.close(() => {
    console.log(`\nUpload Tests finished: ${passed} passed, ${failed} failed.`);
    // Clean up test DB and uploads directory
    try {
      db.close();
      const testDbPath = path.resolve(process.cwd(), 'src/database/auth_test_upload.db');
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      removeDirRecursive(process.env.UPLOAD_STORAGE_ROOT);
    } catch (e) {
      console.error('Error cleaning up test fixtures:', e.message);
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
