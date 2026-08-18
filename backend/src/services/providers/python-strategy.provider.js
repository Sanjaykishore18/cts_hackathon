const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class PythonStrategyProvider {
  /**
   * Invokes the Python Strategy Effectiveness inference script.
   * @param {Object} payload - The 43 raw features.
   * @returns {Promise<Object>} Object containing predicted_pdc.
   */
  async predict(payload) {
    const pythonExec = process.env.PYTHON_STRATEGY_EXECUTABLE || 'venv_strategy/Scripts/python.exe';
    const modelDir = process.env.STRATEGY_MODEL_DIR || 'ml_model/strategy';

    const scriptPath = path.resolve(modelDir, 'predict_strategy.py');
    const modelPath = path.resolve(modelDir, 'gradientboostingregressor_model.joblib');
    const preprocessorPath = path.resolve(modelDir, 'preprocessor.joblib');

    // 1. Verify all required ML model files exist
    const scriptExists = fs.existsSync(scriptPath);
    const modelExists = fs.existsSync(modelPath);
    const preprocessorExists = fs.existsSync(preprocessorPath);

    if (!scriptExists || !modelExists || !preprocessorExists) {
      console.error(`[PythonStrategyProvider] Missing artifacts. script: ${scriptExists}, model: ${modelExists}, preprocessor: ${preprocessorExists}`);
      const error = new Error('Strategy effectiveness prediction model unavailable');
      error.status = 503;
      error.code = 'STRATEGY_MODEL_UNAVAILABLE';
      error.details = { scriptExists, modelExists, preprocessorExists };
      throw error;
    }

    // 2. Spawn python subprocess and exchange JSON payloads via stdin/stdout
    return new Promise((resolve, reject) => {
      console.log(`[PythonStrategyProvider] Spawning ${pythonExec} for script: ${scriptPath}`);
      
      const child = spawn(pythonExec, [scriptPath]);
      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('error', (err) => {
        console.error('[PythonStrategyProvider] Process failed to spawn:', err);
        const error = new Error(`Python execution error: ${err.message}`);
        error.status = 503;
        error.code = 'STRATEGY_MODEL_UNAVAILABLE';
        reject(error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`[PythonStrategyProvider] predict_strategy.py exited with code ${code}. Stderr: ${stderrData}`);
          let parsedErr = {};
          try {
            parsedErr = JSON.parse(stderrData.trim());
          } catch (e) {
            parsedErr = { error: stderrData || 'Unknown Python process error' };
          }
          const error = new Error(parsedErr.error || 'Python inference execution failed');
          error.status = 500;
          error.code = 'STRATEGY_INFERENCE_FAILED';
          error.details = parsedErr;
          return reject(error);
        }

        try {
          const result = JSON.parse(stdoutData.trim());
          if (result === null || typeof result.predicted_pdc !== 'number') {
            throw new Error('Missing predicted_pdc in response');
          }
          resolve(result);
        } catch (parseErr) {
          console.error(`[PythonStrategyProvider] Malformed JSON response. Output was: ${stdoutData}`);
          const error = new Error('Malformed model response');
          error.status = 502;
          error.code = 'INVALID_MODEL_RESPONSE';
          reject(error);
        }
      });

      // Write payload to stdin and end it
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }
}

module.exports = PythonStrategyProvider;
