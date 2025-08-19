const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true, // Required for Azure SQL
    trustServerCertificate: false // Change to true for local dev / self-signed certs
  }
};

let poolPromise = null;

async function getConnection() {
  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = new Promise(async (resolve, reject) => {
    try {
      const pool = await sql.connect(config);
      console.log("Successfully connected to the database.");
      resolve(pool);
    } catch (err) {
      console.error("Database connection failed: ", err);
      poolPromise = null; // Reset promise on failure
      reject(err);
    }
  });

  return poolPromise;
}

module.exports = { getConnection };
