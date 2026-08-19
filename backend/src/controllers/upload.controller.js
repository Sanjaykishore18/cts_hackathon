const uploadService = require('../services/upload.service');

class UploadController {
  async upload(req, res, next) {
    try {
      const sourceSystem = req.body.source_system;
      const files = req.files;
      const tenantId = process.env.DEFAULT_TENANT_ID || 'tenant_default';
      const uploadedBy = req.user ? req.user.username : 'anonymous';
      const uploadedAt = new Date();

      const result = await uploadService.processUpload(tenantId, sourceSystem, files, uploadedBy, uploadedAt);

      res.status(202).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UploadController();
