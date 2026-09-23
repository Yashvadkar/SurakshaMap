# 🛡️ SurakshaMap (सुरक्षा Map)
> **Empowering Communities with Real-Time Public Space Safety Reporting & Intelligence**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](README.md)
[![Status: Production Ready](https://img.shields.io/badge/Status-Complete-success.svg)](README.md)

SurakshaMap is a production-grade, community-driven public safety reporting platform designed to help citizens report municipal and safety hazards—such as broken streetlights, potholes, harassment hotspots, and open hazards—without requiring account creation or login. Reports are visualized on an interactive map with real-time risk density heatmaps, verified through Gemini AI classification, tracked via unique access tokens, and triaged by authorities via an authenticated Admin Console.

---

## 🌟 Key Features

### 1. 🔏 Anonymous Citizen Reporting (No Signup Required)
- **Zero Friction**: Submit reports anonymously without passwords or personal data.
- **5-Step Wizard**: Intuitive step-by-step reporting flow with category selection, description, location tagging, and photo evidence.
- **Auto-Geolocation & Pin Drop**: Pinpoint exact coordinates via GPS or click-to-pin on an interactive Leaflet map.
- **Private Tracking Code**: Generates a cryptographically secure tracking token (e.g., `SM-A1B2-C3D4`) so citizens can monitor status updates and add supplemental notes.

### 2. 🗺️ Live Safety Map & Hotspot Analysis
- **Dynamic Clustering**: Utilizes Leaflet.markercluster with risk-weighted color coding (Critical, High, Medium, Low).
- **Temporal & Category Filters**: Filter by issue type, time of day (Night/Day), and resolution status.
- **Safety Density & Insights**: Computes localized hazard index scores to alert citizens to high-risk zones.
- **Interactive Details**: Bottom-sheet modal with complete incident details, verification badges, and timestamps.

### 3. 🤖 AI-Powered Incident Verification (Google Gemini)
- **Automated Triage**: Classifies incident severity, predicts potential hazards, and recommends municipal department routing.
- **Duplicate Detection**: Identifies nearby similar incidents to prevent redundant dispatches.
- **Real-Time Moderation**: Filters abusive or invalid submissions before escalation.

### 4. 📊 Public Safety Insights Dashboard
- **Interactive Visualizations**: Powered by Chart.js (Incidents by Category, Time-of-Day distribution, Resolution Status, and Municipal Ward breakdown).
- **Key Performance Indicators**: Total reports, resolution rate, average response turnaround, and active critical alerts.

### 5. 🔐 Authenticated Authority / Admin Console
- **RBAC Protected**: Role-based access for municipal officers and law enforcement (Firebase Auth).
- **Incident Lifecycle Management**: Update statuses (`Submitted` ➔ `In Review` ➔ `In Progress` ➔ `Resolved` ➔ `Closed`).
- **Batch Processing**: Run bulk AI reviews, filter by severity, and export reports in CSV/GeoJSON formats.
- **Internal Notes & Citizen Feedback**: Post official progress notes visible to citizens via their tracking tokens.

### 6. 🌓 Modern UI/UX & Responsive Design
- **Theme Support**: Seamless Dark/Light mode toggle with persistence and system preference detection.
- **Accessibility & Micro-animations**: Polished CSS variables, fluid glassmorphism, responsive navigation, and mobile-friendly layout.
- **Zero Build Step**: Pure HTML5, Vanilla JavaScript (ES modules/classes), and custom CSS architecture—runs instantly on any web server.

---

## 📁 Repository Structure

```
SurakshaMapDeploy/
├── assets/
│   └── SurakshaMap_logo.png     # Official project branding
├── css/
│   ├── design-system.css        # CSS custom properties, tokens, and base reset
│   ├── animations.css           # Micro-interactions, keyframes, transitions
│   ├── components.css           # Reusable UI widgets (cards, modals, badges, wizard)
│   └── layouts.css              # Responsive grid, hero, map, print stylesheets
├── js/
│   ├── config.js                # Firebase & Gemini API configuration
│   ├── firebase-init.js         # Firebase Auth/Firestore SDK & LocalStorage fallback
│   ├── ui-components.js         # Toast notifications, modal dialogs, status badges
│   ├── theme.js                 # Dark/Light theme manager
│   ├── app.js                   # SPA client-side hash router
│   ├── risk-engine.js           # Spatial hazard clustering & risk density algorithm
│   ├── report-wizard.js         # Multi-step citizen reporting workflow
│   ├── map-engine.js            # Leaflet map integration & clustering layers
│   ├── ai-review.js             # Gemini AI classification & duplicate detection
│   ├── tracking.js              # Token-based incident lookup & citizen timeline
│   ├── insights.js              # Chart.js analytics & municipal KPI metrics
│   └── admin-dashboard.js       # Admin portal logic, status updates & data exports
├── admin.html                   # Authority management dashboard
├── firebase.json                # Firebase hosting configuration
├── firestore.rules              # Granular security rules for database
├── firestore.indexes.json       # Composite indexing for geospatial queries
├── index.html                   # Main citizen-facing single-page application
├── package.json                 # Project metadata & local dev scripts
├── privacy.html                 # Comprehensive privacy & data protection policy
└── storage.rules                # Secure cloud storage rules for evidence uploads
```

---

## 🚀 Quick Start (Local Development)

Because SurakshaMap is built with standard Web APIs and Vanilla JavaScript, it requires **no compilation or bundler step**.

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/SurakshaMap.git
cd SurakshaMap
```

### 2. Start a local HTTP server
Using Python:
```bash
# Python 3
python -m http.server 8080
```
Or using Node.js:
```bash
npx http-server -p 8080
```

### 3. Open in Browser
Navigate to `http://localhost:8080` to access the application.

---

## 🔑 Demo Mode & Authentication

The project is designed to run seamlessly out-of-the-box in **Demo Mode (LocalStorage)** even without live Firebase keys configured.

- **Pre-loaded Data**: 6 realistic sample safety incidents across different categories and risk levels.
- **Admin Portal Demo Credentials**:
  - **URL**: Navigate to `admin.html` (or click "Admin Login" in footer)
  - **Email**: `admin@surakshamap.in`
  - **Password**: `suraksha-demo`

---

## ⚙️ Production Firebase & Gemini Configuration

To deploy to production with live Google Cloud Firebase and Gemini:

1. Create a project in [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database**, **Authentication** (Email/Password), and **Cloud Storage**.
3. Create an API key in [Google AI Studio](https://aistudio.google.com/) for Gemini.
4. Update `js/config.js` with your credentials:
```javascript
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const GEMINI_CONFIG = {
  apiKey: "YOUR_GEMINI_API_KEY",
  model: "gemini-1.5-flash"
};
```
5. Deploy rules and hosting:
```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

---

## 🔒 Security & Privacy by Design

- **Anonymous by Default**: Citizen submissions never collect IP addresses, device identifiers, or biometric data.
- **Tokenized Access**: Only individuals holding the unique tracking hash can view updates or add info to their reports.
- **Granular Firestore Rules**: Public write-access restricted to new report creation with strict schema validation; read access filtered to approved public pins; modification restricted to authenticated admin users.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
