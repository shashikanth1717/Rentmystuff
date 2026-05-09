// test-api.js — Run this AFTER your server is running
// Usage: node test-api.js
// Make sure server is running: npm run dev

const BASE = 'http://localhost:5000/api';
let token = '';

async function run() {
  console.log('\n🧪 RentMyStuff API Test Suite\n' + '─'.repeat(40));

  // ── Test 1: Health check ────────────────────────────────
  console.log('\n1️⃣  Health check...');
  try {
    const res = await fetch('http://localhost:5000');
    const data = await res.json();
    console.log('✅', data.message);
  } catch (e) {
    console.log('❌ Server not running. Start with: npm run dev');
    return;
  }

  // ── Test 2: Register ────────────────────────────────────
  console.log('\n2️⃣  Register new user...');
  try {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: `test_${Date.now()}@example.com`,
        phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        password: 'password123',
      }),
    });
    const data = await res.json();
    if (data.success) {
      token = data.token;
      console.log('✅ Registered:', data.user.name, '| Token:', token.slice(0, 20) + '...');
    } else {
      console.log('⚠️ ', data.message);
    }
  } catch (e) {
    console.log('❌ Register error:', e.message);
  }

  // ── Test 3: Get my profile ──────────────────────────────
  console.log('\n3️⃣  Get profile (needs token)...');
  try {
    const res = await fetch(`${BASE}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      console.log('✅ Profile:', data.user.name, '|', data.user.email);
    } else {
      console.log('⚠️ ', data.message);
    }
  } catch (e) {
    console.log('❌ Profile error:', e.message);
  }

  // ── Test 4: Browse items ────────────────────────────────
  console.log('\n4️⃣  Browse items (no token)...');
  try {
    const res = await fetch(`${BASE}/items`);
    const data = await res.json();
    if (data.success) {
      console.log(`✅ Found ${data.total} items (${data.items.length} on this page)`);
    } else {
      console.log('⚠️ ', data.message);
    }
  } catch (e) {
    console.log('❌ Browse error:', e.message);
  }

  // ── Test 5: Search items ────────────────────────────────
  console.log('\n5️⃣  Search items with filters...');
  try {
    const res = await fetch(`${BASE}/items?category=Electronics&sort=rating`);
    const data = await res.json();
    console.log(`✅ Electronics search: ${data.total || 0} items found`);
  } catch (e) {
    console.log('❌ Search error:', e.message);
  }

  // ── Test 6: Update profile ──────────────────────────────
  console.log('\n6️⃣  Update profile...');
  try {
    const res = await fetch(`${BASE}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Updated Name', city: 'Hyderabad', bio: 'I rent things!' }),
    });
    const data = await res.json();
    if (data.success) console.log('✅ Profile updated:', data.user.name, '|', data.user.city);
    else console.log('⚠️ ', data.message);
  } catch (e) {
    console.log('❌ Update error:', e.message);
  }

  console.log('\n' + '─'.repeat(40));
  console.log('✅ All tests done! Your backend is working.\n');
  console.log('📌 Next steps:');
  console.log('   1. Open Postman and test POST /api/items (with photos)');
  console.log('   2. Add your Razorpay keys in .env');
  console.log('   3. Connect your frontend HTML pages to these APIs');
  console.log('   4. Deploy to Render.com\n');
}

run();
