const patientRepository = require('../repositories/patient.repository');

/**
 * Service to handle patient and patient-program database requests.
 */
class PatientService {
  /**
   * Retrieves all patients based on filters
   */
  async getAllPatients(filters = {}) {
    return patientRepository.findAll(filters);
  }

  /**
   * Retrieves a single patient by ID across programs, merging recommendations if they exist
   */
  async getPatientById(patientId) {
    return patientRepository.findByIdWithRecommendations(patientId);
  }

  /**
   * Retrieves all programs that a specific patient is enrolled/was enrolled in
   */
  async getPatientPrograms(patientId) {
    return patientRepository.findProgramsByPatientId(patientId);
  }

  /**
   * Retrieves all patients enrolled in a specific program
   */
  async getProgramPatients(programId) {
    return patientRepository.findPatientsByProgramId(programId);
  }
}

module.exports = new PatientService();
