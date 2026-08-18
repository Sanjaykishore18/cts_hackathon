const businessRepository = require('../repositories/business.repository');

/**
 * Service to calculate sales, revenue, cost, and ROI using the Repository layer.
 * 
 * ROI (%) = (Revenue - Program Cost) / Program Cost * 100
 */
class BusinessService {
  /**
   * Helper to compute ROI safely
   */
  calculateROI(revenue, cost) {
    const numericRevenue = parseFloat(revenue || 0);
    const numericCost = parseFloat(cost || 0);
    
    if (numericCost === 0) {
      return { ratio: 0, percentage: 0 };
    }
    
    const ratio = (numericRevenue - numericCost) / numericCost;
    const percentage = ratio * 100;
    
    return {
      ratio: parseFloat(ratio.toFixed(4)),
      percentage: parseFloat(percentage.toFixed(2))
    };
  }

  /**
   * General overview metrics
   */
  async getBusinessOverview(filters = {}) {
    const row = await businessRepository.getOverview(filters);
    if (!row) {
      return {
        totalCost: 0,
        totalRevenue: 0,
        totalPatients: 0,
        avgRetentionRate: 0,
        avgChurnRate: 0,
        roiRatio: 0,
        roiPercentage: 0
      };
    }

    const roi = this.calculateROI(row.total_revenue, row.total_cost);

    return {
      totalCost: parseFloat(row.total_cost || 0),
      totalRevenue: parseFloat(row.total_revenue || 0),
      totalPatients: parseInt(row.total_patients || 0, 10),
      avgRetentionRate: parseFloat(parseFloat(row.avg_retention_rate || 0).toFixed(2)),
      avgChurnRate: parseFloat(parseFloat(row.avg_churn_rate || 0).toFixed(2)),
      roiRatio: roi.ratio,
      roiPercentage: roi.percentage
    };
  }

  /**
   * Retrieves aggregated business metrics for all programs
   */
  async getPrograms(filters = {}) {
    const rows = await businessRepository.findPrograms(filters);
    
    return rows.map(row => {
      const roi = this.calculateROI(row.total_revenue, row.total_cost);
      return {
        programId: row.program_id,
        totalCost: parseFloat(row.total_cost || 0),
        totalRevenue: parseFloat(row.total_revenue || 0),
        totalPatients: parseInt(row.total_patients || 0, 10),
        avgRetentionRate: parseFloat(parseFloat(row.avg_retention_rate || 0).toFixed(2)),
        avgChurnRate: parseFloat(parseFloat(row.avg_churn_rate || 0).toFixed(2)),
        roiRatio: roi.ratio,
        roiPercentage: roi.percentage
      };
    });
  }

  /**
   * Retrieves detailed metrics for a single program, broken down by region and time period
   */
  async getProgramById(programId) {
    const rows = await businessRepository.findProgramById(programId);
    return rows.map(row => {
      const roi = this.calculateROI(row.revenue_generated, row.program_cost);
      return {
        ...row,
        roiRatio: roi.ratio,
        roiPercentage: roi.percentage,
        program_cost: parseFloat(row.program_cost),
        revenue_generated: parseFloat(row.revenue_generated)
      };
    });
  }

  /**
   * Retrieves aggregated business metrics per Region
   */
  async getRegions(filters = {}) {
    const rows = await businessRepository.findRegions(filters);
    
    return rows.map(row => {
      const roi = this.calculateROI(row.total_revenue, row.total_cost);
      return {
        region: row.region,
        totalCost: parseFloat(row.total_cost || 0),
        totalRevenue: parseFloat(row.total_revenue || 0),
        totalPatients: parseInt(row.total_patients || 0, 10),
        avgRetentionRate: parseFloat(parseFloat(row.avg_retention_rate || 0).toFixed(2)),
        avgChurnRate: parseFloat(parseFloat(row.avg_churn_rate || 0).toFixed(2)),
        roiRatio: roi.ratio,
        roiPercentage: roi.percentage
      };
    });
  }

  /**
   * Retrieves business performance trends aggregated by Time Period
   */
  async getTrends(filters = {}) {
    const rows = await businessRepository.findTrends(filters);
    
    return rows.map(row => {
      const roi = this.calculateROI(row.total_revenue, row.total_cost);
      return {
        timePeriod: row.time_period,
        totalCost: parseFloat(row.total_cost || 0),
        totalRevenue: parseFloat(row.total_revenue || 0),
        totalPatients: parseInt(row.total_patients || 0, 10),
        roiRatio: roi.ratio,
        roiPercentage: roi.percentage
      };
    });
  }
}

module.exports = new BusinessService();
