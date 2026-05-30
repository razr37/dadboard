# Dadboard 🚗

**The family pickup command centre — so Dad stops getting ambushed.**

Kids and spouse submit ride pickups, shopping requests, and other tasks from their own phones. Dad sees everything on one dashboard, gets notified, marks things done.

---

## Quick start

### Prerequisites
- Node.js 18+
- EAS CLI: `npm install -g eas-cli` (required for Firebase)
- Expo Go works for UI development; Firebase sync requires a dev build

### Install
```bash
cd Dadboard
npm install
```

### Run (UI only, no Firebase sync)
```bash
npx expo start
```
Guest mode works in Expo Go — all data stays local.

### Run with Firebase sync (full app)
Complete `firebase/FIREBASE_SETUP.md` first, then:
```bash
npx expo run:android   # or: eas build --profile development
```

---

## Project structure

```
Dadboard/
├── App.js                          # Root: auth gate → consent gate → main app
├── firebase/
│   ├── firestore.rules             # Security rules — deploy to Firebase
│   └── FIREBASE_SETUP.md           # Step-by-step Firebase configuration
├── src/
│   ├── utils/
│   │   ├── theme.js                # Design tokens (colors, spacing, typography)
│   │   └── firebase.js             # Auth + Firestore service layer
│   ├── context/
│   │   └── AppContext.js           # Dual-mode state (local ↔ Firestore)
│   └── screens/
│       ├── AuthScreen.js           # Sign up / sign in / guest start
│       ├── ConsentScreen.js        # PDPA + GDPR consent gate (v2)
│       ├── DadHomeScreen.js        # Dad's today dashboard
│       ├── ScheduleScreen.js       # 7-day pickup schedule
│       ├── ShoppingScreen.js       # Shopping list
│       ├── KidHomeScreen.js        # Kid's simplified home
│       ├── AddRequestScreen.js     # Submit pickup / buy / other
│       ├── SwitchUserScreen.js     # Switch between family profiles
│       ├── InviteScreen.js         # Share invite code with family
│       └── PrivacySettingsScreen.js # GDPR rights, export, delete
```

---

## How it works

### Two modes

**Guest mode** (no account): data on one device only. Free, offline, works in Expo Go.

**Sync mode** (email account): real-time Firestore sync across all family devices. Each person has their own phone login.

### Family setup flow (sync mode)
1. Dad installs app → "I'm the Dad" → creates account → family created
2. Consent screen shown → PDPA + GDPR compliant
3. Dad goes to Settings → Invite → copies family invite code
4. Each kid installs app → "Join family" → enters code + creates account
5. Everyone sees the same data in real time

### Security model
- Anonymous users (guest mode) cannot access Firestore at all
- Email-authenticated users can only read/write their own family's data
- Kids can only create requests attributed to their own uid
- Only parents can delete members or edit other people's requests
- All rules enforced server-side in `firebase/firestore.rules`

---

## Compliance summary

| | Status |
|---|---|
| PDPA consent | ✓ ConsentScreen v2 |
| GDPR Art.6 lawful basis | ✓ Shown to EU users |
| GDPR Art.8 children | ✓ Parental checkbox |
| Right to erasure | ✓ Settings → Delete all |
| Data portability | ✓ JSON export via expo-sharing |
| Firestore security rules | ✓ Family-isolated, role-based |
| Firebase Authentication | ✓ Email + anonymous |
| EU representative | ⏳ Appoint before EU launch (~€50/yr) |

---

## Play Store checklist

- [ ] Complete Firebase setup
- [ ] Test all three auth flows (parent / join / guest)
- [ ] Host privacy policy at dadboard.app/privacy
- [ ] Complete Play Console Data Safety form
- [ ] Generate signed AAB: `eas build --platform android --profile production`
- [ ] Submit to Google Play internal testing first

---

## Tech stack

React Native (Expo) · React Navigation · Firebase Auth · Firestore · AsyncStorage · expo-secure-store · expo-sharing · date-fns · Ionicons
