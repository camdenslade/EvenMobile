//********************************************************************
//
// StepDatingPreference Component
//
// Step 3 of onboarding flow. Allows user to select their dating
// preference. Options are filtered based on user's age (removes
// "short_term_relationship" for users under 25, removes "situationship"
// for users 25 and older).
//
// Return Value
// ------------
// React.ReactElement    JSX element representing dating preference step
//
// Value Parameters
// ----------------
// colors              Object                  Theme colors object
// birthday            BirthdayValue           User's birthday
// datingPreference    DatingPreferenceValue   Selected dating preference
// setDatingPreference function                Dating preference setter
// onContinue          function                Callback to advance to next step
// onBack              function                Callback to go back
//
// Reference Parameters
// --------------------
// None
//
// Local State
// -----------
// None
//
// Side Effects
// ------------
// None
//
//*******************************************************************

import { Text, TouchableOpacity, Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BirthdayValue } from "../../../components/BirthdayPicker";
import { ScreenWrap } from "../components/ScreenWrap";
import { onboardingStyles } from "../styles";
import { DatingPreferenceValue } from "../types";

interface StepDatingPreferenceProps {
  colors: any;
  birthday: BirthdayValue;
  datingPreference: DatingPreferenceValue;
  setDatingPreference: (pref: DatingPreferenceValue) => void;
  onContinue: () => void;
  onBack: () => void;
}

const RAW_OPTIONS = [
  { value: "hookups" as const, label: "Hookups" },
  { value: "situationship" as const, label: "Situationship" },
  { value: "short_term_relationship" as const, label: "Short-term Relationship" },
  { value: "short_term_open" as const, label: "Short-term, open to long" },
  { value: "long_term_open" as const, label: "Long-term, open to short" },
  { value: "long_term_relationship" as const, label: "Long-term Relationship" },
];

export function StepDatingPreference({
  colors,
  birthday,
  datingPreference,
  setDatingPreference,
  onContinue,
  onBack,
}: StepDatingPreferenceProps) {
  const age = new Date().getFullYear() - birthday.year;

  const FILTERED =
    age < 25
      ? RAW_OPTIONS.filter((r) => r.value !== "short_term_relationship")
      : RAW_OPTIONS.filter((r) => r.value !== "situationship");

  // Ensure current selection is included even if filtered
  const options = FILTERED.some((p) => p.value === datingPreference)
    ? FILTERED
    : (() => {
        const found = RAW_OPTIONS.find((p) => p.value === datingPreference);
        return found ? [found, ...FILTERED] : FILTERED;
      })();

  return (
    <ScreenWrap>
      <TouchableOpacity
        onPress={onBack}
        style={onboardingStyles.back}
        accessible={true}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        accessibilityHint="Returns to previous step"
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
        style={[onboardingStyles.header, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Dating preference
      </Text>

      {options.map((p) => (
        <TouchableOpacity
          key={p.value}
          style={[
            onboardingStyles.genderOption,
            {
              backgroundColor: datingPreference === p.value ? colors.accent : colors.card,
            },
          ]}
          onPress={() => setDatingPreference(p.value)}
          accessible={true}
          accessibilityLabel={p.label}
          accessibilityRole="button"
          accessibilityState={{ selected: datingPreference === p.value }}
          accessibilityHint={`Selects ${p.label.toLowerCase()} as dating preference`}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[
              onboardingStyles.genderText,
              {
                color: datingPreference === p.value ? colors.buttonText : colors.text,
              },
            ]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            {p.label}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[onboardingStyles.mainButton, { backgroundColor: colors.accent }]}
        onPress={() => {
          if (!datingPreference) {
            Alert.alert(
              "Required Field",
              "Please select your dating preference to continue.",
              [{ text: "OK" }]
            );
            return;
          }
          onContinue();
        }}
        accessible={true}
        accessibilityLabel="Continue"
        accessibilityRole="button"
        accessibilityHint="Continues to next step"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text
          style={[onboardingStyles.mainButtonText, { color: colors.buttonText }]}
          allowFontScaling={true}
          accessible={false}
          importantForAccessibility="no"
        >
          Continue
        </Text>
      </TouchableOpacity>
    </ScreenWrap>
  );
}

