const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ─── GET /api/users/profile ────────────────────────────────
// Get current user's full profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/users/profile ────────────────────────────────
// Update current user's profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, bio, city, state } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, bio, city, state },
      { new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Profile updated!', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/users/bank ───────────────────────────────────
// Update bank account details
router.put('/bank', protect, async (req, res) => {
  try {
    const { accountNumber, ifscCode, bankName, accountHolderName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { bankAccount: { accountNumber, ifscCode, bankName, accountHolderName } },
      { new: true }
    );
    res.json({ success: true, message: 'Bank details updated!', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/users/:id ────────────────────────────────────
// Get public profile of any user
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name avatar bio city avgRating totalRentals totalReviews kyc.isVerified createdAt');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
