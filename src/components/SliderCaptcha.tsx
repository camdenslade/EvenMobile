//********************************************************************
//
// SliderCaptcha Component
//
// A security slider component requiring the user to drag a handle to
// the far right before continuing. Used to prevent accidental taps or
// bot-like behavior. On success, handle snaps to end, checkmark appears,
// and onVerified callback is triggered.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the slider captcha
//
// Value Parameters
// ----------------
// onVerified    () => void    Callback triggered on successful verification
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// SLIDER_WIDTH    number              Width of slider track (260)
// HANDLE_SIZE      number              Size of draggable handle (40)
// MAX_X            number              Maximum horizontal position
// animatedX        Animated.Value     Animation value for horizontal position
// verified         boolean            Whether slider has been verified
// clamped          number              Clamped gesture delta X value
// passed           boolean             Whether verification threshold passed
//
//*******************************************************************

import { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated } from 'react-native';
import { useTheme } from '../context/ThemeProvider';

interface Props {
  onVerified: () => void;
}

export function SliderCaptcha({ onVerified }: Props) {
  const { colors, isDark } = useTheme();
  const SLIDER_WIDTH = 260;
  const HANDLE_SIZE = 40;
  const MAX_X = SLIDER_WIDTH - HANDLE_SIZE - 10;

  const animatedX = useRef(new Animated.Value(0)).current;

  const [verified, setVerified] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => !verified,

      onPanResponderMove: (_evt, gesture) => {
        if (verified) return;

        const clamped = Math.min(Math.max(gesture.dx, 0), MAX_X);
        animatedX.setValue(clamped);
      },

      onPanResponderRelease: (_evt, gesture) => {
        if (verified) return;

        const passed = gesture.dx >= MAX_X * 0.95;

        if (passed) {
          setVerified(true);

          Animated.timing(animatedX, {
            toValue: MAX_X,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            // Once verified, lock the slider in place by disabling pan handlers
            // and leave the handle snapped to the end.
            onVerified();
          });
        } else {
          Animated.spring(animatedX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.track,
          {
            backgroundColor: isDark ? colors.card : colors.border,
            borderColor: colors.border,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.handle,
            { borderColor: colors.border },
            verified && styles.handleVerified,
            verified && { backgroundColor: colors.accent },
            { transform: [{ translateX: animatedX }] },
          ]}
          {...panResponder.panHandlers}
        >
          <Text style={[styles.handleText, { color: verified ? colors.buttonText : colors.text }]}>
            {verified ? '✓' : '>>'}
          </Text>
        </Animated.View>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>
        {verified ? 'Verified' : 'Slide to verify'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 25,
    alignItems: 'center',
  },

  track: {
    width: 260,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  handle: {
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  handleVerified: {
    backgroundColor: '#4CAF50',
  },

  handleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },

  label: {
    marginTop: 10,
    fontSize: 14,
  },
});
