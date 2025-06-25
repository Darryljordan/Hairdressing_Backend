const express = require('express');
const router = express.Router();

// In-memory "database"
let bookings = [];
let idCounter = 1;

// Create a new booking
router.post('/', (req, res) => {
  const { name, email, phone, service, date, time } = req.body;
  if (!name || !email || !phone || !service || !date || !time) {
    return res.status(400).json({ error: 'Missing required booking fields.' });
  }
  const booking = {
    id: idCounter++,
    name,
    email,
    phone,
    service,
    date,
    time,
    createdAt: new Date()
  };
  bookings.push(booking);
  res.status(201).json(booking);
});

// Get all bookings
router.get('/', (req, res) => {
  res.json(bookings);
});

// Get a single booking by ID
router.get('/:id', (req, res) => {
  const booking = bookings.find(b => b.id === parseInt(req.params.id));
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  res.json(booking);
});

// Delete a booking by ID
router.delete('/:id', (req, res) => {
  const index = bookings.findIndex(b => b.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Booking not found.' });
  const deleted = bookings.splice(index, 1)[0];
  res.json({ message: 'Booking deleted.', booking: deleted });
});

module.exports = router;