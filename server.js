const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// ─── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Database Connection ───────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ─── API Routes ────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/items',    require('./routes/items'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/payments', require('./routes/payments'));

// ─── Health Check ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: '🚀 RentMyStuff API is running!',
    version: '1.0.0',
    endpoints: {
      auth:     '/api/auth',
      items:    '/api/items',
      bookings: '/api/bookings',
      users:    '/api/users',
      payments: '/api/payments',
    }
  });
});

// ─── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ─── Start Server ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 RentMyStuff server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
});
