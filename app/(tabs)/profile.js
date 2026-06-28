import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Switch, Alert, Modal, TextInput, Pressable, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme } from '../../src/core/theme/theme';
import { useStore } from '../../src/core/store/store';
import Card from '../../src/shared/components/Card';
import Button from '../../src/shared/components/Button';
import { runQuery } from '../../src/core/db/sqlite';
import OnboardingStory from '../../src/shared/components/OnboardingStory';

export default function ProfileScreen() {
  const { theme, isDark, toggleTheme, setThemeMode } = useTheme();
  const { colors, spacing, typography, roundness } = theme;

  const user = useStore((state) => state.user);
  const updateUser = useStore((state) => state.updateUser);

  const notificationsEnabled = useStore((state) => state.notificationsEnabled);
  const toggleNotifications = useStore((state) => state.toggleNotifications);
  const notificationSettings = useStore((state) => state.notificationSettings);
  const updateNotificationSettings = useStore((state) => state.updateNotificationSettings);

  const themeMode = useStore((state) => state.themeMode);
  const setThemeModeStore = useStore((state) => state.setThemeMode);

  // Zustand version triggers
  const triggerTasksUpdate = useStore((state) => state.triggerTasksUpdate);
  const triggerNotesUpdate = useStore((state) => state.triggerNotesUpdate);
  const triggerProgressUpdate = useStore((state) => state.triggerProgressUpdate);
  const triggerRoutineUpdate = useStore((state) => state.triggerRoutineUpdate);
  const triggerExpensesUpdate = useStore((state) => state.triggerExpensesUpdate);
  const triggerTargetsUpdate = useStore((state) => state.triggerTargetsUpdate);
  const triggerNotificationsUpdate = useStore((state) => state.triggerNotificationsUpdate);

  const superheroUrls = [
    'https://cdn.pixabay.com/photo/2024/01/15/11/36/batman-8510022_1280.png',
    'https://tse3.mm.bing.net/th/id/OIP.n2Vn3H4FAAncuoao_EThgwHaHa?cb=thumbexptrt1&urlcheck=1&rs=1&pid=ImgDetMain&o=7&rm=3',
    'https://tse2.mm.bing.net/th/id/OIP.B2dX4fxPIg16Tadw6yzu_AHaHa?cb=thumbexptrt1&urlcheck=1&rs=1&pid=ImgDetMain&o=7&rm=3',
    'https://live.staticflickr.com/8008/7122168053_bbdbdc3a38_b.jpg',
    'https://tse4.mm.bing.net/th/id/OIP.e3YeqE3Uekj-xoZX44UzUgHaF7?cb=thumbexptrt1&urlcheck=1&rs=1&pid=ImgDetMain&o=7&rm=3',
    'https://variety.com/wp-content/uploads/2013/11/krrish-3-pic.jpg',
    'https://i.pinimg.com/736x/7f/74/c9/7f74c9036e89a052dbcef55c57621c42.jpg'
  ];

  // Profile Edit Modal States
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isStoryModalVisible, setIsStoryModalVisible] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio);
  const [editAvatar, setEditAvatar] = useState(user.avatar || '');
  const [customUserAvatar, setCustomUserAvatar] = useState(() => {
    return superheroUrls.includes(user.avatar) ? '' : (user.avatar || '');
  });
  const [customTypedUrl, setCustomTypedUrl] = useState(() => {
    const isWebLink = !!user.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://'));
    const isSuperhero = superheroUrls.includes(user.avatar);
    return (isWebLink && !isSuperhero) ? user.avatar : '';
  });

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
        const pickedUri = result.assets[0].uri;
        setEditAvatar(pickedUri);
        setCustomUserAvatar(pickedUri);
        setCustomTypedUrl(''); // Don't show local path in input box
      }
    } catch (e) {
      console.warn('Error picking image:', e);
      Alert.alert('Error', 'Failed to pick image from library.');
    }
  };

  const handleToggleThemeSwitch = () => {
    const nextMode = isDark ? 'light' : 'dark';
    setThemeModeStore(nextMode);
    setThemeMode(nextMode);
  };

  const handleToggleNotifications = async (value) => {
    try {
      toggleNotifications();

      if (!value) {
        // Clear SQLite notifications history logs
        await runQuery('DELETE FROM notifications');
        triggerNotificationsUpdate();
        console.log('[Profile] Master push notifications disabled. Notifications log database cleared.');
      }
    } catch (err) {
      console.warn('[Profile] Failed to empty notification history logs:', err);
    }
  };

  const handleClearDatabase = () => {
    Alert.alert(
      'Reset App Data',
      'This will erase all Tasks, Notes, and Progress logs from the SQLite database. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Database',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete SQLite records
              await runQuery('DELETE FROM tasks');
              await runQuery('DELETE FROM notes');
              await runQuery('DELETE FROM progress_logs');
              await runQuery('DELETE FROM routine');
              await runQuery('DELETE FROM routine_logs');
              await runQuery('DELETE FROM expenses');
              await runQuery('DELETE FROM targets');

              // Trigger screen updates
              triggerTasksUpdate();
              triggerNotesUpdate();
              triggerProgressUpdate();
              triggerRoutineUpdate();
              triggerExpensesUpdate();
              triggerTargetsUpdate();

              Alert.alert('Success', 'All database tables cleared successfully.');
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to reset tables.');
            }
          },
        },
      ]
    );
  };

  const openProfileEdit = () => {
    setEditName(user.name);
    setEditBio(user.bio);
    setEditAvatar(user.avatar || '');
    setCustomUserAvatar(superheroUrls.includes(user.avatar) ? '' : (user.avatar || ''));
    const isWebLink = !!user.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://'));
    const isSuperhero = superheroUrls.includes(user.avatar);
    setCustomTypedUrl((isWebLink && !isSuperhero) ? user.avatar : '');
    setIsProfileModalVisible(true);
  };

  const handleSaveProfile = () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Profile name cannot be empty.');
      return;
    }
    updateUser({ name: editName, bio: editBio, avatar: editAvatar || null });
    setIsProfileModalVisible(false);
    Alert.alert('Success', 'Profile updated successfully.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Screen Title */}
        <Text
          style={[
            styles.screenTitle,
            {
              color: colors.text,
              fontSize: typography.sizes.xxl,
              fontFamily: theme.typography.fontFamily.bold,
              marginTop: 40,
              marginBottom: spacing.lg,
            },
          ]}
        >
          Settings
        </Text>

        {/* User Card (Pressable to Edit) */}
        <Pressable onPress={openProfileEdit}>
          <Card style={styles.profileCard} glass>
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary, overflow: 'hidden' }]}>
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarText, { color: '#FFFFFF', fontFamily: theme.typography.fontFamily.bold }]}>
                    {user.name.split(' ').map((n) => n[0]).join('')}
                  </Text>
                )}
              </View>
              <View style={styles.userMetadata}>
                <View style={styles.nameHeaderRow}>
                  <Text style={[styles.name, { color: colors.text, fontSize: typography.sizes.lg, fontFamily: theme.typography.fontFamily.bold }]}>
                    {user.name}
                  </Text>
                  <Ionicons name="create-outline" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
                </View>
                <Text style={[styles.bio, { color: colors.textSecondary, fontSize: typography.sizes.xs, fontFamily: theme.typography.fontFamily.regular }]}>
                  {user.bio}
                </Text>
                <Text style={[styles.joinedText, { color: colors.textMuted, fontSize: 10, marginTop: 4 }]}>
                  Joined LifeOS in {new Date(user.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
              </View>
            </View>
          </Card>
        </Pressable>

        {/* General Settings */}
        <Text style={[styles.sectionHeader, { color: colors.text, fontSize: typography.sizes.md, fontFamily: theme.typography.fontFamily.bold }]}>
          Preferences
        </Text>

        <Card style={styles.settingsGroupCard}>
          {/* Theme Preference Segment Selector */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={[styles.settingLabelWrapper, { marginBottom: 10 }]}>
              <Ionicons name="sunny-outline" size={20} color={colors.primary} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.sizes.md }]}>
                Theme Preference
              </Text>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: roundness.md, padding: 3 }}>
              {['system', 'light', 'dark'].map((mode) => {
                const isSelected = themeMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      setThemeModeStore(mode);
                      setThemeMode(mode);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: roundness.md - 2,
                      backgroundColor: isSelected ? colors.surface : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isSelected ? colors.primary : colors.textSecondary
                    }}>
                      {mode === 'system' ? 'System (Time)' : mode.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Notifications toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelWrapper}>
              <Ionicons name="notifications-outline" size={20} color={colors.secondary} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.sizes.md }]}>
                Push Notifications
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </Card>

        {/* Notification Offsets Settings */}
        <Text style={[styles.sectionHeader, { color: colors.text, fontSize: typography.sizes.md, fontFamily: theme.typography.fontFamily.bold, marginTop: spacing.md }, !notificationsEnabled && { opacity: 0.5 }]}>
          Notification Alerts
        </Text>

        <Card style={[styles.settingsGroupCard, !notificationsEnabled && { opacity: 0.45 }]} pointerEvents={notificationsEnabled ? 'auto' : 'none'}>
          {/* Routine Alerts Offset Selector */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.sizes.sm, marginBottom: 8 }]}>
              Routine Reminder Offset
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: roundness.md, padding: 3 }}>
              {[
                { label: 'Off', value: null },
                { label: '0m', value: 0 },
                { label: '5m', value: 5 },
                { label: '15m', value: 15 },
                { label: '30m', value: 30 }
              ].map((opt) => {
                const isSelected = notificationSettings.routineOffset === opt.value;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => updateNotificationSettings({ routineOffset: opt.value })}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      borderRadius: roundness.md - 2,
                      backgroundColor: isSelected ? colors.surface : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: isSelected ? colors.primary : colors.textSecondary }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Routine End At Time Toggle */}
          <View style={[styles.settingRow, { borderColor: colors.border, borderBottomWidth: 1, paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 0, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}>
            <View style={[styles.settingLabelWrapper, { flexDirection: 'row', alignItems: 'center' }]}>
              <Ionicons name="notifications-circle-outline" size={20} color={colors.secondary} style={[styles.settingIcon, { marginRight: 8 }]} />
              <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.sizes.sm }]}>
                Notify at Routine End Time
              </Text>
            </View>
            <Switch
              value={notificationSettings.routineEndAtTime}
              onValueChange={(val) => updateNotificationSettings({ routineEndAtTime: val })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Task Start Offset Selector */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.sizes.sm, marginBottom: 8 }]}>
              Task Start Reminder Offset
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: roundness.md, padding: 3 }}>
              {[
                { label: 'Off', value: null },
                { label: '0m', value: 0 },
                { label: '5m', value: 5 },
                { label: '15m', value: 15 },
                { label: '30m', value: 30 }
              ].map((opt) => {
                const isSelected = notificationSettings.taskStartOffset === opt.value;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => updateNotificationSettings({ taskStartOffset: opt.value })}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      borderRadius: roundness.md - 2,
                      backgroundColor: isSelected ? colors.surface : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: isSelected ? colors.primary : colors.textSecondary }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Task End At Time Toggle */}
          <View style={[styles.settingRow, { borderColor: colors.border }]}>
            <View style={styles.settingLabelWrapper}>
              <Ionicons name="notifications-circle-outline" size={20} color={colors.secondary} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.sizes.md }]}>
                Notify at Task End Time
              </Text>
            </View>
            <Switch
              value={notificationSettings.taskEndAtTime}
              onValueChange={(val) => updateNotificationSettings({ taskEndAtTime: val })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Task End Offset Selector */}
          <View style={{ padding: 16 }}>
            <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.sizes.sm, marginBottom: 8 }]}>
              Before Task Ends Warning Offset
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: roundness.md, padding: 3 }}>
              {[
                { label: 'Off', value: null },
                { label: '0m', value: 0 },
                { label: '5m', value: 5 },
                { label: '10m', value: 10 },
                { label: '15m', value: 15 }
              ].map((opt) => {
                const isSelected = notificationSettings.taskEndOffset === opt.value;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => updateNotificationSettings({ taskEndOffset: opt.value })}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      borderRadius: roundness.md - 2,
                      backgroundColor: isSelected ? colors.surface : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: isSelected ? colors.primary : colors.textSecondary }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        {/* App Story */}
        <Text style={[styles.sectionHeader, { color: colors.text, fontSize: typography.sizes.md, fontFamily: theme.typography.fontFamily.bold, marginTop: spacing.md }]}>
          Creation Story
        </Text>

        <Card style={styles.settingsGroupCard}>
          <Pressable 
            onPress={() => setIsStoryModalVisible(true)}
            style={({ pressed }) => [
              styles.settingRow, 
              pressed && { backgroundColor: `${colors.primary}10` }
            ]}
          >
            <View style={styles.settingLabelWrapper}>
              <Ionicons name="book-outline" size={20} color={colors.primary} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.sizes.md }]}>
                View Creation Story
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* Danger Zone */}
        <Text style={[styles.sectionHeader, { color: colors.error, fontSize: typography.sizes.md, fontFamily: theme.typography.fontFamily.bold }]}>
          Danger Zone
        </Text>

        <Card style={[styles.dangerCard, { borderColor: `${colors.error}30`, backgroundColor: `${colors.error}05` }]}>
          <Text style={[styles.dangerTitle, { color: colors.error, fontSize: typography.sizes.sm, fontFamily: theme.typography.fontFamily.bold }]}>
            System Maintenance
          </Text>
          <Text style={[styles.dangerDesc, { color: colors.textSecondary, fontSize: typography.sizes.xs }]}>
            Resetting database tables will delete all recorded progress logs, checklists, and notes saved locally.
          </Text>
          <Button
            title="Erase Your Data"
            onPress={handleClearDatabase}
            variant="danger"
            size="sm"
            style={styles.clearBtn}
          />
        </Card>

        {/* Footer Branding */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted, fontSize: 10 }]}>
            LifeOS Version 1.0.0
          </Text>
          <Text style={[styles.footerTextSub, { color: colors.textMuted, fontSize: 10 }]}>
            For Ultra-Premium HomoSepians
          </Text>
          <Text style={[styles.footerTextSub, { color: colors.textMuted, fontSize: 10 }]}>
            Made with ❤️ by Vishnu
          </Text>
        </View>
      </ScrollView>

      <OnboardingStory 
        isVisible={isStoryModalVisible} 
        onClose={() => setIsStoryModalVisible(false)} 
      />

      {/* Edit Profile Modal */}
      <Modal visible={isProfileModalVisible} animationType="slide" presentationStyle="overFullScreen">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <Pressable onPress={() => setIsProfileModalVisible(false)} style={styles.modalCloseBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              Edit User Profile
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={[styles.modalScroll, { padding: spacing.lg }]} showsVerticalScrollIndicator={false}>
            {/* User Name */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Full Name</Text>
            <TextInput
              style={[
                styles.titleInput,
                {
                  color: colors.text,
                  fontFamily: theme.typography.fontFamily.bold,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: roundness.md,
                  padding: spacing.md,
                },
              ]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Name"
              placeholderTextColor={colors.textMuted}
            />

            {/* User Bio */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Reason for being here</Text>
            <TextInput
              style={[
                styles.contentInput,
                {
                  color: colors.text,
                  fontFamily: theme.typography.fontFamily.regular,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: roundness.md,
                  padding: spacing.md,
                },
              ]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Reason for being here..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            {/* Pick from Local Storage Button */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Upload Profile Photo</Text>
            <Button
              title="Select from Device Library"
              onPress={handleSelectLocalImage}
              variant="secondary"
              iconLeft={<Ionicons name="image-outline" size={18} color={colors.primary} />}
              style={{ marginBottom: spacing.sm }}
            />

            {/* Profile Image Preset Grid */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Choose Your Avatar</Text>
            <View style={[styles.avatarPresetsGrid, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }]}>
              {[
                { name: 'Batman', url: 'https://cdn.pixabay.com/photo/2024/01/15/11/36/batman-8510022_1280.png' },
                { name: 'Iron Man', url: 'https://tse3.mm.bing.net/th/id/OIP.n2Vn3H4FAAncuoao_EThgwHaHa?cb=thumbexptrt1&urlcheck=1&rs=1&pid=ImgDetMain&o=7&rm=3' },
                { name: 'Spiderman', url: 'https://tse2.mm.bing.net/th/id/OIP.B2dX4fxPIg16Tadw6yzu_AHaHa?cb=thumbexptrt1&urlcheck=1&rs=1&rs=1&pid=ImgDetMain&o=7&rm=3' },
                { name: 'Flying Jatt', url: 'https://cdn.mobygames.com/covers/2854610-a-flying-jatt-iphone-front-cover.jpg' },
                { name: 'Hulk', url: 'https://tse4.mm.bing.net/th/id/OIP.e3YeqE3Uekj-xoZX44UzUgHaF7?cb=thumbexptrt1&urlcheck=1&rs=1&pid=ImgDetMain&o=7&rm=3' },
                { name: 'Krrish', url: 'https://variety.com/wp-content/uploads/2013/11/krrish-3-pic.jpg' },
                { name: 'Natasha', url: 'https://i.pinimg.com/736x/7f/74/c9/7f74c9036e89a052dbcef55c57621c42.jpg' },
                { name: 'You', url: customUserAvatar || 'https://static1.cbrimages.com/wordpress/wp-content/uploads/2024/03/batman-s-true-dcau-nemesis-was-never-the-joker.jpg' }
              ].map((hero) => {
                const isPresetSelected = hero.name === 'You'
                  ? (editAvatar === hero.url || (!!editAvatar && !superheroUrls.includes(editAvatar)))
                  : (editAvatar === hero.url);
                return (
                  <View key={hero.name} style={{ width: '23%', alignItems: 'center', marginBottom: 12, marginRight: '2%' }}>
                    <Pressable
                      onPress={() => {
                        const targetUrl = hero.name === 'You'
                          ? (customUserAvatar || 'https://static1.cbrimages.com/wordpress/wp-content/uploads/2024/03/batman-s-true-dcau-nemesis-was-never-the-joker.jpg')
                          : hero.url;
                        setEditAvatar(targetUrl);
                      }}
                      style={[
                        styles.avatarPresetChip,
                        { borderColor: isPresetSelected ? colors.primary : colors.border, width: 60, height: 60, borderRadius: 30, overflow: 'hidden', marginRight: 0, marginBottom: 0 }
                      ]}
                    >
                      <Image source={{ uri: hero.url }} style={[styles.presetImage, { width: '100%', height: '100%' }]} />
                      {isPresetSelected && (
                        <View style={[styles.presetCheckmark, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        </View>
                      )}
                    </Pressable>
                    <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 4, textAlign: 'center', fontFamily: theme.typography.fontFamily.medium }}>
                      {hero.name}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Custom URL Input */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Or Custom Image URL</Text>
            <TextInput
              style={[
                styles.titleInput,
                {
                  color: colors.text,
                  fontFamily: theme.typography.fontFamily.regular,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: roundness.md,
                  padding: spacing.md,
                },
              ]}
              value={editAvatar}
              onChangeText={(text) => {
                setEditAvatar(text);
                if (!superheroUrls.includes(text)) {
                  setCustomUserAvatar(text);
                }
              }}
              placeholder="https://example.com/avatar.jpg"
              placeholderTextColor={colors.textMuted}
            />

            <Button
              title="Save Profile"
              onPress={handleSaveProfile}
              variant="primary"
              style={{ marginTop: spacing.xl }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenTitle: {
    fontWeight: '800',
  },
  profileCard: {
    marginBottom: 28,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  userMetadata: {
    flex: 1,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontWeight: '700',
  },
  bio: {
    marginTop: 2,
    lineHeight: 16,
  },
  joinedText: {
    fontWeight: '500',
  },
  sectionHeader: {
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 10,
  },
  settingsGroupCard: {
    padding: 0,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontWeight: '500',
  },
  dangerCard: {
    borderWidth: 1.5,
    padding: 16,
  },
  dangerTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  dangerDesc: {
    lineHeight: 16,
    marginBottom: 16,
  },
  clearBtn: {
    alignSelf: 'flex-start',
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: 20,
  },
  footerText: {
    fontWeight: '600',
  },
  footerTextSub: {
    fontWeight: '500',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginTop: 40,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalScroll: {
    paddingBottom: 80,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleInput: {
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 8,
  },
  contentInput: {
    borderWidth: 1,
    fontSize: 14,
    minHeight: 100,
  },
  modalCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalCategoryBadge: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCategoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginTop: 8,
  },
  avatarPresetChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    marginRight: 10,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  presetCheckmark: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
