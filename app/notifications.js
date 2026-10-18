import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/core/theme/theme';
import { useStore } from '../src/core/store/store';
import Card from '../src/shared/components/Card';
import Button from '../src/shared/components/Button';
import EmptyState from '../src/shared/components/EmptyState';
import LoadingState from '../src/shared/components/LoadingState';
import { selectAll, runQuery } from '../src/core/db/sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '../src/shared/components/BrandLogo';

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, roundness } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const notificationsVersion = useStore((state) => state.notificationsVersion);
  const triggerNotificationsUpdate = useStore((state) => state.triggerNotificationsUpdate);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      const data = await selectAll('SELECT * FROM notifications ORDER BY timestamp DESC');
      setNotifications(data || []);
    } catch (e) {
      console.warn('[NotificationsScreen] Error loading database: ', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [notificationsVersion]);

  const markAllRead = async () => {
    try {
      await runQuery('UPDATE notifications SET read = 1');
      triggerNotificationsUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const clearAllNotifications = async () => {
    Alert.alert('Clear History', 'Are you sure you want to clear your notification history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            await runQuery('DELETE FROM notifications');
            triggerNotificationsUpdate();
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const deleteNotification = async (id) => {
    try {
      await runQuery('DELETE FROM notifications WHERE id = ?', [id]);
      triggerNotificationsUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleRead = async (id, isRead) => {
    try {
      await runQuery('UPDATE notifications SET read = ? WHERE id = ?', [isRead ? 0 : 1, id]);
      triggerNotificationsUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  // Human-readable relative time formatter
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const renderItem = ({ item }) => {
    const isUnread = item.read === 0;
    
    // Choose icons & colors based on type
    let iconName = 'notifications-outline';
    let iconColor = colors.primary;
    let typeLabel = 'SYSTEM';
    
    if (item.type === 'task') {
      iconName = 'checkbox-outline';
      iconColor = colors.secondary;
      typeLabel = 'TASK';
    } else if (item.type === 'routine') {
      iconName = 'repeat-outline';
      iconColor = colors.success;
      typeLabel = 'ROUTINE';
    }

    return (
      <Card
        style={[
          styles.notificationCard,
          isUnread && {
            borderLeftWidth: 4,
            borderLeftColor: iconColor,
            backgroundColor: `${iconColor}02`
          }
        ]}
      >
        <View style={styles.cardRow}>
          {/* Unread circle marker */}
          {isUnread && (
            <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />
          )}

          {/* Left Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>

          {/* Content */}
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.typeText, { color: iconColor, fontFamily: theme.typography.fontFamily.bold }]}>
                {typeLabel}
              </Text>
              <Text style={[styles.timeText, { color: colors.textMuted }]}>
                {formatTime(item.timestamp)}
              </Text>
            </View>
            <Text style={[styles.title, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              {item.title}
            </Text>
            {item.body ? (
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {item.body}
              </Text>
            ) : null}
          </View>

          {/* Delete Action button */}
          <View style={styles.actionButtons}>
            <Pressable onPress={() => toggleRead(item.id, !isUnread)} style={styles.actionBtn}>
              <Ionicons
                name={isUnread ? 'mail-open-outline' : 'mail-unread-outline'}
                size={16}
                color={colors.textMuted}
              />
            </Pressable>
            <Pressable onPress={() => deleteNotification(item.id)} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Navigation Header */}
      <View style={[styles.header, { borderColor: colors.border, marginTop: Math.max(12, insets.top) }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <BrandLogo size={24} style={{ marginRight: 8 }} />
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
            Notification Center
          </Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {/* Top action row */}
      {notifications.length > 0 && (
        <View style={styles.actionRow}>
          <Pressable onPress={markAllRead} style={styles.actionRowBtn}>
            <Ionicons name="checkmark-done" size={16} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.actionRowText, { color: colors.primary, fontFamily: theme.typography.fontFamily.bold }]}>
              Mark all read
            </Text>
          </Pressable>
          <Pressable onPress={clearAllNotifications} style={styles.actionRowBtn}>
            <Ionicons name="trash-bin-outline" size={16} color={colors.error} style={{ marginRight: 4 }} />
            <Text style={[styles.actionRowText, { color: colors.error, fontFamily: theme.typography.fontFamily.bold }]}>
              Clear History
            </Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <LoadingState type="spinner" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="Inbox Empty"
            description="You are completely up to date! System status and scheduling reminders will appear here."
            iconName="notifications-off-outline"
          />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginTop: 40,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  actionRowText: {
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  notificationCard: {
    padding: 12,
    marginBottom: 10,
    position: 'relative',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unreadDot: {
    position: 'absolute',
    left: -6,
    top: 14,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  timeText: {
    fontSize: 9,
    fontWeight: '500',
  },
  title: {
    fontSize: 13,
    lineHeight: 16,
    flexShrink: 1,
  },
  body: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 4,
    marginLeft: 6,
  },
});
