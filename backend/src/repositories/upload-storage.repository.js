const fs = require('fs');
const path = require('path');

class UploadStorageRepository {
  constructor() {
    this.storageRoot = process.env.UPLOAD_STORAGE_ROOT || './uploads';
  }

  getPartitionPath(tenantId, batchId, sourceSystem) {
    const safeRegex = /^[a-zA-Z0-9_\-]+$/;
    if (!safeRegex.test(String(tenantId)) || !safeRegex.test(String(batchId)) || !safeRegex.test(String(sourceSystem))) {
      throw new Error('Invalid path segment or path traversal attempt detected.');
    }

    const resolvedPath = path.resolve(this.storageRoot, String(tenantId), String(batchId), String(sourceSystem));
    const absoluteRoot = path.resolve(this.storageRoot);

    if (!resolvedPath.startsWith(absoluteRoot)) {
      throw new Error('Path traversal attempt detected. Path escapes storage root.');
    }

    return resolvedPath;
  }

  async saveFile(tenantId, batchId, sourceSystem, fileName, buffer) {
    const dir = this.getPartitionPath(tenantId, batchId, sourceSystem);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const safeFileName = path.basename(fileName);
    const filePath = path.join(dir, safeFileName);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  async saveManifest(tenantId, batchId, sourceSystem, manifestObj) {
    const dir = this.getPartitionPath(tenantId, batchId, sourceSystem);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, 'manifest.json');
    fs.writeFileSync(filePath, JSON.stringify(manifestObj, null, 2), 'utf8');
    return filePath;
  }

  async findDuplicateBatch(sha256, tenantId) {
    if (!tenantId) {
      return null;
    }
    const rootPath = path.resolve(this.storageRoot, String(tenantId));
    if (!fs.existsSync(rootPath)) {
      return null;
    }

    const manifests = [];
    const walk = (dir) => {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          walk(fullPath);
        } else if (file === 'manifest.json') {
          manifests.push(fullPath);
        }
      }
    };

    try {
      walk(rootPath);
    } catch (e) {
      // Ignore read errors
    }

    for (const mPath of manifests) {
      try {
        const content = fs.readFileSync(mPath, 'utf8');
        const manifest = JSON.parse(content);
        if (manifest && manifest.tenant_id === tenantId && Array.isArray(manifest.files)) {
          for (const f of manifest.files) {
            if (f.sha256 === sha256) {
              return manifest.batch_id;
            }
          }
        }
      } catch (err) {
        // Ignore read/parse errors
      }
    }
    return null;
  }
}

module.exports = new UploadStorageRepository();
