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

export interface BirthdayValue {
  year: number;
  month: number; // 0–11
  day: number;   // 1–31
}

export interface BirthdayPickerProps {
  value: BirthdayValue;
  onChange: (v: BirthdayValue) => void;
}

const ITEM_HEIGHT = 42;
const CONTAINER_HEIGHT = 168;
const CENTER_OFFSET = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;
// Must be typed to match ScrollView's decelerationRate: number | 'fast' | 'normal'
const DECELERATION_RATE: number | 'fast' | 'normal' =
  Platform.OS === 'android' ? 0.995 : 'fast';

export function BirthdayPicker({ value, onChange }: BirthdayPickerProps) {
  const { colors } = useTheme();

  const monthRef = useRef<ScrollView>(null);
  const dayRef = useRef<ScrollView>(null);
  const yearRef = useRef<ScrollView>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const daysInMonth = new Date(value.year, value.month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Initial alignment only (do not fight user scroll)
  useEffect(() => {
    monthRef.current?.scrollTo({
      y: value.month * ITEM_HEIGHT,
      animated: false,
    });

    dayRef.current?.scrollTo({
      y: (value.day - 1) * ITEM_HEIGHT,
      animated: false,
    });

    const yearIndex = years.indexOf(value.year);
    if (yearIndex >= 0) {
      yearRef.current?.scrollTo({
        y: yearIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Correct invalid day when month/year changes
  useEffect(() => {
    if (value.day > daysInMonth) {
      onChange({ ...value, day: daysInMonth });

      dayRef.current?.scrollTo({
        y: (daysInMonth - 1) * ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [daysInMonth, onChange, value]);

  const clampIndex = (idx: number, max: number) =>
    Math.max(0, Math.min(max, idx));

  return (
    <View style={styles.container} accessible={false}>
      <View style={styles.selectionOverlay} pointerEvents="none" />

      {/* MONTH */}
      <ScrollView
        ref={monthRef}
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
        onMomentumScrollEnd={(e) => {
          const idx = clampIndex(
            Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT),
            months.length - 1,
          );

          if (idx !== value.month) {
            onChange({ ...value, month: idx });
          }
        }}
      >
        {months.map((m, idx) => {
          const isSelected = value.month === idx;
          return (
            <Pressable
              key={m}
              style={styles.item}
              android_disableSound
              onPress={() => {
                monthRef.current?.scrollTo({
                  y: idx * ITEM_HEIGHT,
                  animated: true,
                });
                onChange({ ...value, month: idx });
              }}
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
              >
                {m}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* DAY */}
      <ScrollView
        ref={dayRef}
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
        onMomentumScrollEnd={(e) => {
          const idx = clampIndex(
            Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT),
            days.length - 1,
          );

          const nextDay = idx + 1;
          if (nextDay !== value.day) {
            onChange({ ...value, day: nextDay });
          }
        }}
      >
        {days.map((d) => {
          const isSelected = value.day === d;
          return (
            <Pressable
              key={d}
              style={styles.item}
              android_disableSound
              onPress={() => {
                dayRef.current?.scrollTo({
                  y: (d - 1) * ITEM_HEIGHT,
                  animated: true,
                });
                onChange({ ...value, day: d });
              }}
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
              >
                {d}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* YEAR */}
      <ScrollView
        ref={yearRef}
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
        onMomentumScrollEnd={(e) => {
          const idx = clampIndex(
            Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT),
            years.length - 1,
          );

          const nextYear = years[idx];
          if (nextYear !== value.year) {
            onChange({ ...value, year: nextYear });
          }
        }}
      >
        {years.map((y, idx) => {
          const isSelected = value.year === y;
          return (
            <Pressable
              key={y}
              style={styles.item}
              android_disableSound
              onPress={() => {
                yearRef.current?.scrollTo({
                  y: idx * ITEM_HEIGHT,
                  animated: true,
                });
                onChange({ ...value, year: y });
              }}
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
              >
                {y}
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






