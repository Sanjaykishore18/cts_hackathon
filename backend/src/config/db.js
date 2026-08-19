const { Pool } = require('pg');

// Create connection configuration using env variables
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Add reasonable timeout settings
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20
});



// Event listener for idle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});



/**
 * Reusable query execution handler
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text, duration, rowsCount: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error: error.message });
    throw error;
  }
};

/**
 * Verifies connection connectivity
 */
const testConnection = async () => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW()');
    console.log('Database connection successfully established at:', res.rows[0].now);
    return true;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  testConnection
};
