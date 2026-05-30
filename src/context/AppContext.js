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
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import {
  onAuthStateChanged, getFamilyId,
  subscribeToMembers, subscribeToRequests,
  addRequest as fbAddRequest,
  updateRequestStatus as fbUpdateStatus,
  deleteRequest as fbDeleteRequest,
  addKidMember,
  subscribeMealPlans, setMemberMeals as fbSetMemberMeals,
  savePushToken,
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
};

function getWeekStartDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split('T')[0];
}

const SEED_FAMILY = [
  { id: 'dad', name: 'Dad', role: 'parent', colorIndex: -1 },
  { id: 'kid1', name: 'Ethan', role: 'kid', colorIndex: 0 },
  { id: 'kid2', name: 'Ryan', role: 'kid', colorIndex: 1 },
  { id: 'kid3', name: 'Mia', role: 'kid', colorIndex: 2 },
];

const SEED_REQUESTS = [
  { id: 'r1', type: 'pickup', fromId: 'kid1', fromName: 'Ethan', colorIndex: 0, activity: 'Maths tuition', date: new Date().toISOString().split('T')[0], time: '15:30', location: 'Peirce Rd, Novena', dropTo: 'Home', note: 'Class ends at 3:30 sharp', status: 'pending', createdAt: Date.now() },
  { id: 'r2', type: 'pickup', fromId: 'kid2', fromName: 'Ryan', colorIndex: 1, activity: 'Swimming', date: new Date().toISOString().split('T')[0], time: '17:00', location: 'SAFRA Yishun', dropTo: 'Home', note: '', status: 'pending', createdAt: Date.now() },
  { id: 'r3', type: 'pickup', fromId: 'kid3', fromName: 'Mia', colorIndex: 2, activity: 'Piano', date: new Date().toISOString().split('T')[0], time: '13:00', location: 'Ang Mo Kio CC', dropTo: 'Home', note: '', status: 'done', createdAt: Date.now() },
  { id: 'r4', type: 'buy', fromId: 'kid1', fromName: 'Ethan', colorIndex: 0, item: 'Milo tins (2x)', urgency: 'this weekend', note: '', status: 'pending', createdAt: Date.now() },
  { id: 'r5', type: 'buy', fromId: 'kid2', fromName: 'Ryan', colorIndex: 1, item: 'New swimming goggles', urgency: 'ASAP', note: 'Speedo brand preferred', status: 'pending', createdAt: Date.now() },
];

export function AppProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);       // Firebase user
  const [familyId, setFamilyId] = useState(null);       // Firestore familyId (null = guest)
  const [family, setFamily] = useState(SEED_FAMILY);
  const [requests, setRequests] = useState(SEED_REQUESTS);
  const [currentUser, setCurrentUser] = useState(SEED_FAMILY[0]);
  const [loaded, setLoaded] = useState(false);
  const [isSynced, setIsSynced] = useState(false);      // true = using Firestore
  const [mealPlans, setMealPlans] = useState({});       // { [memberId]: { [weekStart]: { [date]: { lunch, dinner } } } }

  const unsubscribeMembers = useRef(null);
  const unsubscribeRequests = useRef(null);
  const unsubscribeMealPlans = useRef(null);
  const pushRegisteredRef = useRef(false);

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      setAuthUser(user);

      if (!user) {
        // Signed out — load local data
        await loadLocalData();
        setIsSynced(false);
        setLoaded(true);
        return;
      }

      // Check for Firestore family
      const fid = await getFamilyId();
      if (fid) {
        setFamilyId(fid);
        setIsSynced(true);
        attachFirestoreListeners(fid);
      } else {
        // Authenticated but no family yet (e.g. just created account)
        await loadLocalData();
        setIsSynced(false);
      }
      setLoaded(true);
    });
    return unsub;
  }, []);

  // ── Firestore real-time listeners ──────────────────────────────────────────
  function attachFirestoreListeners(fid) {
    // Unsubscribe any previous listeners
    unsubscribeMembers.current?.();
    unsubscribeRequests.current?.();
    unsubscribeMealPlans.current?.();

    unsubscribeMembers.current = subscribeToMembers(fid, (members) => {
      setFamily(members);
      // Restore currentUser from updated members
      setCurrentUser(prev => {
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
      unsubscribeMembers.current?.();
      unsubscribeRequests.current?.();
      unsubscribeMealPlans.current?.();
    };
  }, []);

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

  async function addFamilyMember(name) {
    const colorIndex = family.filter(f => f.role === 'kid').length % 5;
    if (isSynced && familyId) {
      await addKidMember(familyId, name, colorIndex);
    } else {
      const member = { id: uuid.v4(), name, role: 'kid', colorIndex };
      await saveLocalFamily([...family, member]);
      return member;
    }
  }

  async function switchUser(user) {
    setCurrentUser(user);
    await AsyncStorage.setItem(LOCAL_KEYS.CURRENT_USER, JSON.stringify(user));
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
    const today = new Date().toISOString().split('T')[0];
    return requests
      .filter(r => r.type === 'pickup' && r.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function getPendingBuyRequests() {
    return requests.filter(r => r.type === 'buy' && r.status === 'pending');
  }

  return (
    <AppContext.Provider value={{
      authUser, familyId, isSynced, loaded,
      family, currentUser, switchUser,
      requests, addRequest, updateRequestStatus, deleteRequest,
      addFamilyMember, getTodayRequests, getPendingBuyRequests,
      mealPlans, setMealDay,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
