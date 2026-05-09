const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Booking = require('../models/Booking');
const Item = require('../models/Item');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payments/create-order
router.post('/create-order', protect, async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: 'Booking ID required.' });

    const booking = await Booking.findById(bookingId).populate('item', 'title');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.renter.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (booking.payment.status === 'paid')
      return res.status(400).json({ success: false, message: 'Already paid.' });

    const amountInPaise = booking.pricing.totalPayable * 100;
    const order = await razorpay.orders.create({
      amount:   amountInPaise,
      currency: 'INR',
      receipt:  `rms_${bookingId.toString().slice(-8)}_${Date.now()}`,
      notes: { bookingId: bookingId.toString(), renterName: req.user.name, itemTitle: booking.item?.title || 'Item' },
    });

    booking.payment.razorpayOrderId = order.id;
    await booking.save();

    res.json({
      success: true, orderId: order.id, amount: booking.pricing.totalPayable,
      currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID, bookingId,
      prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone },
      description: `RentMyStuff – ${booking.item?.title || 'Rental'} (${booking.totalDays} days)`,
    });
  } catch (error) {
    if (error.error) return res.status(400).json({ success: false, message: error.error.description || 'Razorpay error. Check your API keys.' });
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/verify
router.post('/verify', protect, async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ success: false, message: 'Missing payment fields.' });

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');

    if (expectedSignature !== razorpay_signature) {
      const booking = await Booking.findById(bookingId);
      if (booking) { booking.payment.status = 'failed'; await booking.save(); }
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    const booking = await Booking.findById(bookingId).populate('item', 'title deposit');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    booking.payment = { razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature, status: 'paid', paidAt: new Date() };
    booking.deposit.collected = true;
    booking.handoverOtp = booking.generateOtp();
    booking.status = 'confirmed';
    await booking.save();
    await Item.findByIdAndUpdate(booking.item._id, { status: 'rented' });

    res.json({ success: true, message: 'Payment successful! Booking confirmed.', bookingId: booking._id, handoverOtp: booking.handoverOtp, amountPaid: booking.pricing.totalPayable, paymentId: razorpay_payment_id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/refund
router.post('/refund', protect, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.owner.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Only owner can refund.' });
    if (booking.deposit.refunded) return res.status(400).json({ success: false, message: 'Already refunded.' });
    if (!booking.payment.razorpayPaymentId) return res.status(400).json({ success: false, message: 'No payment found.' });

    const refund = await razorpay.payments.refund(booking.payment.razorpayPaymentId, {
      amount: booking.deposit.amount * 100,
      notes: { reason: 'Security deposit refund', bookingId: bookingId.toString() },
    });

    booking.deposit.refunded = true;
    booking.deposit.refundedAt = new Date();
    await booking.save();

    res.json({ success: true, message: `Rs.${booking.deposit.amount} deposit refunded!`, refundId: refund.id });
  } catch (error) {
    if (error.error) return res.status(400).json({ success: false, message: error.error.description || 'Refund failed.' });
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payments/test-keys
router.get('/test-keys', protect, async (req, res) => {
  try {
    await razorpay.balance.fetch();
    res.json({ success: true, message: 'Razorpay keys are valid!', mode: process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test') ? 'TEST MODE' : 'LIVE MODE', keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Razorpay keys are invalid. Check your .env file.', error: error.error?.description || error.message });
  }
});

module.exports = router;
