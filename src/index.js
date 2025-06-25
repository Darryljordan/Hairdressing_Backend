require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});