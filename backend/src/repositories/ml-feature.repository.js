const { query } = require('../config/fabric');

class MlFeatureRepository {
  /**
   * Get patient demographic and outcome details from dbo.dim_patient and dbo.fact_patient_outcome.
   */
  async getPatientProfile(patientId) {
    const sql = `
      SELECT 
        p.Patient_ID, p.Age, p.Gender, p.Age_Group, p.Region, p.State, p.City_Market,
        p.Income_Band, p.Employment_Status, p.Insurance_Type, p.Insurance_Plan,
        p.Disease_Condition, p.Baseline_Risk, p.Financial_Assistance_Eligible,
        p.Patient_Status, p.Patient_Start_Date,
        o.Assessment_Date, o.Treatment_Start_Date, o.Last_Refill_Date, o.Last_Covered_Date,
        o.Current_Treatment_Status, o.PDC, o.Persistence_Days, o.Persistence_Months,
        o.Discontinuation_Date, o.Adherence_Status, o.Risk_Status
      FROM dbo.dim_patient p
      LEFT JOIN dbo.fact_patient_outcome o ON p.Patient_ID = o.Patient_ID
      WHERE p.Patient_ID = @param1
    `;
    const result = await query(sql, [patientId]);
    return result.rows[0] || null;
  }

  /**
   * Get all enrollments for a patient including program details.
   */
  async getEnrollments(patientId) {
    const sql = `
      SELECT 
        e.Enrollment_ID, e.Patient_ID, e.Program_ID, e.Enrollment_Date, e.Enrollment_Status,
        e.Program_Start_Date, e.Program_End_Date, e.Exit_Date, e.Enrollment_Channel, e.Enrollment_Reason,
        p.Variable_Cost_Per_Patient, p.Copay_Max_Per_Patient
      FROM dbo.fact_enrollment e
      LEFT JOIN dbo.dim_program p ON e.Program_ID = p.Program_ID
      WHERE e.Patient_ID = @param1
      ORDER BY e.Enrollment_Date ASC
    `;
    const result = await query(sql, [patientId]);
    return result.rows;
  }

  /**
   * Get all pharmacy claims for a patient.
   */
  async getPharmacyClaims(patientId) {
    const sql = `
      SELECT 
        Claim_ID, Patient_ID, Drug_ID, Claim_Date, Prescription_Date,
        Fill_Number, Days_Supply, Quantity, Refill_Number, Claim_Status,
        Pharmacy_ID, Prescriber_ID, Patient_Paid_Amount, Diagnosis_Code, Dose, Frequency
      FROM dbo.fact_pharmacy_claim
      WHERE Patient_ID = @param1
      ORDER BY Claim_Date ASC
    `;
    const result = await query(sql, [patientId]);
    return result.rows;
  }

  /**
   * Get all copay claims for a patient.
   */
  async getCopayClaims(patientId) {
    const sql = `
      SELECT 
        Copay_Claim_ID, Prescription_ID, Patient_ID, Drug_ID, Program_ID, Payer_ID,
        Claim_Date, Submission_Date, Processing_Date, Processing_Days, Paid_Date,
        Claim_Status, Claim_Rejection_Reason, Claim_Submitted_Amount, Claim_Approved_Amount,
        Claim_Paid_Amount, Manufacturer_Assistance, Patient_OOP_Before, Patient_OOP_After,
        Patient_Savings, Annual_Copay_Max, Copay_Balance_Before, Copay_Used, Copay_Balance_After,
        Fund_Exhausted_Flag, Accumulator_Flag, Maximizer_Flag
      FROM dbo.fact_copay_claim
      WHERE Patient_ID = @param1
      ORDER BY Claim_Date ASC
    `;
    const result = await query(sql, [patientId]);
    return result.rows;
  }

  /**
   * Get all support interactions for a patient.
   */
  async getInteractions(patientId) {
    const sql = `
      SELECT 
        Interaction_ID, Patient_ID, Program_ID, Interaction_Date, Interaction_Type,
        Interaction_Channel, Interaction_Reason, Interaction_Status, Outcome,
        Follow_Up_Required, Follow_Up_Date
      FROM dbo.fact_support_interaction
      WHERE Patient_ID = @param1
      ORDER BY Interaction_Date ASC
    `;
    const result = await query(sql, [patientId]);
    return result.rows;
  }

  /**
   * Get all eligibility records for a patient.
   */
  async getEligibilities(patientId) {
    const sql = `
      SELECT 
        Eligibility_ID, Patient_ID, Program_ID, Eligibility_Date, Eligible_Flag,
        Eligibility_Reason, Eligibility_Start_Date, Eligibility_End_Date, Enrollment_Eligible_Flag
      FROM dbo.fact_eligibility
      WHERE Patient_ID = @param1
    `;
    const result = await query(sql, [patientId]);
    return result.rows;
  }

  /**
   * Get cost transactions for programs enrolled.
   */
  async getProgramCosts() {
    const sql = `
      SELECT 
        Cost_ID, Program_ID, Drug_ID, Month, Copay_Funding_Cost, Personnel_Cost,
        Technology_Cost, Vendor_Cost, Administration_Cost, Marketing_Cost,
        Total_Program_Cost, Month_Start
      FROM dbo.fact_program_cost
    `;
    const result = await query(sql);
    return result.rows;
  }
}

module.exports = new MlFeatureRepository();
