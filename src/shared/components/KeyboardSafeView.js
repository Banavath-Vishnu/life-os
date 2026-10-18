import React from 'react';
import { KeyboardAvoidingView } from 'react-native';

/**
 * Shrinks its content by the part of the screen the keyboard covers.
 *
 * Uses 'padding' on both platforms: with Android edge-to-edge the window no longer
 * resizes for the keyboard, and KeyboardAvoidingView only pads by the actual overlap
 * with its own frame, so it never double-adjusts if the window does resize.
 */
export default function KeyboardSafeView({ style, children, ...rest }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]} {...rest}>
      {children}
    </KeyboardAvoidingView>
  );
}
