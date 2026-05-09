const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { protect } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// ─── GET /api/items ────────────────────────────────────────
// Browse & search items (public — no login needed)
router.get('/', async (req, res) => {
  try {
    const {
      search, category, city,
      minPrice, maxPrice,
      condition, sort,
      page = 1, limit = 12,
    } = req.query;

    // Build query
    const query = { status: 'active', isDeleted: false };

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // City filter
    if (city) {
      query['location.city'] = { $regex: city, $options: 'i' };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query['pricing.perDay'] = {};
      if (minPrice) query['pricing.perDay'].$gte = Number(minPrice);
      if (maxPrice) query['pricing.perDay'].$lte = Number(maxPrice);
    }

    // Condition filter
    if (condition) {
      query.condition = condition;
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sort === 'price-low')  sortOption = { 'pricing.perDay': 1 };
    if (sort === 'price-high') sortOption = { 'pricing.perDay': -1 };
    if (sort === 'rating')     sortOption = { avgRating: -1 };
    if (sort === 'popular')    sortOption = { totalRentals: -1 };

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Item.countDocuments(query);

    const items = await Item.find(query)
      .populate('owner', 'name avatar avgRating kyc.isVerified')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      items,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/items/:id ────────────────────────────────────
// Get a single item by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('owner', 'name avatar avgRating totalRentals kyc.isVerified city createdAt')
      .populate('reviews.user', 'name avatar');

    if (!item || item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }

    // Increment view count
    item.views += 1;
    await item.save();

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/items ───────────────────────────────────────
// Create a new listing (must be logged in)
router.post('/', protect, upload.array('photos', 6), async (req, res) => {
  try {
    const {
      title, description, category, brand, condition,
      pricePerDay, pricePerWeek, pricePerMonth,
      depositRequired, depositAmount,
      address, city, state, pincode,
      minDuration, availabilityType,
      deliveryAvailable, deliveryCharge,
      features,
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !condition || !pricePerDay || !city || !state) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    // Build photos array from Cloudinary upload results
    const photos = req.files ? req.files.map(file => ({
      url: file.path,
      public_id: file.filename,
    })) : [];

    if (photos.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload at least one photo.' });
    }

    // Parse features (comes as JSON string from form)
    let parsedFeatures = [];
    try { parsedFeatures = JSON.parse(features || '[]'); } catch (e) { parsedFeatures = []; }

    const item = await Item.create({
      owner: req.user._id,
      title,
      description,
      category,
      brand,
      condition,
      photos,
      pricing: {
        perDay:   Number(pricePerDay),
        perWeek:  Number(pricePerWeek)  || 0,
        perMonth: Number(pricePerMonth) || 0,
      },
      deposit: {
        required: depositRequired === 'true',
        amount:   Number(depositAmount) || 0,
      },
      location: { address, city, state, pincode },
      availability: {
        minDuration:    minDuration || '1 day',
        type:           availabilityType || 'Available now',
      },
      delivery: {
        available: deliveryAvailable === 'true',
        charge:    Number(deliveryCharge) || 0,
      },
      features: parsedFeatures,
      status: 'pending_review', // Admin must approve first
    });

    res.status(201).json({
      success: true,
      message: 'Item listed successfully! It will go live after review (2–4 hours).',
      item,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/items/:id ────────────────────────────────────
// Update a listing (owner only)
router.put('/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    // Only owner can edit
    if (item.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this listing.' });
    }

    const updatedItem = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });

    res.json({ success: true, message: 'Listing updated!', item: updatedItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── DELETE /api/items/:id ─────────────────────────────────
// Soft delete a listing (owner only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    if (item.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    item.isDeleted = true;
    item.status = 'paused';
    await item.save();

    res.json({ success: true, message: 'Listing deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/items/:id/reviews ───────────────────────────
// Add a review after a completed rental
router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const item = await Item.findById(req.params.id);

    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    // Check if user already reviewed
    const alreadyReviewed = item.reviews.find(
      r => r.user.toString() === req.user._id.toString()
    );
    if (alreadyReviewed) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this item.' });
    }

    item.reviews.push({ user: req.user._id, name: req.user.name, rating, comment });
    item.updateAvgRating();
    await item.save();

    res.status(201).json({ success: true, message: 'Review added!', avgRating: item.avgRating });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/items/my/listings ────────────────────────────
// Get current user's listings
router.get('/my/listings', protect, async (req, res) => {
  try {
    const items = await Item.find({ owner: req.user._id, isDeleted: false })
      .sort({ createdAt: -1 });

    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
