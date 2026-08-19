const rateLimitCache = new Map();

/**
 * Lightweight memory-based rate limiter middleware.
 * Throttles requests by IP address.
 */
const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60 * 1000; // default 1 minute
  const max = options.max || 10; // default 10 requests per window

  return (req, res, next) => {
    // In test environment, bypass rate limits to avoid interfering with registration/login test runs
    // unless the tests specifically test the rate limiter by passing an override header
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!rateLimitCache.has(ip)) {
      rateLimitCache.set(ip, []);
    }

    const timestamps = rateLimitCache.get(ip);
    
    // Filter out timestamps outside of the current time window
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);
    
    if (activeTimestamps.length >= max) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many authentication attempts. Please try again later.'
        }
      });
    }

    activeTimestamps.push(now);
    rateLimitCache.set(ip, activeTimestamps);
    next();
  };
};

module.exports = rateLimiter;
