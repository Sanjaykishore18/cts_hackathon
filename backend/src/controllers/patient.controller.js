const patientService = require('../services/patient.service');

/**
 * Controller handling patient and patient-program REST APIs.
 */
class PatientController {
  async getAllPatients(req, res, next) {
    try {
      const filters = {
        programId: req.query.programId,
        programType: req.query.programType,
        insuranceType: req.query.insuranceType,
        enrollmentStatus: req.query.enrollmentStatus
      };
      
      const patients = await patientService.getAllPatients(filters);
      res.status(200).json({
        success: true,
        data: patients
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientById(req, res, next) {
    try {
      const { patientId } = req.params;
      const patientRecords = await patientService.getPatientById(patientId);

      if (!patientRecords || patientRecords.length === 0) {
        const error = new Error(`Patient with ID ${patientId} not found`);
        error.status = 404;
        error.code = 'PATIENT_NOT_FOUND';
        return next(error);
      }

      // Format response as a single patient object with nested program history
      const patientData = {
        patient_id: patientRecords[0].patient_id,
        patient_demographics: patientRecords[0].patient_demographics,
        disease_therapy_area: patientRecords[0].disease_therapy_area,
        predicted_adherence_risk: patientRecords[0].predicted_adherence_risk,
        predicted_churn_risk: patientRecords[0].predicted_churn_risk,
        recommended_program_type: patientRecords[0].recommended_program_type,
        recommended_discount_tier: patientRecords[0].recommended_discount_tier,
        predicted_roi_contribution: patientRecords[0].predicted_roi_contribution ? parseFloat(patientRecords[0].predicted_roi_contribution) : null,
        model_confidence_score: patientRecords[0].model_confidence_score ? parseFloat(patientRecords[0].model_confidence_score) : null,
        programs: patientRecords.map(r => ({
          program_id: r.program_id,
          program_type: r.program_type,
          insurance_type: r.insurance_type,
          enrollment_date: r.enrollment_date,
          enrollment_status: r.enrollment_status,
          enrollment_channel: r.enrollment_channel,
          copay_coverage_amount: parseFloat(r.copay_coverage_amount || 0),
          annual_benefit_cap: parseFloat(r.annual_benefit_cap || 0),
          benefit_utilized_amount: parseFloat(r.benefit_utilized_amount || 0),
          number_of_fills_with_assistance: parseInt(r.number_of_fills_with_assistance || 0, 10),
          adherence_rate: parseFloat(r.adherence_rate || 0),
          persistency_days: parseInt(r.persistency_days || 0, 10),
          dropout_reason: r.dropout_reason
        }))
      };

      res.status(200).json({
        success: true,
        data: patientData
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientPrograms(req, res, next) {
    try {
      const { patientId } = req.params;
      const programs = await patientService.getPatientPrograms(patientId);

      if (!programs || programs.length === 0) {
        const error = new Error(`No programs found for Patient ID ${patientId}`);
        error.status = 404;
        error.code = 'PATIENT_PROGRAMS_NOT_FOUND';
        return next(error);
      }

      res.status(200).json({
        success: true,
        data: programs
      });
    } catch (error) {
      next(error);
    }
  }

  async getProgramPatients(req, res, next) {
    try {
      const { programId } = req.params;
      const patients = await patientService.getProgramPatients(programId);

      if (!patients || patients.length === 0) {
        const error = new Error(`No patients found for Program ID ${programId}`);
        error.status = 404;
        error.code = 'PROGRAM_PATIENTS_NOT_FOUND';
        return next(error);
      }

      res.status(200).json({
        success: true,
        data: patients
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PatientController();
