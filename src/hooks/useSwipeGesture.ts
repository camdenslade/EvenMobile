//********************************************************************
//
// useSwipeGesture Hook
//
// This React hook provides horizontal pan gesture handling for swipeable
// cards. Implements translate and rotate animations, snap-back on
// insufficient swipe, and off-screen animation when threshold is passed.
//
// Return Value
// ------------
// Object containing:
//   panHandlers    PanResponderHandlers    Event handlers for card
//   animatedStyle  AnimatedStyle           Style object for animations
//
// Value Parameters
// ----------------
// onSwipe    (direction: 'LEFT'|'RIGHT') => void    Callback on successful swipe
//
// Reference Parameters
// --------------------
// None (React hook)
//
// Local Variables
// ---------------
// translateX    Animated.Value    Horizontal translation value
// rotate        Animated.Interpolation    Rotation interpolation
// animatedStyle Object            Style object with transforms
//
//*******************************************************************

import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

interface Params {
  onSwipe: (direction: 'LEFT' | 'RIGHT') => void;
}

export function useSwipeGesture({ onSwipe }: Params) {
  const translateX = useRef(new Animated.Value(0)).current;

  const rotate = translateX.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ['-20deg', '0deg', '20deg'],
    extrapolate: 'clamp',
  });

  const animatedStyle = {
    transform: [{ translateX }, { rotate }],
  };

  //********************************************************************
  //
  // resetPosition Function
  //
  // Resets the card to its original position using a spring animation.
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
  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  //********************************************************************
  //
  // swipeOffScreen Function
  //
  // Animates the card off screen in the specified direction, then
  // resets position and calls the onSwipe callback.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // direction    'LEFT'|'RIGHT'    Direction to swipe card
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
  const swipeOffScreen = (direction: 'LEFT' | 'RIGHT') => {
    Animated.timing(translateX, {
      toValue: direction === 'LEFT' ? -500 : 500,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      onSwipe(direction);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderMove: (_evt, gesture) => {
        translateX.setValue(gesture.dx);
      },

      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > 120) {
          swipeOffScreen('RIGHT');
          return;
        }

        if (gesture.dx < -120) {
          swipeOffScreen('LEFT');
          return;
        }

        resetPosition();
      },
    }),
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
    animatedStyle,
  };
}
