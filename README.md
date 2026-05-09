# RentMyStuff — Backend API

Complete Node.js + Express + MongoDB backend for the RentMyStuff peer-to-peer rental platform.


<video controls src="Screen Recording 2026-05-02 203814.mp4" title="Title"></video>

---

## Project Structure

```
rentmystuff-backend/
├── server.js              ← App entry point
├── .env.example           ← Copy this to .env and fill in your keys
├── .gitignore
├── package.json
│
├── config/
│   ├── db.js              ← MongoDB connection
│   └── cloudinary.js      ← Photo upload config
│
├── models/
│   ├── User.js            ← User schema (auth, KYC, bank)
│   ├── Item.js            ← Item listing schema
│   └── Booking.js         ← Booking + payment schema
│
├── middleware/
│   └── auth.js            ← JWT protect middleware
│
└── routes/
    ├── auth.js            ← Register, login, Firebase OTP
    ├── items.js           ← List, search, create, review items
    ├── bookings.js        ← Book, confirm, cancel, complete
    ├── users.js           ← Profile, bank details
    └── payments.js        ← Razorpay order + verify
```

---

## Quick Setup (Step by Step)

### Step 1 — Install Node.js
Download from https://nodejs.org (choose LTS version)
Verify: `node --version` should show v18 or higher

### Step 2 — Get your project files
Place all these files in a folder called `rentmystuff-backend`

### Step 3 — Install dependencies
Open terminal inside the folder and run:
```bash
npm install
```

### Step 4 — Set up MongoDB (free)
1. Go to https://cloud.mongodb.com
2. Create a free account
3. Click "Create a cluster" → choose Free tier → any region
4. Click "Connect" → "Connect your application"
5. Copy the connection string — it looks like:
   `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`

### Step 5 — Set up Cloudinary (free, for photos)
1. Go to https://cloudinary.com → Sign up free
2. Go to Dashboard → copy Cloud Name, API Key, API Secret

### Step 6 — Create your .env file
```bash
cp .env.example .env
```
Open `.env` and fill in:
- MONGO_URI → your MongoDB connection string (add `rentmystuff` as database name)
- JWT_SECRET → any long random string
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET → from Cloudinary
- RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET → from Razorpay (use test keys first)

### Step 7 — Run the server
```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

You should see:
```
🚀 RentMyStuff server running on http://localhost:5000
✅ MongoDB connected successfully
```

---

## All API Endpoints

### Auth — /api/auth
| Method | Endpoint           | Description              | Auth needed |
|--------|--------------------|--------------------------|-------------|
| POST   | /register          | Create new account       | No          |
| POST   | /login             | Login with email+password| No          |
| POST   | /firebase          | Login via Google/OTP     | No          |
| GET    | /me                | Get current user info    | ✅ Yes      |

### Items — /api/items
| Method | Endpoint           | Description              | Auth needed |
|--------|--------------------|--------------------------|-------------|
| GET    | /                  | Browse & search items    | No          |
| GET    | /:id               | Get single item          | No          |
| POST   | /                  | Create new listing       | ✅ Yes      |
| PUT    | /:id               | Edit listing             | ✅ Yes      |
| DELETE | /:id               | Delete listing           | ✅ Yes      |
| POST   | /:id/reviews       | Add review               | ✅ Yes      |
| GET    | /my/listings       | My listings              | ✅ Yes      |

### Bookings — /api/bookings
| Method | Endpoint           | Description              | Auth needed |
|--------|--------------------|--------------------------|-------------|
| POST   | /                  | Create booking request   | ✅ Yes      |
| GET    | /my                | My bookings              | ✅ Yes      |
| GET    | /:id               | Single booking details   | ✅ Yes      |
| PATCH  | /:id/confirm       | Owner confirms booking   | ✅ Yes      |
| PATCH  | /:id/cancel        | Cancel booking           | ✅ Yes      |
| PATCH  | /:id/complete      | Mark as completed        | ✅ Yes      |

### Payments — /api/payments
| Method | Endpoint           | Description              | Auth needed |
|--------|--------------------|--------------------------|-------------|
| POST   | /create-order      | Create Razorpay order    | ✅ Yes      |
| POST   | /verify            | Verify payment signature | ✅ Yes      |

### Users — /api/users
| Method | Endpoint           | Description              | Auth needed |
|--------|--------------------|--------------------------|-------------|
| GET    | /profile           | Get my profile           | ✅ Yes      |
| PUT    | /profile           | Update my profile        | ✅ Yes      |
| PUT    | /bank              | Update bank details      | ✅ Yes      |
| GET    | /:id               | Get any user's public profile | No    |

---

## Testing the API

Use Postman or Thunder Client (VS Code extension) to test.

### Test 1 — Register a user
```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Rahul Kumar",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "password": "password123"
}
```
Expected: `{ success: true, token: "...", user: {...} }`

### Test 2 — Login
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "rahul@example.com",
  "password": "password123"
}
```
Copy the token from the response.

### Test 3 — Browse items (no token needed)
```
GET http://localhost:5000/api/items
GET http://localhost:5000/api/items?category=Electronics&city=Hyderabad
GET http://localhost:5000/api/items?search=camera&sort=price-low
GET http://localhost:5000/api/items?minPrice=100&maxPrice=500
```

### Test 4 — Get your profile (needs token)
```
GET http://localhost:5000/api/users/profile
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## Booking Flow (How it works end to end)

```
1. Renter sees item → POST /api/bookings          (status: pending)
2. Renter pays      → POST /api/payments/create-order
                    → POST /api/payments/verify    (status: confirmed)
3. Owner confirms   → PATCH /api/bookings/:id/confirm
4. Handover OTP is shared with renter at pickup
5. Item returned    → PATCH /api/bookings/:id/complete
6. Deposit refunded automatically
7. Renter reviews   → POST /api/items/:id/reviews
```

---

## Search Query Parameters

```
GET /api/items?search=camera        ← Text search (title + description)
GET /api/items?category=Electronics ← Filter by category
GET /api/items?city=Hyderabad       ← Filter by city
GET /api/items?minPrice=100         ← Minimum daily price
GET /api/items?maxPrice=1000        ← Maximum daily price
GET /api/items?condition=Like+new   ← Filter by condition
GET /api/items?sort=price-low       ← Sort options: price-low, price-high, rating, popular
GET /api/items?page=2&limit=12      ← Pagination
```

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `MongoServerError: bad auth` | Wrong password in MONGO_URI |
| `ECONNREFUSED` | MongoDB not connected — check MONGO_URI |
| `jwt malformed` | Token is wrong — login again and copy fresh token |
| `Cannot POST /api/...` | Route typo — check endpoint spelling |
| `Unexpected token` | Invalid JSON body — check Content-Type header |

---

## What's Next — Stage 3

Once this backend is running:
1. Test all endpoints with Postman
2. Add Razorpay real keys (replace demo code in payments.js)
3. Connect your HTML frontend pages to these APIs using fetch()
4. Deploy backend to Render.com (free hosting)
