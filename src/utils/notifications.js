// src/utils/notifications.js
// Expo push + local notification helpers for Dadboard.
//
// Guest mode:  scheduleLocalNotification — same device, no token needed.
// Sync mode:   sendExpoPushNotification  — sends via Expo's push gateway to Dad's device.
//              Push token is registered on the parent's device and stored in their Firestore
//              member doc so kid devices can look it up and send to it.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Show alerts + sound even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Returns the Expo push token string, or null if permission denied / not a physical device.
export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data;
  } catch {
    return null;
  }
}

// Deliver a notification immediately on this device (used in guest / single-device mode).
export async function scheduleLocalNotification(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

// Send a push notification to another device via Expo's push gateway.
export async function sendExpoPushNotification(expoPushToken, title, body) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: expoPushToken, title, body, sound: 'default' }),
    });
  } catch (e) {
    console.log('Push send error', e);
  }
}
