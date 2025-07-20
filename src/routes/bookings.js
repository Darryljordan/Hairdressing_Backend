const express = require('express');
const pool = require('../db/pool');
const router = express.Router();
const { authenticateWorker } = require('../middleware/auth');
const { softDeleteBooking, findBookingById } = require('../db/booking');
const { sendMail } = require('../utils/email');
const crypto = require('crypto');

// Cancel a booking
router.post('/cancel/:token', async (req, res) => {
  const { token } = req.params;
  // Find booking by cancel_token and is not already deleted
  const result = await pool.query(
    `SELECT * FROM bookings WHERE cancel_token = $1 AND state = 'valid'`,
    [token]
  );
  if (result.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid or expired cancellation link.' });
  }
  const booking = result.rows[0];
  // Mark as deleted (soft delete)
  await pool.query(
    `UPDATE bookings SET state = 'deleted' WHERE id = $1`,
    [booking.id]
  );
  // Send cancellation confirmation
  await sendMail({
    to: booking.email,
    subject: 'Booking Canceled',
    html: `<p>Your booking for ${booking.service} on ${booking.date} at ${booking.time} has been canceled.</p>`
  });
  res.json({ message: 'Booking canceled successfully.' });
});

// Create a new booking
router.post('/', async (req, res) => {
  const { name, email, phone, service, date, time } = req.body;
  if (!name || !email || !phone || !service || !date || !time) {
    return res.status(400).json({ error: 'Missing required booking fields.' });
  }

  // Ensure time is in "HH:MM:SS" format for interval math
  const timeInterval = time.length === 5 ? time + ':00' : time;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check for overlap (within 2 hours of any existing booking, valid state only)
    const overlapResult = await client.query(
      `SELECT * FROM bookings
       WHERE date = $1 AND state = 'valid'
       AND ABS(EXTRACT(EPOCH FROM (
         (date + time::interval) - ($1::date + $2::interval)
       ))/3600) < 2`,
      [date, timeInterval]
    );
    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This time slot is not available. Please choose another.' });
    }

    // Generate a secure cancel token
    const cancelToken = require('crypto').randomBytes(32).toString('hex');

    // Insert booking
    const result = await client.query(
      `INSERT INTO bookings (name, email, phone, service, date, time, cancel_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, email, phone, service, date, time, cancelToken]
    );

    // Send confirmation email with cancellation link
    const booking = result.rows[0];
    const cancelLink = `http://your-frontend-domain.com/cancel-booking/${cancelToken}`;
    await sendMail({
      to: booking.email,
      subject: 'Booking Confirmation',
      html: `<p>Thank you for booking!<br>
             Service: ${booking.service}<br>
             Date: ${booking.date}<br>
             Time: ${booking.time}<br>
             <br>
             If you need to cancel, click <a href="${cancelLink}">here</a>.</p>`
    });

    await client.query('COMMIT');
    res.status(201).json(booking);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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