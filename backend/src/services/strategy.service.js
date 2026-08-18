const PythonStrategyProvider = require('./providers/python-strategy.provider');

const STRATEGY_FEATURES = [
  'Age', 'Baseline_Risk', 'Enrolled_PG01', 'Enrolled_PG02', 'Enrolled_PG03', 'Enrolled_PG04', 'Enrolled_PG05', 'Enrolled_PG06',
  'Variable_Cost_Per_Patient_30d', 'Copay_Max_Per_Patient_30d', 'Num_Claims_30d', 'Num_Refills_30d', 'Average_Days_Supply_30d',
  'Total_Patient_Paid_30d', 'Average_Patient_Paid_30d', 'Average_Refill_Gap_30d', 'Maximum_Refill_Gap_30d', 'Copay_Claims_Count_30d',
  'Total_Copay_Used_30d', 'Total_Copay_Savings_30d', 'Fund_Exhausted_Any_30d', 'Copay_Utilization_Rate_30d', 'Num_Interactions_30d',
  'Num_Financial_Assistance_Interactions_30d', 'Num_Adherence_Counseling_Interactions_30d', 'Follow_Up_Rate_30d', 'Resolution_Rate_30d',
  'No_Response_Rate_30d', 'Escalation_Rate_30d', 'Gender', 'Age_Group', 'Region', 'State', 'City_Market',
  'Insurance_Type', 'Insurance_Plan', 'Disease_Condition', 'Income_Band', 'Financial_Assistance_Eligible',
  'Employment_Status', 'Segment_Name', 'Primary_Enrollment_Channel', 'Primary_Enrollment_Reason'
];

class StrategyService {
  constructor() {
    this.provider = new PythonStrategyProvider();
  }

  /**
   * Predict strategy effectiveness (PDC).
   * @param {Object} inputData - Express validated body.
   * @returns {Promise<Object>} Object containing predicted_pdc.
   */
  async predictStrategyEffectiveness(inputData) {
    const payload = {};

    // If inputData represents a database-driven request (e.g. Age is missing but Patient_ID / patientId is present)
    let finalFeatures = inputData;
    if (inputData.Age === undefined && (inputData.Patient_ID || inputData.patientId)) {
      const patientId = inputData.Patient_ID || inputData.patientId;
      const mlFeatureService = require('./ml-feature.service');
      const rawData = await mlFeatureService.fetchPatientData(patientId);
      
      // Live K-Means Segmentation call for Segment_Name dependency
      const segmentationFeatureBuilder = require('../ml/feature-builders/segmentation.feature-builder');
      const segFeatures = segmentationFeatureBuilder.buildFeatures(rawData);
      const segmentationService = require('./segmentation.service');
      const segResult = await segmentationService.predictSegment(segFeatures);

      // Build Strategy features using Segment_Name
      const strategyFeatureBuilder = require('../ml/feature-builders/strategy.feature-builder');
      finalFeatures = strategyFeatureBuilder.buildFeatures({
        ...rawData,
        segmentName: segResult.segment_name,
        treatmentStartDate: inputData.treatmentStartDate || '2026-08-15'
      });
    }

    // Build the payload with exact 43 features in order
    for (const key of STRATEGY_FEATURES) {
      payload[key] = finalFeatures[key];
    }

    // Call the Python ML provider
    const result = await this.provider.predict(payload);

    return {
      predicted_pdc: result.predicted_pdc
    };
  }
}

module.exports = new StrategyService();
