const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class PythonSegmentationProvider {
  /**
   * Invokes the real python K-Means inference implementation via a temporary JSON file.
   * @param {Object} payload - The 44 features.
   * @returns {Promise<Object>} Object containing cluster_id and segment_name.
   */
  async predict(payload) {
    const pythonExec = process.env.PYTHON_SEGMENTATION_EXECUTABLE || 'venv_strategy/Scripts/python.exe';
    const modelDir = process.env.SEGMENTATION_MODEL_DIR || 'ml_model/segmentation';

    const scriptPath = path.resolve(modelDir, 'predict.py');
    const modelPath = path.resolve(modelDir, 'kmeans_model.joblib');
    const preprocessorPath = path.resolve(modelDir, 'preprocessor.joblib');

    const scriptExists = fs.existsSync(scriptPath);
    const modelExists = fs.existsSync(modelPath);
    const preprocessorExists = fs.existsSync(preprocessorPath);

    console.log(`[PythonSegmentationProvider] Path Check:\n - Script: ${scriptPath} (exists: ${scriptExists})\n - Model: ${modelPath} (exists: ${modelExists})\n - Preprocessor: ${preprocessorPath} (exists: ${preprocessorExists})`);

    if (!scriptExists || !modelExists || !preprocessorExists) {
      console.error(`[PythonSegmentationProvider] Missing artifacts. script: ${scriptExists}, model: ${modelExists}, preprocessor: ${preprocessorExists}`);
      const error = new Error('Patient segmentation model unavailable');
      error.status = 503;
      error.code = 'SEGMENTATION_MODEL_UNAVAILABLE';
      error.details = { scriptExists, modelExists, preprocessorExists };
      throw error;
    }

    // 2. Create a temporary JSON file for input
    const tempFileName = `temp_seg_${Date.now()}_${Math.floor(Math.random() * 10000)}.json`;
    const tempFilePath = path.resolve(modelDir, tempFileName);

    try {
      fs.writeFileSync(tempFilePath, JSON.stringify(payload));
    } catch (err) {
      const error = new Error(`Failed to write temporary JSON input: ${err.message}`);
      error.status = 500;
      error.code = 'SEGMENTATION_INFERENCE_FAILED';
      throw error;
    }

    // 3. Spawn python subprocess and exchange data via CLI arguments
    return new Promise((resolve, reject) => {
      console.log(`[PythonSegmentationProvider] Spawning ${pythonExec} with input file: ${tempFilePath}`);
      
      const child = spawn(pythonExec, [scriptPath, '--input', tempFilePath]);
      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('error', (err) => {
        // Cleanup temp file
        try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
        
        console.error('[PythonSegmentationProvider] Process spawn error:', err);
        const error = new Error(`Python execution error: ${err.message}`);
        error.status = 503;
        error.code = 'SEGMENTATION_MODEL_UNAVAILABLE';
        reject(error);
      });

      child.on('close', (code) => {
        // Ensure cleanup of the temporary file in all exit paths
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`[PythonStrategyProvider] Cleaned up temporary file: ${tempFilePath}`);
          }
        } catch (cleanupErr) {
          console.error(`[PythonSegmentationProvider] Failed to delete temp file ${tempFilePath}:`, cleanupErr);
        }

        if (code !== 0) {
          console.error(`[PythonSegmentationProvider] predict.py exited with code ${code}. Stderr: ${stderrData}`);
          const error = new Error('Python inference execution failed');
          error.status = 500;
          error.code = 'SEGMENTATION_INFERENCE_FAILED';
          error.details = { stderr: stderrData };
          return reject(error);
        }

        try {
          const result = JSON.parse(stdoutData.trim());
          if (result === null || typeof result.cluster_id !== 'number' || typeof result.segment_name !== 'string') {
            throw new Error('Missing cluster_id or segment_name in response');
          }
          resolve(result);
        } catch (parseErr) {
          console.error(`[PythonSegmentationProvider] Malformed JSON response. Output was: ${stdoutData}`);
          const error = new Error('Malformed model response');
          error.status = 502;
          error.code = 'INVALID_MODEL_RESPONSE';
          reject(error);
        }
      });
    });
  }
}

module.exports = PythonSegmentationProvider;
