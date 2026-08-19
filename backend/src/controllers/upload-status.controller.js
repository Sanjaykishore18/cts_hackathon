const uploadStatusService = require('../services/upload-status.service');

class UploadStatusController {
  async getStatus(req, res, next) {
    try {
      const { batchId } = req.params;
      
      // Use the clearly documented development-only tenant ID fallback
      // since the database schema lacks an authentic tenant model.
      const tenantId = process.env.DEFAULT_TENANT_ID || 'tenant_default';

      const status = await uploadStatusService.getStatus(batchId, tenantId);

      // Return only the fields defined in the database view (vw_etl_batch_status)
      res.status(200).json({
        success: true,
        data: {
          batch_id: status.batch_id,
          tenant_id: status.tenant_id,
          status: status.status,
          stage: status.stage,
          progress_pct: status.progress_pct,
          tables_expected: status.tables_expected,
          tables_loaded: status.tables_loaded,
          rows_loaded: status.rows_loaded,
          dq_error_count: status.dq_error_count,
          error_code: status.error_code,
          error_message: status.error_message,
          fabric_job_id: status.fabric_job_id,
          notebook_batch_id: status.notebook_batch_id,
          // Backward-compatible API response shape compatibility field
          fabric_run_url: status.fabric_run_url,
          uploaded_by: status.uploaded_by,
          uploaded_at: status.uploaded_at,
          etl_started_at: status.etl_started_at,
          etl_completed_at: status.etl_completed_at,
          is_terminal: status.is_terminal,
          elapsed_seconds: status.elapsed_seconds
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UploadStatusController();
