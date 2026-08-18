const enrollmentRepository = require('../repositories/enrollment.repository');

class EnrollmentService {
  async getAll(filters = {}) {
    return enrollmentRepository.findAll(filters);
  }

  async getById(patientId, programId) {
    return enrollmentRepository.findById(patientId, programId);
  }

  async create(data) {
    // 1. Detect if enrollment already exists (composite key validation)
    const existing = await enrollmentRepository.findById(data.patientId, data.programId);
    if (existing) {
      const error = new Error('Enrollment already exists');
      error.status = 409;
      error.code = 'ENROLLMENT_ALREADY_EXISTS';
      throw error;
    }

    // 2. Canonical casing for enrollment status
    if (data.enrollmentStatus) {
      const lower = data.enrollmentStatus.toLowerCase();
      if (lower === 'enrolled') data.enrollmentStatus = 'Enrolled';
      else if (lower === 'dropped') data.enrollmentStatus = 'Dropped';
      else if (lower === 'non-enrolled') data.enrollmentStatus = 'Non-Enrolled';
    }

    return enrollmentRepository.createEnrollment(data);
  }

  async update(patientId, programId, data) {
    // 1. Ensure target record exists
    const existing = await enrollmentRepository.findById(patientId, programId);
    if (!existing) {
      const error = new Error('Enrollment not found');
      error.status = 404;
      error.code = 'ENROLLMENT_NOT_FOUND';
      throw error;
    }

    // 2. Canonical casing for enrollment status
    if (data.enrollmentStatus) {
      const lower = data.enrollmentStatus.toLowerCase();
      if (lower === 'enrolled') data.enrollmentStatus = 'Enrolled';
      else if (lower === 'dropped') data.enrollmentStatus = 'Dropped';
      else if (lower === 'non-enrolled') data.enrollmentStatus = 'Non-Enrolled';
    }

    // 3. Keep existing fields if not passed in update payload
    const updateData = {
      enrollmentStatus: data.enrollmentStatus || existing.enrollment_status,
      dropoutReason: data.dropoutReason !== undefined ? data.dropoutReason : existing.dropout_reason,
      benefitUtilizedAmount: data.benefitUtilizedAmount !== undefined ? data.benefitUtilizedAmount : parseFloat(existing.benefit_utilized_amount || 0),
      numberOfFillsWithAssistance: data.numberOfFillsWithAssistance !== undefined ? data.numberOfFillsWithAssistance : parseInt(existing.number_of_fills_with_assistance || 0, 10),
      adherenceRate: data.adherenceRate !== undefined ? data.adherenceRate : parseFloat(existing.adherence_rate || 0),
      persistencyDays: data.persistencyDays !== undefined ? data.persistencyDays : parseInt(existing.persistency_days || 0, 10)
    };

    return enrollmentRepository.updateEnrollment(patientId, programId, updateData);
  }
}

module.exports = new EnrollmentService();
