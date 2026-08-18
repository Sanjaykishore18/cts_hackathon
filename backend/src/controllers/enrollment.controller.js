const enrollmentService = require('../services/enrollment.service');

class EnrollmentController {
  async getAllEnrollments(req, res, next) {
    try {
      const filters = {
        enrollmentStatus: req.query.enrollmentStatus
      };
      const enrollments = await enrollmentService.getAll(filters);
      res.status(200).json({
        success: true,
        data: enrollments
      });
    } catch (error) {
      next(error);
    }
  }

  async getEnrollmentById(req, res, next) {
    try {
      const { patientId, programId } = req.params;
      const enrollment = await enrollmentService.getById(patientId, programId);

      if (!enrollment) {
        const error = new Error(`Enrollment not found for patient ${patientId} and program ${programId}`);
        error.status = 404;
        error.code = 'ENROLLMENT_NOT_FOUND';
        return next(error);
      }

      res.status(200).json({
        success: true,
        data: enrollment
      });
    } catch (error) {
      next(error);
    }
  }

  async createEnrollment(req, res, next) {
    try {
      const enrollment = await enrollmentService.create(req.body);
      res.status(201).json({
        success: true,
        data: enrollment
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEnrollment(req, res, next) {
    try {
      const { patientId, programId } = req.params;
      const enrollment = await enrollmentService.update(patientId, programId, req.body);
      res.status(200).json({
        success: true,
        data: enrollment
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EnrollmentController();
