const crypto = require('crypto');
const path = require('path');
const xlsx = require('xlsx');
const contract = require('../config/upload_contracts.json');
const storageRepo = require('../repositories/upload-storage.repository');
const uploadStatusRepository = require('../repositories/upload-status.repository');

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

function calculateSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isValidNumber(val) {
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'string') {
    return !isNaN(Number(val)) && val.trim() !== '';
  }
  return false;
}

function isValidBoolean(val) {
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return val === 0 || val === 1;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return lower === 'true' || lower === 'false' || lower === '1' || lower === '0' || lower === 'yes' || lower === 'no';
  }
  return false;
}

function isValidDate(val) {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') return val > 0; // Excel serial date
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return !isNaN(parsed);
  }
  return false;
}

class UploadService {
  constructor() {
    this.contract = contract;
    this.unknownSheetBehavior = process.env.UPLOAD_UNKNOWN_SHEET_BEHAVIOR || 'ignore';
  }

  async processUpload(tenantId, sourceSystem, files, uploadedBy = 'anonymous', uploadedAt = new Date()) {
    // 1. Verify source system
    if (sourceSystem !== 'patient' && sourceSystem !== 'business') {
      const err = new Error("Invalid source_system. Must be 'patient' or 'business'.");
      err.status = 422;
      err.code = 'UPLOAD_VALIDATION_ERROR';
      throw err;
    }

    if (!files || files.length === 0) {
      const err = new Error('No files provided in request.');
      err.status = 422;
      err.code = 'UPLOAD_VALIDATION_ERROR';
      throw err;
    }

    // 2. Enforce limits
    const maxFileSize = 25 * 1024 * 1024; // 25 MB
    const maxRequestSize = 60 * 1024 * 1024; // 60 MB
    let totalRequestSize = 0;

    for (const file of files) {
      if (file.size > maxFileSize) {
        const err = new Error(`File size of ${file.originalname} exceeds per-file limit of 25 MB.`);
        err.status = 413;
        err.code = 'PAYLOAD_TOO_LARGE';
        throw err;
      }
      totalRequestSize += file.size;
    }

    if (totalRequestSize > maxRequestSize) {
      const err = new Error('Total request size exceeds maximum limit of 60 MB.');
      err.status = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }

    // Get defined tables for this source system
    const systemTables = Object.entries(this.contract.tables)
      .filter(([_, t]) => t.source_system === sourceSystem)
      .map(([name, t]) => ({ name, ...t }));

    const expectedSheetNames = systemTables.map(t => t.sheet);

    // 3. Parse and run Tier-1 validations
    const fileMetadataList = [];
    const validationErrors = [];
    let isAllDuplicate = true;
    let duplicateBatchId = null;

    // We keep track of file hashes
    const fileHashes = [];

    for (const file of files) {
      const sha256 = calculateSha256(file.buffer);
      fileHashes.push({ file, sha256 });

      const existingBatch = await storageRepo.findDuplicateBatch(sha256, tenantId);
      if (!existingBatch) {
        isAllDuplicate = false;
      } else {
        duplicateBatchId = existingBatch;
      }

      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.xlsx' && ext !== '.xls' && ext !== '.csv') {
        validationErrors.push({
          file: file.originalname,
          message: `Unsupported file extension: ${ext}. Only .xlsx, .xls, and .csv are supported.`
        });
        continue;
      }

      let workbook;
      try {
        workbook = xlsx.read(file.buffer, { type: 'buffer', cellDates: true });
      } catch (e) {
        validationErrors.push({
          file: file.originalname,
          message: `Failed to parse Excel/CSV structure: ${e.message}`
        });
        continue;
      }

      // Check sheets
      if (ext === '.csv') {
        // CSV is represented as a single sheet. Map filename to table.
        const baseName = path.basename(file.originalname, ext).trim();
        // find matching table by sheet name or table name case-insensitively
        const matchingTable = systemTables.find(
          t => t.sheet.toLowerCase() === baseName.toLowerCase() || t.name.toLowerCase() === baseName.toLowerCase()
        );

        if (!matchingTable) {
          if (this.unknownSheetBehavior === 'reject') {
            validationErrors.push({
              file: file.originalname,
              message: `CSV file does not map to any recognized table schema in ${sourceSystem} source system.`
            });
          }
          continue;
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        this._validateSheet(file.originalname, matchingTable.sheet, sheet, matchingTable, validationErrors);

        fileMetadataList.push({
          original_name: file.originalname,
          format: 'CSV',
          dataset_identity: matchingTable.name,
          file_size: file.size,
          sha256,
          buffer: file.buffer
        });
      } else {
        // Excel Workbook: contains multiple sheets
        const sheetNames = workbook.SheetNames;

        // Check for unrecognized sheets if behavior is reject
        if (this.unknownSheetBehavior === 'reject') {
          for (const sName of sheetNames) {
            if (!expectedSheetNames.includes(sName)) {
              validationErrors.push({
                file: file.originalname,
                message: `Workbook contains unrecognized sheet: ${sName}`
              });
            }
          }
        }

        // We must check sheets matching contract
        // A single workbook might contain all or a subset of sheets.
        let processedSheetsCount = 0;
        for (const sName of sheetNames) {
          const matchingTable = systemTables.find(t => t.sheet === sName);
          if (matchingTable) {
            processedSheetsCount++;
            const sheet = workbook.Sheets[sName];
            this._validateSheet(file.originalname, sName, sheet, matchingTable, validationErrors);
          }
        }

        if (processedSheetsCount === 0) {
          validationErrors.push({
            file: file.originalname,
            message: `Workbook does not contain any matching sheets for the ${sourceSystem} source system.`
          });
        }

        fileMetadataList.push({
          original_name: file.originalname,
          format: ext.toUpperCase().substring(1),
          dataset_identity: sourceSystem === 'patient' ? 'Patient_Workbook' : 'Business_Workbook',
          file_size: file.size,
          sha256,
          buffer: file.buffer
        });
      }
    }

    // Check for missing sheets in the upload batch
    if (extValidationSuccess(files)) {
      // For CSV, all tables must be provided
      const isCsvUpload = files.every(f => path.extname(f.originalname).toLowerCase() === '.csv');
      if (isCsvUpload) {
        const uploadedTables = fileMetadataList.map(m => m.dataset_identity);
        const missingTables = systemTables.filter(t => !uploadedTables.includes(t.name));
        if (missingTables.length > 0) {
          validationErrors.push({
            message: `Missing required tables for ${sourceSystem} source system: ${missingTables.map(t => t.name).join(', ')}`
          });
        }
      } else {
        // For Excel, the workbook must contain all expected sheets for the source system
        // Let's verify that the uploaded workbooks cover all required sheets
        const allUploadedSheets = [];
        for (const file of files) {
          const ext = path.extname(file.originalname).toLowerCase();
          if (ext === '.xlsx' || ext === '.xls') {
            try {
              const wb = xlsx.read(file.buffer, { type: 'buffer' });
              allUploadedSheets.push(...wb.SheetNames);
            } catch (e) {
              // already caught
            }
          }
        }
        const missingSheets = expectedSheetNames.filter(s => !allUploadedSheets.includes(s));
        if (missingSheets.length > 0) {
          validationErrors.push({
            message: `Workbook upload is missing required sheets: ${missingSheets.join(', ')}`
          });
        }
      }
    }

    if (validationErrors.length > 0) {
      const err = new Error('Tier-1 validation failed');
      err.status = 422;
      err.code = 'UPLOAD_VALIDATION_ERROR';
      err.details = validationErrors;
      throw err;
    }

    // 4. Return existing batch if all files are duplicates
    if (isAllDuplicate && duplicateBatchId) {
      return {
        batch_id: duplicateBatchId,
        status: 'Accepted'
      };
    }

    // 5. Save files and generate manifest
    const batchId = generateBatchId();

    const manifestFiles = [];
    for (const fMeta of fileMetadataList) {
      const storedPath = await storageRepo.saveFile(tenantId, batchId, sourceSystem, fMeta.original_name, fMeta.buffer);
      manifestFiles.push({
        original_name: fMeta.original_name,
        stored_path: storedPath.replace(/\\/g, '/'), // normalize windows paths
        file_size: fMeta.file_size,
        sha256: fMeta.sha256,
        format: fMeta.format,
        dataset_identity: fMeta.dataset_identity
      });
    }

    const manifest = {
      batch_id: batchId,
      tenant_id: tenantId,
      source_system: sourceSystem,
      upload_timestamp: new Date().toISOString(),
      files: manifestFiles,
      status: 'Accepted',
      policy_warnings: [
        'Batch completeness policy is pending confirmation.'
      ]
    };

    await storageRepo.saveManifest(tenantId, batchId, sourceSystem, manifest);

    // Save initial status to Fabric status metadata store
    await uploadStatusRepository.createBatch(batchId, tenantId, uploadedBy, uploadedAt);

    return {
      batch_id: batchId,
      status: 'Accepted'
    };
  }

  _validateSheet(filename, sheetName, sheet, tableConfig, errors) {
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (data.length === 0) {
      errors.push({
        file: filename,
        sheet: sheetName,
        message: 'Sheet is empty (no header row found).'
      });
      return;
    }

    const headers = data[0].map(h => (h !== null ? String(h).trim() : ''));
    const expectedHeaders = tableConfig.columns.map(c => c.name);

    // Validate headers exact match (name and sequence)
    if (headers.length !== expectedHeaders.length || headers.some((h, i) => h !== expectedHeaders[i])) {
      errors.push({
        file: filename,
        sheet: sheetName,
        message: `Column header mismatch. Expected: [${expectedHeaders.join(', ')}]. Observed: [${headers.join(', ')}].`
      });
      return;
    }

    // Validate rows
    for (let rIndex = 1; rIndex < data.length; rIndex++) {
      const row = data[rIndex];
      // Skip trailing empty rows that are sometimes generated by excel readers
      if (row.every(cell => cell === null || cell === '')) {
        continue;
      }

      for (let cIndex = 0; cIndex < tableConfig.columns.length; cIndex++) {
        const colDef = tableConfig.columns[cIndex];
        const cellValue = row[cIndex];

        // 1. Null check
        if (cellValue === null || cellValue === undefined || String(cellValue).trim() === '') {
          if (!colDef.nullable) {
            errors.push({
              file: filename,
              sheet: sheetName,
              row: rIndex + 1,
              column: colDef.name,
              message: `Column '${colDef.name}' is non-nullable but contains empty/null value.`
            });
          }
          continue;
        }

        // 2. Type validation
        if (colDef.type === 'number') {
          if (!isValidNumber(cellValue)) {
            errors.push({
              file: filename,
              sheet: sheetName,
              row: rIndex + 1,
              column: colDef.name,
              message: `Value '${cellValue}' is not valid for type 'number'.`
            });
          }
        } else if (colDef.type === 'boolean') {
          if (!isValidBoolean(cellValue)) {
            errors.push({
              file: filename,
              sheet: sheetName,
              row: rIndex + 1,
              column: colDef.name,
              message: `Value '${cellValue}' is not valid for type 'boolean'.`
            });
          }
        } else if (colDef.type === 'date') {
          if (!isValidDate(cellValue)) {
            errors.push({
              file: filename,
              sheet: sheetName,
              row: rIndex + 1,
              column: colDef.name,
              message: `Value '${cellValue}' is not valid for type 'date'.`
            });
          }
        }
      }
    }
  }
}

function extValidationSuccess(files) {
  return files.every(file => {
    const ext = path.extname(file.originalname).toLowerCase();
    return ext === '.xlsx' || ext === '.xls' || ext === '.csv';
  });
}

module.exports = new UploadService();
