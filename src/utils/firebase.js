// src/utils/firebase.js
// Dadboard — Firebase Auth + Firestore service layer
//
// SETUP STEPS (do once before running):
// 1. Create a Firebase project at console.firebase.google.com
// 2. Add an Android app with package name: com.dadboard.app
// 3. Download google-services.json → place in /android/app/
// 4. Enable Authentication → Sign-in methods: Email/Password + Anonymous
// 5. Create Firestore database in production mode
// 6. Deploy firestore.rules (in /firebase/ folder)
//
// DATA MODEL:
//   /families/{familyId}
//   /families/{familyId}/members/{userId}
//   /families/{familyId}/requests/{requestId}
//   /users/{userId}  ← maps user to their familyId

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signInAnonymously() {
  const { user } = await auth().signInAnonymously();
  return user;
}

export async function signInWithEmail(email, password) {
  const { user } = await auth().signInWithEmailAndPassword(email, password);
  return user;
}

export async function createEmailAccount(email, password) {
  const { user } = await auth().createUserWithEmailAndPassword(email, password);
  return user;
}

export async function signOut() {
  await auth().signOut();
}

export function getCurrentUser() {
  return auth().currentUser;
}

export function onAuthStateChanged(callback) {
  return auth().onAuthStateChanged(callback);
}

// Upgrade anonymous account to email/password (used when parent wants Pro)
export async function upgradeAnonymousToEmail(email, password) {
  const credential = auth.EmailAuthProvider.credential(email, password);
  const { user } = await auth().currentUser.linkWithCredential(credential);
  return user;
}

// ─── Family management ────────────────────────────────────────────────────────

// Create a new family in Firestore, return the familyId
export async function createFamily(parentName) {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');

  const familyRef = firestore().collection('families').doc();
  const familyId = familyRef.id;

  const batch = firestore().batch();

  // Family doc
  batch.set(familyRef, {
    familyName: `${parentName}'s Family`,
    ownerUid: user.uid,
    createdAt: firestore.FieldValue.serverTimestamp(),
    memberCount: 1,
  });

  // Parent member doc
  const memberRef = familyRef.collection('members').doc(user.uid);
  batch.set(memberRef, {
    uid: user.uid,
    name: parentName,
    role: 'parent',
    colorIndex: -1,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  // User → family mapping
  const userRef = firestore().collection('users').doc(user.uid);
  batch.set(userRef, {
    familyId,
    role: 'parent',
    name: parentName,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return familyId;
}

// Get the familyId for the current user
export async function getFamilyId() {
  const user = auth().currentUser;
  if (!user) return null;
  const doc = await firestore().collection('users').doc(user.uid).get();
  return doc.exists ? doc.data().familyId : null;
}

// Join an existing family with an invite code (familyId)
export async function joinFamily(familyId, memberName, colorIndex) {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');

  // Verify family exists
  const familyDoc = await firestore().collection('families').doc(familyId).get();
  if (!familyDoc.exists) throw new Error('Family not found. Check the invite code.');

  const batch = firestore().batch();

  // Add as kid member
  const memberRef = firestore()
    .collection('families').doc(familyId)
    .collection('members').doc(user.uid);
  batch.set(memberRef, {
    uid: user.uid,
    name: memberName,
    role: 'kid',
    colorIndex,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  // User → family mapping
  const userRef = firestore().collection('users').doc(user.uid);
  batch.set(userRef, {
    familyId,
    role: 'kid',
    name: memberName,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  // Increment member count
  const familyRef = firestore().collection('families').doc(familyId);
  batch.update(familyRef, {
    memberCount: firestore.FieldValue.increment(1),
  });

  await batch.commit();
}

// ─── Members ──────────────────────────────────────────────────────────────────

export function subscribeToMembers(familyId, callback) {
  return firestore()
    .collection('families').doc(familyId)
    .collection('members')
    .onSnapshot(snap => {
      const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(members);
    });
}

export async function savePushToken(familyId, uid, token) {
  await firestore()
    .collection('families').doc(familyId)
    .collection('members').doc(uid)
    .update({ pushToken: token });
}

export async function addKidMember(familyId, name, colorIndex) {
  // Creates a placeholder member (no auth account needed for kids on same device)
  const ref = firestore()
    .collection('families').doc(familyId)
    .collection('members').doc();
  await ref.set({
    uid: ref.id,          // synthetic uid for local kids
    name,
    role: 'kid',
    colorIndex,
    isLocalProfile: true, // flag: this kid uses the parent's device
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export function subscribeToRequests(familyId, callback) {
  return firestore()
    .collection('families').doc(familyId)
    .collection('requests')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const requests = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        // Convert Firestore Timestamp → JS date string for compatibility
        createdAt: d.data().createdAt?.toMillis?.() || Date.now(),
      }));
      callback(requests);
    });
}

export async function addRequest(familyId, request) {
  const ref = firestore()
    .collection('families').doc(familyId)
    .collection('requests').doc();
  await ref.set({
    ...request,
    status: 'pending',
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateRequestStatus(familyId, requestId, status) {
  await firestore()
    .collection('families').doc(familyId)
    .collection('requests').doc(requestId)
    .update({ status, updatedAt: firestore.FieldValue.serverTimestamp() });
}

export async function deleteRequest(familyId, requestId) {
  await firestore()
    .collection('families').doc(familyId)
    .collection('requests').doc(requestId)
    .delete();
}

// ─── Meal Plans ───────────────────────────────────────────────────────────────
// One Firestore doc per member: /families/{fid}/mealPlans/{memberId}
// Doc structure: { [weekStart: 'YYYY-MM-DD']: { [date: 'YYYY-MM-DD']: { lunch: bool, dinner: bool } } }

export function subscribeMealPlans(familyId, callback) {
  return firestore()
    .collection('families').doc(familyId)
    .collection('mealPlans')
    .onSnapshot(snap => {
      const plans = {};
      snap.docs.forEach(d => { plans[d.id] = d.data(); });
      callback(plans);
    });
}

export async function setMemberMeals(familyId, memberId, weekStart, weekData) {
  await firestore()
    .collection('families').doc(familyId)
    .collection('mealPlans').doc(memberId)
    .set({ [weekStart]: weekData }, { merge: true });
}

// ─── Account deletion (GDPR Art.17 / PDPA) ───────────────────────────────────

export async function deleteAllFamilyData(familyId) {
  // Delete all requests
  const requests = await firestore()
    .collection('families').doc(familyId)
    .collection('requests').get();
  const batch1 = firestore().batch();
  requests.docs.forEach(d => batch1.delete(d.ref));
  await batch1.commit();

  // Delete all members
  const members = await firestore()
    .collection('families').doc(familyId)
    .collection('members').get();
  const batch2 = firestore().batch();
  members.docs.forEach(d => batch2.delete(d.ref));
  await batch2.commit();

  // Delete family doc
  await firestore().collection('families').doc(familyId).delete();

  // Delete user mapping
  const user = auth().currentUser;
  if (user) {
    await firestore().collection('users').doc(user.uid).delete();
    // Delete the Firebase Auth account itself
    await user.delete();
  }
}
