const businessService = require('../services/business.service');

/**
 * Controller handling business outcomes and trends APIs.
 */
class BusinessController {
  async getOverview(req, res, next) {
    try {
      const filters = {
        programId: req.query.programId,
        region: req.query.region,
        timePeriod: req.query.timePeriod
      };
      const overview = await businessService.getBusinessOverview(filters);
      res.status(200).json({
        success: true,
        data: overview
      });
    } catch (error) {
      next(error);
    }
  }

  async getPrograms(req, res, next) {
    try {
      const filters = {
        region: req.query.region,
        timePeriod: req.query.timePeriod
      };
      const programs = await businessService.getPrograms(filters);
      res.status(200).json({
        success: true,
        data: programs
      });
    } catch (error) {
      next(error);
    }
  }

  async getProgramById(req, res, next) {
    try {
      const { programId } = req.params;
      const details = await businessService.getProgramById(programId);

      if (!details || details.length === 0) {
        const error = new Error(`Business data for Program ID ${programId} not found`);
        error.status = 404;
        error.code = 'PROGRAM_BUSINESS_NOT_FOUND';
        return next(error);
      }

      res.status(200).json({
        success: true,
        data: details
      });
    } catch (error) {
      next(error);
    }
  }

  async getRegions(req, res, next) {
    try {
      const filters = {
        programId: req.query.programId,
        timePeriod: req.query.timePeriod
      };
      const regions = await businessService.getRegions(filters);
      res.status(200).json({
        success: true,
        data: regions
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrends(req, res, next) {
    try {
      const filters = {
        programId: req.query.programId,
        region: req.query.region
      };
      const trends = await businessService.getTrends(filters);
      res.status(200).json({
        success: true,
        data: trends
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BusinessController();
