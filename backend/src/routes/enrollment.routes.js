const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollment.controller');
const {
  validatePatientId,
  validateProgramId,
  validateFilters,
  validateEnrollmentPayload,
  validateEnrollmentUpdatePayload
} = require('../middleware/validator');
const { authenticateJWT } = require('../middleware/auth');

// GET /api/enrollments
router.get('/', authenticateJWT, validateFilters, enrollmentController.getAllEnrollments);

// GET /api/enrollments/:patientId/:programId
router.get('/:patientId/:programId', authenticateJWT, validatePatientId, validateProgramId, enrollmentController.getEnrollmentById);


// POST /api/enrollments - DE-REGISTERED (Fabric is read-only)
// router.post('/', validateEnrollmentPayload, enrollmentController.createEnrollment);

// PUT /api/enrollments/:patientId/:programId - DE-REGISTERED (Fabric is read-only)
// router.put('/:patientId/:programId', validatePatientId, validateProgramId, validateEnrollmentUpdatePayload, enrollmentController.updateEnrollment);

module.exports = router;
