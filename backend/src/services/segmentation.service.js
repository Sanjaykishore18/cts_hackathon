const PythonSegmentationProvider = require('./providers/python-segmentation.provider');

// Exact 44 features in order required by the preprocessor
const SEGMENTATION_FEATURES = [
  'Patient_ID', 'Age', 'Gender', 'Age_Group', 'Region', 'State', 'City_Market', 'Insurance_Type', 'Insurance_Plan',
  'Disease_Condition', 'Baseline_Risk', 'Patient_Start_Date', 'Income_Band', 'Financial_Assistance_Eligible',
  'Employment_Status', 'Total_Enrollment_Duration', 'Num_Programs_Enrolled', 'Total_Enrollments', 'Num_Withdrawals',
  'Num_Discontinuations', 'Primary_Enrollment_Channel', 'Primary_Enrollment_Reason', 'Num_Claims', 'Num_Refills',
  'Average_Days_Supply', 'Total_Patient_Paid', 'Average_Patient_Paid', 'Average_Refill_Gap', 'Maximum_Refill_Gap',
  'Copay_Claims_Count', 'Total_Copay_Used', 'Total_Copay_Savings', 'Fund_Exhausted_Any', 'Copay_Utilization_Rate',
  'Num_Interactions', 'Num_Financial_Assistance_Interactions', 'Num_Adherence_Counseling_Interactions', 'Follow_Up_Rate',
  'Resolution_Rate', 'No_Response_Rate', 'Escalation_Rate', 'PDC', 'Persistence_Days', 'Persistence_Months'
];

class SegmentationService {
  constructor() {
    this.provider = new PythonSegmentationProvider();
  }

  /**
   * Predict patient cluster segment and name using K-Means model.
   * @param {Object} inputData - Express validated body.
   * @returns {Promise<Object>} Formatted segment data.
   */
  async predictSegment(inputData) {
    const payload = {};

    // If inputData represents a database-driven request (e.g. Age is missing but Patient_ID is present)
    let finalFeatures = inputData;
    if (inputData.Age === undefined && inputData.Patient_ID) {
      const patientId = inputData.Patient_ID;
      const mlFeatureService = require('./ml-feature.service');
      const rawData = await mlFeatureService.fetchPatientData(patientId);
      const segmentationFeatureBuilder = require('../ml/feature-builders/segmentation.feature-builder');
      finalFeatures = segmentationFeatureBuilder.buildFeatures(rawData);
    }

    // 1. Prepare exact payload format for Python
    for (const key of SEGMENTATION_FEATURES) {
      payload[key] = finalFeatures[key];
    }

    // 2. Delegate to Python K-Means provider
    const result = await this.provider.predict(payload);

    // 3. Return output directly using Python's segment mapping
    return {
      patient_id: result.patient_id,
      cluster_id: result.cluster_id,
      segment_name: result.segment_name
    };
  }
}

module.exports = new SegmentationService();
