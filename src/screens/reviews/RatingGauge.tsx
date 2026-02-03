//********************************************************************
//
// RatingGauge Component
//
// Visual circular gauge component displaying a user's average rating.
// Uses react-native-svg to render an animated circular progress ring.
// Animates from 0 to target progress over 900ms. Displays numeric rating
// in center and metadata (count, best) below. Used in profile screens
// and review summaries.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the rating gauge
//
// Value Parameters
// ----------------
// average    number    User's average rating (0-10 scale)
// count      number    Number of total reviews
// best       number    Highest rating ever received
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// radius              number              Radius of the circular gauge
// strokeWidth         number              Width of the stroke
// circumference       number              Circumference of the circle
// targetProgress      number              Normalized progress (0-1) from average
// progress            number              Current animated progress value
// current             number              Current progress in animation loop
// duration            number              Animation duration in milliseconds
// steps               number              Number of animation steps
// increment           number              Progress increment per step
// interval            number              Time interval between steps
// id                  NodeJS.Timeout      Interval ID for cleanup
// dashOffset          number              Stroke dash offset for progress visualization
//
//*******************************************************************

import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../context/ThemeProvider";

interface RatingGaugeProps {
  average: number; // Expected 0–10
  count: number;   // Number of reviews
  best: number;    // Highest rating
  compact?: boolean; // If true, hide labels for inline display
  colorsOverride?: Partial<{
    text: string;
    subtitle: string;
    textSecondary: string;
    accent: string;
    border: string;
  }>;
}

export function RatingGauge({
  average,
  count,
  best,
  compact = false,
  colorsOverride,
}: RatingGaugeProps) {
  const { colors: themeColors } = useTheme();
  const colors = {
    text: colorsOverride?.text ?? themeColors.text,
    subtitle: colorsOverride?.subtitle ?? themeColors.subtitle,
    textSecondary: colorsOverride?.textSecondary ?? themeColors.textSecondary,
    accent: colorsOverride?.accent ?? themeColors.accent,
    border: colorsOverride?.border ?? themeColors.border,
  };
  const radius = 30;
  const strokeWidth = 4;
  const circumference = 2 * Math.PI * radius;

  const targetProgress = Math.min(Math.max(average / 10, 0), 1);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setProgress(0);

    let current = 0;
    const duration = 900;
    const steps = 60;
    const increment = targetProgress / steps;
    const interval = duration / steps;

    const id = setInterval(() => {
      current += increment;

      if (current >= targetProgress) {
        current = targetProgress;
        clearInterval(id);
      }

      if (!cancelled) {
        setProgress(current);
      }
    }, interval);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [targetProgress]);

  // Start from top and fill counter-clockwise
  // Rotate -90 degrees to start at top (12 o'clock)
  // For counter-clockwise: start with full offset, decrease as progress increases
  const dashOffset = circumference * (1 - progress);

  const styles = getStyles(colors);
  
  return (
    <View
      style={compact ? styles.containerCompact : styles.container}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`Rating gauge. Average ${average.toFixed(
        1
      )} out of 10 from ${count} review${count !== 1 ? "s" : ""}. Best ${best}.`}
    >
      <View style={styles.gaugeWrapper}>
        <Svg width={80} height={80} style={styles.svg}>
          <Circle
            cx={40}
            cy={40}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
            transform="rotate(-90 40 40)"
          />

          <Circle
            cx={40}
            cy={40}
            r={radius}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={-dashOffset}
            transform="rotate(-90 40 40)"
          />
        </Svg>
        <Text style={styles.avg}>{average.toFixed(1)}</Text>
      </View>

      {!compact && (
        <View style={styles.textContainer}>
          <Text style={styles.label}>Average Rating</Text>
          <Text style={styles.sub}>
            {count} Review{count !== 1 ? "s" : ""} • Best: {best}
          </Text>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },

  containerCompact: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
    margin: 0,
  },

  gaugeWrapper: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },

  svg: {
    position: "absolute",
  },

  avg: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  textContainer: {
    marginLeft: 12,
    justifyContent: "center",
  },

  label: {
    color: colors.subtitle,
    fontSize: 14,
  },

  sub: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 13,
  },
});

