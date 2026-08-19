const uploadStatusRepository = require('../repositories/upload-status.repository');

class UploadStatusService {
  async getStatus(batchId, tenantId) {
    const status = await uploadStatusRepository.getStatus(batchId, tenantId);
    if (!status) {
      const error = new Error(`Batch status with ID ${batchId} not found`);
      error.status = 404;
      error.code = 'BATCH_NOT_FOUND';
      throw error;
    }
    return status;
  }

  async createBatch(batchId, tenantId) {
    return uploadStatusRepository.createBatch(batchId, tenantId);
  }
}

module.exports = new UploadStatusService();
