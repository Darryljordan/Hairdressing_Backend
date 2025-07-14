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

// Read and split SQL statements
const sql = fs.readFileSync(path.join(__dirname, 'init.sql')).toString();
const statements = sql
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0);

async function runMigrations() {
  try {
    for (const stmt of statements) {
      if (stmt.toLowerCase().includes('create table') && stmt.includes('bookings')) {
        await pool.query(stmt);
        console.log('Bookings table created (if not exists)');
      } else if (stmt.toLowerCase().includes('create table') && stmt.includes('workers')) {
        await pool.query(stmt);
        console.log('Workers table created (if not exists)');
      } else {
        await pool.query(stmt);
        console.log('Executed statement:', stmt.slice(0, 40) + '...');
      }
    }
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    pool.end();
  }
}

runMigrations();