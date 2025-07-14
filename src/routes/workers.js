const express = require('express');
const router = express.Router();
const { createWorker, findWorkerByUsernameOrEmail, findWorkerByEmail, setResetToken, findWorkerByResetToken, updateWorkerPassword, getAllWorkers, updateWorkerInfo, deleteWorker, validateWorker, findWorkerByValidationToken } = require('../db/worker');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../utils/email');
const crypto = require('crypto');
const { authenticateWorker } = require('../middleware/auth');
// const ADMIN_EMAIL = 'nasahdarryl@mail.com'; // Change as needed

// DELETE /api/workers/me
router.delete('/me', authenticateWorker, async (req, res) => {
    try {
      await deleteWorker(req.worker.id);
      res.json({ message: 'Worker account deleted.' });
    } catch (err) {
      res.status(500).json({ error: 'Server error.' });
    }
  });

// PUT /api/workers/me
router.put('/me', authenticateWorker, async (req, res) => {
    const { username, email } = req.body;
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email required.' });
    }
    try {
      const updated = await updateWorkerInfo(req.worker.id, { username, email });
      res.json({ message: 'Worker info updated.', worker: updated });
    } catch (err) {
      res.status(500).json({ error: 'Server error.' });
    }
  });

// GET /api/workers/me
router.get('/me', authenticateWorker, async (req, res) => {
    try {
      // req.worker is set by the middleware
      res.json({
        id: req.worker.id,
        username: req.worker.username,
        email: req.worker.email
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error.' });
    }
  });

router.get('/validate/:token', async (req, res) => {
  const { token } = req.params;
  const worker = await findWorkerByValidationToken(token);
  if (!worker) {
    return res.status(400).json({ error: 'Invalid or expired validation token.' });
  }
  await validateWorker(worker.id); // sets is_validated = true, clears token
  // Optionally send email to user
  res.send('Worker account validated successfully!');
});

// GET /api/workers
router.get('/', authenticateWorker, async (req, res) => {
    try {
      const workers = await getAllWorkers();
      res.json(workers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

// POST /api/workers/password-reset
router.post('/password-reset', authenticateWorker, async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required.' });
    }
  
    const worker = await findWorkerByResetToken(token);
    if (!worker) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }
  
    await updateWorkerPassword(worker.id, newPassword);
    // Optionally clear the reset token
    await setResetToken(worker.email, null, null);
  
    res.json({ message: 'Password updated successfully.' });
  });

// POST /api/workers/password-reset-request
router.post('/password-reset-request', authenticateWorker, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
  
    const worker = await findWorkerByEmail(email);
    if (!worker) {
      // For security, don't reveal if email exists or not
      return res.json({ message: 'If this email exists, a reset link will be sent.' });
    }
  
    // Generate token and expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  
    await setResetToken(email, token, expires);
  
    // Send email
    const resetUrl = `http://localhost:4200/worker-password-reset?token=${token}`;
    await sendMail({
      to: email,
      subject: 'Password Reset Request',
      text: `Reset your password: ${resetUrl}`,
      html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  
    res.json({ message: 'If this email exists, a reset link will be sent.' });
  });

// POST /api/workers/login
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body; // identifier can be username or email
  
    if (!identifier || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
  
    try {
      const worker = await findWorkerByUsernameOrEmail(identifier);
      if (!worker) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
  
      const valid = await bcrypt.compare(password, worker.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      // --- ADD THIS CHECK HERE ---
      if (!worker.is_validated) {
        return res.status(403).json({ error: 'Account not validated yet. Please wait for admin approval.' });
      }
      // --- END CHECK ---
  
      // Generate JWT
      const token = jwt.sign(
        { id: worker.id, username: worker.username, email: worker.email },
        process.env.JWT_SECRET || 'supersecret', // Use a strong secret in production!
        { expiresIn: '12h' }
      );
  
      res.json({
        message: 'Login successful.',
        token,
        worker: {
          id: worker.id,
          username: worker.username,
          email: worker.email,
          created_at: worker.created_at
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  });

// POST /api/workers/signup
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Check if user already exists
    const existing = await findWorkerByUsernameOrEmail(username) || await findWorkerByUsernameOrEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already in use.' });
    }

    // Generate validation token
    const validation_token = crypto.randomBytes(32).toString('hex');

    // Create the worker (make sure your createWorker supports these fields)
    const worker = await createWorker({
      username,
      email,
      password,
      is_validated: false,
      validation_token
    });

    // Build validation URL (adjust domain as needed)
    const validationUrl = `http://localhost:4000/api/workers/validate/${validation_token}`;

    // Send email to admin
    await sendMail({
      to: process.env.FROM_EMAIL, // This will use the email from your .env
      subject: 'New Worker Signup Request',
      html: `
        <p>A new worker has requested to join:</p>
        <ul>
          <li>Username: ${username}</li>
          <li>Email: ${email}</li>
        </ul>
        <p>To approve this worker, click <a href="${validationUrl}">here</a>.</p>
      `
    });

    res.status(201).json({ message: 'Worker created successfully.', worker });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;