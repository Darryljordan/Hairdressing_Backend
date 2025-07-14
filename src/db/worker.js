const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
});

async function findWorkerByValidationToken(token) {
  const result = await pool.query(
    'SELECT * FROM workers WHERE validation_token = $1',
    [token]
  );
  return result.rows[0];
}

// Create a new worker (signup)
async function createWorker({ username, email, password, is_validated = false, validation_token = null }) {
  const password_hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO workers (username, email, password_hash, is_validated, validation_token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, created_at, is_validated, validation_token`,
    [username, email, password_hash, is_validated, validation_token]
  );
  return result.rows[0];
}

// Find worker by username or email
async function findWorkerByUsernameOrEmail(identifier) {
  const result = await pool.query(
    `SELECT * FROM workers WHERE username = $1 OR email = $1`,
    [identifier]
  );
  return result.rows[0];
}

async function validateWorker(id) {
  await pool.query(
    'UPDATE workers SET is_validated = TRUE, validation_token = NULL WHERE id = $1',
    [id]
  );
}

// Find worker by email
async function findWorkerByEmail(email) {
  const result = await pool.query(
    `SELECT * FROM workers WHERE email = $1`,
    [email]
  );
  return result.rows[0];
}

// Find worker by id
async function findWorkerById(id) {
  const result = await pool.query(
    `SELECT * FROM workers WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

// Update worker password (for password reset)
async function updateWorkerPassword(id, newPassword) {
  const password_hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    `UPDATE workers SET password_hash = $1 WHERE id = $2`,
    [password_hash, id]
  );
}

// Set password reset token and expiry
async function setResetToken(email, token, expires) {
  await pool.query(
    `UPDATE workers SET reset_token = $1, reset_token_expires = $2 WHERE email = $3`,
    [token, expires, email]
  );
}

// Find worker by reset token
async function findWorkerByResetToken(token) {
  const result = await pool.query(
    `SELECT * FROM workers WHERE reset_token = $1 AND reset_token_expires > NOW()`,
    [token]
  );
  return result.rows[0];
}

// Get all workers (excluding sensitive info)
async function getAllWorkers() {
    const result = await pool.query(
      `SELECT id, username, email, created_at FROM workers ORDER BY created_at DESC`
    );
    return result.rows;
  }

async function updateWorkerInfo(id, { username, email }) {
    const result = await pool.query(
        `UPDATE workers SET username = $1, email = $2 WHERE id = $3 RETURNING id, username, email, created_at`,
        [username, email, id]
    );
    return result.rows[0];
}

async function deleteWorker(id) {
    await pool.query(`DELETE FROM workers WHERE id = $1`, [id]);
}

module.exports = {
  createWorker,
  findWorkerByUsernameOrEmail,
  findWorkerByEmail,
  findWorkerById,
  updateWorkerPassword,
  setResetToken,
  findWorkerByResetToken,
  getAllWorkers,
  updateWorkerInfo,
  deleteWorker,
  findWorkerByValidationToken,
  validateWorker
};