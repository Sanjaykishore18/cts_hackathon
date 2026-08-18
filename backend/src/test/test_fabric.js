require('dotenv').config();
const { testConnection, query } = require('../config/fabric');

async function run() {
  console.log('Starting Microsoft Fabric connection test...');
  try {
    await testConnection();
    console.log('SELECT 1 connection test succeeded!');

    // Discover if the Gold schema objects exist
    console.log('Discovering Gold tables...');
    const tables = [
      'dbo.dim_patient',
      'dbo.dim_program',
      'dbo.fact_enrollment',
      'dbo.fact_patient_risk_score',
      'dbo.fact_patient_outcome'
    ];

    for (const table of tables) {
      try {
        const res = await query(`SELECT TOP 1 * FROM ${table}`);
        console.log(`Table/View exists and is accessible: ${table} (${res.rows.length} rows returned)`);
      } catch (err) {
        console.warn(`Table/View checks failed/inaccessible for: ${table} - Error: ${err.message}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Microsoft Fabric connection test failed:');
    console.dir(error, { depth: null });
    process.exit(1);
  }
}

run();
