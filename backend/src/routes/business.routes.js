const express = require('express');
const router = express.Router();
const businessController = require('../controllers/business.controller');
const { validateProgramId, validateFilters } = require('../middleware/validator');

// GET /api/business/overview
router.get('/overview', validateFilters, businessController.getOverview);

// GET /api/business/programs
router.get('/programs', validateFilters, businessController.getPrograms);

// GET /api/business/programs/:programId
router.get('/programs/:programId', validateProgramId, businessController.getProgramById);

// GET /api/business/regions
router.get('/regions', validateFilters, businessController.getRegions);

// GET /api/business/trends
router.get('/trends', validateFilters, businessController.getTrends);

module.exports = router;
