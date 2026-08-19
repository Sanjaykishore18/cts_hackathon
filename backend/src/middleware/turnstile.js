const turnstileService = require('../services/turnstile.service');

/**
 * Middleware to validate Cloudflare Turnstile token on register and login routes.
 */
const validateTurnstile = async (req, res, next) => {
  const token = req.body.turnstileToken;

  if (!token) {
    const error = new Error('Human verification failed');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = [{ field: 'turnstileToken', message: 'turnstileToken is required' }];
    return next(error);
  }

  try {
    // Pass client IP as remoteip
    const clientIp = req.ip || req.socket.remoteAddress;
    const isValid = await turnstileService.verifyToken(token, clientIp);

    if (!isValid) {
      const error = new Error('Human verification failed');
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = [{ field: 'turnstileToken', message: 'Turnstile verification failed' }];
      return next(error);
    }

    next();
  } catch (err) {
    // If anything fails unexpectedly, return a controlled verification failure
    const error = new Error('Human verification failed');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    return next(error);
  }
};

module.exports = {
  validateTurnstile
};
