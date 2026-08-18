const fs = require('fs');
const path = require('path');

class UploadStorageRepository {
  constructor() {
    this.storageRoot = process.env.UPLOAD_STORAGE_ROOT || './uploads';
  }

  getPartitionPath(tenantId, batchId, sourceSystem) {
    return path.join(this.storageRoot, String(tenantId), String(batchId), String(sourceSystem));
  }

  async saveFile(tenantId, batchId, sourceSystem, fileName, buffer) {
    const dir = this.getPartitionPath(tenantId, batchId, sourceSystem);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, fileName);
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

  async findDuplicateBatch(sha256) {
    const rootPath = path.resolve(this.storageRoot);
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
        if (manifest && Array.isArray(manifest.files)) {
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
