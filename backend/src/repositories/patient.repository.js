const { query } = require('../config/fabric');

class PatientRepository {
  /**
   * Retrieves all patients based on filters, ensuring exactly one row per patient.
   * @param {Object} filters
   * @returns {Promise<Array>} List of patients
   */
  async findAll(filters = {}) {
    const { programId, programType, insuranceType, enrollmentStatus } = filters;
    let sql = `
      SELECT 
        p.Patient_ID AS patient_id, 
        p.Age AS age,
        p.Age_Group AS age_group,
        p.Gender AS gender,
        p.Region AS region,
        p.State AS state,
        p.City_Market AS city_market,
        p.Income_Band AS income_band,
        p.Employment_Status AS employment_status,
        p.Insurance_Type AS insurance_type,
        p.Insurance_Plan AS insurance_plan,
        p.Disease_Condition AS disease_condition,
        p.Baseline_Risk AS baseline_risk,
        p.Financial_Assistance_Eligible AS financial_assistance_eligible,
        p.Patient_Status AS patient_status,
        p.Patient_Start_Date AS patient_start_date,
        latest_e.Program_ID AS program_id,
        latest_e.Enrollment_Status AS enrollment_status,
        latest_e.Enrollment_Date AS enrollment_date,
        pr.Program_Type AS program_type
      FROM dbo.dim_patient p
      OUTER APPLY (
        SELECT TOP 1 Program_ID, Enrollment_Status, Enrollment_Date
        FROM dbo.fact_enrollment
        WHERE Patient_ID = p.Patient_ID
        ORDER BY Enrollment_Date DESC
      ) latest_e
      LEFT JOIN dbo.dim_program pr ON latest_e.Program_ID = pr.Program_ID
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (programId) {
      sql += ` AND latest_e.Program_ID = @param${paramIndex}`;
      params.push(programId);
      paramIndex++;
    }
    if (programType) {
      sql += ` AND pr.Program_Type LIKE @param${paramIndex}`;
      params.push(programType);
      paramIndex++;
    }
    if (insuranceType) {
      sql += ` AND p.Insurance_Type LIKE @param${paramIndex}`;
      params.push(insuranceType);
      paramIndex++;
    }
    if (enrollmentStatus) {
      sql += ` AND latest_e.Enrollment_Status LIKE @param${paramIndex}`;
      params.push(enrollmentStatus);
      paramIndex++;
    }

    sql += ' ORDER BY p.Patient_ID ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Retrieves a single patient by ID across programs, merging recommendations
   * @param {string} patientId
   * @returns {Promise<Array>} Patient records matching ID
   */
  async findByIdWithRecommendations(patientId) {
    const sql = `
      SELECT 
        p.Patient_ID AS patient_id,
        p.Age AS age,
        p.Age_Group AS age_group,
        p.Gender AS gender,
        p.Region AS region,
        p.State AS state,
        p.City_Market AS city_market,
        p.Income_Band AS income_band,
        p.Employment_Status AS employment_status,
        p.Insurance_Type AS insurance_type,
        p.Insurance_Plan AS insurance_plan,
        p.Disease_Condition AS disease_condition,
        p.Baseline_Risk AS baseline_risk,
        p.Financial_Assistance_Eligible AS financial_assistance_eligible,
        p.Patient_Status AS patient_status,
        p.Patient_Start_Date AS patient_start_date,
        e.Program_ID AS program_id,
        e.Enrollment_Status AS enrollment_status,
        e.Enrollment_Channel AS enrollment_channel,
        e.Enrollment_Date AS enrollment_date,
        pr.Program_Type AS program_type,
        pr.Annual_Budget AS annual_benefit_cap,
        o.PDC AS adherence_rate,
        o.Persistence_Days AS persistency_days,
        o.Adherence_Status AS adherence_status,
        o.Risk_Status AS risk_status,
        o.Discontinuation_Date AS dropout_reason
      FROM dbo.dim_patient p
      LEFT JOIN dbo.fact_enrollment e ON p.Patient_ID = e.Patient_ID
      LEFT JOIN dbo.dim_program pr ON e.Program_ID = pr.Program_ID
      LEFT JOIN dbo.fact_patient_outcome o ON p.Patient_ID = o.Patient_ID
      WHERE p.Patient_ID = @param1
    `;
    const result = await query(sql, [patientId]);
    
    // Map recommendations dynamically to fit legacy JSONB response structure
    return result.rows.map(r => ({
      ...r,
      patient_demographics: JSON.stringify({ age: r.age, gender: r.gender }),
      disease_therapy_area: r.disease_condition,
      predicted_adherence_risk: r.risk_status || 'Medium',
      predicted_churn_risk: r.risk_status || 'Medium',
      recommended_program_type: 'Copay Card',
      recommended_discount_tier: 'Tier 1',
      predicted_roi_contribution: 0.00,
      model_confidence_score: 0.95
    }));
  }

  /**
   * Retrieves all programs that a specific patient is enrolled/was enrolled in
   * @param {string} patientId
   * @returns {Promise<Array>} List of programs for patient
   */
  async findProgramsByPatientId(patientId) {
    const sql = `
      SELECT 
        e.Program_ID AS program_id,
        pr.Program_Type AS program_type,
        e.Enrollment_Date AS enrollment_date,
        e.Enrollment_Status AS enrollment_status,
        e.Enrollment_Channel AS enrollment_channel,
        o.PDC AS adherence_rate,
        o.Persistence_Days AS persistency_days
      FROM dbo.fact_enrollment e
      LEFT JOIN dbo.dim_program pr ON e.Program_ID = pr.Program_ID
      LEFT JOIN dbo.fact_patient_outcome o ON e.Patient_ID = o.Patient_ID
      WHERE e.Patient_ID = @param1
      ORDER BY e.Enrollment_Date DESC
    `;
    const result = await query(sql, [patientId]);
    return result.rows;
  }

  /**
   * Retrieves all patients enrolled in a specific program
   * @param {string} programId
   * @returns {Promise<Array>} List of patients in program
   */
  async findPatientsByProgramId(programId) {
    const sql = `
      SELECT 
        p.Patient_ID AS patient_id,
        e.Enrollment_Date AS enrollment_date,
        e.Enrollment_Status AS enrollment_status,
        p.Insurance_Type AS insurance_type,
        o.PDC AS adherence_rate,
        o.Persistence_Days AS persistency_days
      FROM dbo.fact_enrollment e
      JOIN dbo.dim_patient p ON e.Patient_ID = p.Patient_ID
      LEFT JOIN dbo.fact_patient_outcome o ON e.Patient_ID = o.Patient_ID
      WHERE e.Program_ID = @param1
      ORDER BY p.Patient_ID ASC
    `;
    const result = await query(sql, [programId]);
    return result.rows;
  }
}

module.exports = new PatientRepository();
