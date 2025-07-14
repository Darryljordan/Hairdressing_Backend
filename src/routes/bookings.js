const express = require('express');
const pool = require('../db/pool');
const router = express.Router();
const { authenticateWorker } = require('../middleware/auth');
const { softDeleteBooking, findBookingById } = require('../db/booking');
const { sendMail } = require('../utils/email');

// Create a new booking
router.post('/', async (req, res) => {
  const { name, email, phone, service, date, time } = req.body;
  if (!name || !email || !phone || !service || !date || !time) {
    return res.status(400).json({ error: 'Missing required booking fields.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO bookings (name, email, phone, service, date, time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, email, phone, service, date, time]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all bookings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Bookings for a Worker
router.get('/worker', authenticateWorker, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY time'); // or whatever your sort is
    res.json({ bookings: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get a single booking by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a Booking (by Worker) and Notify Booker
router.delete('/:id', authenticateWorker, async (req, res) => {
  const bookingId = req.params.id;
  const booking = await findBookingById(bookingId);
  if (!booking) {
    return res.status(403).json({ error: 'Not authorized to delete this booking.' });
  }
  await softDeleteBooking(bookingId);

  // Notify booker
  await sendMail({
    to: booking.email, // assuming booking.email is the booker's email
    subject: 'Your booking has been canceled',
    html: `<p>Dear ${booking.name},<br>Your booking on ${booking.time} has been canceled by the worker. Please contact the salon if you have questions.</p>`
  });

  res.json({ message: 'Booking deleted and booker notified.' });
});

// Delete a booking by ID
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ message: 'Booking deleted.', booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;