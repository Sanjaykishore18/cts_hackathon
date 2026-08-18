const { query } = require('../config/fabric');

class ProgramRepository {
  /**
   * Retrieves all distinct programs represented in dim_program
   * @returns {Promise<Array>} List of programs
   */
  async findAll() {
    const sql = `
      SELECT DISTINCT Program_ID AS program_id, Program_Type AS program_type 
      FROM dbo.dim_program 
      ORDER BY Program_ID ASC
    `;
    const result = await query(sql);
    return result.rows;
  }

  /**
   * Retrieves a specific program by ID represented in dim_program
   * @param {string} programId
   * @returns {Promise<Object|null>} Program info or null
   */
  async findById(programId) {
    const sql = `
      SELECT DISTINCT Program_ID AS program_id, Program_Type AS program_type 
      FROM dbo.dim_program 
      WHERE Program_ID = @param1
    `;
    const result = await query(sql, [programId]);
    return result.rows[0] || null;
  }
}

module.exports = new ProgramRepository();
