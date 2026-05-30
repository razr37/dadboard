# Dadboard — Firebase Setup Guide
# Complete this before running the app with sync enabled.
# Estimated time: 20–30 minutes.

## Step 1 — Create Firebase project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Name it: dadboard-app (or similar)
4. Disable Google Analytics for now (can enable later)
5. Click "Create project"

## Step 2 — Add Android app

1. In Firebase console, click the Android icon
2. Package name: com.dadboard.app
   (Must match android/app/build.gradle applicationId)
3. App nickname: Dadboard Android
4. SHA-1: skip for now (add later for Google Sign-In)
5. Download google-services.json
6. Place it at: android/app/google-services.json

## Step 3 — Enable Authentication

1. In Firebase console → Authentication → Get started
2. Sign-in method tab:
   - Enable: Email/Password
   - Enable: Anonymous (for guest/free tier users)
3. Save

## Step 4 — Create Firestore database

1. Firebase console → Firestore Database → Create database
2. Select: Start in production mode
3. Location: asia-southeast1 (Singapore) — important for PDPA/GDPR
4. Click Enable

## Step 5 — Deploy security rules

Install Firebase CLI if you haven't:
  npm install -g firebase-tools

Then:
  firebase login
  firebase init firestore
    → Select your project
    → Rules file: firebase/firestore.rules (already exists)
    → Indexes file: firebase/firestore.indexes.json (create blank)
  firebase deploy --only firestore:rules

Verify rules are active in Firebase console → Firestore → Rules tab.

## Step 6 — Create required Firestore indexes

In Firebase console → Firestore → Indexes, add:

Collection: families/{familyId}/requests
Fields: createdAt (Descending)
Query scope: Collection

(This is needed for the requests query with orderBy)

## Step 7 — Configure Android project

In android/build.gradle (project level), add:
  classpath 'com.google.gms:google-services:4.3.15'

In android/app/build.gradle (app level), add at bottom:
  apply plugin: 'com.google.gms.google-services'

## Step 8 — Run the app

  npm install
  npx expo run:android

(Note: @react-native-firebase requires a dev build, not Expo Go.
Use EAS Build for a shareable dev build:
  npm install -g eas-cli
  eas build --profile development --platform android)

## Step 9 — Test auth flows

1. Open app → Auth screen appears
2. "I'm the Dad" → create account → family created in Firestore
3. Check Firebase console → Firestore → families collection → your family appears
4. Go to Settings → Invite code → copy the familyId
5. Install app on second device → "Join family" → paste code → join
6. Verify both devices show the same requests in real time

## Ongoing costs (Firebase free tier — Spark plan)

Firestore reads:    50,000/day free
Firestore writes:   20,000/day free
Firestore deletes:  20,000/day free
Auth:               10,000/month free
Storage:            1 GB free

A family of 5 making ~20 requests/day = ~100 reads/day.
You would need ~500 active families to approach the free tier limit.
Free tier is sufficient until significant scale.

## Environment variables (optional, for CI/CD)

If you don't want google-services.json in your repo:
  Add to .gitignore: android/app/google-services.json
  Use EAS Secrets for production builds:
    eas secret:create --name GOOGLE_SERVICES_JSON --value "$(base64 android/app/google-services.json)"
