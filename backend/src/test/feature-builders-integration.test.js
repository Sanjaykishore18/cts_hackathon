require('dotenv').config();
const { query } = require('../config/fabric');
const mlFeatureService = require('../services/ml-feature.service');

async function runIntegrationTest() {
  console.log('--- Starting ML Feature Engineering & Inference Integration Test ---');

  let testPatientId = null;
  try {
    console.log('Fetching a test patient ID from Microsoft Fabric...');
    const result = await query('SELECT TOP 1 Patient_ID FROM dbo.dim_patient');
    if (result.rows.length === 0) {
      console.warn('⚠️ No patients found in dbo.dim_patient. Live Fabric testing is BLOCKED by empty dataset.');
      process.exit(0);
    }
    
    testPatientId = result.rows[0].Patient_ID;
    console.log(`Using Patient ID: ${testPatientId} for live integration test.`);
  } catch (err) {
    console.error('❌ Failed to fetch test patient ID. Live Fabric testing is BLOCKED:', err.message);
    process.exit(1);
  }

  // Test Churn Pipeline
  try {
    console.log('\nRunning Churn Prediction Pipeline...');
    const churnResult = await mlFeatureService.buildAndPredictChurn(testPatientId);
    console.log('Churn Prediction Result:', churnResult);
  } catch (err) {
    console.error('❌ Churn Prediction Pipeline failed:', err.message);
  }

  // Test Segmentation Pipeline
  try {
    console.log('\nRunning Patient Segmentation Pipeline...');
    const segResult = await mlFeatureService.buildAndPredictSegment(testPatientId);
    console.log('Segmentation Result:', segResult);
  } catch (err) {
    console.error('❌ Patient Segmentation Pipeline failed:', err.message);
  }

  // Test Strategy Pipeline
  try {
    console.log('\nRunning Strategy Effectiveness Pipeline...');
    const strategyResult = await mlFeatureService.buildAndPredictStrategy(testPatientId, 'PG01', '2026-08-15');
    console.log('Strategy Effectiveness Result (Predicted PDC):', strategyResult);
  } catch (err) {
    console.error('❌ Strategy Effectiveness Pipeline failed:', err.message);
  }

  console.log('\n--- Integration Test Finished ---');
  process.exit(0);
}

runIntegrationTest();
