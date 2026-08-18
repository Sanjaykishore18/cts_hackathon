const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/upload.controller');

// Memory storage keeps file buffers in RAM, passing them directly to SheetJS validation
const upload = multer({ storage: multer.memoryStorage() });

// Role authorization middleware
const authorizeUpload = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    if (req.headers['x-mock-role'] === 'unauthorized') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Role restriction is not yet defined.'
        }
      });
    }
    return next();
  }

  // In production/development, check process.env.UPLOAD_ROLE if configured
  const requiredRole = process.env.UPLOAD_ROLE;
  if (requiredRole) {
    if (!req.user || req.user.role !== requiredRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires role: ${requiredRole}`
        }
      });
    }
  }
  next();
};

// POST /api/uploads
router.post('/', authorizeUpload, upload.array('files'), uploadController.upload);

module.exports = router;

