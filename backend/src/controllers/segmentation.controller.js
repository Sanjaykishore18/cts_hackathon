const segmentationService = require('../services/segmentation.service');

/**
 * Controller for Patient Segmentation prediction.
 */
class SegmentationController {
  async predictSegment(req, res, next) {
    try {
      const result = await segmentationService.predictSegment(req.body);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SegmentationController();
