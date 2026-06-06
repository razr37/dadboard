// src/context/AppContext.js
// Dadboard — dual-mode context
//
// GUEST MODE  (anonymous auth, no familyId):
//   All data stored locally via AsyncStorage — identical to original behaviour.
//
// SYNC MODE (email auth + familyId):
//   All data stored in Firestore, synced in real time.
//   Local AsyncStorage used only as a loading cache.

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { startOfWeek } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import {
  onAuthStateChanged, subscribeToFamilyId,
  subscribeToFamily, subscribeToMembers, subscribeToRequests,
  addRequest as fbAddRequest,
  updateRequestStatus as fbUpdateStatus,
  deleteRequest as fbDeleteRequest,
  addKidMember,
  subscribeMealPlans, setMemberMeals as fbSetMemberMeals,
  savePushToken, updateMemberDoc,
} from '../utils/firebase';
import {
  registerForPushNotifications,
  scheduleLocalNotification,
  sendExpoPushNotification,
} from '../utils/notifications';

const AppContext = createContext(null);

const LOCAL_KEYS = {
  FAMILY: 'dadboard_family',
  REQUESTS: 'dadboard_requests',
  CURRENT_USER: 'dadboard_current_user',
  MEAL_PLANS: 'dadboard_meal_plans',
  FAVOURITE_PLACES: 'dadboard_favourite_places',
};

const DEFAULT_FAVOURITE_PLACES = ['Home', 'School', 'Office'];

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekStartDate(dateStr) {
  return toLocalDateStr(startOfWeek(new Date(dateStr + 'T00:00:00'), { weekStartsOn: 1 }));
}

// Default user shown before any AsyncStorage data loads. Ensures the parent
// view renders correctly on first launch with no seeded family members.
const DEFAULT_USER = { id: 'default', name: 'Dad', role: 'parent', colorIndex: -1 };

export function AppProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);       // Firebase user
  const [familyId, setFamilyId] = useState(null);       // Firestore familyId (null = guest)
  const [family, setFamily] = useState([]);
  const [requests, setRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(DEFAULT_USER);
  const [loaded, setLoaded] = useState(false);
  const [isSynced, setIsSynced] = useState(false);      // true = using Firestore
  const [isPro, setIsPro] = useState(false);
  const [mealPlans, setMealPlans] = useState({});       // { [memberId]: { [weekStart]: { [date]: { lunch, dinner } } } }
  const [favouritePlaces, setFavouritePlaces] = useState(DEFAULT_FAVOURITE_PLACES);

  const unsubscribeMembers = useRef(null);
  const unsubscribeRequests = useRef(null);
  const unsubscribeMealPlans = useRef(null);
  const unsubscribeFamily = useRef(null);
  const unsubscribeUserDoc = useRef(null);
  const pushRegisteredRef = useRef(false);

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      setAuthUser(user);

      // Clean up any previous /users/{uid} listener before attaching a new one
      unsubscribeUserDoc.current?.();
      unsubscribeUserDoc.current = null;

      if (!user) {
        // Signed out — load local data
        await loadLocalData();
        setIsSynced(false);
        setLoaded(true);
        return;
      }

      // Subscribe to /users/{uid} instead of a one-shot getDoc read.
      // This fires immediately with the current value AND again if createFamily()
      // commits its batch after this callback fires (new-account race condition).
      // On permission-denied (anonymous users) it calls back with null.
      let firstRead = true;
      unsubscribeUserDoc.current = subscribeToFamilyId(user.uid, async (fid, memberId) => {
        if (fid) {
          setFamilyId(fid);
          setIsSynced(true);
          attachFirestoreListeners(fid, memberId);
          setLoaded(true);
        } else if (firstRead) {
          // No family on first read — load local fallback (guest / new account)
          await loadLocalData();
          setIsSynced(false);
          setLoaded(true);
        }
        firstRead = false;
      });
    });
    return () => {
      unsub();
      unsubscribeUserDoc.current?.();
    };
  }, []);

  // ── Firestore real-time listeners ──────────────────────────────────────────
  function attachFirestoreListeners(fid, memberId) {
    // Unsubscribe any previous listeners
    unsubscribeFamily.current?.();
    unsubscribeMembers.current?.();
    unsubscribeRequests.current?.();
    unsubscribeMealPlans.current?.();

    unsubscribeFamily.current = subscribeToFamily(fid, (familyDoc) => {
      setIsPro(familyDoc?.isPro === true);
    });

    unsubscribeMembers.current = subscribeToMembers(fid, (members) => {
      setFamily(members);
      setCurrentUser(prev => {
        // Magic-link join: memberId from /users/{uid} points to the member doc
        // Dad created, so we land directly on the right kid/spouse profile.
        if (memberId) {
          const target = members.find(m => m.id === memberId || m.uid === memberId);
          if (target) return target;
        }
        const updated = members.find(m => m.id === prev?.id || m.uid === prev?.id);
        return updated || members.find(m => m.role === 'parent') || members[0];
      });
    });

    unsubscribeRequests.current = subscribeToRequests(fid, (reqs) => {
      setRequests(reqs);
    });

    unsubscribeMealPlans.current = subscribeMealPlans(fid, (plans) => {
      setMealPlans(plans);
    });
  }

  useEffect(() => {
    return () => {
      unsubscribeFamily.current?.();
      unsubscribeMembers.current?.();
      unsubscribeRequests.current?.();
      unsubscribeMealPlans.current?.();
      unsubscribeUserDoc.current?.();
    };
  }, []);

  // ── Favourite places (device-local, not synced to Firestore) ─────────────────
  // Loaded on mount for both guest and sync mode users.
  useEffect(() => {
    AsyncStorage.getItem(LOCAL_KEYS.FAVOURITE_PLACES).then(raw => {
      if (raw) {
        setFavouritePlaces(JSON.parse(raw));
      } else {
        AsyncStorage.setItem(LOCAL_KEYS.FAVOURITE_PLACES, JSON.stringify(DEFAULT_FAVOURITE_PLACES));
      }
    }).catch(() => {});
  }, []);

  async function addFavouritePlace(name) {
    const trimmed = name.trim();
    if (!trimmed || favouritePlaces.includes(trimmed)) return;
    const updated = [...favouritePlaces, trimmed];
    setFavouritePlaces(updated);
    await AsyncStorage.setItem(LOCAL_KEYS.FAVOURITE_PLACES, JSON.stringify(updated));
  }

  async function removeFavouritePlace(name) {
    const updated = favouritePlaces.filter(p => p !== name);
    setFavouritePlaces(updated);
    await AsyncStorage.setItem(LOCAL_KEYS.FAVOURITE_PLACES, JSON.stringify(updated));
  }

  // ── Push notification registration (parent's device only) ──────────────────
  // Runs once after family loads. Stores token in Firestore member doc (sync)
  // so that kid devices can find it and push to Dad.
  useEffect(() => {
    if (!loaded || !authUser || pushRegisteredRef.current) return;
    const parentMember = family.find(m => m.uid === authUser.uid);
    if (!parentMember || parentMember.role !== 'parent') return;

    pushRegisteredRef.current = true;
    registerForPushNotifications().then(async (token) => {
      if (!token) return;
      if (isSynced && familyId) {
        savePushToken(familyId, authUser.uid, token).catch(() => {});
      }
    });
  }, [loaded, authUser, familyId, family]);

  // ── Local data (guest mode) ────────────────────────────────────────────────
  async function loadLocalData() {
    try {
      const [fRaw, rRaw, uRaw, mpRaw] = await Promise.all([
        AsyncStorage.getItem(LOCAL_KEYS.FAMILY),
        AsyncStorage.getItem(LOCAL_KEYS.REQUESTS),
        AsyncStorage.getItem(LOCAL_KEYS.CURRENT_USER),
        AsyncStorage.getItem(LOCAL_KEYS.MEAL_PLANS),
      ]);
      if (fRaw) setFamily(JSON.parse(fRaw));
      if (rRaw) setRequests(JSON.parse(rRaw));
      if (uRaw) setCurrentUser(JSON.parse(uRaw));
      if (mpRaw) setMealPlans(JSON.parse(mpRaw));
    } catch (e) {
      console.log('Local load error', e);
    }
  }

  async function saveLocalRequests(updated) {
    setRequests(updated);
    await AsyncStorage.setItem(LOCAL_KEYS.REQUESTS, JSON.stringify(updated));
  }

  async function saveLocalFamily(updated) {
    setFamily(updated);
    await AsyncStorage.setItem(LOCAL_KEYS.FAMILY, JSON.stringify(updated));
  }

  // ── Notification helper ────────────────────────────────────────────────────
  // Guest mode: local notification (kid and Dad share one device).
  // Sync mode: Expo push to every parent member who has a token stored, skipping
  //            the current auth user so Dad doesn't notify himself.
  async function sendDadNotification(title, body) {
    if (!isSynced) {
      await scheduleLocalNotification(title, body);
      return;
    }
    const parents = family.filter(m => m.role === 'parent' && m.pushToken);
    for (const parent of parents) {
      if (parent.uid === authUser?.uid) continue;
      await sendExpoPushNotification(parent.pushToken, title, body);
    }
  }

  // ── Public API — automatically routes to Firestore or local ───────────────

  async function addRequest(req) {
    let newReq;
    if (isSynced && familyId) {
      await fbAddRequest(familyId, {
        ...req,
        fromId: authUser?.uid || req.fromId,
      });
    } else {
      newReq = { ...req, id: uuid.v4(), status: 'pending', createdAt: Date.now() };
      await saveLocalRequests([...requests, newReq]);
    }

    const title = `New request from ${req.fromName}`;
    let body;
    if (req.type === 'pickup') {
      body = `🚗 ${req.activity} at ${req.time}`;
    } else if (req.type === 'buy') {
      body = `🛒 ${req.item}`;
    } else {
      body = `💬 ${req.message || 'Check the app for details'}`;
    }
    await sendDadNotification(title, body);

    return newReq;
  }

  async function updateRequestStatus(id, status) {
    if (isSynced && familyId) {
      await fbUpdateStatus(familyId, id, status);
    } else {
      await saveLocalRequests(requests.map(r => r.id === id ? { ...r, status } : r));
    }
  }

  async function deleteRequest(id) {
    if (isSynced && familyId) {
      await fbDeleteRequest(familyId, id);
    } else {
      await saveLocalRequests(requests.filter(r => r.id !== id));
    }
  }

  async function addFamilyMember(name, role = 'telegram_user') {
    // app_user (full dashboard) shares parent orange (-1); telegram_user gets a rotating colour.
    const colorIndex = role === 'telegram_user'
      ? family.filter(f => f.role === 'telegram_user').length % 5
      : -1;
    if (isSynced && familyId) {
      const id = await addKidMember(familyId, name, colorIndex, role);
      return { id, name, role, colorIndex };
    } else {
      const member = { id: uuid.v4(), name, role, colorIndex };
      await saveLocalFamily([...family, member]);
      return member;
    }
  }

  async function switchUser(user) {
    setCurrentUser(user);
    await AsyncStorage.setItem(LOCAL_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  async function updateCurrentUserName(name) {
    const updated = { ...currentUser, name };
    setCurrentUser(updated);
    await AsyncStorage.setItem(LOCAL_KEYS.CURRENT_USER, JSON.stringify(updated));
    if (isSynced && familyId && authUser) {
      await updateMemberDoc(familyId, authUser.uid, { name });
    } else {
      const updatedFamily = family.map(m => m.id === currentUser.id ? { ...m, name } : m);
      await saveLocalFamily(updatedFamily);
    }
  }

  async function setMealDay(memberId, date, { lunch, dinner }) {
    const weekStart = getWeekStartDate(date);

    // Capture previous state before optimistic update (for notification diff)
    const prevDay = mealPlans[memberId]?.[weekStart]?.[date] || { lunch: false, dinner: false };

    // Optimistic local update (both modes respond instantly)
    const updated = {
      ...mealPlans,
      [memberId]: {
        ...mealPlans[memberId],
        [weekStart]: {
          ...(mealPlans[memberId]?.[weekStart] || {}),
          [date]: { lunch, dinner },
        },
      },
    };
    setMealPlans(updated);

    if (isSynced && familyId) {
      await fbSetMemberMeals(familyId, memberId, weekStart, updated[memberId][weekStart]);
    } else {
      await AsyncStorage.setItem(LOCAL_KEYS.MEAL_PLANS, JSON.stringify(updated));
    }

    // Notify Dad only when a meal is newly toggled ON (not off)
    const newMeals = [];
    if (lunch && !prevDay.lunch) newMeals.push('lunch');
    if (dinner && !prevDay.dinner) newMeals.push('dinner');

    if (newMeals.length > 0) {
      const member = family.find(m => m.id === memberId);
      const memberName = member?.name || 'Someone';
      const d = new Date(date + 'T00:00:00');
      const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayName = DAY_NAMES[(d.getDay() + 6) % 7]; // getDay: 0=Sun → index Mon=0
      await sendDadNotification(
        'Meal plan updated',
        `🍽️ ${memberName} will be home for ${newMeals.join(' & ')} on ${dayName}`
      );
    }
  }

  // ── Derived helpers ────────────────────────────────────────────────────────
  function getTodayRequests() {
    const today = toLocalDateStr(new Date());
    return requests
      .filter(r => r.type === 'pickup' && r.date === today)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  function getPendingBuyRequests() {
    return requests.filter(r => r.type === 'buy' && (!r.status || r.status === 'pending'));
  }

  return (
    <AppContext.Provider value={{
      authUser, familyId, isSynced, isPro, loaded,
      family, currentUser, switchUser, updateCurrentUserName,
      requests, addRequest, updateRequestStatus, deleteRequest,
      addFamilyMember, getTodayRequests, getPendingBuyRequests,
      mealPlans, setMealDay,
      favouritePlaces, addFavouritePlace, removeFavouritePlace,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
