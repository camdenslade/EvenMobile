//********************************************************************
//
// HeightPicker Component
//
// A 2-column scrollable picker for selecting height (feet and inches).
// Displays feet (4-7) and inches (0-11). Highlights selected values with
// different styling. Calls onChange whenever any height component changes.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the height picker
//
// Value Parameters
// ----------------
// value       HeightValue    Current selected height value
// onChange    function       Callback fired when any height component changes
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors          Object              Theme colors
// feet            number[]            Array of feet values (4-7)
// inches          number[]            Array of inch values (0-11)
// f               number              Feet value in map
// i               number              Inch value in map
// isSelected      boolean             Whether current feet/inch is selected
//
//*******************************************************************

import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeProvider';

export interface HeightValue {
  feet: number;
  inches: number;
}

export interface HeightPickerProps {
  value: HeightValue;
  onChange: (v: HeightValue) => void;
}

const ITEM_HEIGHT = 42;
const CONTAINER_HEIGHT = 168;
const CENTER_OFFSET = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;
// Must be typed to match ScrollView's decelerationRate: number | 'fast' | 'normal'
const DECELERATION_RATE: number | 'fast' | 'normal' =
  Platform.OS === 'android' ? 0.995 : 'fast';

export function HeightPicker({ value, onChange }: HeightPickerProps) {
  const { colors } = useTheme();

  const feetRef = useRef<ScrollView>(null);
  const inchesRef = useRef<ScrollView>(null);

  const feet = Array.from({ length: 4 }, (_, i) => i + 4); // 4–7
  const inches = Array.from({ length: 12 }, (_, i) => i); // 0–11

  // Initial alignment only
  useEffect(() => {
    const feetIndex = feet.indexOf(value.feet);
    if (feetIndex >= 0) {
      feetRef.current?.scrollTo({
        y: feetIndex * ITEM_HEIGHT,
        animated: false,
      });
    }

    inchesRef.current?.scrollTo({
      y: value.inches * ITEM_HEIGHT,
      animated: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clampIndex = (idx: number, max: number) =>
    Math.max(0, Math.min(max, idx));

  return (
    <View
      style={styles.container}
      accessible={false}
      importantForAccessibility="no"
    >
      <View style={styles.selectionOverlay} pointerEvents="none" />

      {/* FEET */}
      <ScrollView
        ref={feetRef}
        style={styles.column}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate={DECELERATION_RATE}
        contentContainerStyle={styles.contentPadding}
        scrollEventThrottle={16}
        bounces
        directionalLockEnabled
        nestedScrollEnabled={Platform.OS === 'android'}
        accessible={false}
        importantForAccessibility="no"
        onMomentumScrollEnd={(e) => {
          const idx = clampIndex(
            Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT),
            feet.length - 1,
          );

          const nextFeet = feet[idx];
          if (nextFeet !== value.feet) {
            onChange({ ...value, feet: nextFeet });
          }
        }}
      >
        {feet.map((f, idx) => {
          const isSelected = value.feet === f;
          return (
            <Pressable
              key={f}
              style={styles.item}
              android_disableSound
              onPress={() => {
                feetRef.current?.scrollTo({
                  y: idx * ITEM_HEIGHT,
                  animated: true,
                });
                onChange({ ...value, feet: f });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${f} feet`}
              accessibilityHint="Selects this feet value"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.text,
                  {
                    color: isSelected ? colors.text : colors.subtitle,
                    fontWeight: isSelected ? '600' : '400',
                    fontSize: isSelected ? 20 : 18,
                  },
                ]}
                accessible={false}
                importantForAccessibility="no"
              >
                {f}'
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* INCHES */}
      <ScrollView
        ref={inchesRef}
        style={styles.column}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate={DECELERATION_RATE}
        contentContainerStyle={styles.contentPadding}
        scrollEventThrottle={16}
        bounces
        directionalLockEnabled
        nestedScrollEnabled={Platform.OS === 'android'}
        accessible={false}
        importantForAccessibility="no"
        onMomentumScrollEnd={(e) => {
          const idx = clampIndex(
            Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT),
            inches.length - 1,
          );

          if (idx !== value.inches) {
            onChange({ ...value, inches: idx });
          }
        }}
      >
        {inches.map((i) => {
          const isSelected = value.inches === i;
          return (
            <Pressable
              key={i}
              style={styles.item}
              android_disableSound
              onPress={() => {
                inchesRef.current?.scrollTo({
                  y: i * ITEM_HEIGHT,
                  animated: true,
                });
                onChange({ ...value, inches: i });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${i} inches`}
              accessibilityHint="Selects this inch value"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.text,
                  {
                    color: isSelected ? colors.text : colors.subtitle,
                    fontWeight: isSelected ? '600' : '400',
                    fontSize: isSelected ? 20 : 18,
                  },
                ]}
                accessible={false}
                importantForAccessibility="no"
              >
                {i}"
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    height: CONTAINER_HEIGHT,
    position: 'relative',
  },
  selectionOverlay: {
    position: 'absolute',
    top: CENTER_OFFSET,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
  },
  column: {
    flex: 1,
  },
  contentPadding: {
    paddingVertical: CENTER_OFFSET,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
  },
});
