const strategyService = require('../services/strategy.service');

/**
 * Controller for Strategy Effectiveness prediction.
 */
class StrategyController {
  async predictStrategyEffectiveness(req, res, next) {
    try {
      const result = await strategyService.predictStrategyEffectiveness(req.body);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StrategyController();
