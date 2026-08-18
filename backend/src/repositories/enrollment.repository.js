const { query } = require('../config/fabric');

class EnrollmentRepository {
  /**
   * Retrieves all enrollment records based on status filter
   * @param {Object} filters
   * @returns {Promise<Array>} List of enrollments
   */
  async findAll(filters = {}) {
    const { enrollmentStatus } = filters;
    let sql = `
      SELECT 
        e.Enrollment_ID AS enrollment_id,
        e.Patient_ID AS patient_id,
        e.Program_ID AS program_id,
        e.Enrollment_Date AS enrollment_date,
        e.Enrollment_Status AS enrollment_status,
        e.Enrollment_Channel AS enrollment_channel,
        e.Enrollment_Reason AS enrollment_reason,
        pr.Program_Type AS program_type
      FROM dbo.fact_enrollment e
      LEFT JOIN dbo.dim_program pr ON e.Program_ID = pr.Program_ID
      WHERE 1=1
    `;
    const params = [];

    if (enrollmentStatus) {
      sql += ' AND e.Enrollment_Status LIKE @param1';
      params.push(enrollmentStatus);
    }

    sql += ' ORDER BY e.Enrollment_Date DESC, e.Patient_ID ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Retrieves a single enrollment record by composite key
   * @param {string} patientId
   * @param {string} programId
   * @returns {Promise<Object|null>} Enrollment record or null
   */
  async findById(patientId, programId) {
    const sql = `
      SELECT 
        e.Enrollment_ID AS enrollment_id,
        e.Patient_ID AS patient_id,
        e.Program_ID AS program_id,
        e.Enrollment_Date AS enrollment_date,
        e.Enrollment_Status AS enrollment_status,
        e.Enrollment_Channel AS enrollment_channel,
        e.Enrollment_Reason AS enrollment_reason,
        pr.Program_Type AS program_type
      FROM dbo.fact_enrollment e
      LEFT JOIN dbo.dim_program pr ON e.Program_ID = pr.Program_ID
      WHERE e.Patient_ID = @param1 AND e.Program_ID = @param2
    `;
    const result = await query(sql, [patientId, programId]);
    return result.rows[0] || null;
  }
}

module.exports = new EnrollmentRepository();
