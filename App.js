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
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Dismiss the native splash immediately when the JS bundle loads.
// The brand-colour background in app.json ensures any unavoidable flash
// is orange rather than the default geometric pattern.
SplashScreen.hideAsync();
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { AppProvider, useApp } from './src/context/AppContext';
import { colors } from './src/utils/theme';
import { onAuthStateChanged } from './src/utils/firebase';
import { hasConsented } from './src/screens/ConsentScreen';

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

function KidTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border, borderTopWidth: 1,
          paddingBottom: 8, paddingTop: 6, height: 64,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) =>
          <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />,
      }}
    >
      <Tab.Screen name="Home" component={KidHomeScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator({ consentGiven, onConsentAccepted }) {
  const { currentUser, loaded } = useApp();

  if (!consentGiven) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Consent">
          {() => <ConsentScreen onAccept={onConsentAccepted} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isParent = currentUser?.role === 'parent'
    || currentUser?.role === 'spouse'
    || currentUser?.role === 'adult';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isParent
        ? <Stack.Screen name="DadMain" component={DadTabs} />
        : <Stack.Screen name="KidMain" component={KidTabs} />
      }
      <Stack.Screen name="AddRequest" component={AddRequestScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SwitchUser" component={SwitchUserScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Invite" component={InviteScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="Shopping" component={ShoppingScreen} />
      <Stack.Screen name="Consent">
        {() => <ConsentScreen onAccept={onConsentAccepted} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function Root() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [consentGiven, setConsentGiven] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      setIsAuthed(!!user);
      if (user) {
        const consented = await hasConsented();
        setConsentGiven(consented);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  if (!authChecked || consentGiven === null && isAuthed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Not authenticated → show auth screen outside of AppProvider
  if (!isAuthed) {
    return (
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator
          consentGiven={consentGiven}
          onConsentAccepted={() => setConsentGiven(true)}
        />
      </NavigationContainer>
    </AppProvider>
  );
}

export default function App() {
  return <Root />;
}
