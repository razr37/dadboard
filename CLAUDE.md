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

**`subscribeToFamilyId(uid, callback)`** — real-time `onSnapshot` listener on `/users/{uid}` that replaces the old one-shot `getFamilyId()` read in AppContext. Used to handle the race condition where `createFamily()` commits its Firestore batch *after* AppContext's `onAuthStateChanged` fires (new-account sign-up flow). When the batch lands, the snapshot fires a second time and switches AppContext from guest → sync mode without requiring a sign-out. On `permission-denied` (anonymous users) it calls `callback(null)` silently. **Do not revert this to a one-shot `getDoc` call.**

### Boot sequence (App.js)

`Root` uses three boolean states: `ready`, `authed`, `consented`. Renders sequentially:

```
!ready     → loading spinner
!authed    → AuthScreen (in NavigationContainer, standalone)
!consented → ConsentScreen (plain component, no navigator)
else       → AppProvider + NavigationContainer + AppNavigator
```

`onAuthStateChanged` sets `authed` and reads `AsyncStorage.getItem('dadboard_consented') === 'yes'` to set `consented`. `ConsentScreen.onAccept` writes `'dadboard_consented'='yes'` to AsyncStorage and calls `setConsented(true)` — navigation is immediate, write is fire-and-forget.

`AppProvider`'s context is not available in `AuthScreen` or `ConsentScreen` (both render outside the provider).

**Consent key**: `dadboard_consented` = `'yes'`. `revokeConsent()` in ConsentScreen clears this key (plus legacy keys). `AsyncStorage.clear()` in `performDelete` also clears it.

**Setup wizard key**: `dadboard_setup_complete` = `'yes'`. Written by `DadHomeScreen` once all three setup steps are done (Step 1 always complete; Step 2 = `family.length > 1`; Step 3 = `requests.length > 0`). While the key is absent the wizard card renders above the summary strip. The card never shows again after the key is written — it is not cleared by `AsyncStorage.clear()` during account deletion (intentional: a fresh account starts clean anyway).

**Splash screen**: `SplashScreen.hideAsync()` is called at module scope so the native splash dismisses as soon as the JS bundle loads. `app.json` sets `splash.backgroundColor` to `#F07C2A`. Do not add `SplashScreen.preventAutoHideAsync()` or the splash will hang.

### Navigation

Two role-based navigators sit inside a root `Stack.Navigator`:

- `DadTabs` (Tab.Navigator) — Today / Schedule / Shopping / Meals
- `KidMain` (Stack.Navigator) — KidHomeScreen only, **no tab bar** (single screen needs no tabs)

`isParent` (App.js) is `true` for roles `'parent'`, `'spouse'`, and `'adult'` — all three get `DadTabs`. Only `'kid'` gets `KidMain`. Modal screens (AddRequest, SwitchUser, Invite, PrivacySettings, Auth, Settings, ProUpgrade) are pushed onto the root stack and accessible from either navigator.

**Role-based access**: Settings, Privacy, Invite, and Manage Members have no entry points in `KidHomeScreen` — kids only navigate to `AddRequest` and `SwitchUser`. The routes are registered for all users but no kid-visible button calls them.

**`currentUser` ≠ `authUser`**: `authUser` is the Firebase Auth session (always the parent on the parent's device). `currentUser` is the active family profile — a parent can switch to a kid's profile via `SwitchUserScreen` to add requests on their behalf.

**SwitchUserScreen navigation gotcha**: `navigation.goBack()` must be called *before* `switchUser()`. A role change (`parent`↔`kid`) causes `AppNavigator` to swap the entire stack, detaching the modal's navigation context. Calling `goBack()` after the role state update has no effect.

### Consent gate (ConsentScreen.js)

Shown once after first auth. Records `dadboard_consent_v1` to AsyncStorage. EU/EEA/UK users see GDPR-specific language and an extra rights checkbox. No IP geolocation is used — consent hasn't been given yet at detection time.

**Region detection** (`detectRegion()`):
- `isEU` is `true` **only** when `Localization.region` explicitly returns an EU/EEA/UK country code. Locale parsing can set `regionCode` for display but can **never** trigger GDPR on its own.
- `Localization.region` is the primary source. The locale-string fallback (e.g. `"en-SG"` → `"SG"`) is skipped for globally-distributed language codes (`en`, `fr`, `es`, `pt`, `nl`, `de`) because tags like `en-GB` are standard on non-EU devices in SG, MY, HK, AU.
- If `Localization.region` is null (no SIM, emulator, some Android builds), `isEU` is `false` and `regionCode` defaults to `'SG'`.

**`handleAccept`**: `await onAccept()` — nothing else. The `onAccept` prop (set in App.js Root) writes `dadboard_consented='yes'` and calls `setConsented(true)`. Navigation is driven entirely by App.js state, not by ConsentScreen.

**Scroll fallback timer**: 2 seconds — unlocks the button if all checkboxes are ticked but the content never scrolled to the `-100px` threshold (common on tall screens).

### Push notifications (src/utils/notifications.js)

- **Guest mode**: `scheduleLocalNotification` — fires on the same device, no token needed.
- **Sync mode**: `sendExpoPushNotification` — sends via Expo's push gateway to Dad's device using the Expo push token stored in the parent's Firestore `members` doc. Token is registered once on the parent device after load and saved via `savePushToken`. Kid devices read the token from the member doc to push to Dad. Dad is never notified of his own actions (skipped by `uid` comparison in `sendDadNotification`).

### Firestore data model

```
/users/{uid}                         ← maps uid → { familyId, role, name }
/families/{familyId}                 ← family doc { familyName, ownerUid, memberCount, isPro? }
/families/{familyId}/members/{uid}   ← { name, role, colorIndex, uid, isLocalProfile? }
/families/{familyId}/requests/{id}   ← { type, fromId, fromName, status, createdAt, ... }
/families/{familyId}/mealPlans/{memberId}  ← { [weekStart: YYYY-MM-DD]: { [date]: { lunch: bool, dinner: bool } } }
/telegram_users/{telegramId}         ← { telegramUserId, familyId, name, registeredAt }  (written by bot, Admin SDK)
/invites/{token}                     ← { familyId, createdBy, createdAt, expiresAt, used }  (8-char token, 48hr TTL, one-time use)
```

Request types: `pickup` (has `date`, `time`, `location`, `dropTo`), `buy` (has `item`, `urgency`), `other` (has `message`, `urgency`).
Status cycle: `pending` → `onway` → `done` (tap on DadHomeScreen cycles through).

Kids on a shared parent device are created with `isLocalProfile: true` and a synthetic `uid` (doc ID) — they have no Firebase Auth account of their own.

Security rules are in `firebase/firestore.rules`. Non-anonymous auth is required for all family data. Kids can only create requests with their own `fromId`; parents have elevated permissions.

**`isParent()` in rules covers `'parent'`, `'spouse'`, and `'adult'`** — matches the app-level `isParent` check in `App.js`. If you add new adult roles, update this function in the rules too or those roles will be denied write access. Deploy with `firebase deploy --only firestore:rules` after any rules change.

### Invite flow (InviteScreen.js + AuthScreen.js + App.js)

InviteScreen shows **two invite paths**:

**1. Telegram bot** — `https://t.me/DadboardBot?start={token}`. Pro feature. No app needed; any phone with Telegram can register. `generateTelegramInvite(familyId, uid)` in `firebase.js` creates an 8-char token (e.g. `X7K2M9PQ`) stored in `/invites/{token}` with a 48hr expiry and `used: false`. The token is auto-generated when the Pro Telegram card mounts and can be regenerated. The bot validates the token (invalid/used/expired), marks it `used: true`, and registers the user in `/telegram_users/{telegramId}`.

**2. Dadboard app** — displays the raw `familyId` as a monospace invite code. WhatsApp message includes the Play Store URL. The recipient enters the code in AuthScreen → Join family tab.

**Deep link receiving** (App.js `Root`): `Linking.getInitialURL()` handles cold-start opens; `Linking.addEventListener('url')` handles foreground opens. `parseInviteCode(url)` extracts the `?code=` param from `https://dadboard.app/join?code=FAMILYID`. `initialInviteCode` state flows through `Root` → `AppNavigator` → both `AuthScreen` instances.

**Join flow** (AuthScreen): accepts `initialInviteCode` prop. When set: auto-switches to `'join'` tab, pre-fills `inviteCode` state, hides the code field (replaced by a green "detected" badge), and shows 3 fields (Name / Email / Password) instead of 4.

**Android deep link config**: `app.json` has `intentFilters` for `https://dadboard.app/join`. `autoVerify: false` until `dadboard.app` is live.

### Telegram bot companion (`~/dadboard-bot/`)

Separate Node.js/Express project (not inside this repo). Receives Telegram webhooks and writes to the same Firestore project using **Firebase Admin SDK**, which bypasses security rules entirely.

**Registration flow**: `/start {token}` → looks up `/invites/{token}` → validates not used / not expired → registers user in `/telegram_users/{telegramId}` → marks invite `used: true`. Invalid/used/expired tokens each return a distinct error message directing the user to ask Dad for a new one.

**Request flow**: message text → Claude Haiku via `parseMessage()` → `saveRequest(familyId, {...parsed, fromName, rawMessage})` → `families/{familyId}/requests`.

**Bot-written request fields**: `type`, `date`, `time`, `location`, `activity`, `item`, `urgency`, `fromName`, `rawMessage`, `createdAt`. Notably **absent**: `status` and `fromId` (Admin SDK skips rules that require them). `subscribeToRequests` in `firebase.js` defaults both: `status: data.status ?? 'pending'`, `fromId: data.fromId ?? ''`. Do not remove these defaults.

**Date parsing**: `parser.js` builds its system prompt dynamically via `buildSystemPrompt()`, injecting today's date in SGT (`Asia/Singapore` timezone) on every call. This is critical — a static prompt causes the model to use its training cutoff date for relative terms like "tomorrow".

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

### Meal plan navigation — two-week view

Both `MealsScreen` (Dad) and `KidHomeScreen` (`MealsThisWeek` component) use a `weekOffset` state (`0` = this week, `1` = next week) rather than an unbounded date cursor. `weekStart` is derived as `baseWeek` or `shiftWeek(baseWeek, 1)`.

- Left arrow disabled at offset 0; right arrow disabled at offset 1 — hard ceiling of two weeks
- Kids can pre-plan Sunday evening for the coming week without waiting for Monday
- Dad's view and kid's view always reference the same Firestore keys for the same calendar week

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

### Config plugin (plugins/withAndroidFixes.js)

Registered in `app.json` as the first plugin. Runs during every `npx expo prebuild` (including `--clean`) and writes three things that are gitignored and would otherwise be missing:

- **`withOrangeColors`** — sets `iconBackground` and `splashscreen_background` to `#F07C2A` in `android/.../colors.xml`
- **`withBlankSplashLogo`** — writes a 1×1 transparent PNG to `drawable/splashscreen_logo.png` (satisfies the XML reference expo-splash-screen injects even when no splash image is configured)
If a build fails with a missing drawable resource, check this plugin first. Both mods use `withDangerousMod` so they have direct filesystem access to `platformProjectRoot`.

**`"icon"` is intentionally absent from the `expo-notifications` plugin config in `app.json`** — including it would cause expo-notifications to inject `@drawable/notification_icon` meta-data into `AndroidManifest.xml`, but `drawable-*/` is gitignored so the PNG is never present on a clean build. Removing the `"icon"` property stops the injection entirely. The `"color"` property is kept; expo-notifications generates `@color/notification_icon_color` which is satisfied.

### Pro subscription gate

`isPro` is a boolean derived from the `families/{familyId}` Firestore document field `isPro: true`. It is subscribed to via `subscribeToFamily(fid, callback)` in `attachFirestoreListeners` inside AppContext, exposed as `isPro` on the context, and defaults to `false`.

Currently gated behind Pro:
- **Telegram invite** (`InviteScreen.js`) — locked card with "Upgrade to Pro" button → `ProUpgradeScreen` when `isPro` is false. When true, auto-generates a token via `generateTelegramInvite` on mount and shows the Telegram link with expiry note and "Generate new link" button.

`ProUpgradeScreen.js` — modal screen listing Pro benefits with checkmarks, SGD $3.99/month price, and an "Upgrade to Pro" button that opens `mailto:dadboard.privacy@gmail.com` with the family ID pre-filled. Activation is manual within 24 hours.

**To enable Pro for testing**: set `isPro: true` on the `/families/{familyId}` document in Firebase console.

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
- ConsentScreen: "I agree" tapped but nothing happened — `onAuthStateChanged` token refresh fired during `recordConsent`, called `hasConsented()` before write completed, got `false`, overwrote `consentGiven=true`; fixed with `justConsented` ref in Root
- KidHomeScreen: crash on switching to kid profile — `currentUser.colorIndex` could be `undefined` (new kid) making array index `NaN`; fixed with `Math.max(0, currentUser?.colorIndex ?? 0) % 5`
- PrivacySettingsScreen: "Delete all my data" used wrong `dadapp_*` AsyncStorage key names (correct prefix is `dadboard_*`), never called `deleteAllFamilyData()`, and tried `navigation.reset()` on a detached navigator after auth deletion — all fixed
- PrivacySettingsScreen + SettingsScreen: single try/catch meant cloud failure blocked local cleanup; split into independent blocks so AsyncStorage always clears
- MealsScreen, KidHomeScreen, AppContext: `toISOString()` UTC offset caused wrong week on SGT devices — all replaced with `toLocalDateStr()` + `date-fns startOfWeek`; kid writes and Dad reads now use the same Firestore key
- ConsentScreen: button appeared to do nothing after tapping — `handleAccept` was fire-and-forget (no await, no loading state); now async with `accepting` spinner and `await recordConsent()` before calling `onAccept()`
- ConsentScreen: 10-second fallback timer made button feel unresponsive — reduced to 2 seconds
- Splash screen: green square caused by missing `resizeMode: contain` in app.json; `splashscreen_logo.png` resource reference satisfied by 1×1 transparent PNG generated by withAndroidFixes plugin
- iconBackground color: defined in `android/app/src/main/res/values/colors.xml`
- Duplicate Firebase classes: resolved via `configurations.all` in `android/app/build.gradle`
- `expo-asset` and `expo-font`: must be explicitly installed for Expo 52
- Expo SDK 51 + Firebase v20 = incompatible (Gradle plugin error)
- ConsentScreen: `en-GB` locale falsely triggered GDPR on SG devices where `Localization.region` returns null — fixed by requiring explicit `Localization.region` for `isEU`
- ConsentScreen: "I agree" button tapped but did nothing — `handleAccept` had no try/catch; AsyncStorage throw in `recordConsent` silently blocked `onAccept()`
- ConsentScreen: button stayed greyed out after ticking all checkboxes — scroll threshold tightened to `-100px` and 10s fallback timer added
- AppContext / createFamily: new-account sign-up left app stuck in guest mode — `onAuthStateChanged` in AppContext fired before `createFamily()` committed its Firestore batch; `getFamilyId()` returned null and AppContext settled into guest mode permanently; fixed by replacing the one-shot `getDoc` read with `subscribeToFamilyId()` (`onSnapshot`), which fires again when the batch lands and switches to sync mode automatically
- AuthScreen handleCreateParent: Firestore errors from `createFamily()` were shown as "Something went wrong" — auth and family-creation errors were in one try/catch; split into separate blocks so `createFamily` errors show `e.message` / `e.code` directly
- Build error `@drawable/notification_icon` missing — expo-notifications injects this meta-data when `"icon"` is set in its plugin config; removed the `"icon"` property from `app.json` entirely so the drawable reference is never injected; `drawable-*/` is gitignored so PNG-copy approaches do not survive `prebuild --clean`
- DadHomeScreen `getTodayRequests`: used `toISOString().split('T')[0]` for today's date — caused SGT pickups from the Telegram bot (which writes SGT dates) to never appear on the Today tab; fixed with `toLocalDateStr(new Date())`

## Session management
- Each Claude.ai chat session has a context limit
- When you see "conversation compacted" notice - open a new Claude.ai chat immediately
- Start new chat with: "I'm building Dadboard. Read ~/Dadboard-work/CLAUDE.md for full context. Current task: [describe task]"
- CLAUDE.md is the persistent memory - keep it updated at end of every session
- Claude Code sessions (terminal) are separate from Claude.ai chat sessions and don't have the same limit

## If starting fresh on a new machine
```bash
npx create-expo-app Dadboard --template blank
cd Dadboard
npx expo install firebase @react-native-async-storage/async-storage
npx expo install expo-notifications expo-secure-store expo-file-system expo-sharing expo-localization expo-device expo-asset expo-font @react-native-community/datetimepicker
npx expo install --fix
eas build --platform android --profile development  # Test build BEFORE writing app code
```
