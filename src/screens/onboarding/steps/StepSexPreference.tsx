//********************************************************************
//
// StepSexPreference Component
//
// Step 2 of onboarding flow. Allows user to select who they're
// interested in: Men, Women, or Everyone.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing sex preference step
//
// Value Parameters
// ----------------
// colors            Object              Theme colors object
// sexPreference     SexPreferenceValue  Selected sex preference
// setSexPreference  function            Sex preference setter
// onContinue        function            Callback to advance to next step
// onBack            function            Callback to go back
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
import { ScreenWrap } from "../components/ScreenWrap";
import { onboardingStyles } from "../styles";
import { SexPreferenceValue } from "../types";

interface StepSexPreferenceProps {
  colors: any;
  sexPreference: SexPreferenceValue;
  setSexPreference: (pref: SexPreferenceValue) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function StepSexPreference({
  colors,
  sexPreference,
  setSexPreference,
  onContinue,
  onBack,
}: StepSexPreferenceProps) {
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
        I'm interested in
      </Text>

      {(["male", "female", "everyone"] as const).map((opt) => {
        const label = opt === "male" ? "Men" : opt === "female" ? "Women" : "Everyone";
        return (
          <TouchableOpacity
            key={opt}
            style={[
              onboardingStyles.genderOption,
              {
                backgroundColor: sexPreference === opt ? colors.accent : colors.card,
              },
            ]}
            onPress={() => setSexPreference(opt)}
            accessible={true}
            accessibilityLabel={label}
            accessibilityRole="button"
            accessibilityState={{ selected: sexPreference === opt }}
            accessibilityHint={`Selects interest in ${label.toLowerCase()}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                onboardingStyles.genderText,
                {
                  color: sexPreference === opt ? colors.buttonText : colors.text,
                },
              ]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[onboardingStyles.mainButton, { backgroundColor: colors.accent }]}
        onPress={() => {
          if (!sexPreference) {
            Alert.alert(
              "Required Field",
              "Please select who you're interested in to continue.",
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

