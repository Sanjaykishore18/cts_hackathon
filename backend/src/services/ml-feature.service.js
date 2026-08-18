const mlFeatureRepository = require('../repositories/ml-feature.repository');
const churnFeatureBuilder = require('../ml/feature-builders/churn.feature-builder');
const segmentationFeatureBuilder = require('../ml/feature-builders/segmentation.feature-builder');
const strategyFeatureBuilder = require('../ml/feature-builders/strategy.feature-builder');

const mlService = require('./ml.service');
const segmentationService = require('./segmentation.service');
const strategyService = require('./strategy.service');

class MlFeatureService {
  /**
   * Fetch all raw data required for any model features for a given patient.
   */
  async fetchPatientData(patientId) {
    const profile = await mlFeatureRepository.getPatientProfile(patientId);
    if (!profile) {
      const err = new Error(`Patient with ID ${patientId} not found`);
      err.status = 404;
      err.code = 'PATIENT_NOT_FOUND';
      throw err;
    }

    const [enrollments, claims, copayClaims, interactions, eligibilities] = await Promise.all([
      mlFeatureRepository.getEnrollments(patientId),
      mlFeatureRepository.getPharmacyClaims(patientId),
      mlFeatureRepository.getCopayClaims(patientId),
      mlFeatureRepository.getInteractions(patientId),
      mlFeatureRepository.getEligibilities(patientId)
    ]);

    return {
      profile,
      enrollments,
      claims,
      copayClaims,
      interactions,
      eligibilities
    };
  }

  /**
   * Build features and predict churn for a patient by ID.
   */
  async buildAndPredictChurn(patientId) {
    const rawData = await this.fetchPatientData(patientId);
    const features = churnFeatureBuilder.buildFeatures(rawData);
    return await mlService.predictChurn(features);
  }

  /**
   * Build features and predict segment for a patient by ID.
   */
  async buildAndPredictSegment(patientId) {
    const rawData = await this.fetchPatientData(patientId);
    const features = segmentationFeatureBuilder.buildFeatures(rawData);
    return await segmentationService.predictSegment(features);
  }

  /**
   * Build features and predict strategy effectiveness for a patient by ID.
   */
  async buildAndPredictStrategy(patientId, proposedStrategyCode, treatmentStartDate = '2026-08-15') {
    const rawData = await this.fetchPatientData(patientId);

    // 1. Live Segmentation call to get Segment_Name dependency
    const segFeatures = segmentationFeatureBuilder.buildFeatures(rawData);
    const segResult = await segmentationService.predictSegment(segFeatures);

    // 2. Build Strategy features with Segment_Name from step 1
    const strategyFeatures = strategyFeatureBuilder.buildFeatures({
      ...rawData,
      segmentName: segResult.segment_name,
      treatmentStartDate
    });

    // 3. Predict strategy effectiveness
    return await strategyService.predictStrategyEffectiveness(strategyFeatures);
  }
}

module.exports = new MlFeatureService();
