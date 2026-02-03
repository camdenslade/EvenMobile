//********************************************************************
//
// GlobalBackground Component
//
// Renders animated background shapes (circles and rectangle) that drift
// slowly across the screen. Shapes adapt to theme mode (dark/light) with
// different opacity values. Uses pointerEvents="none" to allow touches
// to pass through.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing animated background
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
// mode          string            Theme mode ("dark"|"light")
// driftA        Animated.Value    Animation value for first circle
// driftB        Animated.Value    Animation value for second circle
// driftC        Animated.Value    Animation value for rectangle
// shapeColor     string            Color of shapes (white for dark, black for light)
// opacity        number            Opacity of shapes (0.10 for dark, 0.12 for light)
// v              Animated.Value    Animation value parameter
// shift          number            Translation distance for animation
// d              number            Animation duration in milliseconds
//
//*******************************************************************

import { View, StyleSheet, Animated, Dimensions } from "react-native";
import { useRef, useEffect, useContext } from "react";
import { ThemeContext } from "../context/ThemeProvider";

const { width, height } = Dimensions.get("window");

export default function GlobalBackground() {
  const { mode, colors } = useContext(ThemeContext);

  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const driftC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    //********************************************************************
    //
    // animate Function
    //
    // Creates a looping animation that moves an Animated.Value between
    // 0 and a shift value over a specified duration.
    //
    // Return Value
    // ------------
    // void
    //
    // Value Parameters
    // ----------------
    // v       Animated.Value    Animation value to animate
    // shift   number            Translation distance
    // d       number            Animation duration (default 9000ms)
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
    const animate = (v: Animated.Value, shift: number, d = 9000) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: shift, duration: d, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: d, useNativeDriver: true }),
        ])
      ).start();
    };

    animate(driftA, 35);
    animate(driftB, 55, 11000);
    animate(driftC, 40, 13000);
  }, []);

  const circleColor = colors.circle;
  const rectColor = colors.shapeRect;
  const circleOpacity =
    mode === "default" ? 0.22 : mode === "custom" ? 0.18 : 0.12;
  const rectOpacity =
    mode === "default" ? 0.18 : mode === "custom" ? 0.14 : 0.1;

  return (
    <View pointerEvents="none" style={styles.container}>
      <Animated.View
        style={[
          styles.circle,
          {
            backgroundColor: circleColor,
            opacity: circleOpacity,
            width: 320,
            height: 320,
            top: -90,
            left: -110,
            transform: [{ translateY: driftA }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.circle,
          {
            backgroundColor: circleColor,
            opacity: circleOpacity * 0.75,
            width: 200,
            height: 200,
            bottom: 110,
            right: -60,
            transform: [{ translateX: driftB }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.rect,
          {
            backgroundColor: rectColor,
            opacity: rectOpacity,
            bottom: mode === "default" ? 120 : 140,
            left: mode === "default" ? -width * 0.02 : -width * 0.18,
            width: mode === "default" ? width * 1.12 : width * 1.4,
            transform: [
              { rotate: mode === "default" ? "-8deg" : "-10deg" },
              { translateX: driftC },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  circle: {
    position: "absolute",
    borderRadius: 999,
  },
  rect: {
    position: "absolute",
    width: width * 1.4,
    height: 220,
    borderRadius: 30,
  },
});
