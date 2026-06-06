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
| `addFamilyMember(name, role)` | Add a member; `role` is `'telegram_user'` (default) or `'app_user'`. `telegram_user` gets a rotating `colorIndex` (0–4); `app_user` gets `-1` (parent orange). |
| `deleteFamilyMember(memberId)` | Remove a member — Firestore `deleteDoc` in sync mode, local array filter in guest mode |
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

All Firebase service calls live in `src/utils/firebase.js`. Add new Firestore/Auth helpers there, not inline in components. Notable helpers beyond CRUD: `upgradeAnonymousToEmail` (links anonymous account to email), `deleteAllFamilyData` (GDPR/PDPA right to erasure), `generateMemberInvite` (Dad creates magic-link token for a family member), `redeemMemberInvite` (member taps link → anonymous sign-in + user doc write), `deleteFamilyMember` (removes a member doc), `signInWithGoogle` (Google OAuth → `signInWithCredential` → returns `{user, isNewUser}`).

**Google Sign-In**: `@react-native-google-signin/google-signin` v16 is installed. `GoogleSignin.configure({ webClientId })` is called at module scope in `App.js`. `signInWithGoogle()` in `firebase.js` calls `GoogleSignin.signIn()`, wraps the `idToken` in `GoogleAuthProvider.credential`, and calls `signInWithCredential`. Returns `null` if the user cancelled. New users get `createFamily(displayName)` called automatically in `handleGoogleSignIn` in `AuthScreen.js`. Existing users go straight to the app via `onAuthStateChanged`.

**`subscribeToFamilyId(uid, callback)`** — real-time `onSnapshot` on `/users/{uid}`. Callback signature: `callback(familyId, memberId)` — both strings or null. `memberId` is set when the user doc was written by `redeemMemberInvite`, pointing to the member slot Dad pre-created. AppContext uses it to select the correct `currentUser` after a magic-link join. Also handles the `createFamily()` batch race condition (new-account sign-up). **Do not revert this to a one-shot `getDoc` call.**

### Boot sequence (App.js)

`Root` uses a **two-phase boot** to support magic-link joins without a flash of AuthScreen:

**Phase 1** (`linkChecked` state): `Linking.getInitialURL()` checks for `?invite=TOKEN`. If found and no existing session, calls `redeemMemberInvite(token)` which does `signInAnonymously` + writes `/users/{uid}`. This completes before Phase 2 starts.

**Phase 2** (gated on `linkChecked`): `onAuthStateChanged` listener subscribes. By the time it fires, the anonymous session from Phase 1 is already established.

`Root` renders sequentially:

```
!ready     → loading spinner (covers Phase 1 + Phase 2 startup)
!authed    → AuthScreen (Dad setup / sign-in only)
!consented → ConsentScreen
else       → AppProvider + NavigationContainer + AppNavigator
```

`onAuthStateChanged` sets `authed` and reads `AsyncStorage.getItem('dadboard_consented') === 'yes'` to set `consented`. `ConsentScreen.onAccept` writes `'dadboard_consented'='yes'` to AsyncStorage and calls `setConsented(true)` — navigation is immediate, write is fire-and-forget.

`AppProvider`'s context is not available in `AuthScreen` or `ConsentScreen` (both render outside the provider).

**Consent key**: `dadboard_consented` = `'yes'`. `revokeConsent()` in ConsentScreen clears this key (plus legacy keys). `AsyncStorage.clear()` in `performDelete` also clears it.

**Setup wizard key**: `dadboard_setup_complete` = `'yes'`. Written by `DadHomeScreen` once all three setup steps are done (Step 1 always complete; Step 2 = `family.length > 1`; Step 3 = `requests.length > 0`). While the key is absent the wizard card renders above the summary strip. The card never shows again after the key is written — it is not cleared by `AsyncStorage.clear()` during account deletion (intentional: a fresh account starts clean anyway).

**Splash screen**: `SplashScreen.hideAsync()` is called at module scope so the native splash dismisses as soon as the JS bundle loads. `app.json` sets `splash.backgroundColor` to `#F07C2A`. Do not add `SplashScreen.preventAutoHideAsync()` or the splash will hang.

### AsyncStorage keys

| Key | Value | Notes |
|---|---|---|
| `dadboard_consented` | `'yes'` | Preserved on sign-out; cleared only by `AsyncStorage.clear()` (account deletion) |
| `dadboard_current_user` | JSON | Active profile selection |
| `dadboard_family` | JSON | Guest-mode family array |
| `dadboard_requests` | JSON | Guest-mode requests array |
| `dadboard_meal_plans` | JSON | Guest-mode meal plans |
| `dadboard_favourite_places` | JSON | Pickup location suggestions |
| `dadboard_setup_complete` | `'yes'` | Written once; never cleared — not part of `AsyncStorage.clear()` on account deletion (intentional) |

Sign-out uses `AsyncStorage.multiRemove(SIGN_OUT_CLEAR_KEYS)` (all keys except `dadboard_consented`) so the consent gate isn't re-shown after signing back in. Account deletion uses `AsyncStorage.clear()` for full erasure.

### Navigation

Two role-based navigators sit inside a root `Stack.Navigator`:

- `DadTabs` (Tab.Navigator) — Today / Schedule / Shopping / Meals
- `KidMain` (Stack.Navigator) — KidHomeScreen only, **no tab bar** (single screen needs no tabs)

`isParent` (App.js) is `true` for roles `'parent'` and `'app_user'` — both get `DadTabs`. Only `'telegram_user'` gets `KidMain`. Modal screens (AddRequest, SwitchUser, Invite, PrivacySettings, Auth, Settings, ProUpgrade) are pushed onto the root stack and accessible from either navigator.

**Role system**: three roles in use — `'parent'` (Dad, full access, orange), `'app_user'` (full dashboard, orange, joins via `dadboard://` magic link), `'telegram_user'` (simplified view, rotating colour, interacts via Telegram bot). `isParent()` in `firestore.rules` covers `['parent', 'app_user']`. `isValidMember()` covers `['parent', 'telegram_user', 'app_user']`.

**`currentUser` ≠ `authUser`**: `authUser` is the Firebase Auth session (always the parent on the parent's device). `currentUser` is the active family profile — a parent can switch to a Telegram User's profile via `SwitchUserScreen` to add requests on their behalf.

**SwitchUserScreen navigation gotcha**: `navigation.goBack()` must be called *before* `switchUser()`. A role change (`parent`/`app_user` ↔ `telegram_user`) causes `AppNavigator` to swap the entire stack, detaching the modal's navigation context. Calling `goBack()` after the role state update has no effect.

**SwitchUserScreen delete member**: each `MemberCard` shows a trash icon (`canDelete`) unless the card belongs to the Firebase auth account holder (`member.uid === authUser.uid` or `member.id === authUser.uid`). Tapping the icon shows a single-confirm Alert then calls `deleteFamilyMember(member.id)`. The delete icon is also hidden when the card is the currently active profile (`isActive`). Adding a new member immediately prompts to send an invite (WhatsApp or Copy link), with the link type determined by role: `telegram_user` → `t.me/DadboardBot?start=TOKEN`, `app_user` → `dadboard://join?invite=TOKEN`.

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
/invites/{token}                     ← Telegram: { familyId, createdBy, createdAt, expiresAt, used }
                                       Member:   { familyId, memberId, role, name, colorIndex, createdBy, createdAt, expiresAt, used }
                                       Both: 8-char token, 48hr TTL, one-time use. Presence of memberId distinguishes type.
```

Request types: `pickup` (has `date`, `time`, `from`, `to`, `activity`), `buy` (has `item`, `urgency`), `other` (has `message`, `urgency`).
Status cycle: `pending` → `onway` → `done` (tap on DadHomeScreen cycles through).

Kids on a shared parent device are created with `isLocalProfile: true` and a synthetic `uid` (doc ID) — they have no Firebase Auth account of their own.

Security rules are in `firebase/firestore.rules`. Non-anonymous auth is required for all family data. Kids can only create requests with their own `fromId`; parents have elevated permissions.

**`isParent()` in rules covers `'parent'` and `'app_user'`** — matches the app-level `isParent` check in `App.js`. If you add new elevated roles, update this function in the rules too or those roles will be denied write access. Deploy with `firebase deploy --only firestore:rules` after any rules change.

### Invite flow

There are now **two separate invite mechanisms** — keep them distinct:

**1. Telegram bot** (Pro feature, `InviteScreen.js`) — `https://t.me/DadboardBot?start={token}`. `generateTelegramInvite(familyId, uid, pin?)` creates an 8-char token in `/invites/{token}` with a 48hr expiry. The bot validates and marks used. Token shape: `{ familyId, createdBy, expiresAt, used, pin? }` — `pin` is a djb2xor hash of the 4-digit PIN if Dad set one.

**2. Member magic link** (all families, `SwitchUserScreen.js`) — `dadboard://join?invite={token}`. Dad adds a member (name + role) → `addFamilyMember` creates the member doc → `generateMemberInvite` creates a token → Alert offers "Send via WhatsApp" and "Copy link". Token shape: `{ familyId, memberId, role, name, colorIndex, expiresAt, used }`. When the link is tapped on the member's phone, `redeemMemberInvite(token)` in App.js Phase 1 boot: validates token, calls `signInAnonymously`, writes `/users/{anon_uid}` with `{ familyId, role, name, memberId }`, marks invite used. AppContext then finds `memberId` in the user doc and selects the correct family member as `currentUser`. **No login screen shown — the member lands directly on their home screen.**

**PIN verification** (optional, Telegram invites only): when generating a Telegram invite token, Dad is shown a `Modal` + `TextInput` PIN prompt (or can Skip). If a PIN is set, a djb2xor hash is stored as `invite.pin`; the plain PIN is included in the WhatsApp share message. In the bot, `pendingPinVerification` (in-memory `Map`, keyed by `chatId`) tracks users mid-verification; 3 wrong attempts invalidates the invite with `used: true`. **`hashPin()` in `src/utils/firebase.js` and `~/dadboard-bot/server.js` must stay byte-for-byte identical** — divergence permanently locks out any user with a pending PIN invite.

**Deep link config**: `app.json` has `"scheme": "dadboard"` at the expo root — Expo `prebuild` auto-generates the Android intent filter for `dadboard://` from this. `parseMemberToken(url)` in App.js extracts `?invite=` from any URL scheme via regex, handling both `dadboard://` and HTTPS fallback. To test: copy a `dadboard://join?invite=TOKEN` link and open it in Chrome on Android — it will prompt to open Dadboard.

### Telegram bot companion (`~/dadboard-bot/`)

Separate Node.js/Express project (not inside this repo). Receives Telegram webhooks and writes to the same Firestore project using **Firebase Admin SDK**, which bypasses security rules entirely.

**Registration flow**: `/start {token}` → looks up `/invites/{token}` → validates not used / not expired → registers user in `/telegram_users/{telegramId}` → marks invite `used: true`. Invalid/used/expired tokens each return a distinct error message directing the user to ask Dad for a new one.

**Request flow**: message text → Claude Haiku via `parseMessage()` → `saveRequest(familyId, {...parsed, fromName, rawMessage})` → `families/{familyId}/requests`.

**Bot-written request fields**: `type`, `date`, `time`, `from`, `to`, `activity`, `item`, `urgency`, `fromName`, `rawMessage`, `createdAt`. `from` = pickup origin (defaults to `"Home"`); `to` = destination. Notably **absent**: `status` and `fromId` (Admin SDK skips rules that require them). `subscribeToRequests` in `firebase.js` defaults both: `status: data.status ?? 'pending'`, `fromId: data.fromId ?? ''`. Do not remove these defaults.

**`parser.js` `BASE_PROMPT`**: instructs Claude Haiku on the `from`/`to` distinction. `"Next [weekday]"` always means the following week. Urgency defaults to `medium`. System prompt is rebuilt on every call with today's SGT date via `buildSystemPrompt()` — a static prompt causes the model to use its training cutoff for relative dates like "tomorrow".

**Date parsing**: `parser.js` builds its system prompt dynamically via `buildSystemPrompt()`, injecting today's date in SGT (`Asia/Singapore` timezone) on every call. This is critical — a static prompt causes the model to use its training cutoff date for relative terms like "tomorrow".

**Bot file layout**:
- `server.js` — Express + webhook handler, PIN verification (`pendingPinVerification` Map), cancel disambiguation
- `firebase.js` — Admin SDK helpers: `getTelegramUser`, `registerTelegramUser`, `saveRequest`, `deleteRequest`, `setPendingCancel`, `clearPendingCancel`, `getPendingCancel`
- `parser.js` — `parseMessage(text)` via Claude Haiku, `buildSystemPrompt()` injects today's SGT date
- `render.yaml` — Render.com deployment config; bot is deployed there, kept alive with a self-ping every 14 minutes

`pendingPinVerification` is an in-memory `Map` — it is lost on bot restart. Users mid-PIN-entry after a restart will need Dad to regenerate the invite.

### AuthScreen.js — Dad-only auth

AuthScreen is **for Dad only**. `telegram_user` and `app_user` members join via magic link; they never see this screen. Uses a `screen` state (`'welcome' | 'parent' | 'signin'`).

- **`'welcome'`** — two `IntentCard` components: "Set up as Dad / Parent" → `'parent'`; "Sign in" → `'signin'`. Hint text explains that family members join via invite link.
- **`'parent'`** — name + email + password (show/hide toggle) → `createEmailAccount` then `createFamily`. `auth/email-already-in-use` navigates to `'signin'` with email pre-filled; create password is **never** copied to the sign-in password field.
- **`'signin'`** — email + password → `signInWithEmail`. "Forgot password?" calls `sendPasswordReset`.

Each screen has fully independent email/password state. No `initialInviteCode` prop — deep-link join is handled entirely in App.js Phase 1 before AuthScreen ever renders.

### SettingsScreen.js

Reached via the gear icon (⚙) in DadHomeScreen header. Registered as `presentation: 'modal'` in the root stack. Five sections:
- **Account**: Edit profile name (inline `TextInput` toggle → `updateCurrentUserName`); Change password (`sendPasswordReset` → Firebase reset email)
- **Family**: Invite family member → `InviteScreen`; Manage members → `SwitchUserScreen`
- **Privacy**: Data & Privacy → `PrivacySettingsScreen`
- **Sign out**: `handleSignOut` — single-confirm alert → `signOut(auth)` then `AsyncStorage.clear()`. No explicit navigation: `onAuthStateChanged(null)` in `Root` re-renders to `AuthScreen` automatically. Uses `import { signOut } from 'firebase/auth'` and `import { auth } from '../utils/firebase'` directly (not the wrapper).
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

Use `date-fns` `startOfWeek(date, { weekStartsOn: 1 })` for Monday-anchored week starts. `MealsScreen`, `KidHomeScreen`, and `AppContext.getWeekStartDate` all use this pattern — keep them consistent or Firestore meal plan keys will diverge between what family members write and what Dad reads.

### Meal plan navigation — two-week view

Both `MealsScreen` (Dad) and `KidHomeScreen` (`MealsThisWeek` component) use a `weekOffset` state (`0` = this week, `1` = next week) rather than an unbounded date cursor. `weekStart` is derived as `baseWeek` or `shiftWeek(baseWeek, 1)`.

- Left arrow disabled at offset 0; right arrow disabled at offset 1 — hard ceiling of two weeks
- Kids can pre-plan Sunday evening for the coming week without waiting for Monday
- Dad's view and family members' views always reference the same Firestore keys for the same calendar week

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

- **`withOrangeColors`** — sets `iconBackground`, `splashscreen_background`, `colorPrimary`, and `colorPrimaryDark` to `#F07C2A` in `android/.../colors.xml`. `colorPrimary` defaults to dark blue in Expo's template, causing a blue flash on launch if not overridden.
- **`withBlankSplashLogo`** — writes a 1×1 transparent PNG to `drawable/splashscreen_logo.png` (satisfies the XML reference expo-splash-screen injects even when no splash image is configured)
- **`withTargetSdk35`** — patches `android/build.gradle` after Expo generates it, replacing the `targetSdkVersion` fallback with `'35'` (Expo's template defaults to `'34'`; this ensures every `prebuild --clean` produces the correct value)

If a build fails with a missing drawable resource, check this plugin first. All three `withDangerousMod` mods have direct filesystem access to `platformProjectRoot`.

**`"icon"` is intentionally absent from the `expo-notifications` plugin config in `app.json`** — including it would cause expo-notifications to inject `@drawable/notification_icon` meta-data into `AndroidManifest.xml`, but `drawable-*/` is gitignored so the PNG is never present on a clean build. Removing the `"icon"` property stops the injection entirely. The `"color"` property is kept; expo-notifications generates `@color/notification_icon_color` which is satisfied.

### Pro subscription gate

`isPro` is a boolean derived from the `families/{familyId}` Firestore document field `isPro: true`. It is subscribed to via `subscribeToFamily(fid, callback)` in `attachFirestoreListeners` inside AppContext, exposed as `isPro` on the context, and defaults to `false`.

Currently gated behind Pro:
- **Telegram invite** (`InviteScreen.js`) — locked card with "Upgrade to Pro" button → `ProUpgradeScreen` when `isPro` is false. When true, auto-generates a token via `generateTelegramInvite` on mount and shows the Telegram link with expiry note and "Generate new link" button.

`ProUpgradeScreen.js` — modal screen listing Pro benefits with checkmarks, SGD $3.99/month price, and an "Upgrade to Pro" button that opens `mailto:dadboard.privacy@gmail.com` with the family ID pre-filled. Activation is manual within 24 hours.

**To enable Pro for testing**: set `isPro: true` on the `/families/{familyId}` document in Firebase console.

### Design system

All UI primitives are in `src/utils/theme.js`: `colors`, `spacing`, `radius`, `typography`, `shadow`. Reusable components (`Avatar`, `StatusBadge`, `Card`, `PrimaryButton`, etc.) are in `src/components/UI.js`. Always use theme tokens, never hardcode colors or sizes.

The `kids` color array in theme maps `colorIndex` (0–4) to a `telegram_user`'s colour throughout the app. `colorIndex: -1` is used by `parent` and `app_user` (renders as `primary` orange).

### Pending tasks

**Firebase Console (manual)**
- [ ] Enable Auth — Sign-in methods: Email/Password + Anonymous
- [ ] Enable Firestore — region `asia-southeast1`
- [ ] Deploy security rules: `firebase deploy --only firestore:rules`

**Play Store**
- [ ] Host privacy policy on GitHub Pages (`dadboard.app/privacy`)
- [ ] After domain live: set `intentFilters[0].autoVerify: true` in `app.json` + host `/.well-known/assetlinks.json` for verified deep links
- [ ] Generate signed AAB: `eas build --platform android --profile production`

**Post-launch**
- [ ] Apple Sign-In (when iOS launched)

---

## Environment checks

Before building: Node 18+, 5 GB free disk, `android/app/google-services.json` present. After any `prebuild --clean`, copy it back:
```bash
cp ~/Documents/Dadboard/android/app/google-services.json ~/Dadboard-work/android/app/google-services.json
```
Working directory is `~/Dadboard-work` — `~/Documents/Dadboard` has ACL restrictions.

## Before every production build checklist
Run these checks BEFORE building to avoid wasted build time:

1. Version code must be higher than any previously submitted build:
   `grep "versionCode" app.json`
   - Increment by 1 each build (1 → 2 → 3 etc.)
   - Play Store rejects duplicate version codes with no exceptions

2. targetSdkVersion must meet current Play Store minimum:
   `grep "targetSdkVersion" android/build.gradle`
   - As of June 2026: minimum is 35
   - Check play.google.com/console for current requirement before building

3. google-services.json must exist:
   `ls android/app/google-services.json`

4. JS bundle must be clean before building:
   `npx expo export --platform android 2>&1 | head -5`
   - Must show "Android Bundled" with no errors

5. Git must be clean (all changes committed):
   `git status`
   - Must show "nothing to commit"

Run all 5 checks, fix any issues, THEN build.

## Build pipeline rules (learned the hard way)
- ALWAYS run `npx expo install --fix` after any package change
- ALWAYS run `npx expo prebuild --platform android --clean` after package changes
- ALWAYS copy google-services.json back after `--clean` wipes it:
  `cp ~/Documents/Dadboard/android/app/google-services.json ~/Dadboard-work/android/app/google-services.json`
- NEVER hardcode sdkVersion in app.json — let EAS detect it
- Current versions: Expo SDK 52, Firebase JS SDK 12, Android `compileSdkVersion`/`targetSdkVersion` = 35
- If ever switching to `@react-native-firebase` (not the current web JS SDK): version MUST match Expo SDK (Expo 51 → v19, Expo 52 → v20+)
- Working directory is `~/Dadboard-work` NOT `~/Documents/Dadboard` (Documents has ACL restrictions)
- If build fails, check logs at: https://expo.dev/accounts/razr73/projects/dadboard/builds
- Firestore `requests` collection uses `orderBy('createdAt', 'desc')` — a composite index on that field is required (see `firebase/FIREBASE_SETUP.md` Step 6)
- `@react-native-community/datetimepicker` is a native module — requires `expo prebuild` + a fresh native build after adding it

## If starting fresh on a new machine
```bash
npx create-expo-app Dadboard --template blank
cd Dadboard
npx expo install firebase @react-native-async-storage/async-storage
npx expo install expo-notifications expo-secure-store expo-file-system expo-sharing expo-localization expo-device expo-asset expo-font @react-native-community/datetimepicker
npx expo install --fix
eas build --platform android --profile development  # Test build BEFORE writing app code
```
