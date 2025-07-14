const pool = require('./pool');

// Find a booking by ID
async function findBookingById(id) {
  const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
  return result.rows[0];
}

// Delete a booking by ID
async function deleteBooking(id) {
  await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
}

// Soft delete a booking by ID
async function softDeleteBooking(id) {
    await pool.query("UPDATE bookings SET state = 'deleted' WHERE id = $1", [id]);
}

module.exports = {
  findBookingById,
  deleteBooking,
  softDeleteBooking,
};