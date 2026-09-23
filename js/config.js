/**
 * ============================================================================
 *  SurakshaMap Configuration
 * ============================================================================
 *
 *  HOW TO SET UP (3 simple steps):
 *
 *  1. FIREBASE (Free):
 *     - Go to https://console.firebase.google.com
 *     - Click "Create a project" → name it "surakshamap" → disable analytics → Create
 *     - Click the web icon (</>) → register app as "SurakshaMap Web"
 *     - Copy the firebaseConfig object values and paste below
 *     - Go to Build → Firestore Database → Create → Start in TEST mode
 *     - Go to Build → Authentication → Get Started → Enable Email/Password
 *     - Go to Build → Storage → Get Started → Start in TEST mode
 *
 *  2. GEMINI API KEY (Free):
 *     - Go to https://aistudio.google.com/apikey
 *     - Click "Create API Key" → copy it
 *     - Paste it in GEMINI_API_KEY below
 *     - Free tier: 15 requests/minute, 1 million tokens/minute
 *
 *  3. ADMIN ACCOUNT:
 *     - In Firebase Console → Authentication → Users → Add User
 *     - Enter your email and a strong password
 *     - That email/password is your admin login
 *
 * ============================================================================
 */

const SURAKSHAMAP_CONFIG = {

  // ─── Firebase Configuration ───────────────────────────────────────────
  // Replace these with YOUR Firebase project values from Step 1 above.
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  },

  // ─── Google Gemini API Key ────────────────────────────────────────────
  // Paste your free Gemini API key from Step 2 above.
  // This is used ONLY in the admin dashboard for AI report classification.
  geminiApiKey: "YOUR_GEMINI_API_KEY",

  // ─── Gemini Model (free tier) ─────────────────────────────────────────
  geminiModel: "gemini-2.0-flash",

  // ─── App Settings ─────────────────────────────────────────────────────
  app: {
    name: "SurakshaMap",
    tagline: "Community Safety Intelligence",
    defaultCenter: { lat: 19.076, lng: 72.8777 },  // Mumbai
    defaultZoom: 13,
    maxPhotoSizeMB: 5,
    trackingTokenPrefix: "SM",
    duplicateRadiusMeters: 200,
    duplicateTimeWindowDays: 30,
    duplicateSimilarityThreshold: 0.35,
    hotspotRadiusMeters: 200,
    hotspotMinReports: 2,
    recentDays: 30
  }
};

window.SURAKSHAMAP_CONFIG = SURAKSHAMAP_CONFIG;
