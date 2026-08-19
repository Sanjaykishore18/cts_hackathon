const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateJWT } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const { validateTurnstile } = require('../middleware/turnstile');

// Limit login and registration to max 10 attempts per minute
const authLimiter = rateLimiter({ windowMs: 60 * 1000, max: 10 });

// GET /api/auth/config (Public - returns site key)
router.get('/config', authController.config);

// POST /api/auth/register
router.post('/register', authLimiter, validateTurnstile, authController.register);

// POST /api/auth/login
router.post('/login', authLimiter, validateTurnstile, authController.login);

// GET /api/auth/me (Protected)
router.get('/me', authenticateJWT, authController.me);

// POST /api/auth/logout
router.post('/logout', authController.logout);

module.exports = router;
