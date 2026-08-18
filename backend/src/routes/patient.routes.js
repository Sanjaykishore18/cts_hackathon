const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const { validatePatientId, validateProgramId, validateFilters } = require('../middleware/validator');

// GET /api/patients
router.get('/', validateFilters, patientController.getAllPatients);

// GET /api/patients/:patientId/programs
router.get('/:patientId/programs', validatePatientId, patientController.getPatientPrograms);

// GET /api/patients/:patientId
router.get('/:patientId', validatePatientId, patientController.getPatientById);

module.exports = router;
