const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/upload.controller');

const uploadStatusController = require('../controllers/upload-status.controller');
const { validateBatchId } = require('../middleware/validator');

// Memory storage keeps file buffers in RAM, passing them directly to SheetJS validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB per file
  }
});

// Middleware to check Content-Length header before buffering request
const checkUploadPayloadSize = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'], 10);
  const maxRequestSize = 60 * 1024 * 1024; // 60 MB
  if (contentLength && contentLength > maxRequestSize) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Total request size exceeds maximum limit of 60 MB.'
      }
    });
  }
  next();
};

// Role authorization middleware for file uploads
const authorizeUpload = (req, res, next) => {
  const role = req.headers['x-mock-role'] || (req.user && req.user.role);
  if (!role || (role !== 'admin' && role !== 'uploader')) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. Only administrators are allowed to upload files.'
      }
    });
  }
  next();
};

// POST /api/uploads
router.post('/', checkUploadPayloadSize, authorizeUpload, upload.array('files'), uploadController.upload);

// GET /api/uploads/:batchId/status
router.get('/:batchId/status', validateBatchId, uploadStatusController.getStatus);

module.exports = router;

