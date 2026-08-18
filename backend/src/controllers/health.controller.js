/**
 * Health check controller to verify backend status.
 */
const getHealth = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend service is running smoothly.',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
};

module.exports = {
  getHealth
};
