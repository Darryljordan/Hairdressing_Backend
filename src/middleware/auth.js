const jwt = require('jsonwebtoken');

function authenticateWorker(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'supersecret', (err, worker) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.worker = worker; // Attach worker info to request
    next();
  });
}

module.exports = { authenticateWorker };