// src/utils/firebase.js
// Dadboard — Firebase Auth + Firestore via Firebase JS SDK (pure JS, no native modules)
//
// Firebase config is derived from google-services.json (project: dadboard-app).
// Auth state is persisted via AsyncStorage so sessions survive app restarts.
//
// DATA MODEL:
//   /families/{familyId}
//   /families/{familyId}/members/{userId}
//   /families/{familyId}/requests/{requestId}
//   /families/{familyId}/mealPlans/{memberId}
//   /users/{userId}  ← maps uid → familyId

import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously as fbSignInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  EmailAuthProvider,
  linkWithCredential,
  deleteUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc, collection,
  getDoc, setDoc, updateDoc, deleteDoc,
  getDocs, onSnapshot,
  query, orderBy,
  writeBatch, serverTimestamp, increment,
} from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const app = initializeApp({
  apiKey: 'AIzaSyBVXgm0Eu1s3E3ZshjoukpXM3rGCC4hqM0',
  authDomain: 'dadboard-app.firebaseapp.com',
  projectId: 'dadboard-app',
  storageBucket: 'dadboard-app.firebasestorage.app',
  messagingSenderId: '382739338353',
  appId: '1:382739338353:android:ac6c17525e6dcf29f977d0',
});

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

const db = getFirestore(app);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signInAnonymously() {
  const { user } = await fbSignInAnonymously(auth);
  return user;
}

export async function signInWithEmail(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function createEmailAccount(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signOut() {
  await fbSignOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthStateChanged(callback) {
  return fbOnAuthStateChanged(auth, callback);
}

export async function upgradeAnonymousToEmail(email, password) {
  const credential = EmailAuthProvider.credential(email, password);
  const { user } = await linkWithCredential(auth.currentUser, credential);
  return user;
}

// ─── Family management ────────────────────────────────────────────────────────

export async function createFamily(parentName) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const familyRef = doc(collection(db, 'families'));
  const familyId = familyRef.id;
  const batch = writeBatch(db);

  batch.set(familyRef, {
    familyName: `${parentName}'s Family`,
    ownerUid: user.uid,
    createdAt: serverTimestamp(),
    memberCount: 1,
  });

  batch.set(doc(db, 'families', familyId, 'members', user.uid), {
    uid: user.uid,
    name: parentName,
    role: 'parent',
    colorIndex: -1,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'users', user.uid), {
    familyId,
    role: 'parent',
    name: parentName,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return familyId;
}

export async function getFamilyId() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? snap.data().familyId : null;
}

export async function joinFamily(familyId, memberName, colorIndex) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const familySnap = await getDoc(doc(db, 'families', familyId));
  if (!familySnap.exists()) throw new Error('Family not found. Check the invite code.');

  const batch = writeBatch(db);

  batch.set(doc(db, 'families', familyId, 'members', user.uid), {
    uid: user.uid,
    name: memberName,
    role: 'kid',
    colorIndex,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'users', user.uid), {
    familyId,
    role: 'kid',
    name: memberName,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'families', familyId), {
    memberCount: increment(1),
  });

  await batch.commit();
}

// ─── Members ──────────────────────────────────────────────────────────────────

export function subscribeToMembers(familyId, callback) {
  return onSnapshot(
    collection(db, 'families', familyId, 'members'),
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function savePushToken(familyId, uid, token) {
  await updateDoc(doc(db, 'families', familyId, 'members', uid), { pushToken: token });
}

export async function addKidMember(familyId, name, colorIndex, role = 'kid') {
  const ref = doc(collection(db, 'families', familyId, 'members'));
  await setDoc(ref, {
    uid: ref.id,
    name,
    role,
    colorIndex,
    isLocalProfile: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export function subscribeToRequests(familyId, callback) {
  const q = query(
    collection(db, 'families', familyId, 'requests'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toMillis?.() || Date.now(),
    }));
    callback(requests);
  });
}

export async function addRequest(familyId, request) {
  const ref = doc(collection(db, 'families', familyId, 'requests'));
  await setDoc(ref, { ...request, status: 'pending', createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateRequestStatus(familyId, requestId, status) {
  await updateDoc(doc(db, 'families', familyId, 'requests', requestId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRequest(familyId, requestId) {
  await deleteDoc(doc(db, 'families', familyId, 'requests', requestId));
}

// ─── Meal Plans ───────────────────────────────────────────────────────────────

export function subscribeMealPlans(familyId, callback) {
  return onSnapshot(
    collection(db, 'families', familyId, 'mealPlans'),
    (snap) => {
      const plans = {};
      snap.docs.forEach(d => { plans[d.id] = d.data(); });
      callback(plans);
    }
  );
}

export async function setMemberMeals(familyId, memberId, weekStart, weekData) {
  await setDoc(
    doc(db, 'families', familyId, 'mealPlans', memberId),
    { [weekStart]: weekData },
    { merge: true }
  );
}

// ─── Account deletion (GDPR Art.17 / PDPA) ───────────────────────────────────

export async function deleteAllFamilyData(familyId) {
  const requestsSnap = await getDocs(collection(db, 'families', familyId, 'requests'));
  const batch1 = writeBatch(db);
  requestsSnap.docs.forEach(d => batch1.delete(d.ref));
  await batch1.commit();

  const membersSnap = await getDocs(collection(db, 'families', familyId, 'members'));
  const batch2 = writeBatch(db);
  membersSnap.docs.forEach(d => batch2.delete(d.ref));
  await batch2.commit();

  await deleteDoc(doc(db, 'families', familyId));

  const user = auth.currentUser;
  if (user) {
    await deleteDoc(doc(db, 'users', user.uid));
    await deleteUser(user);
  }
}
