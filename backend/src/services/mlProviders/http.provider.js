/**
 * HTTP provider for ML Churn Prediction.
 * Connects to the real XGBoost model service deployment.
 */
class HttpProvider {
  /**
   * Sends the features payload to the external ML service.
   * @param {Object} features - The 20 ordered feature values.
   * @returns {Promise<Object>} The actual model churn prediction probability.
   */
  async predict(features) {
    const url = process.env.ML_SERVICE_URL;
    if (!url) {
      throw new Error('ML_SERVICE_URL environment variable is not defined');
    }

    console.log(`[HttpProvider] Sending request to ML model endpoint: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(features)
    });

    if (!response.ok) {
      throw new Error(`ML model endpoint returned error status: ${response.status}`);
    }

    const data = await response.json();
    
    // The response is expected to contain churnProbability
    if (data && typeof data.churnProbability === 'number') {
      return {
        churnProbability: data.churnProbability
      };
    }

    throw new Error('Invalid response payload from ML model endpoint');
  }
}

module.exports = HttpProvider;
