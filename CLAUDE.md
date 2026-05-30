# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start Metro bundler — guest mode works in Expo Go; Firebase sync requires a dev build
npm start

# Build and run on connected Android device/emulator
npx expo run:android

# EAS dev build (shareable APK with native modules)
eas build --profile development --platform android

# EAS production AAB (for Play Store)
eas build --profile production --platform android

# Deploy Firestore security rules (run `firebase init firestore` first if firebase.json absent)
firebase deploy --only firestore:rules

# Regenerate android/ from app.json (use after adding native packages)
npx expo prebuild --clean
```

There are no tests. There is no lint configuration.

## Architecture

### Dual-mode data layer

The app has two operating modes controlled entirely by `AppContext` (`src/context/AppContext.js`):

- **Guest mode** — anonymous Firebase Auth, all data in AsyncStorage. Activated when user picks "Try it free" or when `familyId` is absent after auth. Starts with `SEED_FAMILY` / `SEED_REQUESTS` demo data.
- **Sync mode** — email/password Firebase Auth + a Firestore `familyId`. All mutations go to Firestore; real-time listeners keep state current across devices.

Every public method on `AppContext` routes to the right backend automatically based on `isSynced && familyId`. Do not bypass this — write new operations the same way. The full public API:

| Method | Description |
|---|---|
| `addRequest(req)` | Create a pickup / buy / other request |
| `updateRequestStatus(id, status)` | Cycle status: `pending` → `onway` → `done` |
| `deleteRequest(id)` | Remove a request |
| `addFamilyMember(name)` | Add a kid (auto-assigns next `colorIndex`) |
| `switchUser(user)` | Change active profile (persisted to AsyncStorage in both modes) |
| `setMealDay(memberId, date, {lunch, dinner})` | Toggle meal presence for a member; optimistic update in both modes |
| `getTodayRequests()` | Derived: today's pickups sorted by time |
| `getPendingBuyRequests()` | Derived: pending `buy` requests |

### Firebase SDK

The app uses **`@react-native-firebase`** (v20, native module), NOT the web `@firebase/app` SDK. This is why Expo Go can't run it — a native dev build is required. Import auth and firestore from their native packages:

```js
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
```

All Firebase service calls live in `src/utils/firebase.js`. Add new Firestore/Auth helpers there, not inline in components. Notable helpers beyond CRUD: `upgradeAnonymousToEmail` (links anonymous account to email), `joinFamily` (kid joins via invite code), `deleteAllFamilyData` (GDPR right to erasure — deletes all subcollections + Auth account).

### Boot sequence (App.js)

`Root` component (outside `AppProvider`) checks auth state first. If unauthenticated, it renders `AuthScreen` standalone. Once authenticated, it wraps everything in `AppProvider` and checks consent (`ConsentScreen`). Only after both gates pass does the main navigator mount.

This means `AppProvider`'s context is not available in `AuthScreen` or `ConsentScreen`.

### Navigation

Two role-based tab navigators sit inside a root `Stack.Navigator`:

- `DadTabs` — Today (DadHomeScreen) / Schedule / Shopping / Meals
- `KidTabs` — Home (KidHomeScreen) only

Role is determined by `currentUser.role` from `AppContext`. Modal screens (AddRequest, SwitchUser, Invite, PrivacySettings, Auth) are pushed onto the root stack from either tab set.

**`currentUser` ≠ `authUser`**: `authUser` is the Firebase Auth session (always the parent on the parent's device). `currentUser` is the active family profile — a parent can switch to a kid's profile via `SwitchUserScreen` to add requests on their behalf.

### Firestore data model

```
/users/{uid}                         ← maps uid → { familyId, role, name }
/families/{familyId}                 ← family doc { familyName, ownerUid, memberCount }
/families/{familyId}/members/{uid}   ← { name, role, colorIndex, uid, isLocalProfile? }
/families/{familyId}/requests/{id}   ← { type, fromId, fromName, status, createdAt, ... }
/families/{familyId}/mealPlans/{memberId}  ← { [weekStart: YYYY-MM-DD]: { [date]: { lunch: bool, dinner: bool } } }
```

Request types: `pickup` (has `date`, `time`, `location`, `dropTo`), `buy` (has `item`, `urgency`), `other` (has `message`, `urgency`).
Status cycle: `pending` → `onway` → `done` (tap on DadHomeScreen cycles through).

Kids on a shared parent device are created with `isLocalProfile: true` and a synthetic `uid` (doc ID) — they have no Firebase Auth account of their own.

Security rules are in `firebase/firestore.rules`. Non-anonymous auth is required for all family data. Kids can only create requests with their own `fromId`; parents have elevated permissions. Deploy with `firebase deploy --only firestore:rules`.

### Design system

All UI primitives are in `src/utils/theme.js`: `colors`, `spacing`, `radius`, `typography`, `shadow`. Reusable components (`Avatar`, `StatusBadge`, `Card`, `PrimaryButton`, etc.) are in `src/components/UI.js`. Always use theme tokens, never hardcode colors or sizes.

The `kids` color array in theme maps `colorIndex` (0–4) to a kid's color throughout the app. `colorIndex: -1` is Dad (uses `primary` orange).

### Pending tasks

**Firebase setup (manual steps in console)**
- [ ] Enable Firebase Auth — Sign-in methods: Email/Password + Anonymous
- [ ] Enable Firestore — region `asia-southeast1`
- [ ] Deploy security rules: `firebase deploy --only firestore:rules` (rules file is complete at `firebase/firestore.rules`)

**Play Store prep**
- [x] Set up EAS — `eas.json` created with development/preview/production profiles; `app.json` updated with icon path, `googleServicesFile`, `adaptiveIcon`, notification plugin, and permissions
- [x] Create app icon 512×512px and feature graphic 1024×500px — `generate_assets.py` generates both; run `python3 generate_assets.py` once to produce `assets/icon.png` and `assets/feature-graphic.png`
- [ ] Run `eas init` in terminal to get the project ID, then paste it into `app.json` → `extra.eas.projectId`
- [ ] Host privacy policy on GitHub Pages (`dadboard.app/privacy`)
- [ ] Generate signed AAB: `eas build --platform android --profile production`

**Completed**
- [x] Add meal planning feature — lunch/dinner attendance per day, weekly summary Meals tab
- [x] Wire up push notifications (`src/utils/notifications.js` + `AppContext.js`)
  - Guest mode: local notification on same device when a request is submitted
  - Sync mode: Expo push API to Dad's device using token stored in Firestore member doc
  - Meal toggles notify Dad only when a meal is newly turned ON

### Key constraints

- `@react-native-firebase` requires a **native dev build** for Firebase sync. Guest mode (anonymous auth + AsyncStorage) runs fine in Expo Go via `npm start`.
- The `android/` folder was generated by `expo prebuild`. Do not hand-edit `android/app/build.gradle` plugin declarations without checking autolinking compatibility.
- `google-services.json` at `android/app/google-services.json` is required at build time.
- Firestore `requests` collection uses `orderBy('createdAt', 'desc')` — a composite index on that field is required (see `firebase/FIREBASE_SETUP.md` Step 6).
- Privacy policy URL referenced in AuthScreen: `dadboard.app/privacy` (to be hosted on GitHub Pages).
