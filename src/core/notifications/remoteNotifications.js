import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { requestNotificationPermissions } from './localNotifications';

/**
 * Register for remote push notifications (Dev builds / Prod only)
 */
export async function registerForPushNotificationsAsync() {
  let token = null;
  try {
    const hasPermissions = await requestNotificationPermissions();
    if (!hasPermissions) {
      console.warn('[RemoteNotifications] Notification permissions denied. Cannot fetch push token.');
      return null;
    }

    // Get EAS project ID (EAS config lookup)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('[RemoteNotifications] EAS Project ID not found. Ensure EAS configuration is set in app.json.');
    }

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('[RemoteNotifications] Successfully registered for remote push token:', token);
  } catch (err) {
    console.warn('[RemoteNotifications] Failed to fetch remote push token:', err.message);
  }

  return token;
}

/**
 * Register token listeners for push updates
 */
export function registerRemotePushListeners() {
  try {
    const subscription = Notifications.addPushTokenListener((token) => {
      console.log('[RemoteNotifications] Remote Push Token updated:', token.data);
    });

    return () => {
      subscription.remove();
    };
  } catch (err) {
    console.error('[RemoteNotifications] Error adding push token listener:', err);
    return () => {};
  }
}
