const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'super_secret_local_development_jwt_key_123!';
    const decoded = jwt.verify(token, secret);

    // Verify user still exists in SQLite database
    const user = authService.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token.'
    });
  }
};

module.exports = {
  authenticateJWT
};
