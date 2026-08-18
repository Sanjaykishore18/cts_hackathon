const db = require('../config/db');

class BusinessRepository {
  /**
   * General overview metrics
   * @param {Object} filters
   * @returns {Promise<Object>} Overview record
   */
  async getOverview(filters = {}) {
    const { programId, region, timePeriod } = filters;
    let queryText = `
      SELECT 
        SUM(program_cost) as total_cost,
        SUM(revenue_generated) as total_revenue,
        SUM(enrolled_patient_count) as total_patients,
        AVG(retention_rate) as avg_retention_rate,
        AVG(churn_rate) as avg_churn_rate
      FROM program_business
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (programId) {
      queryText += ` AND program_id = $${paramIndex}`;
      params.push(programId);
      paramIndex++;
    }
    if (region) {
      queryText += ` AND region ILIKE $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }
    if (timePeriod) {
      queryText += ` AND time_period = $${paramIndex}`;
      params.push(timePeriod);
      paramIndex++;
    }

    const result = await db.query(queryText, params);
    return result.rows[0];
  }

  /**
   * Retrieves aggregated business metrics for all programs
   * @param {Object} filters
   * @returns {Promise<Array>} List of program business records
   */
  async findPrograms(filters = {}) {
    const { region, timePeriod } = filters;
    let queryText = `
      SELECT 
        program_id,
        SUM(program_cost) as total_cost,
        SUM(revenue_generated) as total_revenue,
        SUM(enrolled_patient_count) as total_patients,
        AVG(retention_rate) as avg_retention_rate,
        AVG(churn_rate) as avg_churn_rate
      FROM program_business
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (region) {
      queryText += ` AND region ILIKE $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }
    if (timePeriod) {
      queryText += ` AND time_period = $${paramIndex}`;
      params.push(timePeriod);
      paramIndex++;
    }

    queryText += ' GROUP BY program_id ORDER BY program_id ASC';
    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Retrieves detailed metrics for a single program, broken down by region and time period
   * @param {string} programId
   * @returns {Promise<Array>} Program records
   */
  async findProgramById(programId) {
    const queryText = `
      SELECT * 
      FROM program_business
      WHERE program_id = $1
      ORDER BY time_period DESC, region ASC
    `;
    const result = await db.query(queryText, [programId]);
    return result.rows;
  }

  /**
   * Retrieves aggregated business metrics per Region
   * @param {Object} filters
   * @returns {Promise<Array>} Region aggregation records
   */
  async findRegions(filters = {}) {
    const { programId, timePeriod } = filters;
    let queryText = `
      SELECT 
        region,
        SUM(program_cost) as total_cost,
        SUM(revenue_generated) as total_revenue,
        SUM(enrolled_patient_count) as total_patients,
        AVG(retention_rate) as avg_retention_rate,
        AVG(churn_rate) as avg_churn_rate
      FROM program_business
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (programId) {
      queryText += ` AND program_id = $${paramIndex}`;
      params.push(programId);
      paramIndex++;
    }
    if (timePeriod) {
      queryText += ` AND time_period = $${paramIndex}`;
      params.push(timePeriod);
      paramIndex++;
    }

    queryText += ' GROUP BY region ORDER BY region ASC';
    const result = await db.query(queryText, params);
    return result.rows;
  }

  /**
   * Retrieves business performance trends aggregated by Time Period
   * @param {Object} filters
   * @returns {Promise<Array>} Trend records
   */
  async findTrends(filters = {}) {
    const { programId, region } = filters;
    let queryText = `
      SELECT 
        time_period,
        SUM(program_cost) as total_cost,
        SUM(revenue_generated) as total_revenue,
        SUM(enrolled_patient_count) as total_patients
      FROM program_business
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (programId) {
      queryText += ` AND program_id = $${paramIndex}`;
      params.push(programId);
      paramIndex++;
    }
    if (region) {
      queryText += ` AND region ILIKE $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }

    queryText += ' GROUP BY time_period ORDER BY time_period ASC';
    const result = await db.query(queryText, params);
    return result.rows;
  }
}

module.exports = new BusinessRepository();
