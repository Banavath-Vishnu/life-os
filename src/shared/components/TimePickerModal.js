import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Modal } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../core/theme/theme';

export default function TimePickerModal({ isVisible, onClose, onConfirm, initialTime }) {
  const { theme } = useTheme();
  const { colors, spacing, roundness } = theme;

  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [amPm, setAmPm] = useState('AM');
  const [pickerMode, setPickerMode] = useState('hours'); // 'hours' | 'minutes'

  useEffect(() => {
    if (initialTime && initialTime.includes(':')) {
      try {
        const [hStr, mStr] = initialTime.split(':');
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        
        let mode = 'AM';
        if (h >= 12) {
          mode = 'PM';
          if (h > 12) h = h - 12;
        } else if (h === 0) {
          h = 12;
        }
        
        setSelectedHour(h);
        setSelectedMinute(Math.floor(m / 5) * 5); // Snap to nearest 5 mins
        setAmPm(mode);
      } catch (e) {
        console.warn('Error parsing initial time: ', e);
      }
    }
  }, [initialTime, isVisible]);

  const handleConfirm = () => {
    let h24 = selectedHour;
    if (amPm === 'PM' && selectedHour < 12) {
      h24 = selectedHour + 12;
    } else if (amPm === 'AM' && selectedHour === 12) {
      h24 = 0;
    }
    
    const formattedHours = String(h24).padStart(2, '0');
    const formattedMinutes = String(selectedMinute).padStart(2, '0');
    onConfirm(`${formattedHours}:${formattedMinutes}`);
  };

  const hoursArray = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutesArray = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Trigonometry to place numbers in a circle (radius 75, center 110)
  const getCoordinates = (value, isMinutes) => {
    const valIndex = isMinutes ? value / 5 : (value === 12 ? 0 : value);
    const angle = ((valIndex * 30 - 90) * Math.PI) / 180;
    const x = 110 + 75 * Math.cos(angle);
    const y = 110 + 75 * Math.sin(angle);
    return { x, y };
  };

  // Determine selector line hand target coordinates
  const activeValue = pickerMode === 'hours' ? selectedHour : selectedMinute;
  const handTarget = getCoordinates(activeValue, pickerMode === 'minutes');

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderRadius: roundness.lg }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              Select Time
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Time Readout Display */}
          <View style={[styles.timeDisplayRow, { backgroundColor: colors.surfaceSecondary, borderRadius: roundness.md }]}>
            <Pressable onPress={() => setPickerMode('hours')} style={[styles.timePartBtn, pickerMode === 'hours' && styles.activeTimePart]}>
              <Text style={[styles.timePartText, { color: pickerMode === 'hours' ? colors.primary : colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                {String(selectedHour).padStart(2, '0')}
              </Text>
            </Pressable>
            
            <Text style={[styles.colonText, { color: colors.textSecondary }]}>:</Text>
            
            <Pressable onPress={() => setPickerMode('minutes')} style={[styles.timePartBtn, pickerMode === 'minutes' && styles.activeTimePart]}>
              <Text style={[styles.timePartText, { color: pickerMode === 'minutes' ? colors.primary : colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                {String(selectedMinute).padStart(2, '0')}
              </Text>
            </Pressable>

            {/* AM / PM selector pills */}
            <View style={styles.amPmCol}>
              <Pressable
                onPress={() => setAmPm('AM')}
                style={[styles.amPmBtn, amPm === 'AM' && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.amPmText, { color: amPm === 'AM' ? '#FFFFFF' : colors.textSecondary, fontFamily: theme.typography.fontFamily.bold }]}>
                  AM
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAmPm('PM')}
                style={[styles.amPmBtn, amPm === 'PM' && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.amPmText, { color: amPm === 'PM' ? '#FFFFFF' : colors.textSecondary, fontFamily: theme.typography.fontFamily.bold }]}>
                  PM
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Analog Clock Dial Face */}
          <View style={styles.clockDialWrapper}>
            <View style={[styles.clockCircle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              {/* Selector hand line using SVG */}
              <Svg width={220} height={220} style={StyleSheet.absoluteFill}>
                <Line x1={110} y1={110} x2={handTarget.x} y2={handTarget.y} stroke={colors.primary} strokeWidth={2.5} />
                <Circle cx={110} cy={110} r={5} fill={colors.primary} />
                <Circle cx={handTarget.x} cy={handTarget.y} r={14} fill={`${colors.primary}20`} />
              </Svg>

              {/* Hours / Minutes numbers placed in circle */}
              {pickerMode === 'hours' ? (
                hoursArray.map((hour) => {
                  const coords = getCoordinates(hour, false);
                  const isSelected = selectedHour === hour;
                  return (
                    <Pressable
                      key={`hour-${hour}`}
                      onPress={() => {
                        setSelectedHour(hour);
                        setPickerMode('minutes');
                      }}
                      style={[
                        styles.dialNumberNode,
                        {
                          left: coords.x - 16,
                          top: coords.y - 16,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[styles.dialNumberText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                        {hour}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                minutesArray.map((minute) => {
                  const coords = getCoordinates(minute, true);
                  const isSelected = selectedMinute === minute;
                  return (
                    <Pressable
                      key={`minute-${minute}`}
                      onPress={() => setSelectedMinute(minute)}
                      style={[
                        styles.dialNumberNode,
                        {
                          left: coords.x - 16,
                          top: coords.y - 16,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[styles.dialNumberText, { color: isSelected ? '#FFFFFF' : colors.text, fontSize: 10 }]}>
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <Pressable onPress={onClose} style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1, borderRadius: roundness.md }]}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={[styles.actionBtn, { backgroundColor: colors.primary, borderRadius: roundness.md, marginLeft: 12 }]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    padding: 20,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 16,
  },
  closeBtn: {
    padding: 4,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  timePartBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeTimePart: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  timePartText: {
    fontSize: 28,
    textAlign: 'center',
  },
  colonText: {
    fontSize: 28,
    marginHorizontal: 4,
  },
  amPmCol: {
    marginLeft: 16,
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 2,
  },
  amPmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  amPmText: {
    fontSize: 10,
  },
  clockDialWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  clockCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    position: 'relative',
  },
  dialNumberNode: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
