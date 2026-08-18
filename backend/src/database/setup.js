require('dotenv').config();
const { Client } = require('pg');
const { seedDatabase } = require('./seed');

async function setup() {
  console.log('--- Initializing Database Setup ---');

  // Connection settings to default postgres database
  const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10)
  });

  try {
    await client.connect();
    
    // Check if the target database exists
    const checkDbResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'copay_psp_analytics'"
    );

    if (checkDbResult.rows.length === 0) {
      console.log('Database "copay_psp_analytics" does not exist. Creating...');
      // CREATE DATABASE cannot run inside a transaction block, so we run it directly
      await client.query('CREATE DATABASE copay_psp_analytics');
      console.log('Database "copay_psp_analytics" created successfully.');
    } else {
      console.log('Database "copay_psp_analytics" already exists.');
    }
  } catch (err) {
    console.error('Failed to setup database:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  // Seed the newly created/existing database
  console.log('Running database seeding...');
  // Note: seed.js's seedDatabase creates its own pool and closes it.
  // We can require and run it directly since the database now exists.
  try {
    // We run the seedDatabase function exported from seed.js
    const { pool } = require('../config/db');
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    const seedClient = await pool.connect();
    try {
      await seedClient.query('BEGIN');
      console.log('Creating tables...');
      await seedClient.query(schemaSql);
      console.log('Tables created successfully.');

      const PATIENTS = [
        ['PAT-001', 'PROG-001', 'Copay Card', 'Commercial', '2026-01-10', 'Enrolled', 'Provider Portal', 5000.00, 10000.00, 3500.00, 7, 92.50, 210, null],
        ['PAT-002', 'PROG-001', 'Copay Card', 'Commercial', '2026-02-15', 'Enrolled', 'Patient Portal', 5000.00, 10000.00, 1500.00, 3, 85.00, 120, null],
        ['PAT-003', 'PROG-002', 'Alternative Funding', 'Commercial', '2026-01-05', 'Enrolled', 'Provider Portal', 12000.00, 25000.00, 8000.00, 5, 95.00, 220, null],
        ['PAT-004', 'PROG-002', 'Alternative Funding', 'Commercial', '2026-03-01', 'Enrolled', 'Phone Call', 12000.00, 25000.00, 2000.00, 2, 78.00, 90, null],
        ['PAT-005', 'PROG-003', 'Bridge Program', 'Medicare', '2026-01-20', 'Enrolled', 'Provider Portal', 3000.00, 5000.00, 2500.00, 6, 88.00, 200, null],
        ['PAT-006', 'PROG-001', 'Copay Card', 'Commercial', '2026-01-15', 'Dropped', 'Patient Portal', 5000.00, 10000.00, 1000.00, 2, 45.00, 45, 'Financial hardship resolved'],
        ['PAT-007', 'PROG-002', 'Alternative Funding', 'Commercial', '2026-02-10', 'Dropped', 'Provider Portal', 12000.00, 25000.00, 4000.00, 3, 60.00, 80, 'Side effects'],
        ['PAT-008', 'PROG-003', 'Bridge Program', 'Medicare', '2026-01-12', 'Dropped', 'Phone Call', 3000.00, 5000.00, 500.00, 1, 30.00, 30, 'Ineligible for continued support'],
        ['PAT-009', 'PROG-001', 'Copay Card', 'Medicaid', '2026-04-01', 'Non-Enrolled', 'Patient Portal', 5000.00, 10000.00, 0.00, 0, 0.00, 0, 'Prior authorization denied'],
        ['PAT-010', 'PROG-004', 'Patient Assistance Program (PAP)', 'Uninsured', '2026-03-10', 'Non-Enrolled', 'Provider Portal', 15000.00, 30000.00, 0.00, 0, 0.00, 0, 'Incomplete application documents'],
        ['PAT-011', 'PROG-004', 'Patient Assistance Program (PAP)', 'Uninsured', '2026-02-10', 'Enrolled', 'Provider Portal', 15000.00, 30000.00, 10000.00, 5, 91.00, 150, null],
        ['PAT-012', 'PROG-001', 'Copay Card', 'Medicare', '2026-01-22', 'Enrolled', 'Phone Call', 5000.00, 10000.00, 2000.00, 4, 82.30, 160, null]
      ];

      const BUSINESS_DATA = [
        ['PROG-001', 'Northeast', 'Q1-2026', 150, 45000.00, 112500.00, 1.5000, 85.00, 15.00, 25, JSON.stringify({ Commercial: 70, Medicare: 20, Medicaid: 10 })],
        ['PROG-001', 'West', 'Q1-2026', 120, 38000.00, 87400.00, 1.3000, 88.00, 12.00, 18, JSON.stringify({ Commercial: 80, Medicare: 15, Medicaid: 5 })],
        ['PROG-001', 'Midwest', 'Q1-2026', 90, 30000.00, 60000.00, 1.0000, 80.00, 20.00, 10, JSON.stringify({ Commercial: 65, Medicare: 25, Medicaid: 10 })],
        ['PROG-002', 'Northeast', 'Q1-2026', 80, 120000.00, 384000.00, 2.2000, 92.00, 8.00, 15, JSON.stringify({ Commercial: 90, Medicare: 10 })],
        ['PROG-002', 'West', 'Q1-2026', 60, 95000.00, 266000.00, 1.8000, 90.00, 10.00, 12, JSON.stringify({ Commercial: 85, Medicare: 15 })],
        ['PROG-002', 'Southeast', 'Q1-2026', 75, 110000.00, 297000.00, 1.7000, 87.00, 13.00, 14, JSON.stringify({ Commercial: 75, Medicare: 20, Medicaid: 5 })],
        ['PROG-003', 'Midwest', 'Q1-2026', 50, 25000.00, 45000.00, 0.8000, 82.00, 18.00, 8, JSON.stringify({ Medicare: 80, Medicaid: 20 })],
        ['PROG-003', 'Southeast', 'Q1-2026', 40, 22000.00, 35200.00, 0.6000, 78.00, 22.00, 5, JSON.stringify({ Medicare: 85, Medicaid: 15 })],
        ['PROG-001', 'Northeast', 'Q2-2026', 170, 50000.00, 140000.00, 1.8000, 87.00, 13.00, 30, JSON.stringify({ Commercial: 72, Medicare: 18, Medicaid: 10 })],
        ['PROG-001', 'West', 'Q2-2026', 135, 42000.00, 105000.00, 1.5000, 89.00, 11.00, 22, JSON.stringify({ Commercial: 78, Medicare: 17, Medicaid: 5 })],
        ['PROG-002', 'Northeast', 'Q2-2026', 95, 140000.00, 476000.00, 2.4000, 94.00, 6.00, 20, JSON.stringify({ Commercial: 92, Medicare: 8 })]
      ];

      const RECOMMENDATIONS = [
        ['PAT-001', JSON.stringify({ age: 45, gender: 'F' }), 'Oncology', 'Copay Card', 'Low', 'Low', 'Copay Card', 'Tier 1', 1.4500, 0.9450],
        ['PAT-002', JSON.stringify({ age: 58, gender: 'M' }), 'Oncology', 'Copay Card', 'Medium', 'Low', 'Copay Card', 'Tier 2', 1.1500, 0.8900],
        ['PAT-005', JSON.stringify({ age: 67, gender: 'F' }), 'Rheumatology', 'Bridge Program', 'Low', 'Medium', 'Alternative Funding', 'Tier 3', 2.1000, 0.8210],
        ['PAT-006', JSON.stringify({ age: 34, gender: 'M' }), 'Immunology', 'Copay Card', 'High', 'High', 'Patient Assistance Program (PAP)', 'Tier 4', 0.5000, 0.9120],
        ['PAT-007', JSON.stringify({ age: 51, gender: 'F' }), 'Rheumatology', 'Alternative Funding', 'High', 'High', 'Bridge Program', 'Tier 2', 1.0500, 0.8750]
      ];

      console.log('Seeding patient_program table...');
      const patientInsertQuery = `
        INSERT INTO patient_program (
          patient_id, program_id, program_type, insurance_type, enrollment_date, 
          enrollment_status, enrollment_channel, copay_coverage_amount, annual_benefit_cap, 
          benefit_utilized_amount, number_of_fills_with_assistance, adherence_rate, 
          persistency_days, dropout_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;
      for (const patient of PATIENTS) {
        await seedClient.query(patientInsertQuery, patient);
      }

      console.log('Seeding program_business table...');
      const businessInsertQuery = `
        INSERT INTO program_business (
          program_id, region, time_period, enrolled_patient_count, 
          program_cost, revenue_generated, roi, retention_rate, 
          churn_rate, net_new_patients, payer_mix
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      for (const biz of BUSINESS_DATA) {
        await seedClient.query(businessInsertQuery, biz);
      }

      console.log('Seeding patient_recommendations table...');
      const recommendationsInsertQuery = `
        INSERT INTO patient_recommendations (
          patient_id, patient_demographics, disease_therapy_area, current_program_type, 
          predicted_adherence_risk, predicted_churn_risk, recommended_program_type, 
          recommended_discount_tier, predicted_roi_contribution, model_confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      for (const rec of RECOMMENDATIONS) {
        await seedClient.query(recommendationsInsertQuery, rec);
      }

      await seedClient.query('COMMIT');
      console.log('Database setup and seed completed successfully!');
    } catch (err) {
      await seedClient.query('ROLLBACK');
      console.error('Error seeding database:', err.message);
      process.exit(1);
    } finally {
      seedClient.release();
      await pool.end();
    }
  } catch (err) {
    console.error('Failed to connect to database for seeding:', err.message);
    process.exit(1);
  }
}

setup();
