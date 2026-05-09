const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [80, 'Name cannot exceed 80 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'],
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Never return password in queries by default
  },

  // Profile
  avatar: {
    url: { type: String, default: '' },
    public_id: { type: String, default: '' },
  },
  bio: { type: String, maxlength: 300, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },

  // KYC Verification
  kyc: {
    aadhaar: { type: Boolean, default: false },
    pan: { type: Boolean, default: false },
    selfie: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
  },

  // Auth
  googleId: { type: String },          // For Google sign-in
  firebaseUid: { type: String },       // For Firebase OTP
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },

  // Bank details (for payouts)
  bankAccount: {
    accountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountHolderName: { type: String, default: '' },
  },

  // Stats (updated automatically)
  totalEarnings: { type: Number, default: 0 },
  totalRentals: { type: Number, default: 0 },   // Times their items were rented
  totalBookings: { type: Number, default: 0 },  // Times they rented from others
  avgRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
});

// ─── Hash password before saving ──────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Compare password method ───────────────────────────────
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ─── Update KYC verified status ────────────────────────────
userSchema.methods.updateKycStatus = function () {
  this.kyc.isVerified = this.kyc.aadhaar && this.kyc.selfie;
};

module.exports = mongoose.model('User', userSchema);
