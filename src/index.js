require('dotenv').config();
require('./db/pool'); // Ensures the connection is established
const express = require('express');
const cors = require('cors');
const bookingsRouter = require('./routes/bookings');
const workersRouter = require('./routes/workers');
const { Pool } = require('pg');
const pool = require('./db/pool');
const { deleteBooking } = require('./db/booking');
    

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Simple route for testing
app.get('/', (req, res) => {
  res.send('Hairdressing Backend API is running!');
});

// Placeholder for future routes (services, bookings, reviews, etc.)
app.use('/api/bookings', bookingsRouter);
app.use('/api/workers', workersRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Function to permanently delete bookings in "deleted" state for > 1 month
async function cleanupOldDeletedBookings() {
  try {
    // Find bookings in "deleted" state older than 1 month
    const result = await pool.query(
      `SELECT id FROM bookings WHERE state = 'deleted' AND created_at < NOW() - INTERVAL '1 month'`
    );
    for (const row of result.rows) {
      await deleteBooking(row.id);
      console.log(`Permanently deleted booking with id ${row.id}`);
    }
  } catch (err) {
    console.error('Error cleaning up old deleted bookings:', err);
  }
}

// Run every 24 hours (86_400_000 ms)
setInterval(cleanupOldDeletedBookings, 86_400_000);

// Optionally, run once on server start
cleanupOldDeletedBookings();