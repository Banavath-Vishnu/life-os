import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Pressable, ScrollView, Image, Alert } from 'react-native';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '../src/core/theme/theme';
import { initDb, selectAll } from '../src/core/db/sqlite';
import { useStore } from '../src/core/store/store';
import { 
  requestNotificationPermissions, 
  registerNotificationListeners,
  scheduleTaskNotifications,
  scheduleRoutineNotifications,
  registerForPushNotificationsAsync,
  cancelAllScheduledNotificationsAsync
} from '../src/core/notifications/notificationManager';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import Button from '../src/shared/components/Button';
import Input from '../src/shared/components/Input';
import KeyboardSafeView from '../src/shared/components/KeyboardSafeView';
import OnboardingStory from '../src/shared/components/OnboardingStory';
import BrandLogo from '../src/shared/components/BrandLogo';

// Prevent the splash screen from auto-hiding before database is fully initialized
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutContent() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, roundness } = theme;
  const [dbReady, setDbReady] = useState(false);
  const themeMode = useStore((state) => state.themeMode);
  const setThemeMode = useStore((state) => state.setThemeMode);
  const notificationsEnabled = useStore((state) => state.notificationsEnabled);
  const notificationSettings = useStore((state) => state.notificationSettings);
  const user = useStore((state) => state.user);
  const updateUser = useStore((state) => state.updateUser);

  // Onboarding Setup States
  const [onboardName, setOnboardName] = useState('');
  const [onboardBio, setOnboardBio] = useState('');
  const [onboardAvatar, setOnboardAvatar] = useState('https://static1.cbrimages.com/wordpress/wp-content/uploads/2024/03/batman-s-true-dcau-nemesis-was-never-the-joker.jpg');
  const [tempProfile, setTempProfile] = useState(null);
  const [showOnboardStory, setShowOnboardStory] = useState(false);

  const presetAvatars = [
    { name: 'You', url: onboardAvatar },
    { name: 'Batman', url: 'https://cdn.pixabay.com/photo/2024/01/15/11/36/batman-8510022_1280.png' },
    { name: 'Iron Man', url: 'https://tse3.mm.bing.net/th/id/OIP.n2Vn3H4FAAncuoao_EThgwHaHa?cb=thumbexptrt1&urlcheck=1&rs=1&pid=ImgDetMain&o=7&rm=3' },
    { name: 'Spiderman', url: 'https://tse2.mm.bing.net/th/id/OIP.B2dX4fxPIg16Tadw6yzu_AHaHa?cb=thumbexptrt1&urlcheck=1&rs=1&rs=1&pid=ImgDetMain&o=7&rm=3' },
    { name: 'Flying Jatt', url: 'https://cdn.mobygames.com/covers/2854610-a-flying-jatt-iphone-front-cover.jpg' },
    { name: 'Hulk', url: 'https://tse4.mm.bing.net/th/id/OIP.e3YeqE3Uekj-xoZX44UzUgHaF7?cb=thumbexptrt1&urlcheck=1&rs=1&pid=ImgDetMain&o=7&rm=3' },
    { name: 'Krrish', url: 'https://variety.com/wp-content/uploads/2013/11/krrish-3-pic.jpg' },
    { name: 'Natasha', url: 'https://i.pinimg.com/736x/7f/74/c9/7f74c9036e89a052dbcef55c57621c42.jpg' },
  ];

  const handleSelectLocalImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need storage permissions to let you select a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setOnboardAvatar(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Error picking image:', e);
      Alert.alert('Error', 'Failed to pick image from library.');
    }
  };

  const handleSaveProfile = () => {
    if (!onboardName.trim()) {
      Alert.alert('Validation Error', 'Please enter your name to initialize your workspace.');
      return;
    }
    setTempProfile({
      name: onboardName.trim(),
      bio: onboardBio.trim() || 'Optimizing lifestyle & productivity',
      avatar: onboardAvatar,
    });
    setShowOnboardStory(true);
  };

  const handleFinishStory = () => {
    setShowOnboardStory(false);
    if (tempProfile) {
      updateUser({ 
        name: tempProfile.name, 
        bio: tempProfile.bio, 
        avatar: tempProfile.avatar,
        isProfileSetup: true 
      });
    }
  };

  // Initialize DB and Notification Listeners on Startup
  useEffect(() => {
    let unsubscribeNotifications = () => {};
    async function startApp() {
      try {
        console.log('[StagHaus Root] Initializing database...');
        await initDb();
        
        // Request OS push notification permissions
        const hasPermissions = await requestNotificationPermissions();
        console.log('[StagHaus Root] OS Push notifications granted:', hasPermissions);
        
        // Start foreground & tap listeners
        unsubscribeNotifications = registerNotificationListeners();
        
        setDbReady(true);

        // Fetch remote push notification token (in Dev / Prod only, skipped in Expo Go).
        // Not awaited: a slow network must not hold the splash screen.
        registerForPushNotificationsAsync().catch((err) => {
          console.warn('[StagHaus Root] Push token registration failed:', err);
        });
      } catch (err) {
        console.error('[StagHaus Root] Failed to boot database or notification listeners:', err);
        // Allow app to continue
        setDbReady(true);
      }
    }
    startApp();
    return () => unsubscribeNotifications();
  }, []);

  // Hide splash screen once database and services are ready
  useEffect(() => {
    if (dbReady) {
      SplashScreen.hideAsync().catch((err) => {
        console.warn('[StagHaus Root] Error hiding splash screen:', err);
      });
    }
  }, [dbReady]);

  // Global Notification Rescheduler (re-fires when offsets or master switch changes)
  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;
    
    async function rescheduleAllAlerts() {
      try {
        // Clear everything first so alerts for deleted items don't linger
        await cancelAllScheduledNotificationsAsync();
        if (!notificationsEnabled || cancelled) {
          return;
        }

        console.log('[StagHaus Root] Master notifications active. Rescheduling all alerts...');
        
        // Query active tasks
        const allTasks = await selectAll("SELECT * FROM tasks WHERE status = 'pending'");
        for (const task of allTasks) {
          if (cancelled) return;
          await scheduleTaskNotifications(task, notificationSettings);
        }

        // Query routines
        const allRoutines = await selectAll("SELECT * FROM routine");
        for (const r of allRoutines) {
          if (cancelled) return;
          await scheduleRoutineNotifications(r, notificationSettings);
        }
        
        console.log('[StagHaus Root] Successfully scheduled tasks & routines.');
      } catch (err) {
        console.warn('[StagHaus Root] Rescheduling notification alerts failed:', err);
      }
    }
    
    rescheduleAllAlerts();
    return () => { cancelled = true; };
  }, [dbReady, notificationsEnabled, notificationSettings]);

  if (!dbReady) {
    // Keep splash screen visible until database is ready
    return null;
  }

  // Intercept boot flow for new users needing profile onboarding setup
  if (!user || !user.isProfileSetup) {
    return (
      <SafeAreaProvider style={{ backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <KeyboardSafeView style={{ backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={[styles.onboardScroll, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <View style={styles.onboardHeader}>
            <BrandLogo size={100} style={{ marginBottom: 16 }} />
            <Text style={[styles.onboardAppTitle, { color: isDark ? '#F4F4F5' : '#0F172A' }]}>
              Welcome to Stag<Text style={{ color: '#6366F1' }}>Haus</Text>
            </Text>
            <Text style={[styles.onboardAppSubtitle, { color: colors.textSecondary }]}>
              Let's personalize your quantified self workspace.
            </Text>
          </View>

          <View style={[styles.onboardCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={styles.avatarPreviewWrapper}>
              <Image 
                source={{ uri: onboardAvatar }} 
                style={[styles.avatarPreviewImg, { borderColor: colors.border }]} 
              />
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8, fontWeight: '600' }}>
                WORKSPACE AVATAR
              </Text>
            </View>

            <Input
              label="Your Name *"
              placeholder="e.g. Alex Mercer"
              value={onboardName}
              onChangeText={setOnboardName}
            />

            <Input
              label="Reason for being here (Optional)"
              placeholder="e.g. To build a multi-million dollar empire"
              value={onboardBio}
              onChangeText={setOnboardBio}
              style={{ marginTop: 12 }}
            />

            {/* Select Avatar presets */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>Choose Superhero Avatar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, marginBottom: 12 }}>
              {presetAvatars.map((item) => {
                const isSelected = onboardAvatar === item.url;
                return (
                  <Pressable 
                    key={item.name} 
                    onPress={() => setOnboardAvatar(item.url)}
                    style={[
                      styles.avatarPresetCard,
                      { borderColor: isSelected ? colors.primary : colors.border }
                    ]}
                  >
                    <Image source={{ uri: item.url }} style={styles.avatarPresetImg} />
                    <Text style={[styles.avatarPresetName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Button
              title="Select from Device Library"
              onPress={handleSelectLocalImage}
              variant="secondary"
              iconLeft={<Ionicons name="image-outline" size={18} color={colors.primary} />}
              style={{ marginBottom: 16 }}
            />

            <Button
              title="Launch Workspace 🚀"
              onPress={handleSaveProfile}
              variant="primary"
              style={{ marginTop: 8 }}
            />
          </View>
        </ScrollView>
        </KeyboardSafeView>

        <OnboardingStory 
          isVisible={showOnboardStory} 
          onClose={handleFinishStory} 
          isForceWatch={true}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: theme.colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  // Wrap application in ThemeProvider
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandingWrapper: {
    alignItems: 'center',
  },
  splashTitle: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  splashSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  onboardScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  onboardHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  onboardAppTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  onboardAppSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  onboardCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarPreviewWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPreviewImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  avatarPresetCard: {
    width: 70,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 6,
    backgroundColor: 'transparent',
  },
  avatarPresetImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 4,
  },
  avatarPresetName: {
    fontSize: 9,
    fontWeight: '600',
  },
});
