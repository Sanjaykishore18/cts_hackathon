const express = require('express');
const router = express.Router();
const programController = require('../controllers/program.controller');
const { validateProgramId } = require('../middleware/validator');

// GET /api/programs
router.get('/', programController.getAllPrograms);

// GET /api/programs/:programId
router.get('/:programId', validateProgramId, programController.getProgramById);

module.exports = router;
