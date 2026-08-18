const db = require('../config/db');

class AnalyticsRepository {
  /**
   * Adherence statistics
   * @param {Object} filters
   * @returns {Promise<Object>} Adherence stats (overall and by program type)
   */
  async getAdherenceStats(filters = {}) {
    const { programId } = filters;
    let queryText = `
      SELECT 
        program_type,
        COUNT(*) as patient_count,
        ROUND(AVG(adherence_rate), 2) as average_adherence_rate,
        MIN(adherence_rate) as min_adherence,
        MAX(adherence_rate) as max_adherence
      FROM patient_program
      WHERE enrollment_status = 'Enrolled'
    `;
    const params = [];
    if (programId) {
      queryText += ' AND program_id = $1';
      params.push(programId);
    }
    queryText += ' GROUP BY program_type';
    const byProgramTypeResult = await db.query(queryText, params);
    
    let overallQuery = "SELECT ROUND(AVG(adherence_rate), 2) as overall_avg FROM patient_program WHERE enrollment_status = 'Enrolled'";
    const overallParams = [];
    if (programId) {
      overallQuery += ' AND program_id = $1';
      overallParams.push(programId);
    }
    const overallResult = await db.query(overallQuery, overallParams);

    return {
      overallAverage: parseFloat(overallResult.rows[0]?.overall_avg || 0),
      byProgramType: byProgramTypeResult.rows
    };
  }

  /**
   * Persistence stats
   * @param {Object} filters
   * @returns {Promise<Array>} List of persistence stats
   */
  async getPersistenceStats(filters = {}) {
    const { programId } = filters;
    let queryText = `
      SELECT 
        program_type,
        COUNT(*) as patient_count,
        ROUND(AVG(persistency_days), 1) as average_persistency_days,
        ROUND(AVG(number_of_fills_with_assistance), 1) as average_fills
      FROM patient_program
      WHERE 1=1
    `;
    const params = [];
    if (programId) {
      queryText += ' AND program_id = $1';
      params.push(programId);
    }
    queryText += ' GROUP BY program_type';
    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Cohort Comparison
   * @param {Object} filters
   * @returns {Promise<Array>} List of cohort comparison stats
   */
  async getCohortStats(filters = {}) {
    const { programId } = filters;
    let queryText = `
      SELECT 
        enrollment_status as cohort,
        COUNT(*) as patient_count,
        ROUND(AVG(adherence_rate), 2) as average_adherence_rate,
        ROUND(AVG(persistency_days), 1) as average_persistency_days,
        ROUND(AVG(number_of_fills_with_assistance), 1) as average_fills,
        ROUND(AVG(benefit_utilized_amount), 2) as average_benefit_utilized
      FROM patient_program
      WHERE 1=1
    `;
    const params = [];
    if (programId) {
      queryText += ' AND program_id = $1';
      params.push(programId);
    }
    queryText += ' GROUP BY enrollment_status';
    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Utilization stats
   * @param {Object} filters
   * @returns {Promise<Array>} List of utilization stats
   */
  async getUtilizationStats(filters = {}) {
    const { programId } = filters;
    let queryText = `
      SELECT 
        program_type,
        COUNT(*) as patient_count,
        ROUND(AVG(copay_coverage_amount), 2) as average_coverage,
        ROUND(AVG(annual_benefit_cap), 2) as average_cap,
        ROUND(AVG(benefit_utilized_amount), 2) as average_utilized,
        ROUND(SUM(benefit_utilized_amount) / NULLIF(SUM(annual_benefit_cap), 0) * 100, 2) as utilization_rate_percentage
      FROM patient_program
      WHERE enrollment_status = 'Enrolled'
    `;
    const params = [];
    if (programId) {
      queryText += ' AND program_id = $1';
      params.push(programId);
    }
    queryText += ' GROUP BY program_type';
    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * ROI stats
   * @returns {Promise<Array>} List of program ROI records
   */
  async getRoiStats() {
    const queryText = `
      SELECT 
        program_id,
        SUM(program_cost) as total_cost,
        SUM(revenue_generated) as total_revenue
      FROM program_business
      GROUP BY program_id
    `;
    const result = await db.query(queryText);
    return result.rows;
  }

  /**
   * Program Effectiveness stats
   * @returns {Promise<Array>} List of program effectiveness records
   */
  async getEffectivenessStats() {
    const queryText = `
      SELECT 
        pb.program_id,
        AVG(pb.retention_rate) as avg_retention,
        AVG(pb.churn_rate) as avg_churn,
        ROUND(AVG(pp.adherence_rate), 2) as avg_adherence,
        ROUND(AVG(pp.persistency_days), 1) as avg_persistency,
        SUM(pb.enrolled_patient_count) as total_enrolled
      FROM program_business pb
      LEFT JOIN patient_program pp ON pb.program_id = pp.program_id
      GROUP BY pb.program_id
    `;
    const result = await db.query(queryText);
    return result.rows;
  }
}

module.exports = new AnalyticsRepository();
