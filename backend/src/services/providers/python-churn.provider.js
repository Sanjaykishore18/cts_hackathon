const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class PythonChurnProvider {
  /**
   * Predict patient churn using Python XGBoost model.
   * @param {Object} payload - The 20 camelCase features.
   * @returns {Promise<Object>} Object containing churnProbability.
   */
  async predict(payload) {
    const pythonExec = process.env.PYTHON_CHURN_EXECUTABLE || 'venv_strategy/Scripts/python.exe';
    const modelDir = process.env.CHURN_MODEL_DIR || 'ml_model/churn';

    const scriptPath = path.resolve(modelDir, 'predict_churn.py');
    const modelPath = path.resolve(modelDir, 'churn_prediction_model (1).pkl');

    // 1. Verify all required ML model artifacts exist
    const scriptExists = fs.existsSync(scriptPath);
    const modelExists = fs.existsSync(modelPath);

    if (!scriptExists || !modelExists) {
      console.error(`[PythonChurnProvider] Missing artifacts. script: ${scriptExists}, model: ${modelExists}`);
      const error = new Error('Churn model unavailable');
      error.status = 503;
      error.code = 'ML_SERVICE_UNAVAILABLE';
      error.details = { scriptExists, modelExists };
      throw error;
    }

    // 2. Spawn python subprocess and exchange data via stdin/stdout streams
    return new Promise((resolve, reject) => {
      console.log(`[PythonChurnProvider] Spawning ${pythonExec} ${scriptPath}`);
      const child = spawn(pythonExec, [scriptPath]);
      let stdoutData = '';
      let stderrData = '';

      // Feed JSON input to stdin
      try {
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (writeErr) {
        console.error('[PythonChurnProvider] Failed writing to stdin:', writeErr);
        const error = new Error(`Stdin write failed: ${writeErr.message}`);
        error.status = 500;
        error.code = 'ML_SERVICE_UNAVAILABLE';
        return reject(error);
      }

      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('error', (err) => {
        console.error('[PythonChurnProvider] Subprocess error:', err);
        const error = new Error(`Python execution error: ${err.message}`);
        error.status = 503;
        error.code = 'ML_SERVICE_UNAVAILABLE';
        reject(error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`[PythonChurnProvider] predict_churn.py exited with code ${code}. Stderr: ${stderrData}`);
          const error = new Error('Python churn inference execution failed');
          error.status = 500;
          error.code = 'ML_SERVICE_UNAVAILABLE';
          error.details = { stderr: stderrData };
          return reject(error);
        }

        try {
          const result = JSON.parse(stdoutData.trim());
          if (result.error) {
            throw new Error(result.error);
          }
          if (typeof result.churnProbability !== 'number') {
            throw new Error('Missing churnProbability in response');
          }
          resolve(result);
        } catch (parseErr) {
          console.error(`[PythonChurnProvider] Malformed JSON response. Output was: ${stdoutData}`);
          const error = new Error('Malformed model response');
          error.status = 502;
          error.code = 'ML_SERVICE_UNAVAILABLE';
          reject(error);
        }
      });
    });
  }
}

module.exports = PythonChurnProvider;
