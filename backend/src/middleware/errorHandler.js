/**
 * Centralized Express Error Handling Middleware.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || 500;
  if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_MULTIPART') {
    statusCode = 413;
  }
  
  // Format consistent error response
  const errorResponse = {
    success: false,
    error: {
      message: statusCode === 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
      code: err.code || 'INTERNAL_SERVER_ERROR'
    }
  };

  // Include extra details if present (e.g. validation issues)
  if (err.details) {
    errorResponse.error.details = err.details;
  }

  // Log sanitized error details internally to prevent credential leaks in production
  const sanitizedErr = {
    message: err.message,
    code: err.code,
    status: statusCode
  };

  console.error(`[Error Handler] ${statusCode} - ${err.message}`, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    error: sanitizedErr
  });

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
