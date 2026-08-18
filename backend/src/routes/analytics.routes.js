const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { validateProgramId } = require('../middleware/validator');

// GET /api/analytics/adherence
router.get('/adherence', validateProgramId, analyticsController.getAdherence);

// GET /api/analytics/persistence
router.get('/persistence', validateProgramId, analyticsController.getPersistence);

// GET /api/analytics/cohort-comparison
router.get('/cohort-comparison', validateProgramId, analyticsController.getCohortComparison);

// GET /api/analytics/utilization
router.get('/utilization', validateProgramId, analyticsController.getUtilization);

// GET /api/analytics/roi
router.get('/roi', analyticsController.getROI);

// GET /api/analytics/program-effectiveness
router.get('/program-effectiveness', analyticsController.getProgramEffectiveness);

module.exports = router;
