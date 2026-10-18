import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much of the bottom of the screen the keyboard covers.
 *
 * Android reports the keyboard height *above* the navigation bar, and our screens draw
 * edge-to-edge (behind the nav bar), so the covered area is keyboard + nav bar.
 * iOS reports the full height from the bottom of the screen.
 * (React Native's KeyboardAvoidingView mixes screen and window coordinates inside
 * edge-to-edge Modals, which left a large gap above the keyboard.)
 */
export function useKeyboardOverlap() {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates?.height || 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (!keyboardHeight) return 0;
  return Platform.OS === 'android' ? keyboardHeight + insets.bottom : keyboardHeight;
}

/**
 * Pads its bottom by the part of the screen the keyboard covers, so content above stays visible.
 * If the system already shrank the window for the keyboard, it adds nothing (no double gap).
 *
 * `children` may be a function receiving { keyboardOverlap, height } for layouts that need
 * the numbers (e.g. sizing a bottom sheet to the space that's left).
 */
export default function KeyboardSafeView({ style, children, ...rest }) {
  const overlap = useKeyboardOverlap();
  const [height, setHeight] = useState(0);
  const fullHeight = useRef(0);

  const onLayout = (e) => {
    const h = e.nativeEvent.layout.height;
    setHeight(h);
    if (!overlap) fullHeight.current = h; // size with the keyboard closed
    rest.onLayout?.(e);
  };

  // Window already resized by the OS for the keyboard -> nothing left to avoid
  const windowWasResized = overlap > 0 && fullHeight.current > 0 && height < fullHeight.current - overlap / 2;
  const keyboardOverlap = windowWasResized ? 0 : overlap;

  return (
    <View {...rest} style={[{ flex: 1 }, style, { paddingBottom: keyboardOverlap }]} onLayout={onLayout}>
      {typeof children === 'function' ? children({ keyboardOverlap, height }) : children}
    </View>
  );
}
