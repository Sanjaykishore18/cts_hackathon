const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateJWT } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// GET /api/auth/me (Protected)
router.get('/me', authenticateJWT, authController.me);

// POST /api/auth/logout
router.post('/logout', authController.logout);

module.exports = router;
