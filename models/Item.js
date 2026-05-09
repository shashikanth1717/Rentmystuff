const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:    { type: String, required: true },
  rating:  { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
  // Owner
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Basic details
  title: {
    type: String,
    required: [true, 'Item title is required'],
    trim: true,
    maxlength: [80, 'Title cannot exceed 80 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Electronics', 'Household', 'Events', 'Tools', 'Vehicles', 'Travel'],
  },
  brand: { type: String, trim: true, default: '' },
  condition: {
    type: String,
    required: true,
    enum: ['Like new', 'Good', 'Fair', 'Well used'],
  },

  // Photos — stored as Cloudinary URLs
  photos: [{
    url: { type: String, required: true },
    public_id: { type: String, required: true },
  }],

  // Pricing
  pricing: {
    perDay:   { type: Number, required: [true, 'Daily price is required'], min: 0 },
    perWeek:  { type: Number, default: 0 },
    perMonth: { type: Number, default: 0 },
  },

  // Security deposit
  deposit: {
    required: { type: Boolean, default: true },
    amount:   { type: Number, default: 500 },
  },

  // Location
  location: {
    address:  { type: String, default: '' },
    city:     { type: String, required: [true, 'City is required'] },
    state:    { type: String, required: [true, 'State is required'] },
    pincode:  { type: String, default: '' },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },

  // Availability
  availability: {
    isAvailable: { type: Boolean, default: true },
    minDuration: { type: String, default: '1 day' }, // '1 day', '2 days', '1 week', etc.
    type: {
      type: String,
      enum: ['Available now', 'From a date', 'Weekends only'],
      default: 'Available now',
    },
    unavailableDates: [{ type: Date }], // Dates already booked
  },

  // Features / tags
  features: [{ type: String }],

  // Delivery
  delivery: {
    available: { type: Boolean, default: false },
    charge:    { type: Number, default: 0 },
  },

  // Reviews & ratings
  reviews: [reviewSchema],
  avgRating:    { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },

  // Stats
  totalRentals: { type: Number, default: 0 },
  views:        { type: Number, default: 0 },

  // Status
  status: {
    type: String,
    enum: ['active', 'paused', 'rented', 'pending_review', 'rejected'],
    default: 'pending_review', // Admin reviews before going live
  },
  isDeleted: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// ─── Text search index — enables search by title, description ──
itemSchema.index({ title: 'text', description: 'text', category: 'text' });

// ─── Recalculate avg rating when a review is added ─────────
itemSchema.methods.updateAvgRating = function () {
  if (this.reviews.length === 0) {
    this.avgRating = 0;
    this.totalReviews = 0;
  } else {
    const total = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    this.avgRating = Math.round((total / this.reviews.length) * 10) / 10;
    this.totalReviews = this.reviews.length;
  }
};

module.exports = mongoose.model('Item', itemSchema);
