require('dotenv').config();
const { Connection } = require('tedious');

const config = {
  server: process.env.FABRIC_SQL_ENDPOINT,
  options: {
    port: parseInt(process.env.FABRIC_PORT || '1433', 10),
    database: process.env.FABRIC_DATABASE,
    encrypt: true,
    trustServerCertificate: false
  },
  authentication: {
    type: 'azure-active-directory-service-principal-secret',
    options: {
      tenantId: process.env.AZURE_TENANT_ID,
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET
    }
  }
};

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const connection = new Connection(config);

connection.connect((err) => {
  if (err) {
    console.error('Connection Callback Error:', err);
  } else {
    console.log('Connected successfully!');
  }
  process.exit(0);
});

connection.on('errorMessage', (error) => {
  console.error('Server Error Message:', error);
});

connection.on('infoMessage', (info) => {
  console.log('Server Info Message:', info);
});

connection.on('error', (err) => {
  console.error('Connection Level Error:', err);
});
