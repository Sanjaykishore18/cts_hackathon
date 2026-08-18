const express = require('express');
const router = express.Router();
const mlController = require('../controllers/ml.controller');
const segmentationController = require('../controllers/segmentation.controller');
const strategyController = require('../controllers/strategy.controller');
const { validateChurnPredictionInput } = require('../middleware/mlValidator');
const { validateSegmentationInput } = require('../middleware/segmentationValidator');
const { validateStrategyInput } = require('../middleware/strategyValidator');

// POST /api/ml/churn-prediction
router.post('/churn-prediction', validateChurnPredictionInput, mlController.predictChurn);

// POST /api/ml/patient-segmentation
router.post('/patient-segmentation', validateSegmentationInput, segmentationController.predictSegment);

// POST /api/ml/strategy-effectiveness
router.post('/strategy-effectiveness', validateStrategyInput, strategyController.predictStrategyEffectiveness);

module.exports = router;

