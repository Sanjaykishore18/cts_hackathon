const sql = require('mssql');

const config = {
  server: process.env.FABRIC_SQL_ENDPOINT,
  database: process.env.FABRIC_DATABASE,
  port: parseInt(process.env.FABRIC_PORT || '1433', 10),
  authentication: {
    type: 'azure-active-directory-service-principal-secret',
    options: {
      tenantId: process.env.AZURE_TENANT_ID,
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET
    }
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 15000,
    requestTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const pool = new sql.ConnectionPool(config);
let poolConnect = pool.connect();

pool.on('error', err => {
  console.error('Unexpected error on idle Fabric database client', err);
});

const query = async (text, params = []) => {
  const start = Date.now();
  await poolConnect;
  try {
    const request = pool.request();
    // Bind parameters in standard @param1, @param2 format
    params.forEach((param, index) => {
      request.input(`param${index + 1}`, param);
    });
    
    const result = await request.query(text);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed Fabric query', { duration, rowsCount: result.recordset?.length || 0 });
    }
    return { rows: result.recordset || [], rowCount: result.rowsAffected[0] || 0 };
  } catch (error) {
    console.error('Fabric query error:', { error: error.message });
    throw error;
  }
};

const testConnection = async () => {
  await poolConnect;
  const res = await query('SELECT 1 AS connection_test');
  console.log('Microsoft Fabric database connection successfully established.');
  return true;
};

module.exports = {
  pool,
  query,
  testConnection
};
