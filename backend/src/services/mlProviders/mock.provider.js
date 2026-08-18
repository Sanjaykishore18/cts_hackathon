/**
 * Mock provider for ML Churn Prediction.
 * IMPORTANT: This is for DEVELOPMENT/MOCK purposes only.
 * This does not connect to the real XGBoost model service.
 */
class MockProvider {
  /**
   * Deterministically returns a mock prediction based on the supplied input.
   * To facilitate testing, it maps the output probability to the input baselineRisk.
   * @param {Object} features - The 20 ordered feature values.
   * @returns {Promise<Object>} The mock churn probability.
   */
  async predict(features) {
    // Log for transparency
    console.log('[MockProvider] Generating mock churn prediction based on baselineRisk');

    // Deterministic mock mapping: use baselineRisk as probability
    const churnProbability = typeof features.baselineRisk === 'number' ? features.baselineRisk : 0.5;

    return {
      churnProbability
    };
  }
}

module.exports = MockProvider;
