//********************************************************************
//
// PreferencesScreen Component
//
// Allows users to edit their discovery preferences including age range,
// distance, and personal details (height, race, religion, politics, etc.).
// Uses dual slider for age range and single slider for distance.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the preferences screen
//
// Value Parameters
// ----------------
// navigation    any         Navigation object for routing
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors                  Object                  Theme colors
// loading                 boolean                 Loading state
// error                   string|null             Error message
// prefMinAge              number                  Minimum age preference
// prefMaxAge              number                  Maximum age preference
// prefMaxDistanceMiles   number                  Maximum distance preference
// height                  string                  User's height
// race                    string                  User's race
// religion                string                  User's religion
// politics                string                  User's political views
// education               string                  User's education level
// bodyType                string                  User's body type
// drinking                string                  User's drinking preference
// smoking                 string                  User's smoking preference
// marijuana               string                  User's marijuana preference
// data                    UserProfile|null        Profile data from API
// res                     UserProfile|null        Response from PATCH /profiles/me
//
//*******************************************************************

import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { apiGet, apiPatch } from "../../services/apiService";
import { useTheme } from "../../context/ThemeProvider";
import GlobalBackground from "../../components/GlobalBackground";
import { useAppCache } from "../../services/appCache";
import { Slider } from "../../components/Slider";
import type { UserProfile } from "../../types/user";
import { Animated, PanResponder } from "react-native";
import { InlineAlert } from "../../components/InlineAlert";
import {
  HEIGHT_OPTIONS,
  RACE_OPTIONS,
  RELIGION_OPTIONS,
  POLITICS_OPTIONS,
  EDUCATION_OPTIONS,
  ACTIVITY_LEVEL_OPTIONS,
  DRINKING_OPTIONS,
  SMOKING_OPTIONS,
  MARIJUANA_OPTIONS,
} from "../../constants/profileOptions";

interface PreferencesScreenProps {
  navigation?: any;
}

interface RangeSliderProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  step?: number;
  onChange: (nextMin: number, nextMax: number) => void;
  formatValue?: (v: number) => string;
  label?: string;
}

const rangeStyles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  selected: {
    position: "absolute",
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: "absolute",
    marginLeft: -12,
    borderWidth: 2,
    borderColor: "white",
  },
});

function RangeSlider({
  min,
  max,
  minValue,
  maxValue,
  step = 1,
  onChange,
  formatValue,
  label,
}: RangeSliderProps) {
  const { colors } = useTheme();
  const trackWidth = useRef(0);
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const currentMinRef = useRef(minValue);
  const currentMaxRef = useRef(maxValue);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const currentXLeft = useRef(0);
  const currentXRight = useRef(0);
  const startXLeft = useRef(0);
  const startXRight = useRef(0);

  const valueToX = (val: number) =>
    trackWidth.current * ((val - min) / (max - min));

  const xToValue = (x: number) => {
    const rawValue = min + (x / trackWidth.current) * (max - min);
    return Math.min(max, Math.max(min, rawValue));
  };

  const roundValue = (val: number) => {
    return Math.round(val / step) * step;
  };

  const syncPositions = useCallback(() => {
    if (trackWidth.current === 0) return;
    if (!isDraggingLeft.current) {
      const x = valueToX(minValue);
      currentXLeft.current = x;
      left.setValue(x);
    }
    if (!isDraggingRight.current) {
      const x = valueToX(maxValue);
      currentXRight.current = x;
      right.setValue(x);
    }
  }, [minValue, maxValue]);

  useEffect(() => {
    currentMinRef.current = minValue;
    currentMaxRef.current = maxValue;
    syncPositions();
  }, [syncPositions]);

  const baseResponder = (isLeft: boolean) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (isLeft) {
          isDraggingLeft.current = true;
          startXLeft.current = currentXLeft.current;
        } else {
          isDraggingRight.current = true;
          startXRight.current = currentXRight.current;
        }
      },
      onPanResponderMove: (_evt, gesture) => {
        if (trackWidth.current === 0) return;
        const dx = gesture.dx;
        const startX = isLeft ? startXLeft.current : startXRight.current;
        const newX = Math.min(
          trackWidth.current,
          Math.max(0, startX + dx),
        );
        
        // Update position smoothly during drag
        if (isLeft) {
          let newVal = roundValue(xToValue(newX));
          if (newVal >= currentMaxRef.current) return;
          newVal = Math.max(min, Math.min(max, newVal));
          const xPos = valueToX(newVal);
          currentXLeft.current = xPos;
          left.setValue(xPos);
        } else {
          let newVal = roundValue(xToValue(newX));
          if (newVal <= currentMinRef.current) return;
          newVal = Math.max(min, Math.min(max, newVal));
          const xPos = valueToX(newVal);
          currentXRight.current = xPos;
          right.setValue(xPos);
        }
      },
      onPanResponderRelease: () => {
        if (isLeft) {
          isDraggingLeft.current = false;
          const rawVal = xToValue(currentXLeft.current);
          const roundedVal = roundValue(rawVal);
          const clampedRounded = Math.min(max, Math.max(min, roundedVal));
          const roundedX = valueToX(clampedRounded);
          currentXLeft.current = roundedX;
          left.setValue(roundedX);
          currentMinRef.current = clampedRounded;
          onChange(clampedRounded, currentMaxRef.current);
        } else {
          isDraggingRight.current = false;
          const rawVal = xToValue(currentXRight.current);
          const roundedVal = roundValue(rawVal);
          const clampedRounded = Math.min(max, Math.max(min, roundedVal));
          const roundedX = valueToX(clampedRounded);
          currentXRight.current = roundedX;
          right.setValue(roundedX);
          currentMaxRef.current = clampedRounded;
          onChange(currentMinRef.current, clampedRounded);
        }
      },
      onPanResponderTerminationRequest: () => false,
    });

  const leftResponder = useRef(baseResponder(true)).current;
  const rightResponder = useRef(baseResponder(false)).current;

  const display = (v: number) => (formatValue ? formatValue(v) : v.toString());

  return (
    <View style={{ marginBottom: 20 }}>
      {label && (
        <Text style={[styles.label, { color: colors.subtitle }]}>
          {label}: {display(minValue)} - {display(maxValue)}
        </Text>
      )}
      <View
        style={[rangeStyles.track, { backgroundColor: colors.card }]}
        onLayout={(e) => {
          trackWidth.current = e.nativeEvent.layout.width;
          syncPositions();
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            rangeStyles.selected,
            {
              backgroundColor: colors.accent,
              left,
              width: Animated.subtract(right, left),
            },
          ]}
        />
        <Animated.View
          style={[
            rangeStyles.thumb,
            {
              backgroundColor: colors.accent,
              transform: [{ translateX: left }],
            },
          ]}
          {...leftResponder.panHandlers}
        />
        <Animated.View
          style={[
            rangeStyles.thumb,
            {
              backgroundColor: colors.accent,
              transform: [{ translateX: right }],
            },
          ]}
          {...rightResponder.panHandlers}
        />
      </View>
    </View>
  );
}

export default function PreferencesScreen({
  navigation,
}: PreferencesScreenProps) {
  const { colors } = useTheme();
  const setProfile = useAppCache((s) => s.setProfile);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unsavedChangesModalVisible, setUnsavedChangesModalVisible] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<{
    prefMinAge: number;
    prefMaxAge: number;
    prefMinDistanceMiles: number;
    prefMaxDistanceMiles: number;
    prefMinHeight: number;
    prefMaxHeight: number;
    race: string[];
    religion: string[];
    politics: string[];
    education: string[];
    activityLevel: string;
    drinking: string[];
    smoking: string[];
    marijuana: string[];
    allowOutsideAge: boolean;
    allowOutsideDistance: boolean;
    allowOutsideHeight: boolean;
  } | null>(null);

  const [prefMinAge, setPrefMinAge] = useState(18);
  const [prefMaxAge, setPrefMaxAge] = useState(25);
  const [prefMinDistanceMiles, setPrefMinDistanceMiles] = useState(1);
  const [prefMaxDistanceMiles, setPrefMaxDistanceMiles] = useState(50);
  const [prefMinHeight, setPrefMinHeight] = useState<number>(60); // 5'0" in inches
  const [prefMaxHeight, setPrefMaxHeight] = useState<number>(72); // 6'0" in inches
  const [race, setRace] = useState<string[]>([]);
  const [religion, setReligion] = useState<string[]>([]);
  const [politics, setPolitics] = useState<string[]>([]);
  const [education, setEducation] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<string>("");
  const [drinking, setDrinking] = useState<string[]>([]);
  const [smoking, setSmoking] = useState<string[]>([]);
  const [marijuana, setMarijuana] = useState<string[]>([]);
  const [allowOutsideAge, setAllowOutsideAge] = useState(false);
  const [allowOutsideDistance, setAllowOutsideDistance] = useState(false);
  const [allowOutsideHeight, setAllowOutsideHeight] = useState(false);

  const arraysMatch = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const aSorted = [...a].sort();
    const bSorted = [...b].sort();
    return aSorted.every((val, idx) => val === bSorted[idx]);
  };

  function hasUnsavedChanges(): boolean {
    if (!originalPreferences) return false;
    return (
      prefMinAge !== originalPreferences.prefMinAge ||
      prefMaxAge !== originalPreferences.prefMaxAge ||
      prefMinDistanceMiles !== originalPreferences.prefMinDistanceMiles ||
      prefMaxDistanceMiles !== originalPreferences.prefMaxDistanceMiles ||
      prefMinHeight !== originalPreferences.prefMinHeight ||
      prefMaxHeight !== originalPreferences.prefMaxHeight ||
      allowOutsideAge !== originalPreferences.allowOutsideAge ||
      allowOutsideDistance !== originalPreferences.allowOutsideDistance ||
      allowOutsideHeight !== originalPreferences.allowOutsideHeight ||
      !arraysMatch(race, originalPreferences.race) ||
      !arraysMatch(religion, originalPreferences.religion) ||
      !arraysMatch(politics, originalPreferences.politics) ||
      !arraysMatch(education, originalPreferences.education) ||
      !arraysMatch(drinking, originalPreferences.drinking) ||
      !arraysMatch(smoking, originalPreferences.smoking) ||
      !arraysMatch(marijuana, originalPreferences.marijuana) ||
      activityLevel !== originalPreferences.activityLevel
    );
  }

  function handleBackPress() {
    if (hasUnsavedChanges()) {
      setUnsavedChangesModalVisible(true);
    } else {
      navigation.goBack();
    }
  }

  // Load filter preferences (age, distance, height) - not personal details
  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<UserProfile>("/profiles/me");
        if (data) {
          const nextPrefMinAge = data.prefMinAge ?? 18;
          const nextPrefMaxAge = data.prefMaxAge !== undefined ? Math.min(50, data.prefMaxAge) : 25;
          const nextPrefMinDistanceMiles = data.prefMinDistanceMiles ?? 1;
          const nextPrefMaxDistanceMiles = data.prefMaxDistanceMiles !== undefined ? Math.min(100, data.prefMaxDistanceMiles) : 50;
          const nextPrefMinHeight = data.prefMinHeight ?? 60;
          const nextPrefMaxHeight = data.prefMaxHeight ?? 72;

          // Load only filter preferences (age, distance, height)
          setPrefMinAge(nextPrefMinAge);
          setPrefMaxAge(nextPrefMaxAge);
          setPrefMinDistanceMiles(nextPrefMinDistanceMiles);
          setPrefMaxDistanceMiles(nextPrefMaxDistanceMiles);
          
          // Load height filter preferences (min/max in inches)
          setPrefMinHeight(nextPrefMinHeight);
          setPrefMaxHeight(nextPrefMaxHeight);
          
          // Load filter preferences (what user wants to filter by, not their own details)
          // These start empty if not set, representing no filter preference
          const nextRace = Array.isArray(data.prefRace) ? data.prefRace : [];
          const nextReligion = Array.isArray(data.prefReligion) ? data.prefReligion : [];
          const nextPolitics = Array.isArray(data.prefPolitics) ? data.prefPolitics : [];
          const nextEducation = Array.isArray(data.prefEducation) ? data.prefEducation : [];
          const nextActivityLevel = data.prefActivityLevel ?? "";
          const nextDrinking = Array.isArray(data.prefDrinking) ? data.prefDrinking : [];
          const nextSmoking = Array.isArray(data.prefSmoking) ? data.prefSmoking : [];
          const nextMarijuana = Array.isArray(data.prefMarijuana) ? data.prefMarijuana : [];

          setRace(nextRace);
          setReligion(nextReligion);
          setPolitics(nextPolitics);
          setEducation(nextEducation);
          setActivityLevel(nextActivityLevel);
          setDrinking(nextDrinking);
          setSmoking(nextSmoking);
          setMarijuana(nextMarijuana);
          const expandAge = data.expandAge ?? data.showOutsideRange ?? false;
          const expandDistance =
            data.expandDistance ?? data.showOutsideRange ?? false;
          const expandHeight =
            data.expandHeight ?? data.showOutsideRange ?? false;
          setAllowOutsideAge(expandAge);
          setAllowOutsideDistance(expandDistance);
          setAllowOutsideHeight(expandHeight);

          setOriginalPreferences({
            prefMinAge: nextPrefMinAge,
            prefMaxAge: nextPrefMaxAge,
            prefMinDistanceMiles: nextPrefMinDistanceMiles,
            prefMaxDistanceMiles: nextPrefMaxDistanceMiles,
            prefMinHeight: nextPrefMinHeight,
            prefMaxHeight: nextPrefMaxHeight,
            race: nextRace,
            religion: nextReligion,
            politics: nextPolitics,
            education: nextEducation,
            activityLevel: nextActivityLevel,
            drinking: nextDrinking,
            smoking: nextSmoking,
            marijuana: nextMarijuana,
            allowOutsideAge: expandAge,
            allowOutsideDistance: expandDistance,
            allowOutsideHeight: expandHeight,
          });
        }
      } catch {
        setError("Failed to load preferences.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Convert inches to height string
  function inchesToHeightString(inches: number): string {
    const feet = Math.floor(inches / 12);
    const inch = inches % 12;
    return `${feet}'${inch}"`;
  }

function validatePreferences(): string | null {
    if (prefMinAge < 18 || prefMaxAge > 50 || prefMinAge > prefMaxAge) {
      return "Age range must be between 18 and 50+ with min ≤ max.";
    }
    if (
      prefMinDistanceMiles < 1 ||
      prefMaxDistanceMiles > 100 ||
      prefMinDistanceMiles > prefMaxDistanceMiles
    ) {
      return "Distance must be between 1 and 100 miles with min ≤ max.";
    }
    if (
      prefMinHeight != null &&
      prefMaxHeight != null &&
      prefMinHeight > prefMaxHeight
    ) {
      return "Min height cannot exceed max height.";
    }
    return null;
  }

  // Save preferences
  async function save() {
    const validationError = validatePreferences();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const res = await apiPatch<UserProfile>("/profiles/me", {
        prefMinAge,
        prefMaxAge,
        prefMinDistanceMiles,
        prefMaxDistanceMiles,
        prefMinHeight,
        prefMaxHeight,
        showOutsideRange:
          allowOutsideAge || allowOutsideDistance || allowOutsideHeight,
        expandAge: allowOutsideAge,
        expandDistance: allowOutsideDistance,
        expandHeight: allowOutsideHeight,
        prefRace: race.length > 0 ? race : undefined,
        prefReligion: religion.length > 0 ? religion : undefined,
        prefPolitics: politics.length > 0 ? politics : undefined,
        prefEducation: education.length > 0 ? education : undefined,
        prefActivityLevel: activityLevel || undefined,
        prefDrinking: drinking.length > 0 ? drinking : undefined,
        prefSmoking: smoking.length > 0 ? smoking : undefined,
        prefMarijuana: marijuana.length > 0 ? marijuana : undefined,
      });

      if (!res) {
        setError("Failed to save preferences. Please try again.");
        return;
      }

      setProfile(res);
      setOriginalPreferences({
        prefMinAge,
        prefMaxAge,
        prefMinDistanceMiles,
        prefMaxDistanceMiles,
        prefMinHeight,
        prefMaxHeight,
        race,
        religion,
        politics,
        education,
        activityLevel,
        drinking,
        smoking,
        marijuana,
        allowOutsideAge,
        allowOutsideDistance,
        allowOutsideHeight,
      });
      navigation.goBack();
    } catch (err) {
      setError("Failed to save preferences. Check your connection and retry.");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveAndExit() {
    setUnsavedChangesModalVisible(false);
    if (!saving) {
      save();
    }
  }

  function handleDiscardAndExit() {
    setUnsavedChangesModalVisible(false);
    navigation.goBack();
  }

  // Render multi-select option selector
  function renderOptionSelector(
    label: string,
    values: string[],
    options: string[],
    onToggle: (value: string) => void
  ) {
    return (
      <View style={styles.optionSection}>
        <Text 
          style={[styles.optionLabel, { color: colors.text }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          {label}
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.optionScroll}
          accessible={false}
          importantForAccessibility="no"
        >
          {options.map((opt) => {
            const isSelected = values.includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => onToggle(opt)}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.card,
                    borderColor: colors.subtitle,
                  },
                ]}
                accessible={true}
                accessibilityLabel={opt}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityHint={isSelected ? `Deselects ${opt}` : `Selects ${opt}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    {
                      color: isSelected ? colors.buttonText : colors.text,
                    },
                  ]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <GlobalBackground />
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBackPress}
        accessible={true}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        accessibilityHint="Returns to previous screen"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name="chevron-back"
          size={30}
          color={colors.text}
          accessible={false}
          importantForAccessibility="no"
        />
      </TouchableOpacity>

      <Text
        style={[styles.title, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Preferences
      </Text>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        {/* AGE RANGE - DUAL SLIDER */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Age Range
        </Text>
        <Text 
          style={[styles.label, { color: colors.subtitle }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          {prefMinAge} - {prefMaxAge === 50 ? "50+" : prefMaxAge} years old
        </Text>

        <RangeSlider
          min={18}
          max={50}
          minValue={prefMinAge}
          maxValue={prefMaxAge}
          step={1}
          label="Age range"
          onChange={(minVal, maxVal) => {
            // Clamp minVal between 18 and maxVal-1, and maxVal between minVal+1 and 50
            const newMin = Math.max(18, Math.min(minVal, maxVal - 1));
            const newMax = Math.min(50, Math.max(maxVal, minVal + 1));
            setPrefMinAge(newMin);
            setPrefMaxAge(newMax);
          }}
          formatValue={(v) => (v === 50 ? "50+" : `${v}`)}
        />
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAllowOutsideAge((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allowOutsideAge }}
        >
          <View
            style={[
              styles.checkboxBox,
              {
                borderColor: colors.subtitle,
                backgroundColor: allowOutsideAge ? colors.text : "transparent",
              },
            ]}
          />
          <Text style={[styles.checkboxLabel, { color: colors.text }]}>
            Allow matches outside age range when nearby options run out
          </Text>
        </TouchableOpacity>

        {/* DISTANCE SLIDER */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Maximum Distance
        </Text>
        <RangeSlider
          min={1}
          max={100}
          minValue={prefMinDistanceMiles}
          maxValue={prefMaxDistanceMiles}
          step={1}
          label="Distance"
          onChange={(minVal, maxVal) => {
            // Clamp minVal between 1 and maxVal-1, and maxVal between minVal+1 and 100
            const newMin = Math.max(1, Math.min(minVal, maxVal - 1));
            const newMax = Math.min(100, Math.max(maxVal, minVal + 1));
            setPrefMinDistanceMiles(newMin);
            setPrefMaxDistanceMiles(newMax);
          }}
          formatValue={(v) => `${v} miles`}
        />
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAllowOutsideDistance((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allowOutsideDistance }}
        >
          <View
            style={[
              styles.checkboxBox,
              {
                borderColor: colors.subtitle,
                backgroundColor: allowOutsideDistance ? colors.text : "transparent",
              },
            ]}
          />
          <Text style={[styles.checkboxLabel, { color: colors.text }]}>
            Allow matches outside distance range when nearby options run out
          </Text>
        </TouchableOpacity>

        {/* HEIGHT RANGE SLIDER */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Height Range
        </Text>
        <Text 
          style={[styles.label, { color: colors.subtitle }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          {inchesToHeightString(prefMinHeight)} - {inchesToHeightString(prefMaxHeight)}
        </Text>

        <RangeSlider
          min={48}
          max={84}
          minValue={prefMinHeight}
          maxValue={prefMaxHeight}
          step={1}
          label="Height range"
          onChange={(minVal, maxVal) => {
            // Clamp minVal between 48 and maxVal-1, and maxVal between minVal+1 and 84
            const newMin = Math.max(48, Math.min(minVal, maxVal - 1));
            const newMax = Math.min(84, Math.max(maxVal, minVal + 1));
            setPrefMinHeight(newMin);
            setPrefMaxHeight(newMax);
          }}
          formatValue={(inches) => inchesToHeightString(inches)}
        />
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAllowOutsideHeight((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allowOutsideHeight }}
        >
          <View
            style={[
              styles.checkboxBox,
              {
                borderColor: colors.subtitle,
                backgroundColor: allowOutsideHeight ? colors.text : "transparent",
              },
            ]}
          />
          <Text style={[styles.checkboxLabel, { color: colors.text }]}>
            Allow matches outside height range when nearby options run out
          </Text>
        </TouchableOpacity>

        {/* DISCOVERY FILTERS */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text, marginTop: 30 }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Discovery Filters
        </Text>
        <Text 
          style={[styles.sectionSubtitle, { color: colors.subtitle, marginBottom: 14 }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          Filter profiles by these preferences
        </Text>

        {renderOptionSelector("Race", race, RACE_OPTIONS, (val) => {
          setRace(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
        })}
        {renderOptionSelector("Religion", religion, RELIGION_OPTIONS, (val) => {
          setReligion(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
        })}
        {renderOptionSelector("Political Views", politics, POLITICS_OPTIONS, (val) => {
          setPolitics(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
        })}
        {renderOptionSelector("Education", education, EDUCATION_OPTIONS, (val) => {
          setEducation(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
        })}
        
        {/* Activity Level - Single Select */}
        <View style={styles.optionSection}>
          <Text 
            style={[styles.optionLabel, { color: colors.text }]}
            accessible={true}
            accessibilityRole="text"
            allowFontScaling={true}
          >
            Activity Level
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.optionScroll}
            accessible={false}
            importantForAccessibility="no"
          >
            {ACTIVITY_LEVEL_OPTIONS.map((opt) => {
              const isSelected = activityLevel === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setActivityLevel(isSelected ? "" : opt)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.card,
                      borderColor: colors.subtitle,
                    },
                  ]}
                  accessible={true}
                  accessibilityLabel={opt}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityHint={isSelected ? `Deselects ${opt}` : `Selects ${opt}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      {
                        color: isSelected ? colors.buttonText : colors.text,
                      },
                    ]}
                    allowFontScaling={true}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {renderOptionSelector("Drinking", drinking, DRINKING_OPTIONS, (val) => {
          setDrinking(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
        })}
        {renderOptionSelector("Smoking", smoking, SMOKING_OPTIONS, (val) => {
          setSmoking(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
        })}
        {renderOptionSelector("Marijuana", marijuana, MARIJUANA_OPTIONS, (val) => {
          setMarijuana(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
        })}

        {error && <InlineAlert message={error} style={{ marginTop: 12 }} />}

        {/* SAVE */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 },
          ]}
          onPress={saving ? undefined : save}
          disabled={saving}
          accessible={true}
          accessibilityLabel="Save Preferences"
          accessibilityRole="button"
          accessibilityHint="Saves all preference changes"
          accessibilityState={{ disabled: saving }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={[styles.saveText, { color: colors.buttonText }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={unsavedChangesModalVisible}
        transparent
        animationType="fade"
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: colors.text + "80" }]}
          accessible={false}
          importantForAccessibility="no"
        >
          <View
            style={[styles.modalBox, { backgroundColor: colors.card }]}
            accessible={false}
            importantForAccessibility="no"
          >
            <Text
              style={[styles.modalTitle, { color: colors.text }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              Save changes before leaving?
            </Text>

            <Text
              style={[styles.modalMessage, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={true}
            >
              You have unsaved preference changes. Save before exiting?
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: colors.card, borderColor: colors.subtitle }]}
                onPress={() => setUnsavedChangesModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                accessibilityHint="Cancels and returns to editing"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalCancelText, { color: colors.subtitle }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalDiscardBtn, { borderColor: colors.subtitle }]}
                onPress={handleDiscardAndExit}
                accessibilityRole="button"
                accessibilityLabel="Discard changes"
                accessibilityHint="Discard changes and go back"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalDiscardText, { color: colors.text }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Discard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveAndExit}
                accessibilityRole="button"
                accessibilityLabel="Save and exit"
                accessibilityHint="Saves changes and goes back"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalConfirmText, { color: colors.buttonText }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Save & Exit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  container: {
    paddingBottom: 200,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: { marginTop: 10, fontSize: 16 },

  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },

  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderRadius: 4,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 14,
  },

  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 14,
  },

  label: {
    fontSize: 16,
    marginBottom: 8,
  },

  sliderContainer: {
    marginBottom: 20,
  },

  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  sliderTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 10,
  },

  sliderFill: {
    height: "100%",
    borderRadius: 2,
  },

  sliderValue: {
    fontSize: 14,
    minWidth: 30,
  },

  sliderLabel: {
    fontSize: 16,
    marginBottom: 8,
  },

  sliderButtons: {
    flexDirection: "row",
    gap: 10,
  },

  sliderButton: {
    padding: 8,
    borderRadius: 8,
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  optionSection: {
    marginBottom: 20,
  },

  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },

  optionScroll: {
    marginHorizontal: -4,
  },

  optionChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  optionChipText: {
    fontSize: 14,
    fontWeight: "500",
  },

  errorText: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 16,
  },

  saveBtn: {
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  saveText: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalBox: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },

  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },

  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },

  modalDiscardBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  modalDiscardText: {
    fontSize: 16,
    fontWeight: "600",
  },

  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  modalConfirmText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
