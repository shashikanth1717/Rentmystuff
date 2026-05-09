const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, protect } = require('../middleware/auth');

// ─── POST /api/auth/register ───────────────────────────────
// Register a new user with email & password
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email
          ? 'An account with this email already exists.'
          : 'An account with this phone number already exists.',
      });
    }

    // Create user (password gets hashed by the pre-save hook in User model)
    const user = await User.create({ name, email, phone, password });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        kyc: user.kyc,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────
// Login with email & password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Find user and include password (it's hidden by default)
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        avatar: user.avatar,
        kyc: user.kyc,
        totalEarnings: user.totalEarnings,
        avgRating: user.avgRating,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/auth/firebase ───────────────────────────────
// Login or register via Firebase (Google / OTP)
// Firebase Auth runs on the frontend — it sends us the verified UID
router.post('/firebase', async (req, res) => {
  try {
    const { firebaseUid, name, email, phone, provider } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ success: false, message: 'Firebase UID is required.' });
    }

    // Check if user exists already (by UID, email, or phone)
    let user = await User.findOne({
      $or: [
        { firebaseUid },
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ]
    });

    if (!user) {
      // First time — create account
      user = await User.create({
        firebaseUid,
        name: name || 'New User',
        email: email || '',
        phone: phone || '',
        isEmailVerified: provider === 'google',
        isPhoneVerified: provider === 'phone',
      });
    } else {
      // Update Firebase UID if not set
      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        await user.save();
      }
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Authenticated successfully!',
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, kyc: user.kyc },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────
// Get currently logged-in user (requires token)
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
