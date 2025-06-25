require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
});

const sql = fs.readFileSync(path.join(__dirname, 'init.sql')).toString();

pool.query(sql)
  .then(() => {
    console.log('Bookings table created (if not exists)');
    pool.end();
  })
  .catch((err) => {
    console.error('Error creating table:', err);
    pool.end();
  });