const MockProvider = require('./mlProviders/mock.provider');
const HttpProvider = require('./mlProviders/http.provider');
const PythonChurnProvider = require('./providers/python-churn.provider');

// Exact 20 features list in order
const FEATURE_KEYS = [
  'age',
  'gender',
  'region',
  'insuranceType',
  'diseaseCondition',
  'baselineRisk',
  'numProgramsEnrolled',
  'numEnrollments',
  'numWithdrawn',
  'enrollmentChannel',
  'enrollmentReason',
  'totalInteractions',
  'pctFollowUpRequired',
  'pctResolved',
  'pctNoResponse',
  'pctEscalated',
  'numFinancialAssistInteractions',
  'numAdherenceCounseling',
  'numProgramsEligible',
  'pctEnrollmentEligible'
];

class MlService {
  constructor() {
    this.providers = {
      mock: new MockProvider(),
      http: new HttpProvider(),
      python: new PythonChurnProvider()
    };
  }

  /**
   * Predict patient churn probability and prediction status.
   * @param {Object} inputData - Validate input body.
   * @returns {Promise<Object>} Object containing churnProbability and churnPrediction.
   */
  async predictChurn(inputData) {
    const providerType = (process.env.ML_PROVIDER || 'python').toLowerCase();
    const provider = this.providers[providerType];

    if (!provider) {
      const error = new Error(`Unsupported ML provider configuration: ${providerType}`);
      error.status = 500;
      error.code = 'ML_PROVIDER_CONFIG_ERROR';
      throw error;
    }

    // If inputData represents a database-driven request (e.g. age is missing but patientId/Patient_ID is present)
    let finalFeatures = inputData;
    if (inputData.age === undefined && (inputData.Patient_ID || inputData.patientId)) {
      const patientId = inputData.Patient_ID || inputData.patientId;
      const mlFeatureService = require('./ml-feature.service');
      const rawData = await mlFeatureService.fetchPatientData(patientId);
      const churnFeatureBuilder = require('../ml/feature-builders/churn.feature-builder');
      finalFeatures = churnFeatureBuilder.buildFeatures(rawData);
    }

    // Prepare feature payload in the exact order/name expected by the model
    const orderedFeatures = {};
    for (const key of FEATURE_KEYS) {
      orderedFeatures[key] = finalFeatures[key];
    }

    try {
      const result = await provider.predict(orderedFeatures);

      // Validate provider outputs
      if (result === undefined || typeof result.churnProbability !== 'number') {
        throw new Error('Invalid output format from ML provider');
      }

      const churnProbability = result.churnProbability;
      
      // Documented rule: probability >= 0.5 → "Churned", probability < 0.5 → "Active"
      const churnPrediction = churnProbability >= 0.5 ? 'Churned' : 'Active';

      return {
        churnProbability,
        churnPrediction
      };
    } catch (err) {
      console.error(`[MlService] Error during prediction: ${err.message}`);
      // Use existing centralized error format/codes
      const mlError = new Error('ML prediction service unavailable');
      mlError.status = 503;
      mlError.code = 'ML_SERVICE_UNAVAILABLE';
      throw mlError;
    }
  }
}

module.exports = new MlService();
