const uploadService = require('../services/upload.service');

class UploadController {
  async upload(req, res, next) {
    try {
      const sourceSystem = req.body.source_system;
      const files = req.files;
      // Get tenant_id from req.user.id (from decoded JWT) or fall back to default
      const tenantId = req.user ? req.user.id : 'default_tenant';

      const result = await uploadService.processUpload(tenantId, sourceSystem, files);

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
