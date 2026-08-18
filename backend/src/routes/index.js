const express = require('express');
const router = express.Router();
const healthRoutes = require('./health.routes');
const patientRoutes = require('./patient.routes');
const businessRoutes = require('./business.routes');
const analyticsRoutes = require('./analytics.routes');
const mlRoutes = require('./ml.routes');
const programRoutes = require('./program.routes');
const enrollmentRoutes = require('./enrollment.routes');
const authRoutes = require('./auth.routes');
const uploadRoutes = require('./upload.routes');
const patientController = require('../controllers/patient.controller');
const { validateProgramId } = require('../middleware/validator');
const { authenticateJWT } = require('../middleware/auth');

// Mount health routes at /health (Public)
router.use('/health', healthRoutes);

// Mount auth routes at /auth (Public endpoints inside, except /me)
router.use('/auth', authRoutes);

// Mount patient routes at /patients (Protected)
router.use('/patients', authenticateJWT, patientRoutes);

// Mount business routes at /business (Public / Out of scope)
router.use('/business', businessRoutes);

// Mount analytics routes at /analytics (Public / Out of scope)
router.use('/analytics', analyticsRoutes);

// Mount ML routes at /ml (Protected)
router.use('/ml', authenticateJWT, mlRoutes);

// Mount program routes at /programs (Protected)
router.use('/programs', authenticateJWT, programRoutes);

// Mount enrollment routes at /enrollments (Selected methods protected inside)
router.use('/enrollments', enrollmentRoutes);

// Mount upload routes at /uploads (Protected)
router.use('/uploads', authenticateJWT, uploadRoutes);

// Direct mapping for GET /api/programs/:programId/patients (Protected)
router.get('/programs/:programId/patients', authenticateJWT, validateProgramId, patientController.getProgramPatients);

module.exports = router;

