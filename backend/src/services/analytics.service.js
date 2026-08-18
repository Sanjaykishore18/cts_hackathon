const analyticsRepository = require('../repositories/analytics.repository');

/**
 * Service handling analytics and cohort aggregations using Repository layer.
 */
class AnalyticsService {
  /**
   * Helper to compute ROI safely
   */
  calculateROI(revenue, cost) {
    const numericRevenue = parseFloat(revenue || 0);
    const numericCost = parseFloat(cost || 0);
    if (numericCost === 0) return { ratio: 0, percentage: 0 };
    const ratio = (numericRevenue - numericCost) / numericCost;
    return {
      ratio: parseFloat(ratio.toFixed(4)),
      percentage: parseFloat((ratio * 100).toFixed(2))
    };
  }

  /**
   * Adherence analytics (average, distributions)
   */
  async getAdherenceAnalytics(filters = {}) {
    const stats = await analyticsRepository.getAdherenceStats(filters);
    
    return {
      metricDescription: 'Average adherence rate (%) calculated for actively enrolled patients.',
      overallAverage: stats.overallAverage,
      byProgramType: stats.byProgramType.map(r => ({
        programType: r.program_type,
        patientCount: parseInt(r.patient_count, 10),
        averageAdherenceRate: parseFloat(r.average_adherence_rate),
        minAdherence: parseFloat(r.min_adherence),
        maxAdherence: parseFloat(r.max_adherence)
      }))
    };
  }

  /**
   * Persistence analytics (average days on therapy)
   */
  async getPersistenceAnalytics(filters = {}) {
    const rows = await analyticsRepository.getPersistenceStats(filters);

    return {
      metricDescription: 'Average duration (in days) a patient remains on therapy and average number of assisted fills.',
      byProgramType: rows.map(r => ({
        programType: r.program_type,
        patientCount: parseInt(r.patient_count, 10),
        averagePersistencyDays: parseFloat(r.average_persistency_days),
        averageFills: parseFloat(r.average_fills)
      }))
    };
  }

  /**
   * Cohort Comparison (Enrolled vs Non-Enrolled vs Dropped)
   */
  async getCohortComparison(filters = {}) {
    const rows = await analyticsRepository.getCohortStats(filters);

    return {
      metricDescription: 'Compares adherence, persistence, and utilization metrics between Enrolled, Non-Enrolled, and Dropped cohorts.',
      cohorts: rows.map(r => ({
        cohort: r.cohort,
        patientCount: parseInt(r.patient_count, 10),
        averageAdherenceRate: parseFloat(r.average_adherence_rate),
        averagePersistencyDays: parseFloat(r.average_persistency_days),
        averageFills: parseFloat(r.average_fills),
        averageBenefitUtilized: parseFloat(r.average_benefit_utilized)
      }))
    };
  }

  /**
   * Benefit cap and coverage utilization analytics
   */
  async getUtilizationAnalytics(filters = {}) {
    const rows = await analyticsRepository.getUtilizationStats(filters);

    return {
      metricDescription: 'Details the benefit utilization rate (%) calculated as: (Total Benefit Utilized / Total Benefit Cap) * 100.',
      byProgramType: rows.map(r => ({
        programType: r.program_type,
        patientCount: parseInt(r.patient_count, 10),
        averageCoverage: parseFloat(r.average_coverage),
        averageCap: parseFloat(r.average_cap),
        averageUtilized: parseFloat(r.average_utilized),
        utilizationRatePercentage: parseFloat(r.utilization_rate_percentage || 0)
      }))
    };
  }

  /**
   * ROI analytics
   */
  async getROIAnalytics() {
    const rows = await analyticsRepository.getRoiStats();

    return {
      metricDescription: 'ROI calculated as: Ratio = (Revenue - Cost) / Cost, Percentage = Ratio * 100.',
      programs: rows.map(r => {
        const roi = this.calculateROI(r.total_revenue, r.total_cost);
        return {
          programId: r.program_id,
          totalCost: parseFloat(r.total_cost),
          totalRevenue: parseFloat(r.total_revenue),
          roiRatio: roi.ratio,
          roiPercentage: roi.percentage
        };
      })
    };
  }

  /**
   * Program Effectiveness
   */
  async getProgramEffectiveness() {
    const rows = await analyticsRepository.getEffectivenessStats();

    return {
      metricDescription: 'Synthesizes retention rates, churn rates, patient adherence, and persistence to rate program effectiveness.',
      effectiveness: rows.map(r => ({
        programId: r.program_id,
        averageRetentionRate: parseFloat(parseFloat(r.avg_retention || 0).toFixed(2)),
        averageChurnRate: parseFloat(parseFloat(r.avg_churn || 0).toFixed(2)),
        averageAdherenceRate: parseFloat(r.avg_adherence || 0),
        averagePersistencyDays: parseFloat(r.avg_persistency || 0),
        totalEnrolledPatients: parseInt(r.total_enrolled || 0, 10)
      }))
    };
  }
}

module.exports = new AnalyticsService();
