//********************************************************************
//
// StepEmailGate Component
//
// First step of onboarding flow when the school email gate is enabled.
// Collects a .edu email, sends a verification code, and verifies it.
// Blocks progress until verification succeeds.
//
//*******************************************************************

import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { onboardingStyles } from "../styles";
import { OTPInput } from "../../../components/OTPInput";
import { apiPost } from "../../../services/apiService";

const ALLOWED_SCHOOL_DOMAINS = [
  "missouristate.edu",
  // "drury.edu",     // fall release
  // "evangel.edu",  // fall release
  // "otc.edu",      // fall release
  // "mission.edu",  // fall release
  // "sbuniv.edu",   // fall release
];

const LAUNCH_DISCLAIMER =
  "Since the app is newly released, it is currently limited to Missouri State University students. More schools coming fall 2026.";

interface StepEmailGateProps {
  colors: any;
  onVerified: () => void;
  onExit: () => void;
}

export function StepEmailGate({
  colors,
  onVerified,
  onExit,
}: StepEmailGateProps) {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const isValidDomain = (value: string) => {
    const normalized = value.trim().toLowerCase();
    const domain = normalized.split("@").pop();
    if (!domain) return false;
    return ALLOWED_SCHOOL_DOMAINS.some(
      (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
    );
  };

  const handleSendCode = async () => {
    if (inFlightRef.current) return;
    setError(null);
    setVerificationCode("");
    setCodeSent(false);

    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setError("Enter a valid school email.");
      return;
    }
    if (!isValidDomain(normalized)) {
      setError(
        `This launch is limited to Springfield-area schools. Use a .edu ending in: ${ALLOWED_SCHOOL_DOMAINS.join(
          ", ",
        )}`,
      );
      return;
    }

    setSaving(true);
    inFlightRef.current = true;
    try {
      const res = await apiPost("/auth/update-email", { email: normalized });
      if (!res) {
        setError("Failed to send verification code.");
        return;
      }
      setCodeSent(true);
    } catch (err: any) {
      if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError("Failed to send verification code.");
      }
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  };

  const handleVerifyCode = async () => {
    if (inFlightRef.current) return;
    setError(null);

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setError("Email is required.");
      return;
    }
    if (!isValidDomain(normalized)) {
      setError(
        `This launch is limited to Springfield-area schools. Use a .edu ending in: ${ALLOWED_SCHOOL_DOMAINS.join(
          ", ",
        )}`,
      );
      return;
    }

    setSaving(true);
    inFlightRef.current = true;
    try {
      const res = await apiPost("/auth/verify-email", {
        email: normalized,
        code: verificationCode.trim(),
      });
      if (!res) {
        setError("Failed to verify code.");
        return;
      }
      onVerified();
    } catch (err: any) {
      if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError("Failed to verify code.");
      }
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={[onboardingStyles.header, { color: colors.text }]}>
        Verify your student email
      </Text>
      <Text style={[onboardingStyles.subheader, { color: colors.subtitle }]}>
        {LAUNCH_DISCLAIMER}
      </Text>
      <Text
        style={[
          onboardingStyles.caption,
          { color: colors.subtitle, marginBottom: 16 },
        ]}
      >
        Access is limited to verified Missouri State University students.
      </Text>
      <Text
        style={[
          onboardingStyles.caption,
          { color: colors.subtitle, marginBottom: 16 },
        ]}
      >
        Accepted domains: {ALLOWED_SCHOOL_DOMAINS.join(", ")}
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="name@school.edu"
        placeholderTextColor={colors.subtitle}
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[
          onboardingStyles.input,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        editable={!codeSent}
        accessibilityLabel="School email address"
        accessibilityRole="none"
        accessibilityHint="Enter your school email address"
        allowFontScaling={true}
      />

      {!codeSent ? (
        <TouchableOpacity
          style={[
            onboardingStyles.mainButton,
            { backgroundColor: colors.accent },
          ]}
          onPress={handleSendCode}
          accessibilityRole="button"
          accessibilityLabel="Send verification code"
          accessibilityHint="Sends a verification code to your school email"
          accessibilityState={{ disabled: saving }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {saving ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text
              style={[onboardingStyles.mainButtonText, { color: colors.buttonText }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Send Verification Code
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <>
          <Text
            style={[onboardingStyles.caption, { color: colors.subtitle }]}
            allowFontScaling={true}
          >
            Enter the 6-digit code sent to {email}
          </Text>
          <OTPInput
            length={6}
            value={verificationCode}
            onChange={setVerificationCode}
            autoFocus={true}
            onComplete={handleVerifyCode}
          />
          <TouchableOpacity
            style={[
              onboardingStyles.mainButton,
              { backgroundColor: colors.accent },
            ]}
            onPress={handleVerifyCode}
            accessibilityRole="button"
            accessibilityLabel="Verify code"
            accessibilityHint="Verifies your email with the code"
            accessibilityState={{
              disabled: saving || verificationCode.length !== 6,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {saving ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <Text
                style={[onboardingStyles.mainButtonText, { color: colors.buttonText }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Verify Code
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {error && (
        <Text
          style={[onboardingStyles.error, { color: colors.text }]}
          allowFontScaling={true}
        >
          {error}
        </Text>
      )}

      <TouchableOpacity
        style={[
          onboardingStyles.declineButton,
          styles.exitButton,
          { borderColor: colors.border },
        ]}
        onPress={onExit}
        accessibilityRole="button"
        accessibilityLabel="Return to login"
        accessibilityHint="Signs out and returns to login"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text
          style={[onboardingStyles.declineButtonText, { color: colors.text }]}
          allowFontScaling={true}
        >
          Return to login
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  exitButton: {
    marginTop: 10,
    marginBottom: 0,
  },
});
