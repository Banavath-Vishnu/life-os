import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Alert, FlatList, Modal, TextInput, Platform, LayoutAnimation, UIManager, Animated, Dimensions, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Circle, Rect, Line, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useTheme, getCategoryColor } from '../../src/core/theme/theme';
import { useStore } from '../../src/core/store/store';
import { getLocalTodayStr, formatLocalDate, getLocalISOString } from '../../src/core/utils/date';
import { useNavigation, useRouter } from 'expo-router';
import Card from '../../src/shared/components/Card';
import * as Haptics from 'expo-haptics';

import Button from '../../src/shared/components/Button';
import EmptyState from '../../src/shared/components/EmptyState';
import LoadingState from '../../src/shared/components/LoadingState';
import { selectAll, runQuery } from '../../src/core/db/sqlite';
import KeyboardSafeView from '../../src/shared/components/KeyboardSafeView';
import { getExpenseCategories } from '../../src/features/progress/categories';

export default function ProgressScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, roundness } = theme;
  const insets = useSafeAreaInsets();

  const expensesVersion = useStore((state) => state.expensesVersion);
  const targetsVersion = useStore((state) => state.targetsVersion);
  const triggerExpensesUpdate = useStore((state) => state.triggerExpensesUpdate);
  const triggerTargetsUpdate = useStore((state) => state.triggerTargetsUpdate);
  const setActiveSheet = useStore((state) => state.setActiveSheet);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);

  // Sub-tab view state: 'expenses' | 'targets'
  const activeTab = useStore((state) => state.progressSubTab);
  const setActiveTab = useStore((state) => state.setProgressSubTab);
  const [loading, setLoading] = useState(true);

  const handleTabChange = (tab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setActiveTab(tab);
  };

  // Expenses States
  const [expenses, setExpenses] = useState([]);
  const [period, setPeriod] = useState('day'); // 'day' | 'week' | 'month' | 'calendar'
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getLocalTodayStr());
  const [chartType, setChartType] = useState('pie'); // 'pie' | 'bar' | 'line'

  // Tooltip & highlight selections
  const [activeBar, setActiveBar] = useState(null);
  const [activePoint, setActivePoint] = useState(null);
  const [activeSlice, setActiveSlice] = useState(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState(null);
  const [activeHeatmapDay, setActiveHeatmapDay] = useState(null);
  const [isCumulative, setIsCumulative] = useState(true);

  // Chart fade animation value
  const chartOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset selection on periods/chart change
    setActiveBar(null);
    setActivePoint(null);
    setActiveSlice(null);
    setActiveCategoryFilter(null);

    // Fade-in entry animation
    chartOpacity.setValue(0);
    Animated.timing(chartOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [period, chartType]);

  const handlePeriodChange = (p) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPeriod(p);
  };

  const handleChartTypeChange = (type) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChartType(type);
  };

  // Calendar Explorer Modal States
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const todayStr = getLocalTodayStr();
  const [calSelectedDate, setCalSelectedDate] = useState(todayStr);

  const customExpenseCategories = useStore((state) => state.customExpenseCategories);
  const navigation = useNavigation();
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const currentTodayStr = getLocalTodayStr();
      setPeriod('day');
      setSelectedCalendarDate(currentTodayStr);
      setCalSelectedDate(currentTodayStr);
      setActiveCategoryFilter(null);
      setActiveSlice(null);
    });
    return unsubscribe;
  }, [navigation]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Targets States
  const [targets, setTargets] = useState([]);
  const [targetCategoryFilter, setTargetCategoryFilter] = useState('All');

  // Targets Modal State
  const [isTargetModalVisible, setIsTargetModalVisible] = useState(false);
  const [activeTarget, setActiveTarget] = useState(null);
  const [editCompletedCount, setEditCompletedCount] = useState('');
  const [editTotalCount, setEditTotalCount] = useState('');
  const [editStepTexts, setEditStepTexts] = useState([]);
  const [editStepsDone, setEditStepsDone] = useState([]); // per-step ticks (used when sync is off)
  const [editSyncSteps, setEditSyncSteps] = useState(true);

  // Calendar Explorer Handlers
  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  const getCalendarDays = () => {
    const firstDay = new Date(calYear, calMonth, 1);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6; // Sunday

    const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
    const daysGrid = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      daysGrid.push({ dayNum: '', key: `pad-${i}` });
    }

    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      daysGrid.push({
        dayNum: i,
        key: `day-${i}`,
        dateStr: dateStr
      });
    }

    return daysGrid;
  };

  const handleShowExpensesForDate = () => {
    setIsCalendarVisible(false);
    setSelectedCalendarDate(calSelectedDate);
    handlePeriodChange('calendar');
  };

  const handleMarkFutureExpense = () => {
    setIsCalendarVisible(false);
    useStore.getState().setPrefilledDate(calSelectedDate);
    setTimeout(() => {
      setActiveSheet('expense');
    }, 250);
  };

  // Load Data
  const loadExpensesData = async () => {
    try {
      const data = await selectAll('SELECT * FROM expenses ORDER BY date DESC');
      setExpenses(data || []);
    } catch (e) {
      console.warn('[Expenses] Error loading expenses:', e);
    }
  };

  const loadTargetsData = async () => {
    try {
      const data = await selectAll('SELECT * FROM targets ORDER BY id DESC');
      setTargets(data || []);
    } catch (e) {
      console.warn('[Targets] Error loading targets:', e);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    if (activeTab === 'expenses') {
      await loadExpensesData();
    } else {
      await loadTargetsData();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [activeTab, expensesVersion, targetsVersion]);

  // Expenses Calculations
  const getCategoryIcon = (category) => {
    if (!category) return 'card-outline';
    const cat = category.trim().toLowerCase();
    if (cat === 'food & dining') return 'restaurant-outline';
    if (cat === 'transport') return 'car-outline';
    if (cat === 'shopping') return 'bag-handle-outline';
    if (cat === 'entertainment') return 'game-controller-outline';
    if (cat === 'health' || cat === 'fitness') return 'heart-outline';
    if (cat === 'wealth' || cat === 'finance') return 'cash-outline';
    if (cat === 'learning' || cat === 'education') return 'book-outline';
    return 'card-outline';
  };

  const getTargetIcon = (category) => {
    if (!category) return 'flag';
    const cat = category.trim().toLowerCase();
    if (cat === 'learning' || cat === 'education' || cat === 'reading') return 'book';
    if (cat === 'fitness' || cat === 'health' || cat === 'workout') return 'heart';
    if (cat === 'wealth' || cat === 'finance' || cat === 'money') return 'cash';
    if (cat === 'work' || cat === 'career' || cat === 'projects') return 'briefcase';
    if (cat === 'personal' || cat === 'habits') return 'person';
    return 'ribbon';
  };

  const getTrend = () => {
    const now = new Date();
    let currentStart, prevStart, prevEnd;

    if (period === 'day') {
      currentStart = new Date();
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 1);

      prevEnd = new Date(currentStart);
    } else if (period === 'week') {
      currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - 6);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 7);

      prevEnd = new Date(currentStart);
    } else if (period === 'month') {
      currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - 29);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 30);

      prevEnd = new Date(currentStart);
    } else {
      return { percentage: 0, isDown: true, label: 'no trend data' };
    }

    const currentTotal = expenses
      .filter(e => e.date && e.date >= getLocalISOString(currentStart) && e.date.split('T')[0] <= getLocalTodayStr())
      .reduce((acc, curr) => acc + curr.amount, 0);

    const prevTotal = expenses
      .filter(e => e.date && e.date >= getLocalISOString(prevStart) && e.date < getLocalISOString(prevEnd))
      .reduce((acc, curr) => acc + curr.amount, 0);

    if (prevTotal === 0) {
      return { percentage: 0, isDown: true, label: 'vs last period' };
    }

    const diff = currentTotal - prevTotal;
    const pct = Math.abs(Math.round((diff / prevTotal) * 100));
    const isDown = diff <= 0;

    return {
      percentage: pct,
      isDown,
      label: `${pct}% ${isDown ? 'less' : 'more'} than last period`
    };
  };

  const getPeriodStart = () => {
    const start = new Date();
    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
      return getLocalISOString(start);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return getLocalISOString(start);
    } else if (period === 'month') {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return getLocalISOString(start);
    }
    return null;
  };

  const periodExpenses = expenses.filter((e) => {
    if (period === 'calendar') {
      return e.date && e.date.split('T')[0] === selectedCalendarDate;
    }
    const startIso = getPeriodStart();
    // Exclude future-dated expenses from Day/Week/Month totals
    return startIso ? e.date >= startIso && e.date.split('T')[0] <= todayStr : true;
  });

  const filteredExpenses = activeCategoryFilter
    ? periodExpenses.filter((e) => (e.category || '').trim().toLowerCase() === activeCategoryFilter.toLowerCase())
    : periodExpenses;

  const totalSpent = periodExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Categories progress
  // Every category (built-in, user-created, or found on saved expenses) gets its own total
  const categoriesList = getExpenseCategories(customExpenseCategories, expenses.map((e) => e.category));
  const categoryTotals = periodExpenses.reduce((acc, curr) => {
    const cat = categoriesList.find((c) => c.toLowerCase() === (curr.category || '').trim().toLowerCase()) || 'Other';
    acc[cat] = (acc[cat] || 0) + curr.amount;
    return acc;
  }, {});



  // Spending chart calculations & data formatting
  const getLineChartData = () => {
    const dataPoints = [];
    const now = new Date();

    if (period === 'day' || period === 'calendar') {
      const intervals = [
        { label: 'Night', start: 0, end: 6 },
        { label: 'Morning', start: 6, end: 12 },
        { label: 'Afternoon', start: 12, end: 18 },
        { label: 'Evening', start: 18, end: 24 }
      ];

      intervals.forEach(interval => {
        let sum = 0;
        periodExpenses.forEach(exp => {
          if (!exp.date) return;
          const expDate = new Date(exp.date);
          if (period === 'calendar') {
            const expDateStr = exp.date.split('T')[0];
            if (expDateStr !== selectedCalendarDate) return;
          } else {
            const todayStr = formatLocalDate(now);
            const expDateStr = exp.date.split('T')[0];
            if (expDateStr !== todayStr) return;
          }
          const hours = expDate.getHours();
          if (hours >= interval.start && hours < interval.end) {
            sum += exp.amount;
          }
        });
        dataPoints.push({ label: interval.label, value: sum });
      });
    } else if (period === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dStr = formatLocalDate(d);

        let sum = 0;
        periodExpenses.forEach(exp => {
          if (exp.date && exp.date.startsWith(dStr)) {
            sum += exp.amount;
          }
        });
        const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dataPoints.push({ label: weekdayNames[d.getDay()], value: sum });
      }
    } else {
      // Month: group in 6 blocks of 5 days
      for (let i = 5; i >= 0; i--) {
        const startDay = i * 5 + 4;
        const endDay = i * 5;

        const dStart = new Date();
        dStart.setDate(now.getDate() - startDay);
        dStart.setHours(0, 0, 0, 0);

        const dEnd = new Date();
        dEnd.setDate(now.getDate() - endDay);
        dEnd.setHours(23, 59, 59, 999);

        let sum = 0;
        periodExpenses.forEach(exp => {
          if (exp.date) {
            const expDate = new Date(exp.date);
            if (expDate >= dStart && expDate <= dEnd) {
              sum += exp.amount;
            }
          }
        });

        dataPoints.push({ label: `-${endDay}d`, value: sum });
      }
    }

    // Apply cumulative logic if enabled
    if (chartType === 'line' && isCumulative) {
      let runningSum = 0;
      return dataPoints.map(p => {
        runningSum += p.value;
        return { label: p.label, value: runningSum };
      });
    }

    return dataPoints;
  };

  // Helper functions for drawing Bézier curves
  const getCurvePath = (points) => {
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const getAreaPath = (points, chartHeight) => {
    if (points.length === 0) return '';
    const curve = getCurvePath(points);
    return `${curve} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;
  };
  const renderLineChart = () => {
    const dataPoints = getLineChartData();
    const chartHeight = 180;
    const { width: screenWidth } = Dimensions.get('window');
    const chartWidth = screenWidth - spacing.lg * 2 - spacing.md * 2;
    const maxVal = Math.max(...dataPoints.map(p => p.value), 10);
    const paddingLeft = 40;
    const paddingRight = 15;

    const coords = dataPoints.map((p, idx) => {
      const x = paddingLeft + idx * ((chartWidth - paddingLeft - paddingRight) / (dataPoints.length - 1 || 1));
      const y = 175 - 160 * (p.value / maxVal);
      return { x, y, label: p.label, value: p.value };
    });

    const pathD = getCurvePath(coords);
    const areaD = getAreaPath(coords, 175);

    return (
      <View style={{ height: 220, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={chartWidth} height={chartHeight + 30} viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}>
          <Defs>
            <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.32} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.00} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((ratio) => {
            const y = (chartHeight - 20) * (1 - ratio) + 15;
            const gridVal = maxVal * ratio;
            return (
              <G key={`grid-${ratio}`}>
                <Line
                  x1="35"
                  y1={y}
                  x2={chartWidth - 5}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <SvgText
                  x="28"
                  y={y + 3}
                  fontSize="8"
                  fill={colors.textMuted}
                  textAnchor="end"
                >
                  ₹{gridVal.toFixed(0)}
                </SvgText>
              </G>
            );
          })}

          {coords.length > 0 && (
            <Path
              d={areaD}
              fill="url(#chartGradient)"
            />
          )}

          {coords.length > 0 && (
            <Path
              d={pathD}
              fill="none"
              stroke={colors.primary}
              strokeWidth="3"
            />
          )}

          {coords.map((c, idx) => {
            const isPointActive = activePoint === idx;
            return (
              <G key={`point-${idx}`}>
                {/* Large touch hitbox */}
                <Circle
                  cx={c.x}
                  cy={c.y}
                  r="18"
                  fill="transparent"
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                    setActivePoint(isPointActive ? null : idx);
                  }}
                />
                <Circle
                  cx={c.x}
                  cy={c.y}
                  r={isPointActive ? 6 : 4}
                  fill={isPointActive ? colors.primary : colors.surface}
                  stroke={colors.primary}
                  strokeWidth={isPointActive ? 2 : 1.5}
                />
                {!isPointActive && c.value > 0 && (
                  <SvgText
                    x={c.x}
                    y={c.y - 8}
                    fontSize="7.5"
                    fontWeight="700"
                    fill={colors.text}
                    textAnchor="middle"
                  >
                    ₹{c.value.toFixed(0)}
                  </SvgText>
                )}
                <SvgText
                  x={c.x}
                  y={chartHeight + 12}
                  fontSize="8"
                  fontWeight="600"
                  fill={colors.textSecondary}
                  textAnchor="middle"
                >
                  {c.label}
                </SvgText>
              </G>
            );
          })}

          {activePoint !== null && coords[activePoint] && (
            <G>
              <Rect
                x={coords[activePoint].x - 42}
                y={coords[activePoint].y - 34}
                width="84"
                height="24"
                rx="6"
                ry="6"
                fill={colors.text}
              />
              <Path
                d={`M ${coords[activePoint].x - 5} ${coords[activePoint].y - 10} L ${coords[activePoint].x} ${coords[activePoint].y - 5} L ${coords[activePoint].x + 5} ${coords[activePoint].y - 10} Z`}
                fill={colors.text}
              />
              <SvgText
                x={coords[activePoint].x}
                y={coords[activePoint].y - 19}
                fontSize="9.5"
                fontWeight="bold"
                fill={colors.background}
                textAnchor="middle"
              >
                ₹{coords[activePoint].value.toFixed(1)}
              </SvgText>
            </G>
          )}
        </Svg>
      </View>
    );
  };

  const renderBarChart = () => {
    const maxVal = Math.max(...categoriesList.map(cat => categoryTotals[cat] || 0), 10);

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
      <View style={{ height: 220, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: spacing.sm, paddingBottom: 20, flexGrow: 1 }}>
        {categoriesList.map((cat, idx) => {
          const val = categoryTotals[cat] || 0;
          const pct = val / maxVal;
          const barHeight = 100 * pct; // percentage height
          const c = getCategoryColor(cat);
          const isBarActive = activeBar === idx;
          const opacity = activeBar === null ? 1 : isBarActive ? 1 : 0.4;

          return (
            <Pressable
              key={cat}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                setActiveBar(isBarActive ? null : idx);
              }}
              style={{ alignItems: 'center', width: 44, opacity }}
            >
              {isBarActive && val > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -36,
                  alignSelf: 'center',
                  backgroundColor: colors.text,
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 6,
                  zIndex: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 3,
                }}>
                  <Text style={{ color: colors.background, fontSize: 9, fontWeight: 'bold' }}>
                    ₹{val.toFixed(0)}
                  </Text>
                  <View style={{
                    position: 'absolute',
                    bottom: -4,
                    left: '50%',
                    marginLeft: -4,
                    width: 0,
                    height: 0,
                    borderLeftWidth: 4,
                    borderRightWidth: 4,
                    borderTopWidth: 4,
                    borderStyle: 'solid',
                    backgroundColor: 'transparent',
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: colors.text,
                  }} />
                </View>
              )}

              <View style={{
                height: 150,
                width: 14,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: 7,
                overflow: 'hidden',
                justifyContent: 'flex-end',
              }}>
                <View style={{
                  height: `${barHeight}%`,
                  width: '100%',
                  backgroundColor: c,
                  borderRadius: 7,
                }} />
              </View>

              <Text numberOfLines={1} style={{ fontSize: 9, color: colors.textSecondary, marginTop: 8, fontFamily: theme.typography.fontFamily.medium, maxWidth: 44 }}>
                {cat === 'Food & Dining' ? 'Food' : cat === 'Entertainment' ? 'Ent.' : cat}
              </Text>
            </Pressable>
          );
        })}
      </View>
      </ScrollView>
    );
  };

  const renderPieChart = () => {
    const chartRadius = 52;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * chartRadius;

    const activeCats = categoriesList
      .map(cat => ({
        name: cat,
        value: categoryTotals[cat] || 0,
        color: getCategoryColor(cat),
      }))
      .filter(cat => cat.value > 0);

    if (activeCats.length === 0) {
      return (
        <View style={{ height: 160, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary }}>
            No categories with expenses
          </Text>
        </View>
      );
    }

    const totalChartSpent = activeCats.reduce((sum, c) => sum + c.value, 0);

    let accumulated = 0;

    const slices = activeCats.map((cat) => {
      const percentage = cat.value / totalChartSpent;

      const strokeLength = percentage * circumference;

      const startAngle =
        (accumulated / circumference) * Math.PI * 2 - Math.PI / 2;

      accumulated += strokeLength;

      return {
        cat,
        strokeLength,
        strokeOffset: -(
          accumulated - strokeLength
        ),
        startAngle,
        isActive: activeSlice === cat.name,
      };
    });


    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 160, paddingHorizontal: spacing.sm }}>
        <View style={{ width: 140, height: 140, justifyContent: 'center', alignItems: 'center' }}>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <Circle
              cx="75"
              cy="75"
              r={chartRadius}
              stroke={colors.surfaceSecondary}
              strokeWidth={strokeWidth}
              fill="none"
            />

            {slices.map((slice) => {

              const translate = slice.isActive ? 6 : 0;

              const midAngle =
                slice.startAngle +
                (slice.strokeLength / circumference) *
                Math.PI;

              const dx = Math.cos(midAngle) * translate;
              const dy = Math.sin(midAngle) * translate;

              return (
                <G
                  key={slice.cat.name}
                  transform={`translate(${dx},${dy})`}
                >
                  <Circle
                    cx="75"
                    cy="75"
                    r={chartRadius}
                    fill="none"
                    stroke={slice.cat.color}
                    strokeWidth={
                      slice.isActive
                        ? strokeWidth + 3
                        : strokeWidth
                    }
                    strokeLinecap="round"
                    strokeDasharray={`${slice.strokeLength} ${circumference}`}
                    strokeDashoffset={slice.strokeOffset}
                    rotation={-90}
                    origin="75,75"
                    onPress={() => {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut
                      );

                      const next =
                        slice.isActive
                          ? null
                          : slice.cat.name;

                      setActiveSlice(next);
                      setActiveCategoryFilter(next);
                    }}
                  />

                  {/* Bigger invisible touch target */}
                  <Circle
                    cx="75"
                    cy="75"
                    r={chartRadius}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={32}
                    strokeDasharray={`${slice.strokeLength} ${circumference}`}
                    strokeDashoffset={slice.strokeOffset}
                    rotation={-90}
                    origin="75,75"
                    onPress={() => {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut
                      );

                      const next =
                        slice.isActive
                          ? null
                          : slice.cat.name;

                      setActiveSlice(next);
                      setActiveCategoryFilter(next);
                    }}
                  />
                </G>
              );
            })}
          </Svg>

          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
            <View style={{ width: 84, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', fontFamily: theme.typography.fontFamily.bold }} numberOfLines={1}>
                {activeSlice ? (activeSlice === 'Food & Dining' ? 'Food' : activeSlice) : 'Total'}
              </Text>
              <Text
                style={{ fontSize: activeSlice ? 13 : 15, fontFamily: theme.typography.fontFamily.bold, color: activeSlice ? colors.primary : colors.text, marginTop: 2, textAlign: 'center' }}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.65}
              >
                ₹{(activeSlice ? (categoryTotals[activeSlice] || 0) : totalSpent).toFixed(0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flex: 1, paddingLeft: spacing.lg, justifyContent: 'center' }}>
          {activeCats.map((cat) => {
            const pct = Math.round((cat.value / totalChartSpent) * 100);
            const isSliceActive = activeSlice === cat.name;
            return (
              <Pressable
                key={cat.name}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                  const nextSlice = isSliceActive ? null : cat.name;
                  setActiveSlice(nextSlice);
                  setActiveCategoryFilter(nextSlice);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingVertical: 2, opacity: activeSlice === null || isSliceActive ? 1 : 0.4 }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color, marginRight: 8 }} />
                <Text style={{ fontSize: 11, color: isSliceActive ? colors.primary : colors.text, fontWeight: isSliceActive ? '700' : '600', fontFamily: isSliceActive ? theme.typography.fontFamily.bold : theme.typography.fontFamily.medium, flex: 1 }} numberOfLines={1}>
                  {cat.name === 'Food & Dining' ? 'Food' : cat.name}
                </Text>
                <Text style={{ fontSize: 11, color: isSliceActive ? colors.primary : colors.textSecondary, fontFamily: theme.typography.fontFamily.bold, textAlign: 'right' }}>
                  {pct}%
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };


  const renderChart = () => {
    let chartView = null;
    if (chartType === 'line') chartView = renderLineChart();
    else if (chartType === 'bar') chartView = renderBarChart();
    else chartView = renderPieChart();

    return (
      <Animated.View style={{ opacity: chartOpacity }}>
        {chartView}
      </Animated.View>
    );
  };

  const deleteExpense = async (id, title) => {
    Alert.alert('Delete Expense', `Are you sure you want to delete transaction "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await runQuery('DELETE FROM expenses WHERE id = ?', [id]);
            triggerExpensesUpdate();
          } catch (err) {
            console.error(err);
          }
        },
      },
    ]);
  };

  // Targets handlers
  const openTargetDetail = (target) => {
    setActiveTarget(target);
    setEditCompletedCount(String(target.completedCount));
    setEditTotalCount(String(target.totalCount));
    
    // Parse stepTexts
    let steps = [];
    try {
      steps = target.stepTexts ? JSON.parse(target.stepTexts) : [];
    } catch (e) {
      console.warn('Failed to parse stepTexts:', e);
    }
    const total = target.totalCount;
    while (steps.length < total) steps.push('');
    if (steps.length > total) steps = steps.slice(0, total);
    setEditStepTexts(steps);

    // Per-step ticks; targets saved before this existed fall back to "first N steps done"
    let done = null;
    try {
      done = target.stepsDone ? JSON.parse(target.stepsDone) : null;
    } catch (e) {
      console.warn('Failed to parse stepsDone:', e);
    }
    if (!Array.isArray(done)) {
      done = Array.from({ length: total }, (_, i) => i < target.completedCount);
    }
    done = Array.from({ length: total }, (_, i) => !!done[i]);
    setEditStepsDone(done);
    setEditSyncSteps(target.syncSteps !== 0);

    setIsTargetModalVisible(true);
  };

  const handleTotalCountChange = (text) => {
    setEditTotalCount(text);
    const newTotal = Number(text);
    if (!isNaN(newTotal) && newTotal > 0) {
      // Only grow while typing; extra steps are kept until Save so passing through a smaller number loses nothing
      setEditStepTexts((prev) => {
        const updated = [...prev];
        while (updated.length < newTotal) updated.push('');
        return updated;
      });
      const padded = [...editStepsDone];
      while (padded.length < newTotal) padded.push(false);
      setEditStepsDone(padded);
      if (!editSyncSteps) {
        setEditCompletedCount(String(padded.slice(0, newTotal).filter(Boolean).length));
      }
    }
  };

  // Sync on: steps fill in order (current count). Sync off: each tick is independent.
  const handleSyncToggle = (value) => {
    const total = Number(editTotalCount) || 0;
    if (value) {
      // Keep the same number of completed steps, now counted from the first step
      const count = editStepsDone.slice(0, total).filter(Boolean).length;
      setEditCompletedCount(String(count));
    } else {
      const completed = Math.min(Number(editCompletedCount) || 0, total);
      setEditStepsDone(Array.from({ length: total }, (_, i) => i < completed));
      setEditCompletedCount(String(completed));
    }
    setEditSyncSteps(value);
  };

  const isStepDone = (index) =>
    editSyncSteps ? index < (Number(editCompletedCount) || 0) : !!editStepsDone[index];

  const toggleStepCompletion = (index) => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (!editSyncSteps) {
      const updated = [...editStepsDone];
      updated[index] = !updated[index];
      setEditStepsDone(updated);
      setEditCompletedCount(String(updated.filter(Boolean).length));
      return;
    }
    const completed = Number(editCompletedCount) || 0;
    if (index < completed) {
      if (index === completed - 1) {
        setEditCompletedCount(String(index));
      } else {
        setEditCompletedCount(String(index + 1));
      }
    } else {
      setEditCompletedCount(String(index + 1));
    }
  };

  const updateStepText = (index, text) => {
    setEditStepTexts((prev) => {
      const updated = [...prev];
      updated[index] = text;
      return updated;
    });
  };

  const deleteTarget = async (id, title) => {
    Alert.alert('Delete Target', `Are you sure you want to delete target goal "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await runQuery('DELETE FROM targets WHERE id = ?', [id]);
            triggerTargetsUpdate();
            setIsTargetModalVisible(false);
          } catch (err) {
            console.error(err);
          }
        },
      },
    ]);
  };

  const saveTargetProgress = async () => {
    const total = Number(editTotalCount);
    const completed = editSyncSteps
      ? Number(editCompletedCount)
      : editStepsDone.slice(0, total).filter(Boolean).length;

    if (!Number.isInteger(completed) || !Number.isInteger(total) || total <= 0 || completed < 0) {
      Alert.alert('Validation Error', 'Please enter valid completion steps.');
      return;
    }
    if (completed > total) {
      Alert.alert('Validation Error', 'Completed steps cannot exceed total steps.');
      return;
    }

    try {
      // floor so a target only reads 100% once every step is done
      const percentage = Math.floor((completed / total) * 100);
      const stepTexts = Array.from({ length: total }, (_, i) => editStepTexts[i] || '');
      const stepTextsStr = JSON.stringify(stepTexts);
      const stepsDone = Array.from({ length: total }, (_, i) =>
        editSyncSteps ? i < completed : !!editStepsDone[i]
      );
      await runQuery('UPDATE targets SET completedCount = ?, totalCount = ?, percentage = ?, stepTexts = ?, stepsDone = ?, syncSteps = ? WHERE id = ?', [
        completed,
        total,
        percentage,
        stepTextsStr,
        JSON.stringify(stepsDone),
        editSyncSteps ? 1 : 0,
        activeTarget.id,
      ]);
      triggerTargetsUpdate();
      setIsTargetModalVisible(false);
      Alert.alert('Success', 'Target progress updated.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save progress.');
    }
  };

  // Targets stats
  const activeTargetsCount = targets.filter((t) => t.percentage < 100).length;
  const completedTargetsCount = targets.filter((t) => t.percentage === 100).length;

  const filteredTargets = targets.filter((t) => {
    if (targetCategoryFilter === 'All') return true;
    if (targetCategoryFilter === 'In Progress') return t.percentage < 100;
    return t.percentage === 100;
  });

  const handleTargetFilterChange = (filter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTargetCategoryFilter(filter);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Title Row */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg, paddingTop: Math.max(insets.top, 16), paddingBottom: spacing.sm, justifyContent: 'flex-start' }]}>
        <Pressable onPress={goBack} style={{ marginRight: 8, padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text
          style={[
            styles.screenTitle,
            {
              color: colors.text,
              fontSize: typography.sizes.xxl,
              fontFamily: theme.typography.fontFamily.bold,
            },
          ]}
        >
          Progress
        </Text>
      </View>

      {/* Segmented Top Control (Expenses vs Targets) */}
      <View style={[styles.segmentContainer, { marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: roundness.md }]}>
        <Pressable
          onPress={() => handleTabChange('expenses')}
          style={[
            styles.segmentBtn,
            activeTab === 'expenses' && {
              backgroundColor: colors.surface,
              borderRadius: roundness.md - 3,
              shadowColor: colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: theme.dark ? 0.15 : 0.06,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color: activeTab === 'expenses' ? colors.primary : colors.textSecondary,
                fontFamily: theme.typography.fontFamily.bold,
              },
            ]}
          >
            Expenses Tracker
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange('targets')}
          style={[
            styles.segmentBtn,
            activeTab === 'targets' && {
              backgroundColor: colors.surface,
              borderRadius: roundness.md - 3,
              shadowColor: colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: theme.dark ? 0.15 : 0.06,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color: activeTab === 'targets' ? colors.primary : colors.textSecondary,
                fontFamily: theme.typography.fontFamily.bold,
              },
            ]}
          >
            Targets Tracker
          </Text>
        </Pressable>
      </View>

      {activeTab === 'expenses' ? (
        /* ================= EXPENSES TRACKER VIEW ================= */
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 80 + insets.bottom }} showsVerticalScrollIndicator={false}>
          {/* Period & Calendar Selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={[styles.periodContainer, { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: theme.roundness.md, marginRight: spacing.sm, marginBottom: 0 }]}>
              {['day', 'week', 'month'].map((p) => (
                <Pressable
                  key={p}
                  onPress={() => handlePeriodChange(p)}
                  style={[
                    styles.periodBtn,
                    period === p && {
                      backgroundColor: colors.surface,
                      borderRadius: theme.roundness.md - 3,
                      shadowColor: colors.text,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: theme.dark ? 0.15 : 0.06,
                      shadowRadius: 4,
                      elevation: 2,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.periodText,
                      {
                        color: period === p ? colors.primary : colors.textSecondary,
                        fontFamily: theme.typography.fontFamily.bold,
                      },
                    ]}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setIsCalendarVisible(true)}
              style={[
                styles.calendarLaunchBtn,
                {
                  backgroundColor: period === 'calendar' ? colors.primary : colors.surface,
                  borderColor: period === 'calendar' ? colors.primary : colors.border,
                  borderWidth: 1,
                  borderRadius: theme.roundness.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 44,
                  width: 44,
                }
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={period === 'calendar' ? '#FFFFFF' : colors.primary}
              />
            </Pressable>
          </View>

          {/* Calendar Custom Date Info Bar */}
          {period === 'calendar' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Filtering date: <Text style={{ color: colors.primary, fontFamily: theme.typography.fontFamily.bold }}>{selectedCalendarDate}</Text>
              </Text>
              <Pressable
                onPress={() => handlePeriodChange('day')}
                style={{ marginLeft: spacing.sm, paddingHorizontal: 8, paddingVertical: 4, borderRadius: roundness.sm, backgroundColor: colors.surfaceSecondary }}
              >
                <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '700' }}>Clear Filter</Text>
              </Pressable>
            </View>
          )}

          {/* Hero Spending Card */}
          {(() => {
            const trend = getTrend();
            const sparkPoints = getLineChartData();
            const sparkHeight = 70;
            const sparkWidth = 140;
            const sparkMax = Math.max(...sparkPoints.map(p => p.value), 10);

            const sparkCoords = sparkPoints.map((p, idx) => {
              const x = idx * (sparkWidth / (sparkPoints.length - 1 || 1));
              const y = sparkHeight - (sparkHeight * 0.65 * (p.value / sparkMax)) - 10;
              return { x, y };
            });

            let sparkD = '';
            if (sparkCoords.length > 0) {
              sparkD = `M ${sparkCoords[0].x} ${sparkCoords[0].y}`;
              for (let i = 1; i < sparkCoords.length; i++) {
                sparkD += ` L ${sparkCoords[i].x} ${sparkCoords[i].y}`;
              }
            }

            return (
              <Card style={[styles.heroCard, { backgroundColor: colors.primary, overflow: 'hidden' }]} bordered={false}>
                <View style={styles.heroRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroLabel}>
                      {period === 'day' ? "Today's Spending" : period === 'week' ? 'Weekly Spending' : period === 'month' ? 'Monthly Spending' : `Spending for ${selectedCalendarDate}`}
                    </Text>
                    <Text style={[styles.heroVal, { fontFamily: theme.typography.fontFamily.bold }]}>
                      ₹{totalSpent.toFixed(2)}
                    </Text>
                    {trend.percentage > 0 && (
                      <View style={styles.trendRow}>
                        <Ionicons
                          name={trend.isDown ? "trending-down" : "trending-up"}
                          size={14}
                          color={trend.isDown ? "#6ffbbe" : "#ff8a8a"}
                        />
                        <Text style={[styles.trendText, { color: '#ffffffb0', fontFamily: theme.typography.fontFamily.medium }]}>
                          {trend.label}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Svg Mini Chart rendering */}
                  <View style={styles.chartWrapper}>
                    <Svg width="110" height="60" viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}>
                      {sparkD ? (
                        <>
                          <Path
                            d={sparkD}
                            fill="none"
                            stroke="#ffffffb0"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <Circle
                            cx={sparkCoords[sparkCoords.length - 1].x}
                            cy={sparkCoords[sparkCoords.length - 1].y}
                            r="4.5"
                            fill={trend.isDown ? "#6ffbbe" : "#ff8a8a"}
                          />
                        </>
                      ) : (
                        <Path
                          d="M0 35 L140 35"
                          fill="none"
                          stroke="#ffffff40"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      )}
                    </Svg>
                  </View>
                </View>
              </Card>
            );
          })()}

          {/* spending analytics card visualisations */}
          <Card glass={true} bordered={true} style={{ padding: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 14, fontFamily: theme.typography.fontFamily.bold, color: colors.text }}>
                Spending Analytics
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {chartType === 'line' && (
                  <Pressable
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setIsCumulative(!isCumulative);
                    }}
                    style={{
                      marginRight: spacing.sm,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: roundness.sm,
                      backgroundColor: isCumulative ? `${colors.primary}15` : colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: isCumulative ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 9, fontFamily: theme.typography.fontFamily.bold, color: isCumulative ? colors.primary : colors.textSecondary }}>
                      Cumulative
                    </Text>
                  </Pressable>
                )}
                <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: theme.roundness.md, padding: 2 }}>
                  {['line', 'bar', 'pie'].map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => handleChartTypeChange(type)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: theme.roundness.md - 2,
                        backgroundColor: chartType === type ? colors.surface : 'transparent',
                      }}
                    >
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: chartType === type ? colors.primary : colors.textSecondary,
                        textTransform: 'uppercase'
                      }}>
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {periodExpenses.length === 0 ? (
              <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="stats-chart-outline" size={28} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, marginTop: 6, fontSize: 12 }}>
                  No transaction data for this period.
                </Text>
              </View>
            ) : (
              renderChart()
            )}
          </Card>

          {/* Categories Progress Breakdown */}
          <Text style={[styles.sectionLabelHeader, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
            Categories
          </Text>

          <View style={styles.categoriesContainer}>
            {categoriesList.map((cat, idx) => {
              const val = categoryTotals[cat] || 0;
              const pct = totalSpent > 0 ? Math.round((val / totalSpent) * 100) : 0;
              const c = getCategoryColor(cat);
              const isSelected = activeCategoryFilter === cat;

              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                    const nextFilter = isSelected ? null : cat;
                    setActiveCategoryFilter(nextFilter);
                    setActiveSlice(nextFilter);
                  }}
                  style={{ opacity: activeCategoryFilter === null || isSelected ? 1 : 0.55 }}
                >
                  <Card
                    glass={true}
                    bordered={true}
                    style={[
                      styles.catCard,
                      {
                        borderLeftWidth: 4,
                        borderLeftColor: c,
                        marginBottom: spacing.sm,
                        padding: spacing.md,
                        backgroundColor: isSelected ? `${c}08` : colors.surface,
                        borderColor: isSelected ? c : colors.border,
                      }
                    ]}
                  >
                    <View style={styles.catHeader}>
                      <Text style={[styles.catTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.medium }]}>
                        {cat}
                      </Text>
                      <Text style={[styles.catVal, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                        ₹{val.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.progressRow}>
                      <View style={[styles.progressBarOuter, { backgroundColor: colors.surfaceSecondary }]}>
                        <View style={[styles.progressBarInner, { backgroundColor: c, width: `${pct}%` }]} />
                      </View>
                      <Text style={[styles.pctText, { color: colors.textSecondary, fontFamily: theme.typography.fontFamily.bold }]}>
                        {pct}%
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>

          {/* Recent Transactions List */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm }}>
            <Text style={[styles.sectionLabelHeader, { color: colors.text, fontFamily: theme.typography.fontFamily.bold, marginBottom: 0, marginTop: 0 }]}>
              Recent Transactions
            </Text>
            {activeCategoryFilter && (
              <Pressable
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setActiveCategoryFilter(null);
                  setActiveSlice(null);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surfaceSecondary,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: roundness.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 10, color: colors.primary, fontFamily: theme.typography.fontFamily.bold, marginRight: 4 }}>
                  {activeCategoryFilter === 'Food & Dining' ? 'Food' : activeCategoryFilter}
                </Text>
                <Ionicons name="close-circle" size={12} color={colors.primary} />
              </Pressable>
            )}
          </View>

          {loading ? (
            <LoadingState type="spinner" />
          ) : filteredExpenses.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 12 }}>
              No expenses recorded for this period.
            </Text>
          ) : (
            filteredExpenses.map((e) => {
              const catColor = getCategoryColor(e.category);
              const catIcon = getCategoryIcon(e.category);

              return (
                <Card
                  key={e.id}
                  glass={true}
                  bordered={true}
                  style={[
                    styles.txCard,
                    {
                      marginBottom: spacing.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                    }
                  ]}
                >
                  <View style={styles.txLeft}>
                    <View style={[styles.txIconWrapper, { backgroundColor: `${catColor}15` }]}>
                      <Ionicons name={catIcon} size={16} color={catColor} />
                    </View>
                    <View>
                      <Text style={[styles.txMerchant, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                        {e.title}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: theme.typography.fontFamily.regular }}>
                        {e.date
                          ? new Date(e.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
                          : 'Unknown Date'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: colors.error, fontFamily: theme.typography.fontFamily.bold }]}>
                      -₹{e.amount.toFixed(2)}
                    </Text>
                    <Pressable
                      onPress={() => deleteExpense(e.id, e.title)}
                      style={styles.txDelete}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      ) : (
        /* ================= TARGETS TRACKER VIEW ================= */
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 80 + insets.bottom }} showsVerticalScrollIndicator={false}>
          {/* Target Filters */}
          <View style={styles.targetFilterRow}>
            {['All', 'In Progress', 'Completed'].map((filter) => {
              const isSelected = targetCategoryFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => handleTargetFilterChange(filter)}
                  style={[
                    styles.targetFilterBadge,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: roundness.full,
                      shadowColor: colors.text,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: (isSelected && !theme.dark) ? 0.08 : 0,
                      shadowRadius: 4,
                      elevation: isSelected ? 2 : 0,
                    },
                  ]}
                >
                  <Text style={[styles.targetFilterText, { color: isSelected ? '#FFFFFF' : colors.textSecondary, fontFamily: theme.typography.fontFamily.bold }]}>
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Grid of Targets */}
          {loading ? (
            <LoadingState type="spinner" />
          ) : filteredTargets.length === 0 ? (
            <EmptyState
              title="No Targets Found"
              description="Define short-term and long-term targets (AWS certification, books to read, workout goals) here."
              iconName="flag-outline"
              actionTitle="Create New Target"
              onActionPress={() => setActiveSheet('target')}
            />
          ) : (
            <View style={styles.targetsGrid}>
              {filteredTargets.map((item, idx) => {
                const c = getCategoryColor(item.category);
                const tIcon = getTargetIcon(item.category);

                return (
                  <Pressable key={item.id} onPress={() => openTargetDetail(item)}>
                    <Card style={[styles.targetCardInner, { marginBottom: spacing.md }]} glass={true} bordered={true}>
                      <View style={styles.targetCardHeader}>
                        <View style={styles.targetMetaRow}>
                          <View style={[styles.targetIconCircle, { backgroundColor: `${c}15` }]}>
                            <Ionicons name={tIcon} size={20} color={c} />
                          </View>
                          <View style={{ flexShrink: 1, paddingRight: spacing.sm }}>
                            <Text
                              style={[styles.targetTitleText, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: theme.typography.fontFamily.medium }}>
                              {item.category}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.targetPctBox, { backgroundColor: `${c}15` }]}>
                          <Text style={[styles.targetPctText, { color: c, fontFamily: theme.typography.fontFamily.bold }]}>
                            {item.percentage}%
                          </Text>
                        </View>
                      </View>

                      {/* Progress Bar */}
                      <View style={styles.targetProgressSection}>
                        <View style={[styles.targetProgressOuter, { backgroundColor: colors.surfaceSecondary, borderRadius: roundness.full }]}>
                          <View style={[styles.targetProgressInner, { backgroundColor: c, width: `${item.percentage}%`, borderRadius: roundness.full }]} />
                        </View>
                        <View style={styles.targetProgressFooter}>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium }}>
                            {item.completedCount} / {item.totalCount} completed
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium }}>
                            Target: {item.dueDate}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Quick Targets Stats Section */}
          <View style={styles.quickStatsRow}>
            <Card glass={true} bordered={true} style={styles.quickStatsBox}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium }}>Active Targets</Text>
              <Text style={[styles.quickStatsVal, { color: colors.primary, fontFamily: theme.typography.fontFamily.bold }]}>
                {String(activeTargetsCount).padStart(2, '0')}
              </Text>
            </Card>
            <Card glass={true} bordered={true} style={styles.quickStatsBox}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium }}>Completed Goals</Text>
              <Text style={[styles.quickStatsVal, { color: colors.success, fontFamily: theme.typography.fontFamily.bold }]}>
                {String(completedTargetsCount).padStart(2, '0')}
              </Text>
            </Card>
          </View>
        </ScrollView>
      )}

      {/* Target Detail / Progress editor Modal */}
      {activeTarget && (
        <Modal visible={isTargetModalVisible} animationType="slide" presentationStyle="overFullScreen" onRequestClose={() => setIsTargetModalVisible(false)}>
          <KeyboardSafeView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border, paddingTop: insets.top, marginTop: 0 }]}>
              <Pressable
                onPress={() => setIsTargetModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                Update Target Progress
              </Text>
              <Pressable
                onPress={() => deleteTarget(activeTarget.id, activeTarget.title)}
                style={styles.modalDeleteBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={[styles.modalScroll, { padding: spacing.lg }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={{ fontSize: 18, color: colors.text, fontFamily: theme.typography.fontFamily.bold }}>
                {activeTarget.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.lg, fontFamily: theme.typography.fontFamily.medium }}>
                Category: {activeTarget.category} | Target Date: {activeTarget.dueDate}
              </Text>

              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary, fontFamily: theme.typography.fontFamily.bold }]}>Completed Progress Steps</Text>
              <TextInput
                style={[
                  styles.titleInput,
                  {
                    color: colors.text,
                    fontFamily: theme.typography.fontFamily.bold,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: roundness.md,
                    paddingHorizontal: spacing.md,
                  },
                ]}
                value={editCompletedCount}
                onChangeText={setEditCompletedCount}
                editable={editSyncSteps}
                keyboardType="numeric"
                placeholder="e.g. 9"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary, marginTop: spacing.md, fontFamily: theme.typography.fontFamily.bold }]}>Total Target Steps</Text>
              <TextInput
                style={[
                  styles.titleInput,
                  {
                    color: colors.text,
                    fontFamily: theme.typography.fontFamily.bold,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: roundness.md,
                    paddingHorizontal: spacing.md,
                  },
                ]}
                value={editTotalCount}
                onChangeText={handleTotalCountChange}
                keyboardType="numeric"
                placeholder="e.g. 12"
                placeholderTextColor={colors.textMuted}
              />

              {/* Target Steps Timeline */}
              {Number(editTotalCount) > 0 && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg }}>
                    <Text style={[styles.modalSectionLabel, { color: colors.textSecondary, fontFamily: theme.typography.fontFamily.bold, flex: 1 }]}>
                      Steps Checklist & Descriptions
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: theme.typography.fontFamily.bold, marginRight: 6 }}>
                        Sync
                      </Text>
                      <Switch
                        value={editSyncSteps}
                        onValueChange={handleSyncToggle}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm, fontFamily: theme.typography.fontFamily.medium }}>
                    {editSyncSteps
                      ? 'Ticking a step also completes every step before it.'
                      : 'Each step is ticked independently.'}
                  </Text>
                  
                  <View style={styles.targetTimelineContainer}>
                    {/* Timeline vertical axis line */}
                    <View style={[styles.targetVerticalLine, { backgroundColor: colors.border }]} />
                    
                    {editStepTexts.slice(0, Number(editTotalCount) || 0).map((stepText, index) => {
                      const isCompleted = isStepDone(index);
                      const stepNumStr = String(index + 1).padStart(2, '0');
                      
                      return (
                        <View key={index} style={styles.targetTimelineRow}>
                          {/* Left Side: Step Number */}
                          <View style={styles.targetTimeWrapper}>
                            <Text
                              style={[
                                styles.targetTimeText,
                                {
                                  color: isCompleted ? colors.success : colors.textSecondary,
                                  fontFamily: theme.typography.fontFamily.bold,
                                },
                              ]}
                            >
                              {stepNumStr}
                            </Text>
                          </View>

                          {/* Center: Timeline Node Circle */}
                          <View style={styles.targetNodeWrapper}>
                            <Pressable
                              onPress={() => toggleStepCompletion(index)}
                              style={[
                                styles.targetNodeCircle,
                                {
                                  backgroundColor: isCompleted ? `${colors.success}15` : colors.surfaceSecondary,
                                  borderColor: isCompleted ? colors.success : colors.border,
                                },
                              ]}
                            >
                              <Ionicons
                                name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                                size={18}
                                color={isCompleted ? colors.success : colors.textMuted}
                              />
                            </Pressable>
                          </View>

                          {/* Right Side: Step Text Input */}
                          <View style={styles.targetCardWrapper}>
                            <TextInput
                              style={[
                                styles.targetStepInput,
                                {
                                  color: colors.text,
                                  fontFamily: theme.typography.fontFamily.medium,
                                  backgroundColor: colors.surface,
                                  borderColor: colors.border,
                                  borderRadius: roundness.md,
                                  paddingHorizontal: spacing.md,
                                  paddingVertical: spacing.sm,
                                  fontSize: 13,
                                }
                              ]}
                              value={stepText}
                              onChangeText={(newText) => updateStepText(index, newText)}
                              placeholder={`Step ${index + 1} description...`}
                              placeholderTextColor={colors.textMuted}
                              multiline={false}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              <Button
                title="Save Progress"
                onPress={saveTargetProgress}
                variant="primary"
                style={{ marginTop: spacing.xl }}
              />
            </ScrollView>
          </KeyboardSafeView>
        </Modal>
      )}

      {/* Calendar View Explorer Modal */}
      <Modal visible={isCalendarVisible} animationType="slide" presentationStyle="overFullScreen" onRequestClose={() => setIsCalendarVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border, paddingTop: insets.top, marginTop: 0 }]}>
            <Pressable
              onPress={() => setIsCalendarVisible(false)}
              style={styles.modalCloseBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              Calendar Explorer
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={styles.calendarWrapper}>
              {/* Month & Year selector header */}
              <View style={styles.calendarMonthHeader}>
                <Pressable
                  onPress={handlePrevMonth}
                  style={styles.monthNavBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={[styles.calendarMonthText, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                  {monthNames[calMonth]} {calYear}
                </Text>
                <Pressable
                  onPress={handleNextMonth}
                  style={styles.monthNavBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-forward" size={22} color={colors.text} />
                </Pressable>
              </View>

              {/* Weekday headers */}
              <View style={styles.calendarWeekdaysRow}>
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                  <Text key={day} style={[styles.weekdayHeaderText, { color: colors.textMuted, fontFamily: theme.typography.fontFamily.bold }]}>
                    {day}
                  </Text>
                ))}
              </View>

              {/* Calendar Days Grid */}
              <View style={styles.calendarGrid}>
                {getCalendarDays().map((day) => {
                  const isSelected = calSelectedDate === day.dateStr;
                  const isToday = day.dateStr === todayStr;
                  const hasExpenses = day.dateStr && expenses.some(e => e.date && e.date.split('T')[0] === day.dateStr);

                  return (
                    <Pressable
                      key={day.key}
                      onPress={() => day.dateStr && setCalSelectedDate(day.dateStr)}
                      disabled={!day.dayNum}
                      style={[
                        styles.calendarDayCell,
                        isSelected && { backgroundColor: colors.primary, borderRadius: 10 },
                        !isSelected && isToday && { borderColor: colors.primary, borderWidth: 1, borderRadius: 10 }
                      ]}
                    >
                      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <Text
                          style={[
                            styles.calendarDayText,
                            {
                              color: isSelected
                                ? '#FFFFFF'
                                : isToday
                                  ? colors.primary
                                  : day.dayNum
                                    ? colors.text
                                    : 'transparent',
                              fontFamily: (isSelected || isToday) ? theme.typography.fontFamily.bold : theme.typography.fontFamily.regular,
                              marginBottom: hasExpenses ? 2 : 0,
                            }
                          ]}
                        >
                          {day.dayNum}
                        </Text>
                        {day.dayNum && hasExpenses && (
                          <View
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: isSelected ? '#FFFFFF' : colors.primary,
                              opacity: isSelected ? 1 : 0.6
                            }}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Selected Date actions */}
              <Card glass={true} bordered={true} style={{ marginTop: spacing.md, padding: spacing.md }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, fontFamily: theme.typography.fontFamily.medium }}>
                  Selected Date: <Text style={{ color: colors.text, fontFamily: theme.typography.fontFamily.bold }}>{calSelectedDate}</Text>
                </Text>
                <View style={styles.calActionsRow}>
                  <Button
                    title="Log Expense"
                    onPress={handleMarkFutureExpense}
                    variant="primary"
                    style={{ flex: 1, marginRight: spacing.xs }}
                  />
                  <Button
                    title="View Expenses"
                    onPress={handleShowExpensesForDate}
                    variant="secondary"
                    style={{ flex: 1, marginLeft: spacing.xs }}
                  />
                </View>
              </Card>
            </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAddBtn: {
    padding: 4,
  },
  screenTitle: {
    fontWeight: '800',
  },
  segmentContainer: {
    flexDirection: 'row',
    height: 44,
    padding: 4,
    borderRadius: 14,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  segmentText: {
    fontSize: 13,
  },
  periodContainer: {
    flexDirection: 'row',
    height: 44,
    padding: 4,
  },
  periodBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  periodText: {
    fontSize: 13,
  },
  heroCard: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    color: '#ffffff80',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroVal: {
    color: '#FFFFFF',
    fontSize: 32,
    marginTop: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  trendText: {
    color: '#FFFFFF80',
    fontSize: 11,
    marginLeft: 4,
  },
  chartWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabelHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 10,
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  catCard: {
    marginBottom: 12,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catTitle: {
    fontSize: 13,
  },
  catVal: {
    fontSize: 13,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressBarOuter: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 3,
  },
  pctText: {
    fontSize: 10,
    fontWeight: '700',
    paddingLeft: 8,
    width: 32,
    textAlign: 'right',
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txMerchant: {
    fontSize: 13,
  },
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txAmount: {
    fontSize: 13,
    marginRight: 12,
  },
  txDelete: {
    padding: 6,
  },
  targetFilterRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  targetFilterBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  targetFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  targetsGrid: {
    marginBottom: 16,
  },
  targetCardInner: {
    padding: 16,
  },
  targetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  targetIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  targetTitleText: {
    fontSize: 14,
  },
  targetPctBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  targetPctText: {
    fontSize: 12,
  },
  targetProgressSection: {
    marginTop: 14,
  },
  targetProgressOuter: {
    height: 6,
    overflow: 'hidden',
  },
  targetProgressInner: {
    height: '100%',
  },
  targetProgressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  quickStatsBox: {
    flex: 1,
    marginHorizontal: 4,
  },
  quickStatsVal: {
    fontSize: 24,
    marginTop: 4,
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
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 16,
  },
  modalDeleteBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingBottom: 80,
  },
  modalSectionLabel: {
    fontSize: 11,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  titleInput: {
    borderWidth: 1,
    fontSize: 15,
    height: 48,
    marginBottom: 16,
  },
  calendarWrapper: {
    padding: 16,
  },
  calendarMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthNavBtn: {
    padding: 8,
  },
  calendarMonthText: {
    fontSize: 18,
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekdayHeaderText: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: 10,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  calendarDayCell: {
    width: '14.2%',
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  calendarDayText: {
    fontSize: 14,
  },
  calSelectionCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  targetTimelineContainer: {
    position: 'relative',
    paddingLeft: 12,
    marginTop: 10,
  },
  targetVerticalLine: {
    position: 'absolute',
    left: 45,
    top: 10,
    bottom: 10,
    width: 2,
  },
  targetTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  targetTimeWrapper: {
    width: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetTimeText: {
    fontSize: 12,
  },
  targetNodeWrapper: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  targetNodeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCardWrapper: {
    flex: 1,
    marginLeft: 10,
  },
  targetStepInput: {
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
  },
  calActionsRow: {
    flexDirection: 'row',
  },
});
