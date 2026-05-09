// check-connection.js
// Run this BEFORE starting the server to verify all services are connected
// Usage: node check-connection.js

require('dotenv').config();

const checks = {
  env:       false,
  mongo:     false,
  razorpay:  false,
};

async function run() {
  console.log('\n🔍 RentMyStuff — Connection Checker');
  console.log('─'.repeat(45));

  // ── 1. Check .env file ──────────────────────────────────
  console.log('\n📋 Checking .env variables...');
  const required = ['MONGO_URI', 'JWT_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
  const optional = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

  let envOk = true;
  required.forEach(key => {
    if (!process.env[key] || process.env[key].includes('YOUR_')) {
      console.log(`  ❌ ${key} — not set`);
      envOk = false;
    } else {
      const val = process.env[key];
      const preview = val.length > 20 ? val.slice(0, 10) + '...' + val.slice(-6) : val;
      console.log(`  ✅ ${key} = ${preview}`);
    }
  });

  optional.forEach(key => {
    if (!process.env[key] || process.env[key].includes('your_')) {
      console.log(`  ⚠️  ${key} — not set (photo uploads will be disabled)`);
    } else {
      console.log(`  ✅ ${key} = ${process.env[key].slice(0, 8)}...`);
    }
  });

  checks.env = envOk;

  // ── 2. Check MongoDB ────────────────────────────────────
  console.log('\n🍃 Checking MongoDB connection...');
  if (!process.env.MONGO_URI || process.env.MONGO_URI.includes('YOUR_')) {
    console.log('  ❌ MONGO_URI is not set. Cannot connect to MongoDB.');
    console.log('  👉 Get it from: https://cloud.mongodb.com → Connect → Drivers');
  } else {
    try {
      const mongoose = require('mongoose');
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 6000 });
      const host = mongoose.connection.host;
      console.log(`  ✅ MongoDB connected to: ${host}`);
      checks.mongo = true;
      await mongoose.disconnect();
    } catch (err) {
      console.log(`  ❌ MongoDB failed: ${err.message}`);
      if (err.message.includes('bad auth')) {
        console.log('  👉 Fix: Wrong username/password in MONGO_URI');
      } else if (err.message.includes('ENOTFOUND') || err.message.includes('timed out')) {
        console.log('  👉 Fix: Check your internet OR whitelist your IP in MongoDB Atlas');
        console.log('       Atlas → Network Access → Add IP Address → Allow from anywhere (0.0.0.0/0)');
      }
    }
  }

  // ── 3. Check Razorpay ───────────────────────────────────
  console.log('\n💳 Checking Razorpay keys...');
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('rzp_test_xxx')) {
    console.log('  ❌ RAZORPAY_KEY_ID is not set.');
    console.log('  👉 Get it from: https://dashboard.razorpay.com → Settings → API Keys');
  } else {
    try {
      const Razorpay = require('razorpay');
      const rp = new Razorpay({
        key_id:     process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      await rp.balance.fetch();
      const mode = process.env.RAZORPAY_KEY_ID.startsWith('rzp_test') ? '🧪 TEST MODE' : '🟢 LIVE MODE';
      console.log(`  ✅ Razorpay connected! (${mode})`);
      console.log(`  ✅ Key ID: ${process.env.RAZORPAY_KEY_ID}`);
      checks.razorpay = true;
    } catch (err) {
      console.log(`  ❌ Razorpay failed: ${err.error?.description || err.message}`);
      console.log('  👉 Fix: Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
      console.log('       Make sure you copied both keys from Razorpay Dashboard');
    }
  }

  // ── Summary ─────────────────────────────────────────────
  console.log('\n' + '─'.repeat(45));
  console.log('📊 Summary:');
  console.log(`  .env variables : ${checks.env      ? '✅ All set'   : '❌ Missing keys'}`);
  console.log(`  MongoDB        : ${checks.mongo     ? '✅ Connected' : '❌ Not connected'}`);
  console.log(`  Razorpay       : ${checks.razorpay  ? '✅ Connected' : '❌ Not connected'}`);

  const allGood = checks.mongo && checks.razorpay && checks.env;

  if (allGood) {
    console.log('\n🎉 Everything is connected! Run: npm run dev\n');
  } else {
    console.log('\n⚠️  Fix the issues above, then run: node check-connection.js again');
    console.log('   Once all show ✅ → run: npm run dev\n');
  }

  process.exit(allGood ? 0 : 1);
}

run().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
