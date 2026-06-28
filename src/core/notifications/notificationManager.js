import Constants from 'expo-constants';

// Detect environment at module load
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Export everything from localNotifications directly so the codebase imports remain unchanged
export * from './localNotifications';

/**
 * Dynamic orchestrator for registering remote push notifications
 * (Runs only in Development Builds & Production; skipped in Expo Go)
 */
export async function registerForPushNotificationsAsync() {
  if (isExpoGo) {
    console.log('[NotificationManager] Skipping remote push token registration inside Expo Go client.');
    return null;
  }

  try {
    // Dynamic import to prevent evaluation of expo-notifications side effects on Expo Go
    const { registerForPushNotificationsAsync: registerRemote } = require('./remoteNotifications');
    return await registerRemote();
  } catch (err) {
    console.error('[NotificationManager] Error executing remote push registration:', err);
    return null;
  }
}

/**
 * Dynamic orchestrator to register both local and remote notification listeners
 */
export function registerNotificationListeners() {
  // 1. Register local event loggers
  const { registerLocalNotificationListeners } = require('./localNotifications');
  const unsubscribeLocal = registerLocalNotificationListeners();

  // 2. Register remote push token listeners only outside of Expo Go
  let unsubscribeRemote = () => {};
  if (!isExpoGo) {
    try {
      const { registerRemotePushListeners } = require('./remoteNotifications');
      unsubscribeRemote = registerRemotePushListeners();
    } catch (err) {
      console.error('[NotificationManager] Error registering remote push listeners:', err);
    }
  }

  return () => {
    unsubscribeLocal();
    unsubscribeRemote();
  };
}
