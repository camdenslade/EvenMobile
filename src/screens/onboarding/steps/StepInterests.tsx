//********************************************************************
//
// StepInterests Component
//
// Step 4 of onboarding flow. Allows user to select interests from a
// searchable list. Shows first 25 interests by default, or all matching
// results when searching.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing interests step
//
// Value Parameters
// ----------------
// colors          Object      Theme colors object
// interests       string[]    Selected interests array
// search          string      Search query for filtering interests
// setInterests    function    Interests setter (via toggle function)
// setSearch       function    Search query setter
// onContinue      function    Callback to advance to next step
// onBack          function    Callback to go back
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

import { Text, TouchableOpacity, TextInput, View, Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { INTERESTS } from "../../../constants/interests";
import { ScreenWrap } from "../components/ScreenWrap";
import { onboardingStyles } from "../styles";

interface StepInterestsProps {
  colors: any;
  interests: string[];
  search: string;
  toggleInterest: (interest: string) => void;
  setSearch: (search: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function StepInterests({
  colors,
  interests,
  search,
  toggleInterest,
  setSearch,
  onContinue,
  onBack,
}: StepInterestsProps) {
  const filtered = INTERESTS.filter((i) => i.toLowerCase().includes(search.toLowerCase()));
  const visible = search ? filtered : filtered.slice(0, 25);

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
        Your interests
      </Text>

      <TextInput
        style={[
          onboardingStyles.searchInput,
          { backgroundColor: colors.card, color: colors.text },
        ]}
        placeholder="Search interests..."
        placeholderTextColor={colors.subtitle}
        value={search}
        onChangeText={setSearch}
        accessible={true}
        accessibilityLabel="Search interests"
        accessibilityRole="none"
        accessibilityHint="Search for interests to add"
        allowFontScaling={true}
      />

      <View
        style={onboardingStyles.interestGrid}
        accessible={false}
        importantForAccessibility="no"
      >
        {visible.map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => toggleInterest(i)}
            style={[
              onboardingStyles.interestChip,
              {
                backgroundColor: interests.includes(i) ? colors.accent : colors.card,
              },
            ]}
            accessible={true}
            accessibilityLabel={i}
            accessibilityRole="button"
            accessibilityState={{ selected: interests.includes(i) }}
            accessibilityHint={`${interests.includes(i) ? "Removes" : "Adds"} interest: ${i}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                onboardingStyles.interestChipText,
                {
                  color: interests.includes(i) ? colors.buttonText : colors.text,
                },
              ]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {i}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[onboardingStyles.mainButton, { backgroundColor: colors.accent }]}
        onPress={() => {
          if (interests.length === 0) {
            Alert.alert(
              "Required Field",
              "Please select at least one interest to continue.",
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

