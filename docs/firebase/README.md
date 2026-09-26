# Firebase Security Rules & Configuration Reference

This directory preserves the Firestore and Firebase Storage security rules for **SurakshaMap**.

### Overview
- **Deployment Platform**: The SurakshaMap web application and AI review backend are deployed on **Vercel** (`https://surakshamap-omega.vercel.app`).
- **Database & Storage Services**: The frontend client directly interacts with Firebase Firestore and Firebase Storage using the Firebase Web SDK (`Public/js/firebase-init.js`).
  - **Firestore Database (`reports` collection)**: Anonymous citizen report creation, public safety map reading, status updates by dashboard.
  - **Firebase Storage (`reports/{reportId}/*`)**: Citizen incident photo uploads (restricted to images < 5MB).
- **Hosting**: Firebase Hosting is decommissioned in favor of Vercel for serverless function support, faster edge CDN delivery, and automatic GitHub deployment.

### Files
- `firestore.rules`: Active security rules deployed to Cloud Firestore.
- `storage.rules`: Active security rules deployed to Firebase Storage.
- `firestore.indexes.json`: Composite query indexes for Firestore collections.
