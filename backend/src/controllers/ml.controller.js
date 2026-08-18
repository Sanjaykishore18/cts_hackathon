const mlService = require('../services/ml.service');

/**
 * Controller for handling ML Churn Prediction request.
 */
class MlController {
  async predictChurn(req, res, next) {
    try {
      const result = await mlService.predictChurn(req.body);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MlController();
