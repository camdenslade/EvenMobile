//********************************************************************
//
// BottomButtons Component
//
// Renders three main buttons for the swipe interface: undo, center like
// button (with long-press pulse animation), and message button. Center
// button auto-triggers like after 550ms long-press. Opacity reduced when
// disabled. Does not decide whether actions are allowed - parent controls
// disabled states.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the button group
//
// Value Parameters
// ----------------
// disabled    boolean             Whether all buttons are disabled
// onUndo      () => void          Undo button action
// onLike      () => void          Like action (also triggered by long-press)
// onMessage   () => void          Message button action
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// opacity         number                      Global opacity (0.35 if disabled)
// holdTimeout     NodeJS.Timeout|null         Long-press timeout reference
// scale           Animated.Value              Scale animation value
// pulseAnim       Animated.CompositeAnimation|null  Pulse animation reference
//
//*******************************************************************

import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  AccessibilityInfo,
  Text,
} from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppImage } from './AppImage';
import { useTheme } from '../context/ThemeProvider';

interface Props {
  disabled: boolean;
  onUndo: () => void;
  onLike: () => void;
  onMessage: () => void;
  undoTokens?: number;
  messageTokens?: number;
}

export function BottomButtons({ disabled, onUndo, onLike, onMessage, undoTokens, messageTokens }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = disabled ? 0.35 : 1;
  const [reduceMotion, setReduceMotion] = useState(false);

  const holdTimeout = useRef<NodeJS.Timeout | null>(null);

  const scale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    return () => subscription?.remove();
  }, []);

  //********************************************************************
  //
  // startPulse Function
  //
  // Starts looping pulse animation for long-press like button.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // None
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // None
  //
  //*******************************************************************
  const startPulse = () => {
    if (reduceMotion) return; // Skip pulse animation if reduce motion is enabled
    
    pulseAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseAnim.current.start();
  };

  //********************************************************************
  //
  // stopPulse Function
  //
  // Stops pulse animation and resets scale to 1.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // None
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // None
  //
  //*******************************************************************
  const stopPulse = () => {
    if (pulseAnim.current) {
      pulseAnim.current.stop();
      pulseAnim.current = null;
    }
    scale.setValue(1);
  };

  //********************************************************************
  //
  // handlePressIn Function
  //
  // Handles user beginning to press center button. Starts pulse animation
  // for visual feedback. Long-press auto-trigger removed to prevent
  // accidental likes and token consumption.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ---------------- 
  // None
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // None
  //
  //*******************************************************************
  const handlePressIn = () => {
    if (disabled) return;

    // Start pulse animation for visual feedback only
    // Long-press auto-trigger removed to prevent accidental likes
    startPulse();
  };

  //********************************************************************
  //
  // handlePressOut Function
  //
  // Handles user releasing press. Cancels long-press timeout if not
  // triggered and stops pulse animation.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // None
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // None
  //
  //*******************************************************************
  const handlePressOut = () => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    stopPulse();
  };

  // Calculate bottom position accounting for nav bar height
  // Nav bar has: paddingVertical (16 top + 16 bottom) + button minHeight (48) + safe area padding
  // On Android: 16 + 48 + 16 + Math.max(insets.bottom, 20) = ~100px + safe area
  // On iOS: 16 + 48 + 16 + 34 = ~114px
  const navBarTopPadding = 16;
  const navBarButtonHeight = Platform.OS === 'android' ? 48 : 44;
  const navBarBottomPadding = 16;
  const navBarSafeAreaPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 20) : 34;
  const navBarTotalHeight = navBarTopPadding + navBarButtonHeight + navBarBottomPadding + navBarSafeAreaPadding;
  
  // Position buttons above the nav bar
  const dynamicBottom = navBarTotalHeight;

  return (
    <View 
      style={[styles.wrap, { bottom: dynamicBottom }]}
      accessible={false}
      importantForAccessibility="no"
    >
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          onPress={onUndo} 
          disabled={disabled} 
          style={[styles.btn, { backgroundColor: colors.bottomButton }]}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Undo last swipe"
          accessibilityRole="button"
          accessibilityHint="Reverses the last swipe action"
          accessibilityState={{ disabled }}
        >
          <AppImage
            source={require('../../assets/icons/undo.png')}
            style={[styles.icon, { opacity, tintColor: colors.bottomButtonIcon }]}
            accessibilityRole="none"
            contentFit="contain"
          />
        </TouchableOpacity>
        <View style={[styles.tokenCircle, { backgroundColor: isDark ? "#f5f5f5" : "#333333" }]}>
          <Text style={[styles.tokenText, { color: isDark ? "#000000" : "#ffffff" }]} allowFontScaling={true}>
            {undoTokens ?? 0}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        disabled={disabled}
        style={[styles.centerBtn, { backgroundColor: colors.bottomButton }]}
        onPress={onLike}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessible={true}
        accessibilityLabel="Like profile"
        accessibilityRole="button"
        accessibilityHint="Press to like the current profile"
        accessibilityState={{ disabled }}
      >
        <Animated.View
          style={[
            styles.logoIcon,
            { opacity, transform: [{ scale }] },
          ]}
        >
          <AppImage
            source={require('../../assets/images/Even-App-Logos/TransparentBG/EE-SolidWhite.png')}
            style={[styles.logoIcon, { tintColor: colors.bottomButtonIcon }]}
            accessibilityRole="none"
            contentFit="contain"
          />
        </Animated.View>
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={onMessage}
          disabled={disabled}
          style={[styles.btn, { backgroundColor: colors.bottomButton }]}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Message requests"
          accessibilityRole="button"
          accessibilityHint="Sends a message request"
          accessibilityState={{ disabled }}
        >
          <AppImage
            source={require('../../assets/icons/message.png')}
            style={[styles.icon, { opacity, tintColor: colors.bottomButtonIcon }]}
            accessibilityRole="none"
            contentFit="contain"
          />
        </TouchableOpacity>
        <View style={[styles.tokenCircle, { backgroundColor: isDark ? "#f5f5f5" : "#333333" }]}>
          <Text style={[styles.tokenText, { color: isDark ? "#000000" : "#ffffff" }]} allowFontScaling={true}>
            {messageTokens ?? 0}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: Platform.OS === 'android' ? 7 : 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },

  btn: {
    padding: 13,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
  },

  centerBtn: {
    padding: 20,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
  },

  icon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },

  logoIcon: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
  },

  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  tokenCircle: {
    position: 'absolute',
    bottom: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 28,
  },

  tokenText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});
