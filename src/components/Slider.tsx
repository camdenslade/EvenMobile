//********************************************************************
//
// Slider Component
//
// Touch and drag slider for numeric values. Supports min/max bounds
// and step increments. Uses PanResponder for smooth dragging.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the slider
//
// Value Parameters
// ----------------
// value           number        Current slider value
// onValueChange   function      Callback when value changes
// min             number        Minimum value (default: 0)
// max             number        Maximum value (default: 100)
// step            number        Step increment (default: 1)
// label           string        Label text
// formatValue     function      Optional formatter for display
//
//*******************************************************************

import { useRef, useEffect } from "react";
import { View, Text, StyleSheet, PanResponder, Animated } from "react-native";
import { useTheme } from "../context/ThemeProvider";

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  formatValue?: (value: number) => string;
  gradient?: string[];
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  formatValue,
  gradient,
}: SliderProps) {
  const { colors } = useTheme();
  const trackWidth = useRef(0);
  const pan = useRef(new Animated.Value(0)).current;
  const isDragging = useRef(false);
  const currentX = useRef(0);
  const startX = useRef(0);

  // Helper functions (copied from PreferencesScreen RangeSlider)
  const valueToX = (val: number) =>
    trackWidth.current * ((val - min) / (max - min));

  const xToValue = (x: number) => {
    const rawValue = min + (x / trackWidth.current) * (max - min);
    return Math.min(max, Math.max(min, rawValue));
  };

  const roundValue = (val: number) => {
    return Math.round(val / step) * step;
  };

  // Sync position when value changes externally
  useEffect(() => {
    if (trackWidth.current === 0 || isDragging.current) return;
    const x = valueToX(value);
    currentX.current = x;
    pan.setValue(x);
  }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = true;
        startX.current = currentX.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        if (trackWidth.current === 0) return;
        const dx = gesture.dx;
        const newX = Math.min(
          trackWidth.current,
          Math.max(0, startX.current + dx),
        );

        // Update position smoothly during drag
        let newVal = roundValue(xToValue(newX));
        newVal = Math.max(min, Math.min(max, newVal));
        const xPos = valueToX(newVal);
        currentX.current = xPos;
        pan.setValue(xPos);
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        const rawVal = xToValue(currentX.current);
        const roundedVal = roundValue(rawVal);
        const clampedRounded = Math.min(max, Math.max(min, roundedVal));
        const roundedX = valueToX(clampedRounded);
        currentX.current = roundedX;
        pan.setValue(roundedX);
        onValueChange(clampedRounded);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const displayValue = formatValue ? formatValue(value) : value.toString();
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>{label}: {displayValue}</Text>
      )}
      <View
        style={[styles.track, { backgroundColor: gradient ? 'transparent' : colors.card }]}
        onLayout={(event) => {
          trackWidth.current = event.nativeEvent.layout.width;
          const x = valueToX(value);
          currentX.current = x;
          pan.setValue(x);
        }}
      >
        {gradient ? (
          <View style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: 2,
            overflow: 'hidden',
            flexDirection: 'row',
          }}>
            {(() => {
              // Create smooth gradient by interpolating between colors
              const segmentCount = gradient.length - 1;
              const stepsPerSegment = 100; // More steps = smoother gradient, no visible lines
              const totalSteps = segmentCount * stepsPerSegment;
              const steps = [];
              const stepWidth = 100 / totalSteps; // Percentage width for each step

              for (let i = 0; i <= totalSteps; i++) {
                const position = i / totalSteps;
                const segmentIndex = Math.floor(position * segmentCount);
                const nextSegmentIndex = Math.min(segmentIndex + 1, gradient.length - 1);
                const segmentPosition = (position * segmentCount) - segmentIndex;

                // Linear interpolation between two colors
                const color1 = gradient[segmentIndex];
                const color2 = gradient[nextSegmentIndex];

                // Parse hex colors
                const r1 = parseInt(color1.slice(1, 3), 16);
                const g1 = parseInt(color1.slice(3, 5), 16);
                const b1 = parseInt(color1.slice(5, 7), 16);
                const r2 = parseInt(color2.slice(1, 3), 16);
                const g2 = parseInt(color2.slice(3, 5), 16);
                const b2 = parseInt(color2.slice(5, 7), 16);

                // Interpolate
                const r = Math.round(r1 + (r2 - r1) * segmentPosition);
                const g = Math.round(g1 + (g2 - g1) * segmentPosition);
                const b = Math.round(b1 + (b2 - b1) * segmentPosition);

                const interpolatedColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

                steps.push(
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${i * stepWidth}%`,
                      width: `${stepWidth + 0.5}%`, // Slight overlap to prevent gaps
                      height: '100%',
                      backgroundColor: interpolatedColor,
                    }}
                  />
                );
              }

              return steps;
            })()}
          </View>
        ) : (
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors.accent,
                width: `${percentage}%`,
              },
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: colors.accent,
              transform: [{ translateX: pan }],
            },
          ]}
          {...panResponder.panHandlers}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "600",
  },
  track: {
    height: 4,
    borderRadius: 2,
    position: "relative",
    justifyContent: "center",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    position: "absolute",
    left: 0,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: "absolute",
    marginLeft: -10,
    borderWidth: 2,
    borderColor: "white",
  },
});

