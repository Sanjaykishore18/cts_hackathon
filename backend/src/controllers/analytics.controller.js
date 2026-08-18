const analyticsService = require('../services/analytics.service');

/**
 * Controller handling analytics and cohort REST APIs.
 */
class AnalyticsController {
  async getAdherence(req, res, next) {
    try {
      const filters = { programId: req.query.programId };
      const data = await analyticsService.getAdherenceAnalytics(filters);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getPersistence(req, res, next) {
    try {
      const filters = { programId: req.query.programId };
      const data = await analyticsService.getPersistenceAnalytics(filters);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getCohortComparison(req, res, next) {
    try {
      const filters = { programId: req.query.programId };
      const data = await analyticsService.getCohortComparison(filters);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getUtilization(req, res, next) {
    try {
      const filters = { programId: req.query.programId };
      const data = await analyticsService.getUtilizationAnalytics(filters);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getROI(req, res, next) {
    try {
      const data = await analyticsService.getROIAnalytics();
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getProgramEffectiveness(req, res, next) {
    try {
      const data = await analyticsService.getProgramEffectiveness();
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalyticsController();
