const { statusQuery } = require('../config/fabric');
const crypto = require('crypto');

class UploadStatusRepository {
  /**
   * Retrieves the current batch status from the Fabric-native view
   * @param {string} batchId 
   * @param {string} tenantId 
   * @returns {Promise<Object|null>} Status row or null
   */
  async getStatus(batchId, tenantId) {
    const queryText = `
      SELECT batch_id, tenant_id, status, stage, progress_pct,
             tables_expected, tables_loaded, rows_loaded, dq_error_count,
             error_code, error_message, fabric_job_id, notebook_batch_id,
             uploaded_by, uploaded_at, etl_started_at, etl_completed_at,
             updated_at, is_terminal, elapsed_seconds
      FROM dbo.vw_etl_batch_status
      WHERE batch_id = @param1
        AND tenant_id = @param2;
    `;
    const res = await statusQuery(queryText, [batchId, tenantId]);
    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];

    // Normalize values and maintain backward compatibility
    return {
      batch_id: row.batch_id,
      tenant_id: row.tenant_id,
      status: row.status,
      stage: row.stage,
      progress_pct: row.progress_pct,
      tables_expected: row.tables_expected,
      tables_loaded: row.tables_loaded,
      // Parse rows_loaded to a number if it is returned as a string by driver
      rows_loaded: row.rows_loaded !== null ? Number(row.rows_loaded) : null,
      dq_error_count: row.dq_error_count,
      error_code: row.error_code,
      error_message: row.error_message,
      fabric_job_id: row.fabric_job_id,
      notebook_batch_id: row.notebook_batch_id,
      // Backward compatibility placeholder field: the current Fabric view does not expose fabric_run_url
      fabric_run_url: null,
      uploaded_by: row.uploaded_by,
      uploaded_at: row.uploaded_at,
      etl_started_at: row.etl_started_at,
      etl_completed_at: row.etl_completed_at,
      updated_at: row.updated_at,
      is_terminal: row.is_terminal === true || row.is_terminal === 1 || row.is_terminal === '1',
      elapsed_seconds: row.elapsed_seconds
    };
  }

  /**
   * Creates the initial pending batch status by inserting sequence_no=1 into dbo.etl_batch_event
   * @param {string} batchId 
   * @param {string} tenantId 
   * @param {string} uploadedBy 
   * @param {Date} uploadedAt 
   * @returns {Promise<boolean>} Success status
   */
  async createBatch(batchId, tenantId, uploadedBy, uploadedAt) {
    const queryText = `
      INSERT INTO dbo.etl_batch_event (
        event_id, batch_id, tenant_id, sequence_no, status, stage, progress_pct,
        tables_expected, tables_loaded, rows_loaded, dq_error_count, 
        event_at, uploaded_at, uploaded_by
      ) VALUES (
        @param1, @param2, @param3, @param4, @param5, @param6, @param7,
        @param8, @param9, @param10, @param11,
        SYSUTCDATETIME(), @param12, @param13
      );
    `;
    const eventId = crypto.randomUUID();
    const res = await statusQuery(queryText, [
      eventId,
      batchId,
      tenantId,
      1,            // sequence_no
      'pending',    // status
      'uploaded',   // stage
      5,            // progress_pct
      18,           // tables_expected
      0,            // tables_loaded
      0,            // rows_loaded
      0,            // dq_error_count
      uploadedAt,
      uploadedBy
    ]);
    return res.rowCount > 0;
  }

  /**
   * Appends an event into dbo.etl_batch_event. 
   * This table is append-only; update/upsert operations must not be used.
   * @param {Object} event 
   * @returns {Promise<boolean>} Success status
   */
  async insertEvent(event) {
    const queryText = `
      INSERT INTO dbo.etl_batch_event (
        event_id, batch_id, tenant_id, sequence_no, status, stage, progress_pct,
        tables_expected, tables_loaded, rows_loaded, dq_error_count, table_name,
        error_code, error_message, fabric_job_id, fabric_item_id, notebook_batch_id,
        uploaded_by, uploaded_at, event_at
      ) VALUES (
        @param1, @param2, @param3, @param4, @param5, @param6, @param7,
        @param8, @param9, @param10, @param11, @param12,
        @param13, @param14, @param15, @param16, @param17,
        @param18, @param19, @param20
      );
    `;

    const eventId = event.event_id || crypto.randomUUID();
    const eventAt = event.event_at || new Date();

    const res = await statusQuery(queryText, [
      eventId,
      event.batch_id,
      event.tenant_id,
      event.sequence_no,
      event.status,
      event.stage,
      event.progress_pct,
      event.tables_expected !== undefined ? event.tables_expected : null,
      event.tables_loaded !== undefined ? event.tables_loaded : null,
      event.rows_loaded !== undefined ? event.rows_loaded : null,
      event.dq_error_count !== undefined ? event.dq_error_count : null,
      event.table_name || null,
      event.error_code || null,
      event.error_message || null,
      event.fabric_job_id || null,
      event.fabric_item_id || null,
      event.notebook_batch_id || null,
      event.uploaded_by || null,
      event.uploaded_at || null,
      eventAt
    ]);

    return res.rowCount > 0;
  }
}

module.exports = new UploadStatusRepository();
