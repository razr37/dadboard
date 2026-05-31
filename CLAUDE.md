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

- **Guest mode** — anonymous Firebase Auth, all data in AsyncStorage. Activated when user picks "Try it free" or when `familyId` is absent after auth. Starts with empty family and requests; `DEFAULT_USER` (parent role, `colorIndex: -1`) is the initial `currentUser` so `DadTabs` renders correctly on a clean install.
- **Sync mode** — email/password Firebase Auth + a Firestore `familyId`. All mutations go to Firestore; real-time listeners keep state current across devices.

Every public method on `AppContext` routes to the right backend automatically via the `isSynced && familyId` guard. Do not bypass this — write new operations the same way. The full public API:

| Method | Description |
|---|---|
| `addRequest(req)` | Create a pickup / buy / other request |
| `updateRequestStatus(id, status)` | Cycle status: `pending` → `onway` → `done` |
| `deleteRequest(id)` | Remove a request |
| `addFamilyMember(name, role)` | Add a member; `role` is `'kid'` (default), `'spouse'`, or `'adult'`. Kids get a rotating `colorIndex` (0–4); adults get `-1` (parent orange). |
| `switchUser(user)` | Change active profile (persisted to AsyncStorage in both modes) |
| `updateCurrentUserName(name)` | Update the current user's display name — Firestore member doc (sync) or local family array (guest) + AsyncStorage |
| `setMealDay(memberId, date, {lunch, dinner})` | Toggle meal presence for a member; optimistic update in both modes |
| `getTodayRequests()` | Derived: today's pickups sorted by time |
| `getPendingBuyRequests()` | Derived: pending `buy` requests |

### Firebase SDK

The app uses the **web Firebase JS SDK** (`firebase/app`, `firebase/auth`, `firebase/firestore`) — not `@react-native-firebase`. Auth persistence is wired to AsyncStorage via `getReactNativePersistence`. Import from the standard web packages:

```js
import { getFirestore, doc, ... } from 'firebase/firestore';
import { initializeAuth, ... } from 'firebase/auth';
```

All Firebase service calls live in `src/utils/firebase.js`. Add new Firestore/Auth helpers there, not inline in components. Notable helpers beyond CRUD: `upgradeAnonymousToEmail` (links anonymous account to email), `joinFamily` (kid joins via invite code), `deleteAllFamilyData` (GDPR/PDPA right to erasure — deletes all subcollections + Auth account).

### Boot sequence (App.js)

`Root` component (outside `AppProvider`) checks auth state first. If unauthenticated, it renders `AuthScreen` standalone. Once authenticated, it wraps everything in `AppProvider` and checks consent (`ConsentScreen`). Only after both gates pass does the main navigator mount.

This means `AppProvider`'s context is not available in `AuthScreen` or `ConsentScreen`.

**Splash screen**: `SplashScreen.hideAsync()` is called at module scope (before any component mounts) so the native splash dismisses as soon as the JS bundle loads. `app.json` sets `splash.backgroundColor` to `#F07C2A` (brand orange) with no image — any unavoidable flash shows brand colour rather than a pattern. Do not add `SplashScreen.preventAutoHideAsync()` or the splash will hang.

### Navigation

Two role-based navigators sit inside a root `Stack.Navigator`:

- `DadTabs` (Tab.Navigator) — Today / Schedule / Shopping / Meals
- `KidMain` (Stack.Navigator) — KidHomeScreen only, **no tab bar** (single screen needs no tabs)

`isParent` (App.js) is `true` for roles `'parent'`, `'spouse'`, and `'adult'` — all three get `DadTabs`. Only `'kid'` gets `KidMain`. Modal screens (AddRequest, SwitchUser, Invite, PrivacySettings, Auth, Settings) are pushed onto the root stack and accessible from either navigator.

**Role-based access**: Settings, Privacy, Invite, and Manage Members have no entry points in `KidHomeScreen` — kids only navigate to `AddRequest` and `SwitchUser`. The routes are registered for all users but no kid-visible button calls them.

**`currentUser` ≠ `authUser`**: `authUser` is the Firebase Auth session (always the parent on the parent's device). `currentUser` is the active family profile — a parent can switch to a kid's profile via `SwitchUserScreen` to add requests on their behalf.

**SwitchUserScreen navigation gotcha**: `navigation.goBack()` must be called *before* `switchUser()`. A role change (`parent`↔`kid`) causes `AppNavigator` to swap the entire stack, detaching the modal's navigation context. Calling `goBack()` after the role state update has no effect.

### Consent gate (ConsentScreen.js)

Shown once after first auth. Records `dadboard_consent_v1` to AsyncStorage. EU/EEA/UK users see GDPR-specific language and an extra rights checkbox. No IP geolocation is used — consent hasn't been given yet at detection time.

**Region detection** (`detectRegion()`):
- `isEU` is `true` **only** when `Localization.region` explicitly returns an EU/EEA/UK country code. Locale parsing can set `regionCode` for display but can **never** trigger GDPR on its own.
- `Localization.region` is the primary source. The locale-string fallback (e.g. `"en-SG"` → `"SG"`) is skipped for globally-distributed language codes (`en`, `fr`, `es`, `pt`, `nl`, `de`) because tags like `en-GB` are standard on non-EU devices in SG, MY, HK, AU.
- If `Localization.region` is null (no SIM, emulator, some Android builds), `isEU` is `false` and `regionCode` defaults to `'SG'`.

**`handleAccept`**: wraps `recordConsent` in try/catch — an AsyncStorage failure logs a warning but does not block `onAccept()`. Consent is persisted via `recordConsent()` / `hasConsented()` / `revokeConsent()` (exported helpers).

### Push notifications (src/utils/notifications.js)

- **Guest mode**: `scheduleLocalNotification` — fires on the same device, no token needed.
- **Sync mode**: `sendExpoPushNotification` — sends via Expo's push gateway to Dad's device using the Expo push token stored in the parent's Firestore `members` doc. Token is registered once on the parent device after load and saved via `savePushToken`. Kid devices read the token from the member doc to push to Dad. Dad is never notified of his own actions (skipped by `uid` comparison in `sendDadNotification`).

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

Security rules are in `firebase/firestore.rules`. Non-anonymous auth is required for all family data. Kids can only create requests with their own `fromId`; parents have elevated permissions.

**`isParent()` in rules covers `'parent'`, `'spouse'`, and `'adult'`** — matches the app-level `isParent` check in `App.js`. If you add new adult roles, update this function in the rules too or those roles will be denied write access. Deploy with `firebase deploy --only firestore:rules` after any rules change.

### Invite deep link (InviteScreen.js + AuthScreen.js + App.js)

Invite link format: `https://dadboard.app/join?code=FAMILYID`

**Sending** (InviteScreen): generates the full URL, shows a WhatsApp button (`whatsapp://send?text=...` with `canOpenURL` guard), copy-link button, and generic share sheet. Raw `familyId` shown as a fallback note.

**Receiving** (App.js `Root`): `Linking.getInitialURL()` handles cold-start opens; `Linking.addEventListener('url')` handles foreground opens. `parseInviteCode(url)` extracts the `?code=` param. `initialInviteCode` state flows through `Root` → `AppNavigator` → both `AuthScreen` instances (standalone + in-app modal).

**Join flow** (AuthScreen): accepts `initialInviteCode` prop. When set: auto-switches to `'join'` tab, pre-fills `inviteCode` state, hides the code field (replaced by a green "detected" badge), and shows 3 fields (Name / Email / Password) instead of 4. Without a link: original 4-field form.

**Android deep link config**: `app.json` has `intentFilters` for `https://dadboard.app/join`. `autoVerify: false` until `dadboard.app` is live — once the domain is purchased, set `autoVerify: true` and host `/.well-known/assetlinks.json` to get direct app opening without the chooser dialog.

### AuthScreen.js — sign-in vs create-account state

The "I'm the Dad" tab has two modes controlled by `signInMode` (boolean state):
- **Create mode** (default): name + email + `createPassword`; "Create family account" button
- **Sign-in mode**: email (pre-filled) + `signInPassword` (separate state, never shares value with `createPassword`); "Sign in" button; "Forgot password?" link

**`auth/email-already-in-use`**: caught specifically in `handleCreateParent` — shows an Alert with "Sign in" / "Cancel". "Sign in" sets `signInPassword = ''` then `signInMode = true`. Email stays pre-filled. The create password is **never** copied to `signInPassword`.

**Forgot password** (`handleForgotPassword`): validates email is non-empty, calls `sendPasswordReset(email)`, shows confirmation. Available in sign-in mode only.

### SettingsScreen.js

Reached via the gear icon (⚙) in DadHomeScreen header. Registered as `presentation: 'modal'` in the root stack. Four sections:
- **Account**: Edit profile name (inline `TextInput` toggle → `updateCurrentUserName`); Change password (`sendPasswordReset` → Firebase reset email)
- **Family**: Invite family member → `InviteScreen`; Manage members → `SwitchUserScreen`
- **Privacy**: Data & Privacy → `PrivacySettingsScreen`
- **Account removal**: Delete account (double-confirm, same `performDelete` flow as `PrivacySettingsScreen`)

`firebase.js` exports supporting this: `sendPasswordReset(email)`, `updateMemberDoc(familyId, uid, data)`.

### Date handling — UTC offset gotcha

**Never use `toISOString().split('T')[0]`** to get a local date string. On UTC+ devices (e.g. SGT = UTC+8), `toISOString()` returns the previous calendar day because it converts to UTC first. Always derive date strings from local parts:

```js
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

Use `date-fns` `startOfWeek(date, { weekStartsOn: 1 })` for Monday-anchored week starts. `MealsScreen`, `KidHomeScreen`, and `AppContext.getWeekStartDate` all use this pattern — keep them consistent or Firestore meal plan keys will diverge between what kids write and what Dad reads.

### Delete account (PrivacySettingsScreen.js)

"Delete account & all data" satisfies PDPA right to erasure, GDPR Art.17, and Google Play account-deletion policy. The flow (`handleDeleteAll` → `confirmDeleteAll` → `performDelete`) uses double-confirmation alerts.

**`performDelete` sequence**:
1. `deleteAllFamilyData(familyId)` — sync mode only; deletes Firestore subcollections + `/users/{uid}` doc + the Firebase Auth account via `deleteUser()`
2. `AsyncStorage.clear()` — wipes all local state (use `clear()`, not `multiRemove` with a key list that can go stale)
3. `revokeConsent()` — belt-and-suspenders after `clear()`
4. `signOut()` — covers guest/anonymous mode; harmless for sync mode after account deletion

**No `navigation.reset()` needed**: `signOut()` / `deleteUser()` triggers `onAuthStateChanged(null)` in `Root`, which re-renders the entire tree to `AuthScreen`. Calling `navigation.reset()` after this would operate on a detached navigator and throw.

**`auth/requires-recent-login`**: Firebase requires a recent session before `deleteUser()`. This error returns early **without** clearing local data — the user must re-authenticate and retry so deletion is atomic. Do not `AsyncStorage.clear()` before `deleteUser()` succeeds.

**Independent try/catch blocks**: cloud deletion (`deleteAllFamilyData`) and local cleanup (`AsyncStorage.clear` + `revokeConsent` + `signOut`) are in separate try/catch blocks. Local cleanup always runs even if Firestore/Firebase fails. The same pattern is used in both `PrivacySettingsScreen` and `SettingsScreen`.

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
- [x] Account deletion — PrivacySettingsScreen "Delete account & all data" deletes Firestore data + Auth account + local storage (Play Store policy requirement)
- [ ] Run `eas init` in terminal to get the project ID, then paste it into `app.json` → `extra.eas.projectId`
- [ ] Host privacy policy on GitHub Pages (`dadboard.app/privacy`)
- [ ] After domain is live: set `intentFilters[0].autoVerify: true` in `app.json` and host `/.well-known/assetlinks.json` for direct deep link opening
- [ ] Generate signed AAB: `eas build --platform android --profile production`

---

## Mandatory pre-session checklist
Run this audit BEFORE doing anything else in every new session:

```bash
# 1. Node version (need 18+)
node --version

# 2. Disk space (need 5GB+ free)
df -h | grep disk1s1

# 3. Write access to working directory
echo "test" > ~/Dadboard-work/write-test.txt && echo "✓ Write access OK" && rm ~/Dadboard-work/write-test.txt || echo "✗ Write access BLOCKED - use ~/Dadboard-work not ~/Documents"

# 4. Expo SDK alignment
cat node_modules/expo/package.json | grep '"version"' | head -1
npx expo install --fix --check

# 5. Required files exist
ls android/app/google-services.json && echo "✓ google-services.json OK" || echo "✗ MISSING - copy from ~/Documents/Dadboard/android/app/"
ls assets/icon.png && echo "✓ icon.png OK" || echo "✗ MISSING"
ls assets/feature-graphic.png && echo "✓ feature-graphic.png OK" || echo "✗ MISSING"

# 6. Firebase packages aligned
cat node_modules/firebase/package.json | grep '"version"' | head -1
```

## Build pipeline rules (learned the hard way)
- ALWAYS run `npx expo install --fix` after any package change
- ALWAYS run `npx expo prebuild --platform android --clean` after package changes
- ALWAYS copy google-services.json back after `--clean` wipes it:
  `cp ~/Documents/Dadboard/android/app/google-services.json ~/Dadboard-work/android/app/google-services.json`
- NEVER hardcode sdkVersion in app.json — let EAS detect it
- React Native Firebase version MUST match Expo SDK:
  - Expo 51 → Firebase v19
  - Expo 52 → Firebase v20+
- Working directory is `~/Dadboard-work` NOT `~/Documents/Dadboard` (Documents has ACL restrictions)
- If build fails, check logs at: https://expo.dev/accounts/razr73/projects/dadboard/builds
- Firestore `requests` collection uses `orderBy('createdAt', 'desc')` — a composite index on that field is required (see `firebase/FIREBASE_SETUP.md` Step 6)
- `@react-native-community/datetimepicker` is a native module — requires `expo prebuild` + a fresh native build after adding it

## Known issues resolved
- SwitchUserScreen: tapping a member did not navigate back — `goBack()` was called after `switchUser()`, but the role change had already replaced the stack; fixed by calling `goBack()` first; all `goBack()` calls now guarded with `canGoBack()`
- SwitchUserScreen: adding a new member appeared to do nothing — `handleAddMember` was not awaiting `addFamilyMember`, errors were swallowed silently; now async with error Alert
- Firestore "Missing or insufficient permissions" when adding members — `isParent()` in security rules only checked `role == 'parent'`; `isValidMember()` only allowed `['parent', 'kid']`; both updated to include `'spouse'` and `'adult'`
- AuthScreen: create-account password bled into sign-in flow — `password` state was shared; split into `createPassword` (create form) and `signInPassword` (sign-in form); sign-in mode activated via `signInMode` boolean
- PrivacySettingsScreen: "Delete all my data" used wrong `dadapp_*` AsyncStorage key names (correct prefix is `dadboard_*`), never called `deleteAllFamilyData()`, and tried `navigation.reset()` on a detached navigator after auth deletion — all fixed
- PrivacySettingsScreen + SettingsScreen: single try/catch meant cloud failure blocked local cleanup; split into independent blocks so AsyncStorage always clears
- MealsScreen, KidHomeScreen, AppContext: `toISOString()` UTC offset caused wrong week on SGT devices — all replaced with `toLocalDateStr()` + `date-fns startOfWeek`; kid writes and Dad reads now use the same Firestore key
- Splash screen: green square caused by missing `resizeMode: contain` in app.json; `splashscreen_logo.png` resource reference satisfied by 1×1 transparent PNG generated by withAndroidFixes plugin
- iconBackground color: defined in `android/app/src/main/res/values/colors.xml`
- Duplicate Firebase classes: resolved via `configurations.all` in `android/app/build.gradle`
- `expo-asset` and `expo-font`: must be explicitly installed for Expo 52
- Expo SDK 51 + Firebase v20 = incompatible (Gradle plugin error)
- ConsentScreen: `en-GB` locale falsely triggered GDPR on SG devices where `Localization.region` returns null — fixed by requiring explicit `Localization.region` for `isEU`
- ConsentScreen: "I agree" button tapped but did nothing — `handleAccept` had no try/catch; AsyncStorage throw in `recordConsent` silently blocked `onAccept()`
- ConsentScreen: button stayed greyed out after ticking all checkboxes — scroll threshold tightened to `-100px` and 10s fallback timer added

## If starting fresh on a new machine
```bash
npx create-expo-app Dadboard --template blank
cd Dadboard
npx expo install firebase @react-native-async-storage/async-storage
npx expo install expo-notifications expo-secure-store expo-file-system expo-sharing expo-localization expo-device expo-asset expo-font @react-native-community/datetimepicker
npx expo install --fix
eas build --platform android --profile development  # Test build BEFORE writing app code
```
