//********************************************************************
//
// SwipeDeck Component
//
// PanResponder-based swipe deck with plus button for profile access.
// The plus button in the top-right corner opens the profile view,
// eliminating touch conflicts with swipe gestures.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the swipe deck
//
// Value Parameters
// ----------------
// profiles         UserProfile[]     Array of profiles to swipe
// onSkip           function          Callback when user swipes left/right
// onLike           function          Callback when user swipes up
// onPressProfile   function          Callback when plus button is pressed
//
// Reference Parameters
// --------------------
// ref              SwipeDeckRef      Ref to expose swipeUp method
//
// Local Variables
// ---------------
// top              UserProfile|null  Top profile in queue
// next             UserProfile|null  Next profile in queue
// translateX       Animated.Value    Horizontal translation animation
// translateY       Animated.Value    Vertical translation animation
// rotateAnim       Animated.Value    Rotation animation
// scaleAnim        Animated.Value    Scale animation
// isAnimatingRef   boolean           Whether animation is in progress
// lastYRef         number            Last Y position during drag
// rotateFromDrag   Animated.Interpolation Rotation from horizontal drag
// rotateUp         Animated.Interpolation Rotation from swipe up
// animatedStyle    Object            Combined transform styles
// swipeOff         function          Function to animate card off screen
// swipeUp          function          Function to animate card up (like)
// responder        PanResponder      Gesture responder for swipes
//
//********************************************************************

import {
  useRef,
  memo,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  Easing,
  TouchableOpacity,
  Text,
  AccessibilityInfo,
  Platform,
  useWindowDimensions,
} from "react-native";

import type { UserProfile } from "../types/user";
import { SwipeCard } from "./SwipeCard";
import { getSwipeCardDimensions } from "../utils/responsive";


interface Props {
  profiles: UserProfile[];
  onSkip: () => void;
  onLike: () => void;
  onPressProfile: (userId: string) => void;
}

export interface SwipeDeckRef {
  swipeUp: () => void;
  swipeUpCustom: (onComplete: () => void) => void;
}

const SwipeDeckComponent = forwardRef<SwipeDeckRef, Props>((props, ref) => {
  const { profiles, onSkip, onLike, onPressProfile } = props;

  // Responsive card dimensions
  const { width, height } = useWindowDimensions();
  const { width: CARD_WIDTH, height: CARD_HEIGHT } = useMemo(
    () => getSwipeCardDimensions(width, height),
    [width, height]
  );

  const cleanedProfiles = useMemo(
    () => profiles.filter((p) => Boolean(p && p.userUid)),
    [profiles],
  );
  const top = cleanedProfiles[0] ?? null;
  const next = cleanedProfiles[1] ?? null;

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const enterAnim = useRef(new Animated.Value(1)).current;

  const isAnimatingRef = useRef(false);
  const lastYRef = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    return () => subscription?.remove();
  }, []);

  useLayoutEffect(() => {
    translateX.setValue(0);
    translateY.setValue(0);
    rotateAnim.setValue(0);
    scaleAnim.setValue(1);
    lastYRef.current = 0;
    enterAnim.setValue(0);
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [top?.id]);

  const rotateFromDrag = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-180, 0, 180],
        outputRange: ["-15deg", "0deg", "15deg"],
        extrapolate: "clamp",
      }),
    [translateX]
  );

  const rotateUp = useMemo(
    () =>
      rotateAnim.interpolate({
        inputRange: [0, 15],
        outputRange: ["0deg", "15deg"],
      }),
    [rotateAnim]
  );

  const enterOpacity = useMemo(
    () => enterAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.88, 1],
    }),
    [enterAnim]
  );

  const enterScale = useMemo(
    () => enterAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.92, 1],
    }),
    [enterAnim]
  );

  const animatedStyle = useMemo(
    () => ({
      opacity: enterOpacity,
      transform: [
        { translateX },
        { translateY },
        { rotate: rotateFromDrag },
        { rotate: rotateUp },
        { scale: scaleAnim },
        { scale: enterScale },
      ],
    }),
    [translateX, translateY, rotateFromDrag, rotateUp, scaleAnim, enterOpacity, enterScale]
  );

  const swipeOff = useCallback(
    (toRight: boolean) => {
      if (isAnimatingRef.current || !top) return;

      isAnimatingRef.current = true;

      const resetAndSkip = () => {
        onSkip();
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, 100);
      };

      if (reduceMotion) {
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(resetAndSkip);
      } else {
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: toRight ? 600 : -600,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(translateY, {
            toValue: lastYRef.current,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]).start(resetAndSkip);
      }
    },
    [top, reduceMotion, translateX, translateY, scaleAnim, rotateAnim, onSkip]
  );

  const swipeUp = useCallback(() => {
    if (isAnimatingRef.current || !top) return;

      isAnimatingRef.current = true;

      const resetAndLike = () => {
        onLike();
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, 100);
      };

      if (reduceMotion) {
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(resetAndLike);
      } else {
        Animated.parallel([
        Animated.timing(translateY, {
          toValue: -900,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(rotateAnim, {
          toValue: 15,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start(resetAndLike);
    }
  }, [top, reduceMotion, translateY, rotateAnim, scaleAnim, translateX, onLike]);

  const swipeUpCustom = useCallback(
    (onComplete: () => void) => {
      if (isAnimatingRef.current || !top) return;

      isAnimatingRef.current = true;

      const finish = () => {
        onComplete();
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, 100);
      };

      if (reduceMotion) {
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(finish);
      } else {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -900,
            duration: 220,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(rotateAnim, {
            toValue: 15,
            duration: 220,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]).start(finish);
      }
    },
    [top, reduceMotion, translateY, rotateAnim, scaleAnim, translateX]
  );

  useImperativeHandle(ref, () => ({ swipeUp, swipeUpCustom }));

  //********************************************************************
  //
  // restoreCard Function
  //
  // Restores card to center position after incomplete swipe gesture.
  // Uses spring animation for smooth restore or simple timing for reduced
  // motion preference.
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
  const restoreCard = useCallback(() => {
    if (reduceMotion) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start(() => {
        lastYRef.current = 0;
      });
    } else {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
      ]).start(() => {
        lastYRef.current = 0;
      });
    }
  }, [reduceMotion, translateX, translateY]);

  //********************************************************************
  //
  // PanResponder Configuration
  //
  // Handles swipe left/right gestures on profile cards. Detects swipe
  // thresholds based on distance and velocity, triggers swipe animations,
  // and restores card position for incomplete gestures. No tap detection
  // needed since profile opening is handled by the plus button.
  //
  //*******************************************************************
  const plusButtonSize = Platform.OS === "ios" ? 44 : 48;
  const plusButtonRight = 12;
  const plusButtonTop = 12;
  
  const isTouchInPlusButton = (evt: any) => {
    try {
      const { pageX, pageY } = evt.nativeEvent || {};
      if (pageX === undefined || pageY === undefined) return false;
      
      // Get the card's position - it's centered in the wrapper
      const cardLeft = (width - CARD_WIDTH) / 2;
      const cardTop = 58; // From styles.cardWrapper.top
      const buttonLeft = cardLeft + CARD_WIDTH - plusButtonRight - plusButtonSize;
      const buttonRight = cardLeft + CARD_WIDTH - plusButtonRight;
      const buttonTop = cardTop + plusButtonTop;
      const buttonBottom = cardTop + plusButtonTop + plusButtonSize;
      
      return pageX >= buttonLeft && pageX <= buttonRight && 
             pageY >= buttonTop && pageY <= buttonBottom;
    } catch {
      return false;
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (isAnimatingRef.current) return false;
        // Don't capture touches in the plus button area
        return !isTouchInPlusButton(evt);
      },
      onMoveShouldSetPanResponder: (evt) => {
        if (isAnimatingRef.current) return false;
        // Don't capture touches in the plus button area
        return !isTouchInPlusButton(evt);
      },

      onPanResponderGrant: () => {
        enterAnim.stopAnimation();
        enterAnim.setValue(1);
        if (isAnimatingRef.current) {
          translateX.stopAnimation();
          translateY.stopAnimation();
          rotateAnim.stopAnimation();
          isAnimatingRef.current = false;
        }
      },

      onPanResponderMove: (_evt, gesture) => {
        if (isAnimatingRef.current) return;

        translateX.setValue(gesture.dx);
        translateY.setValue(gesture.dy);
        lastYRef.current = gesture.dy;
      },

      onPanResponderRelease: (_evt, gesture) => {
        if (isAnimatingRef.current) return;

        const absDx = Math.abs(gesture.dx);
        const absVx = Math.abs(gesture.vx);

        if (
          gesture.dx > 100 ||
          (gesture.dx > 40 && gesture.vx > 0.5) ||
          (absDx > 80 && absVx > 0.6 && gesture.dx > 0)
        ) {
          return swipeOff(true);
        }

        if (
          gesture.dx < -100 ||
          (gesture.dx < -40 && gesture.vx < -0.5) ||
          (absDx > 80 && absVx > 0.6 && gesture.dx < 0)
        ) {
          return swipeOff(false);
        }

        restoreCard();
      },
    })
  ).current;

  if (!top) return null;

  const firstName = useMemo(() => top.name.split(" ")[0], [top.name]);
  const profileLabel = useMemo(
    () => `Profile card for ${firstName}, age ${top.age}`,
    [firstName, top.age]
  );

  return (
    <View 
      style={styles.wrapper}
      accessible={false}
      importantForAccessibility="no"
    >
      {next && (
        <Animated.View
          key={`next-${next.userUid}`}
          style={[styles.nextCardWrapper, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
          accessible={false}
          importantForAccessibility="no"
        >
          <SwipeCard profile={next} />
        </Animated.View>
      )}

      <Animated.View
        key={`top-${top.userUid}`}
        style={[styles.cardWrapper, { width: CARD_WIDTH, height: CARD_HEIGHT }, animatedStyle]}
        {...responder.panHandlers}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        collapsable={false}
        accessible={true}
        accessibilityLabel={profileLabel}
        accessibilityRole="button"
        accessibilityHint="Swipe left to skip, right to like, or up to super like. Use buttons below for alternative actions."
        accessibilityActions={[
          { name: "activate", label: "Like profile" },
          { name: "longpress", label: "Skip profile" },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "activate") {
            swipeUp();
          } else if (event.nativeEvent.actionName === "longpress") {
            swipeOff(false);
          }
        }}
        pointerEvents="box-none"
      >
        <SwipeCard profile={top} />
        
        <TouchableOpacity
          style={styles.plusButton}
          onPress={() => {
            if (top && top.userUid) {
              onPressProfile(top.userUid);
            }
          }}
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel={`View full profile of ${top.name.split(" ")[0]}`}
          accessibilityRole="button"
          accessibilityHint="Opens detailed profile view"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={styles.plusIcon}
            accessible={false}
            importantForAccessibility="no"
          >
            +
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

const SwipeDeck = memo(SwipeDeckComponent);
export default SwipeDeck;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    position: "relative",
    pointerEvents: "box-none",
  },
  cardWrapper: {
    position: "absolute",
    top: 58,
    zIndex: 10,
  },
  nextCardWrapper: {
    position: "absolute",
    top: 40,
    opacity: 0.88,
    zIndex: 5,
    transform: [{ scale: 0.92 }],
  },
  plusButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: Platform.OS === "ios" ? 44 : 48,
    height: Platform.OS === "ios" ? 44 : 48,
    minWidth: Platform.OS === "ios" ? 44 : 48,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    borderRadius: Platform.OS === "ios" ? 22 : 24,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  plusIcon: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 28,
    includeFontPadding: false,
  },
});
