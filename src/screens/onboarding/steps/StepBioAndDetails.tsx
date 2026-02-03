//********************************************************************
//
// StepBioAndDetails Component
//
// Step 5 of onboarding flow. Collects user's bio (with dynamic height
// growth, no newlines allowed) and personal details: height (required),
// race (required, multi-select), religion, politics, education, activity level,
// drinking, smoking, and marijuana preferences (all single-select except race).
//
// Return Value
// ------------
// React.ReactElement    JSX element representing bio and details step
//
// Value Parameters
// ----------------
// colors            Object          Theme colors object
// bio               string          User's bio text
// bioHeight         number          Current bio input height
// height            HeightValue     Selected height
// race              string[]        Selected race options
// religion          string[]        Selected religion options
// politics          string[]        Selected politics options
// education         string[]        Selected education options
// activityLevel     string          Selected activity level
// drinking          string[]        Selected drinking options
// smoking           string[]        Selected smoking options
// marijuana         string[]        Selected marijuana options
// error             string|null     Error message
// setBio            function        Bio setter
// setBioHeight      function        Bio height setter
// setHeight         function        Height setter
// setRace           function        Race setter
// setReligion       function        Religion setter
// setPolitics       function        Politics setter
// setEducation      function        Education setter
// setActivityLevel  function        Activity level setter
// setDrinking       function        Drinking setter
// setSmoking        function        Smoking setter
// setMarijuana      function        Marijuana setter
// setError          function        Error setter
// onContinue        function        Callback to advance to next step
// onBack            function        Callback to go back
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
// Dismisses keyboard on continue
//
//*******************************************************************

import { Text, TouchableOpacity, TextInput, Keyboard, Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HeightPicker, HeightValue } from "../../../components/HeightPicker";
import { MultiSelectPills } from "../../../components/MultiSelectPills";
import { SingleSelectPills } from "../../../components/SingleSelectPills";
import { ScreenWrap } from "../components/ScreenWrap";
import { onboardingStyles } from "../styles";
import { FLAGGED_WORDS } from "../../../constants/flaggedWords";
import {
  RACE_OPTIONS,
  RELIGION_OPTIONS,
  POLITICS_OPTIONS,
  EDUCATION_OPTIONS,
  ACTIVITY_LEVEL_OPTIONS,
  DRINKING_OPTIONS,
  SMOKING_OPTIONS,
  MARIJUANA_OPTIONS,
} from "../constants";

interface StepBioAndDetailsProps {
  colors: any;
  bio: string;
  bioHeight: number;
  height: HeightValue;
  race: string[];
  religion: string[];
  politics: string[];
  education: string[];
  activityLevel: string;
  drinking: string[];
  smoking: string[];
  marijuana: string[];
  error: string | null;
  setBio: (bio: string) => void;
  setBioHeight: (height: number) => void;
  setHeight: (height: HeightValue) => void;
  setRace: React.Dispatch<React.SetStateAction<string[]>>;
  setReligion: React.Dispatch<React.SetStateAction<string[]>>;
  setPolitics: React.Dispatch<React.SetStateAction<string[]>>;
  setEducation: React.Dispatch<React.SetStateAction<string[]>>;
  setActivityLevel: React.Dispatch<React.SetStateAction<string>>;
  setDrinking: React.Dispatch<React.SetStateAction<string[]>>;
  setSmoking: React.Dispatch<React.SetStateAction<string[]>>;
  setMarijuana: React.Dispatch<React.SetStateAction<string[]>>;
  setError: (error: string | null) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function StepBioAndDetails({
  colors,
  bio,
  bioHeight,
  height,
  race,
  religion,
  politics,
  education,
  activityLevel,
  drinking,
  smoking,
  marijuana,
  error,
  setBio,
  setBioHeight,
  setHeight,
  setRace,
  setReligion,
  setPolitics,
  setEducation,
  setActivityLevel,
  setDrinking,
  setSmoking,
  setMarijuana,
  setError,
  onContinue,
  onBack,
}: StepBioAndDetailsProps) {
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
        Who you are
      </Text>

      <TextInput
        style={[
          onboardingStyles.bioInput,
          { backgroundColor: colors.card, color: colors.text, height: Math.max(120, bioHeight) },
        ]}
        placeholder="Write something about yourself…"
        placeholderTextColor={colors.subtitle}
        value={bio}
        onChangeText={(text) => {
          // Remove newlines and replace with spaces
          const cleanedText = text.replace(/\n/g, " ");
          const lower = cleanedText.toLowerCase();
          if (FLAGGED_WORDS.some((w) => lower.includes(w))) {
            Alert.alert(
              "Bio blocked",
              "Please remove flagged words and try again."
            );
            return;
          }
          setBio(cleanedText);
        }}
        multiline
        returnKeyType="done"
        blurOnSubmit={true}
        onSubmitEditing={() => Keyboard.dismiss()}
        onContentSizeChange={(event) => {
          const { height } = event.nativeEvent.contentSize;
          // Minimum 120px, add padding (16px top + 16px bottom = 32px)
          setBioHeight(Math.max(120, height + 32));
        }}
        accessible={true}
        accessibilityLabel="Bio"
        accessibilityRole="none"
        accessibilityHint="Write something about yourself. Text will wrap automatically, but return key will dismiss keyboard."
        allowFontScaling={true}
      />

      <Text
        style={[onboardingStyles.label, { color: colors.text }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        Height (Required)
      </Text>
      <HeightPicker value={height} onChange={setHeight} />

      <MultiSelectPills
        label="Race (Required)"
        values={race}
        options={RACE_OPTIONS}
        onToggle={(val) =>
          setRace((prev) => {
            if (prev.includes(val)) {
              return prev.filter((v) => v !== val);
            }
            if (prev.length >= 2) {
              setError("Choose up to two races.");
              return prev;
            }
            setError(null);
            return [...prev, val];
          })
        }
      />

      <SingleSelectPills
        label="Religion"
        value={religion.length > 0 ? religion[0] : ""}
        options={RELIGION_OPTIONS}
        onSelect={(val) => setReligion(val === (religion.length > 0 ? religion[0] : "") ? [] : [val])}
      />

      <SingleSelectPills
        label="Political Views"
        value={politics.length > 0 ? politics[0] : ""}
        options={POLITICS_OPTIONS}
        onSelect={(val) => setPolitics(val === (politics.length > 0 ? politics[0] : "") ? [] : [val])}
      />

      <SingleSelectPills
        label="Education"
        value={education.length > 0 ? education[0] : ""}
        options={EDUCATION_OPTIONS}
        onSelect={(val) => setEducation(val === (education.length > 0 ? education[0] : "") ? [] : [val])}
      />

      <SingleSelectPills
        label="Activity Level"
        value={activityLevel}
        options={ACTIVITY_LEVEL_OPTIONS}
        onSelect={(val) => setActivityLevel(val === activityLevel ? "" : val)}
      />

      <SingleSelectPills
        label="Drinking"
        value={drinking.length > 0 ? drinking[0] : ""}
        options={DRINKING_OPTIONS}
        onSelect={(val) => setDrinking(val === (drinking.length > 0 ? drinking[0] : "") ? [] : [val])}
      />

      <SingleSelectPills
        label="Smoking"
        value={smoking.length > 0 ? smoking[0] : ""}
        options={SMOKING_OPTIONS}
        onSelect={(val) => setSmoking(val === (smoking.length > 0 ? smoking[0] : "") ? [] : [val])}
      />

      <SingleSelectPills
        label="Marijuana"
        value={marijuana.length > 0 ? marijuana[0] : ""}
        options={MARIJUANA_OPTIONS}
        onSelect={(val) => setMarijuana(val === (marijuana.length > 0 ? marijuana[0] : "") ? [] : [val])}
      />

      {error && (
        <Text
          style={[onboardingStyles.error, { color: "red" }]}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`Error: ${error}`}
          allowFontScaling={true}
        >
          {error}
        </Text>
      )}

      <TouchableOpacity
        style={[onboardingStyles.mainButton, { backgroundColor: colors.accent }]}
        onPress={() => {
          setError(null);
          if (race.length === 0) {
            setError("Race is required.");
            return;
          }
          Keyboard.dismiss();
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
