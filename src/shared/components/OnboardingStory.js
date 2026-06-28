import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Modal, Pressable, Image, Dimensions, Platform, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../core/theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const slidesData = [
  {
    title: '',
    text: [],
    image: require('../../../assets/onboarding/main.png'),
  },
  {
    title: 'THE CHASE',
    text: ['Everyone sees the lights.', 'The cars.', 'The city.', 'The lifestyle.', '', 'Almost nobody sees the chase.'],
    image: require('../../../assets/onboarding/s1.png'),
  },
  {
    title: 'THE TEMPTATION',
    text: ['Anyone can find company.', 'Anyone can chase pleasure.', '', 'UltraPremiums...', 'finish the mission first.'],
    image: require('../../../assets/onboarding/s2.png'),
  },
  {
    title: 'THE DISCIPLINE',
    text: ['While the city sleeps...', 'Legends keep building.', '', 'Every decision today...', 'writes tomorrow\'s reputation.'],
    image: require('../../../assets/onboarding/s3.png'),
  },
  {
    title: 'THE EMPIRE',
    text: ['Respect wasn\'t given.', 'It wasn\'t bought.', 'It was earned.', '', 'One completed mission at a time.'],
    image: require('../../../assets/onboarding/s4.png'),
  },
  {
    title: 'THE AURA',
    text: ['The lifestyle isn\'t the goal.', 'It\'s the consequence.', '', 'Money follows. Status follows. People follow.', 'Because discipline comes first.'],
    image: require('../../../assets/onboarding/s5.png'),
  },
  {
    title: 'WELCOME',
    text: ['Every city has dreamers.', 'Every city has talkers.', 'Very few become UltraPremium.', '', 'Welcome to UltraPremium HomoSapien.', 'Complete the mission.'],
    image: require('../../../assets/onboarding/s6.png'),
    isLast: true,
  },
];

const safeUnloadSound = async (soundObject) => {
  if (!soundObject) return;
  try {
    const status = await soundObject.getStatusAsync();
    if (status && status.isLoaded) {
      await soundObject.stopAsync().catch(() => {});
      await soundObject.unloadAsync().catch(() => {});
    }
  } catch (err) {
    // Catch all to avoid unhandled promises
  }
};

export default function OnboardingStory({ isVisible, onClose, isForceWatch = false }) {
  const { theme } = useTheme();
  const { colors, roundness } = theme;
  const insets = useSafeAreaInsets();

  const [sound, setSound] = useState(null);
  const [duration, setDuration] = useState(21000); // 21s default fallback
  const [activeIndex, setActiveIndex] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const activeIndexRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const intervalRef = useRef(null);

  // Animated values for Ken Burns Zoom and Cross-Fades
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Sync index ref
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Transition controller that smoothly fades out current slide, swaps index, and fades in new slide
  const transitionToSlide = (nextIndex, slideDuration) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // 1. Fade out current image
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350, // Fades out previous slide
      useNativeDriver: true,
    }).start(() => {
      // 2. Swaps index at 0 opacity
      setActiveIndex(nextIndex);

      // 3. Reset zoom scaling and start fade-in + gradual zoom
      scaleAnim.setValue(1.0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500, // Smooth fade-in of new slide
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.15, // Zoom gradually
          duration: Math.max(100, slideDuration - 350), // Subtract fade-out offset
          useNativeDriver: true,
        })
      ]).start(() => {
        isTransitioningRef.current = false;
      });
    });
  };

  // Helper to compute slide index and duration based on elapsed audio track time
  const getSlideParams = (positionMillis, totalDuration) => {
    const slide0Duration = Math.floor(totalDuration / slidesData.length) + 2000; // Logo slide shows 2s extra
    const remainingDuration = totalDuration - slide0Duration;
    const otherSlideDuration = Math.floor(remainingDuration / (slidesData.length - 1));

    if (positionMillis < slide0Duration) {
      return {
        index: 0,
        duration: slide0Duration,
      };
    } else {
      const elapsedAfter0 = positionMillis - slide0Duration;
      const indexAfter0 = Math.floor(elapsedAfter0 / otherSlideDuration);
      const index = Math.min(1 + indexAfter0, slidesData.length - 1);
      return {
        index,
        duration: otherSlideDuration,
      };
    }
  };

  // Load and play onboardingaudio.mp3
  useEffect(() => {
    let soundObject = null;

    async function loadAudio() {
      if (!isVisible) return;
      try {
        const { sound: playbackObject, status } = await Audio.Sound.createAsync(
          require('../../../assets/onboarding/onBoardingaudio.mp3'),
          { shouldPlay: true, isLooping: false }
        );
        soundObject = playbackObject;
        setSound(playbackObject);
        await playbackObject.setProgressUpdateIntervalAsync(100);

        const trackDuration = status.durationMillis || 21000;
        setDuration(trackDuration);

        // Bind slide transitions and progress indicator directly to real-time audio position
        playbackObject.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.durationMillis) {
              const progress = status.positionMillis / status.durationMillis;
              setPlaybackProgress(progress);

              const params = getSlideParams(status.positionMillis, status.durationMillis);
              if (params.index !== activeIndexRef.current && !isTransitioningRef.current) {
                transitionToSlide(params.index, params.duration);
              }
            }
            if (status.didJustFinish) {
              if (isForceWatch) {
                // For onboarding, keep the slideshow on the last slide, showing the complete button
                setActiveIndex(slidesData.length - 1);
                setPlaybackProgress(1);
              } else {
                // Automatically complete the story when music finishes
                handleFinish();
              }
            }
          }
        });

      } catch (err) {
        console.warn('[OnboardingStory] Failed to load sound:', err);
        // Fallback timer if audio fails to load
        setDuration(21000);
        const start = Date.now();
        intervalRef.current = setInterval(() => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / 21000, 1);
          setPlaybackProgress(progress);

          const params = getSlideParams(elapsed, 21000);
          if (params.index !== activeIndexRef.current && !isTransitioningRef.current) {
            transitionToSlide(params.index, params.duration);
          }

          if (progress >= 1) {
            clearInterval(intervalRef.current);
            if (isForceWatch) {
              setActiveIndex(slidesData.length - 1);
              setPlaybackProgress(1);
            } else {
              handleFinish();
            }
          }
        }, 100);
      }
    }

    loadAudio();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (soundObject) {
        safeUnloadSound(soundObject);
      }
    };
  }, [isVisible]);

  // Handle initial slide fade in and zoom on mount
  useEffect(() => {
    if (!isVisible) return;

    fadeAnim.setValue(0);
    scaleAnim.setValue(1.0);
    isTransitioningRef.current = false;

    // Logo slide duration (2 seconds extra)
    const slide0Duration = Math.floor(duration / slidesData.length) + 2000;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800, // Entrance fade
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.15,
        duration: slide0Duration,
        useNativeDriver: true,
      })
    ]).start();
  }, [duration, isVisible]);

  const handleFinish = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (sound) {
      await safeUnloadSound(sound);
      setSound(null);
    }
    onClose();
  };

  if (!isVisible) return null;

  const currentSlide = slidesData[activeIndex];

  return (
    <Modal 
      visible={isVisible} 
      animationType="fade" 
      presentationStyle="overFullScreen" 
      transparent={true} 
      statusBarTranslucent={true}
    >
      <View style={styles.container}>
        {/* Full Screen Image with Fade + Ken Burns Zoom */}
        <Animated.Image 
          source={currentSlide.image} 
          style={[
            styles.backgroundImage,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]} 
          resizeMode={activeIndex === 0 ? 'contain' : 'cover'} 
        />

        {/* Top Story Progress Bar (One unified indicator) */}
        <View style={[styles.progressContainer, { top: Math.max(40, insets.top) }]}>
          <View style={styles.singleProgressBar}>
            <View 
              style={[
                styles.progressBarInner, 
                { 
                  backgroundColor: '#6366F1',
                  width: `${playbackProgress * 100}%` 
                }
              ]} 
            />
          </View>
        </View>

        {/* Skip button in header - hidden if isForceWatch is enabled */}
        {!isForceWatch && (
          <Pressable onPress={handleFinish} style={[styles.skipBtn, { top: Math.max(40, insets.top) + 16 }]}>
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="play-forward-outline" size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </Pressable>
        )}

        {/* Bottom Text Overlay Card - Hidden on Slide 0 */}
        {activeIndex !== 0 && (
          <View style={[styles.textOverlayCard, { bottom: Math.max(24, insets.bottom) + 16 }]}>
            <Text style={styles.slideTitle}>{currentSlide.title}</Text>
            
            <View style={styles.slideBodyWrapper}>
              {currentSlide.text.map((line, idx) => (
                <Text 
                  key={idx} 
                  style={[
                    styles.slideLine,
                    line.startsWith('**') || line.includes('HomoSapien') || line.includes('UltraPremium')
                      ? styles.highlightLine 
                      : null
                  ]}
                >
                  {line.replace(/\*\*/g, '')}
                </Text>
              ))}
            </View>

            {/* Action button on last slide */}
            {activeIndex === slidesData.length - 1 && (
              <Pressable 
                onPress={handleFinish} 
                style={[
                  styles.actionBtn, 
                  { backgroundColor: '#6366F1', borderRadius: roundness.md }
                ]}
              >
                <Text style={styles.actionBtnText}>Complete the Mission 🚀</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  progressContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    zIndex: 5,
  },
  singleProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 76 : 56,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9,9,11,0.6)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    zIndex: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  textOverlayCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    right: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 3,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  slideTitle: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  slideBodyWrapper: {
    alignItems: 'center',
    marginBottom: 4,
  },
  slideLine: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
    marginVertical: 1,
  },
  highlightLine: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 17,
    marginTop: 4,
  },
  actionBtn: {
    marginTop: 20,
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
