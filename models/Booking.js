const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Who & what
  renter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  item:   { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },

  // Rental period
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },
  totalDays: { type: Number, required: true },

  // Pricing breakdown
  pricing: {
    perDay:       { type: Number, required: true },
    rentalCost:   { type: Number, required: true }, // perDay × totalDays
    platformFee:  { type: Number, required: true }, // 10% of rentalCost
    deposit:      { type: Number, default: 0 },
    totalPayable: { type: Number, required: true }, // rentalCost - fee + deposit
    ownerEarning: { type: Number, required: true }, // rentalCost - platformFee
  },

  // Booking status flow:
  // pending → confirmed → active → completed
  //         → cancelled (by either party)
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
    default: 'pending',
  },

  // Payment
  payment: {
    razorpayOrderId:   { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending',
    },
    paidAt: { type: Date },
  },

  // Deposit tracking
  deposit: {
    amount:    { type: Number, default: 0 },
    collected: { type: Boolean, default: false },
    refunded:  { type: Boolean, default: false },
    refundedAt: { type: Date },
  },

  // OTP for handover (renter shows this to owner at pickup)
  handoverOtp: { type: String },
  returnOtp:   { type: String },

  // Cancellation
  cancellation: {
    cancelledBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason:       { type: String, default: '' },
    cancelledAt:  { type: Date },
  },

  // Notes
  renterNotes: { type: String, default: '' },
  ownerNotes:  { type: String, default: '' },

  // After return
  isReviewed: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// ─── Generate 4-digit OTP ──────────────────────────────────
bookingSchema.methods.generateOtp = function () {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// ─── Calculate pricing from item price and days ────────────
bookingSchema.statics.calculatePricing = function (pricePerDay, days, depositAmount) {
  const rentalCost  = pricePerDay * days;
  const platformFee = Math.round(rentalCost * 0.10);
  const deposit     = depositAmount || 0;
  const totalPayable  = rentalCost - platformFee + deposit;
  const ownerEarning  = rentalCost - platformFee;
  return { perDay: pricePerDay, rentalCost, platformFee, deposit, totalPayable, ownerEarning };
};

module.exports = mongoose.model('Booking', bookingSchema);
