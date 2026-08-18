const { Client } = require('pg');

const passwords = [
  'postgres', 'admin', 'root', '', '1234', 'password', '123456',
  'postgres123', 'postgres1234', 'postgres_pwd', 'postgres1',
  'postgres@123', 'Pg@12345', 'password123', 'Sanjay', 'Sanjay123',
  'Sanjay@123', 'sanjay', 'sanjay123', 'sanjay@123'
];

async function testPasswords() {
  for (const pw of passwords) {
    console.log(`Testing password: "${pw}"...`);
    const client = new Client({
      user: 'postgres',
      host: 'localhost',
      database: 'copay_psp_analytics',
      password: pw,
      port: 5432
    });
    try {
      await client.connect();
      console.log(`\n>>> SUCCESS! Password is "${pw}" <<<\n`);
      await client.end();
      return;
    } catch (err) {
      console.log(`  Failed: ${err.message}`);
    }
  }
  console.log('\nCould not connect with any common password.');
}

testPasswords();
