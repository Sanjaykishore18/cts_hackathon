/**
 * Centralized Express Error Handling Middleware.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || 500;
  
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

  // Log error details internally (do not expose stack trace or pg credentials to client)
  console.error(`[Error Handler] ${statusCode} - ${err.message}`, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    originalError: err
  });

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
