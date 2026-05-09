const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Item = require('../models/Item');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ─── POST /api/bookings ────────────────────────────────────
// Create a new booking request
router.post('/', protect, async (req, res) => {
  try {
    const { itemId, startDate, endDate, renterNotes } = req.body;

    if (!itemId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Item, start date, and end date are required.' });
    }

    const item = await Item.findById(itemId).populate('owner');

    if (!item || item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }

    if (item.status !== 'active') {
      return res.status(400).json({ success: false, message: 'This item is not available for booking.' });
    }

    // Prevent owner from booking their own item
    if (item.owner._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot book your own item.' });
    }

    // Calculate number of days
    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (end <= start) {
      return res.status(400).json({ success: false, message: 'End date must be after start date.' });
    }
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    // Calculate pricing
    const pricing = Booking.calculatePricing(
      item.pricing.perDay,
      totalDays,
      item.deposit.required ? item.deposit.amount : 0
    );

    // Create the booking
    const booking = await Booking.create({
      renter:    req.user._id,
      owner:     item.owner._id,
      item:      itemId,
      startDate: start,
      endDate:   end,
      totalDays,
      pricing,
      deposit: {
        amount: item.deposit.required ? item.deposit.amount : 0,
      },
      renterNotes: renterNotes || '',
      status: 'pending',
    });

    await booking.populate([
      { path: 'item', select: 'title photos pricing location' },
      { path: 'owner', select: 'name phone' },
      { path: 'renter', select: 'name phone' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Booking request sent! Waiting for owner confirmation.',
      booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/bookings/my ──────────────────────────────────
// Get bookings for the current user (as renter or owner)
router.get('/my', protect, async (req, res) => {
  try {
    const { role = 'renter', status } = req.query;
    const query = role === 'owner'
      ? { owner: req.user._id }
      : { renter: req.user._id };

    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('item', 'title photos pricing location category')
      .populate('renter', 'name avatar phone')
      .populate('owner', 'name avatar phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/bookings/:id ─────────────────────────────────
// Get a single booking
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('item', 'title photos pricing location category deposit')
      .populate('renter', 'name avatar phone email')
      .populate('owner', 'name avatar phone email');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Only renter or owner can view
    const isRenter = booking.renter._id.toString() === req.user._id.toString();
    const isOwner  = booking.owner._id.toString() === req.user._id.toString();
    if (!isRenter && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking.' });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PATCH /api/bookings/:id/confirm ──────────────────────
// Owner confirms a booking request
router.patch('/:id/confirm', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (booking.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can confirm this booking.' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot confirm a booking with status: ${booking.status}` });
    }

    // Generate handover OTP
    booking.handoverOtp = booking.generateOtp();
    booking.status = 'confirmed';
    await booking.save();

    // Update item status to rented
    await Item.findByIdAndUpdate(booking.item, { status: 'rented' });

    res.json({
      success: true,
      message: 'Booking confirmed! Renter has been notified.',
      handoverOtp: booking.handoverOtp,
      booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PATCH /api/bookings/:id/cancel ───────────────────────
// Cancel a booking (renter or owner)
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const isRenter = booking.renter.toString() === req.user._id.toString();
    const isOwner  = booking.owner.toString() === req.user._id.toString();
    if (!isRenter && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking cannot be cancelled.' });
    }

    booking.status = 'cancelled';
    booking.cancellation = { cancelledBy: req.user._id, reason: reason || '', cancelledAt: new Date() };
    await booking.save();

    // Set item back to active
    await Item.findByIdAndUpdate(booking.item, { status: 'active' });

    res.json({ success: true, message: 'Booking cancelled.', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PATCH /api/bookings/:id/complete ─────────────────────
// Mark as completed after item return
router.patch('/:id/complete', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (booking.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can complete this booking.' });
    }

    booking.status = 'completed';
    booking.deposit.refunded = true;
    booking.deposit.refundedAt = new Date();
    await booking.save();

    // Update item back to active
    await Item.findByIdAndUpdate(booking.item, { status: 'active' });

    // Update owner earnings
    await User.findByIdAndUpdate(booking.owner, {
      $inc: { totalEarnings: booking.pricing.ownerEarning, totalRentals: 1 },
    });

    // Update renter booking count
    await User.findByIdAndUpdate(booking.renter, {
      $inc: { totalBookings: 1 },
    });

    res.json({
      success: true,
      message: 'Booking completed! Earnings added to your account.',
      earned: booking.pricing.ownerEarning,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
