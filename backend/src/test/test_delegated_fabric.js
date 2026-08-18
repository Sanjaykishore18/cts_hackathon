require('dotenv').config();
const msal = require('@azure/msal-node');
const sql = require('mssql');

const clientId = process.env.AZURE_CLIENT_ID || 'f878bd00-ec41-4386-a53e-15d4bac23e89';
const tenantId = process.env.AZURE_TENANT_ID || 'bc88ed7e-984d-4728-939e-6ab8bfeaba1d';
const authority = `https://login.microsoftonline.com/${tenantId}`;

// Scope for database (TDS endpoint)
const scopes = ['https://database.windows.net//.default'];

const msalConfig = {
  auth: {
    clientId: clientId,
    authority: authority
  }
};

const pca = new msal.PublicClientApplication(msalConfig);

async function runExperiment() {
  console.log('--- Starting Entra ID Delegated Authentication Experiment ---');
  console.log(`Authority: ${authority}`);
  console.log(`Client ID: ${clientId}`);
  console.log(`Scopes: ${scopes.join(', ')}`);

  const deviceCodeRequest = {
    deviceCodeCallback: (response) => {
      console.log('\n==================================================');
      console.log(response.message);
      console.log('==================================================\n');
    },
    scopes: scopes
  };

  try {
    console.log('Requesting device code...');
    const response = await pca.acquireTokenByDeviceCode(deviceCodeRequest);
    console.log('Token successfully acquired!');
    console.log(`Account signed in: ${response.account.username}`);
    
    // Test Fabric TDS Connection using acquired token
    const token = response.accessToken;
    
    const dbConfig = {
      server: 'p3wyrpcntauepe46nk4l72v2du-anqarqd7em4uris2gcc2lhb6yy.datawarehouse.fabric.microsoft.com',
      database: 'Copay_Patient_Support_Lakehouse',
      port: 1433,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token }
      },
      options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 20000,
        requestTimeout: 30000
      }
    };

    console.log('\nConnecting to Microsoft Fabric SQL Endpoint...');
    const pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();
    console.log('Connection established successfully!');

    // Test 1: SELECT 1
    console.log('\nExecuting connection test (SELECT 1)...');
    const testResult = await pool.request().query('SELECT 1 AS connection_test');
    console.log('Test result:', testResult.recordset);

    // Test 2: SELECT TOP 5 FROM dbo.dim_patient
    console.log('\nExecuting query against Gold table (dbo.dim_patient)...');
    try {
      const patientResult = await pool.request().query('SELECT TOP 5 * FROM dbo.dim_patient');
      console.log('dim_patient query succeeded!');
      console.log(`Rows returned: ${patientResult.recordset.length}`);
      console.log('Sample columns:', Object.keys(patientResult.recordset[0] || {}));
    } catch (queryErr) {
      console.error('Query against dbo.dim_patient failed:', queryErr.message);
    }

    await pool.close();
    console.log('\nFabric connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('\nExperiment failed:', error.message);
    process.exit(1);
  }
}

runExperiment();
