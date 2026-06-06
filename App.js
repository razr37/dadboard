// App.js — Dadboard root
//
// Boot sequence:
//   1. Check Firebase auth state
//   2. If no auth → show AuthScreen
//   3. If authed → check consent
//   4. If no consent → show ConsentScreen
//   5. If consented → show main app (Dad view or Kid view based on role)

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

// Dismiss the native splash immediately when the JS bundle loads.
// The brand-colour background in app.json ensures any unavoidable flash
// is orange rather than the default geometric pattern.
SplashScreen.hideAsync();
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AppProvider, useApp } from './src/context/AppContext';
import { colors } from './src/utils/theme';
import { onAuthStateChanged, redeemMemberInvite, auth } from './src/utils/firebase';

GoogleSignin.configure({
  webClientId: '382739338353-7nbkslk96dq28j51ae4ns1bt0jb9h8g9.apps.googleusercontent.com',
});

import AuthScreen from './src/screens/AuthScreen';
import ConsentScreen from './src/screens/ConsentScreen';
import DadHomeScreen from './src/screens/DadHomeScreen';
import KidHomeScreen from './src/screens/KidHomeScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import ShoppingScreen from './src/screens/ShoppingScreen';
import AddRequestScreen from './src/screens/AddRequestScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SwitchUserScreen from './src/screens/SwitchUserScreen';
import InviteScreen from './src/screens/InviteScreen';
import PrivacySettingsScreen from './src/screens/PrivacySettingsScreen';
import MealsScreen from './src/screens/MealsScreen';
import ProUpgradeScreen from './src/screens/ProUpgradeScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function DadTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8, paddingTop: 6, height: 64,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Today: focused ? 'home' : 'home-outline',
            Schedule: focused ? 'calendar' : 'calendar-outline',
            Shopping: focused ? 'bag' : 'bag-outline',
            Meals: focused ? 'restaurant' : 'restaurant-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Today" component={DadHomeScreen} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Shopping" component={ShoppingScreen} />
      <Tab.Screen name="Meals" component={MealsScreen} />
    </Tab.Navigator>
  );
}

function KidMain() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="KidHome" component={KidHomeScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { currentUser, loaded } = useApp();

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isParent = currentUser?.role === 'parent'
    || currentUser?.role === 'app_user';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isParent
        ? <Stack.Screen name="DadMain" component={DadTabs} />
        : <Stack.Screen name="KidMain" component={KidMain} />
      }
      <Stack.Screen name="AddRequest" component={AddRequestScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SwitchUser" component={SwitchUserScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Invite" component={InviteScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ProUpgrade" component={ProUpgradeScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="Shopping" component={ShoppingScreen} />
    </Stack.Navigator>
  );
}

// Extract member magic-link token from dadboard://join?invite=TOKEN
// The regex matches ?invite= in any URL scheme, so it works for both
// dadboard:// (custom scheme, used by invite links) and https:// fallback.
function parseMemberToken(url) {
  if (!url) return null;
  try {
    const match = url.match(/[?&]invite=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

function Root() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [consented, setConsented] = useState(false);
  // linkChecked gates the auth listener so we redeem any member token BEFORE
  // the listener fires — preventing a flash of AuthScreen on magic-link opens.
  const [linkChecked, setLinkChecked] = useState(false);

  // Phase 1 — check deep link and redeem member token if present.
  useEffect(() => {
    async function checkDeepLink() {
      const url = await Linking.getInitialURL();
      const token = parseMemberToken(url);
      if (token && !auth.currentUser) {
        try {
          await redeemMemberInvite(token);
        } catch (e) {
          Alert.alert('Invalid invite', e.message);
        }
      }
      setLinkChecked(true);
    }
    checkDeepLink();

    // Foreground deep links (app already open)
    const sub = Linking.addEventListener('url', async ({ url }) => {
      const token = parseMemberToken(url);
      if (token && !auth.currentUser) {
        redeemMemberInvite(token).catch(e => Alert.alert('Invalid invite', e.message));
      }
    });
    return () => sub.remove();
  }, []);

  // Phase 2 — auth listener starts only after the deep-link check completes.
  useEffect(() => {
    if (!linkChecked) return;
    const unsub = onAuthStateChanged(async (user) => {
      setAuthed(!!user);
      if (user) {
        // Debug: log AsyncStorage state so consent regressions are visible in Metro
        const allKeys = await AsyncStorage.getAllKeys();
        const consentVal = await AsyncStorage.getItem('dadboard_consented');
        console.log('[Auth] AsyncStorage keys:', allKeys);
        console.log('[Auth] dadboard_consented:', consentVal);
        setConsented(consentVal === 'yes');
      }
      setReady(true);
    });
    return unsub;
  }, [linkChecked]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!authed) {
    return (
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (!consented) {
    return (
      <>
        <StatusBar style="dark" />
        <ConsentScreen onAccept={() => {
          AsyncStorage.setItem('dadboard_consented', 'yes');
          setConsented(true);
        }} />
      </>
    );
  }

  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}

export default function App() {
  return <Root />;
}
