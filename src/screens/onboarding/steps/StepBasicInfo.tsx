//********************************************************************
//
// StepBasicInfo Component
//
// Step 1 of onboarding flow. Collects user's name, birthday, and sex.
// Validates name (no spaces allowed) and ensures sex is selected before
// allowing progression to next step.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing basic info step
//
// Value Parameters
// ----------------
// colors        Object          Theme colors object
// name          string          User's name
// birthday      BirthdayValue   Selected birthday
// sex           SexValue        Selected sex
// error         string|null     Error message
// setName       function        Name setter
// setBirthday   function        Birthday setter
// setSex        function        Sex setter
// setError      function        Error setter
// onContinue    function        Callback to advance to next step
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

import { Text, TouchableOpacity, TextInput, View, Modal, StyleSheet } from "react-native";
import { BirthdayPicker, BirthdayValue } from "../../../components/BirthdayPicker";
import { ScreenWrap } from "../components/ScreenWrap";
import { onboardingStyles } from "../styles";
import { SexValue } from "../types";
import { useMemo, useState } from "react";
import { InlineAlert } from "../../../components/InlineAlert";
import { useAuth } from "../../../context/AuthContext";

interface StepBasicInfoProps {
  colors: any;
  name: string;
  birthday: BirthdayValue;
  sex: SexValue;
  error: string | null;
  setName: (name: string) => void;
  setBirthday: (birthday: BirthdayValue) => void;
  setSex: (sex: SexValue) => void;
  setError: (error: string | null) => void;
  onContinue: () => void;
  onUnderage: () => void;
}

export function StepBasicInfo({
  colors,
  name,
  birthday,
  sex,
  error,
  setName,
  setBirthday,
  setSex,
  setError,
  onContinue,
  onUnderage,
}: StepBasicInfoProps) {
  const [underageVisible, setUnderageVisible] = useState(false);
  const { user } = useAuth();

  const isDemoUser = useMemo(() => {
    const phone = user?.phoneNumber || "";
    const normalized = phone.replace(/[^\d+]/g, "");
    return [
      "+15550123456",
      "+15550123457",
      "+15550123458",
      "+15550123459",
      "+15550123460",
      "+15550123461",
      "+15550123462",
      "+15550123463",
    ].includes(normalized);
  }, [user?.phoneNumber]);

  const isUnderage = (value: BirthdayValue) => {
    const today = new Date();
    const birthDate = new Date(value.year, value.month, value.day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthday =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() &&
        today.getDate() >= birthDate.getDate());
    if (!hasHadBirthday) {
      age -= 1;
    }
    return age < 18;
  };

  return (
    <ScreenWrap>
      <Text
        style={[onboardingStyles.header, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Tell us about you
      </Text>

      <TextInput
        style={[
          onboardingStyles.input,
          { backgroundColor: colors.card, color: colors.text },
        ]}
        placeholder="First name"
        placeholderTextColor={colors.subtitle}
        value={name}
        onChangeText={(t) => {
          if (t.includes(" ")) return setError("No spaces allowed.");
          if (!isDemoUser && /\d/.test(t)) {
            setError("Numbers not allowed in first name.");
          } else {
            setError(null);
          }
          setName(t);
        }}
        accessible={true}
        accessibilityLabel="First name"
        accessibilityRole="none"
        accessibilityHint="Enter your first name. No spaces allowed."
        allowFontScaling={true}
      />

      <Text
        style={[onboardingStyles.label, { color: colors.text }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        Birthday
      </Text>
      <BirthdayPicker
        value={birthday}
        onChange={setBirthday}
      />
      <Text
        style={[onboardingStyles.caption, { color: colors.subtitle }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        You must be 18 or older to use Even.
      </Text>

      <Text
        style={[onboardingStyles.label, { color: colors.text }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        I am
      </Text>

      {(["male", "female"] as const).map((g) => {
        const label = g === "male" ? "Male" : "Female";
        return (
          <TouchableOpacity
            key={g}
            style={[
              onboardingStyles.genderOption,
              {
                backgroundColor: sex === g ? colors.accent : colors.card,
              },
            ]}
            onPress={() => setSex(g)}
            accessible={true}
            accessibilityLabel={label}
            accessibilityRole="button"
            accessibilityState={{ selected: sex === g }}
            accessibilityHint={`Selects ${label.toLowerCase()}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                onboardingStyles.genderText,
                {
                  color: sex === g ? colors.buttonText : colors.text,
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
          if (!name.trim()) return setError("Enter a name.");
          if (!isDemoUser && /\d/.test(name)) {
            return setError("Numbers not allowed in first name.");
          }
          if (!sex) return setError("Select your sex.");
          if (isUnderage(birthday)) {
            setUnderageVisible(true);
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

      {error && <InlineAlert message={error} style={{ marginTop: 12 }} />}

      <Modal
        visible={underageVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnderageVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Age restriction</Text>
            <Text style={styles.modalBody}>
              You must be 18 or older to use Even.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setUnderageVisible(false);
                onUnderage();
              }}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.modalButtonText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenWrap>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    backgroundColor: "#ffffff",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111111",
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333333",
    marginBottom: 16,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});

