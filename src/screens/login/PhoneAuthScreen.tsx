import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeProvider";
import { useAuth } from "../../context/AuthContext";
import GlobalBackground from "../../components/GlobalBackground";
import { SliderCaptcha } from "../../components/SliderCaptcha";
import { OTPInput } from "../../components/OTPInput";
import { InlineAlert } from "../../components/InlineAlert";
import { formatPhoneNumber, extractPhoneDigits } from "../../utils/phoneUtils";
import { RootStackParamList } from "../../../App";

type AuthFlowState = "INPUT_PHONE" | "INPUT_CODE" | "VERIFYING";
type PhoneAuthRouteProp = RouteProp<RootStackParamList, "PhoneAuth">;

const COUNTRY_LIST = [
  { code: "US", name: "United States", dial: "1" },
  { code: "CA", name: "Canada", dial: "1" },
  { code: "GB", name: "United Kingdom", dial: "44" },
  { code: "AU", name: "Australia", dial: "61" },
  { code: "NZ", name: "New Zealand", dial: "64" },
  { code: "IN", name: "India", dial: "91" },
];

export default function PhoneAuthScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const route = useRoute<PhoneAuthRouteProp>();
  const { provider = "Phone" } = route.params || { provider: "Phone" };

  const { colors } = useTheme();
  const {
    startPhoneAuth,
    resendPhoneCode,
    verifyPhoneCode,
    error: authError,
    loading: authLoading,
  } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [session, setSession] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<AuthFlowState>("INPUT_PHONE");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [countryDialingCode, setCountryDialingCode] = useState("1");
  const [localError, setLocalError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resendTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalError(authError);
  }, [authError]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(id);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
      }
    };
  }, []);

  const buildE164 = () => {
    const digits = extractPhoneDigits(phoneNumber);
    return `+${countryDialingCode}${digits}`;
  };

  const startTimer = () => {
    setResendTimer(60);
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
    }
    resendTimerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) {
            clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    const digits = extractPhoneDigits(phoneNumber);
    if (digits.length < 10) {
      setLocalError("Please enter a valid phone number.");
      return;
    }
    if (!captchaVerified) {
      setLocalError("Please complete the slider to continue.");
      return;
    }

    setPending(true);
    setLocalError(null);
    try {
      const e164 = buildE164();
      const res = await startPhoneAuth(e164);
      setSession(res.session);
      setFlowState("INPUT_CODE");
      setVerificationCode("");
      startTimer();
    } catch (err: any) {
      setLocalError(err?.message ?? "Failed to send code");
    } finally {
      setPending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!session) {
      setLocalError("Request a code first.");
      return;
    }
    if (verificationCode.length !== 6) {
      setLocalError("Enter the 6-digit code.");
      return;
    }
    setPending(true);
    setLocalError(null);
    setFlowState("VERIFYING");
    try {
      const e164 = buildE164();
      await verifyPhoneCode({ phoneNumber: e164, code: verificationCode, session });
    } catch (err: any) {
      setLocalError(err?.message ?? "Verification failed");
      setFlowState("INPUT_CODE");
    } finally {
      setPending(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    const digits = extractPhoneDigits(phoneNumber);
    if (digits.length < 10) {
      setLocalError("Please enter a valid phone number.");
      return;
    }
    setPending(true);
    setLocalError(null);
    try {
      const e164 = buildE164();
      const res = await resendPhoneCode(e164);
      setSession(res.session);
      setVerificationCode("");
      startTimer();
    } catch (err: any) {
      setLocalError(err?.message ?? "Unable to resend code");
    } finally {
      setPending(false);
    }
  };

  const headerText =
    flowState === "INPUT_PHONE"
      ? "Hey, can we get your number?"
      : "Enter your 6-digit code";

  const buttonText =
    flowState === "INPUT_PHONE" ? "Next" : "Verify and Sign In";

  const buttonDisabled =
    flowState === "INPUT_PHONE"
      ? extractPhoneDigits(phoneNumber).length < 10 ||
        !captchaVerified ||
        pending ||
        authLoading
      : verificationCode.length !== 6 || pending || authLoading;

  return (
    <View style={[styles.phoneContainer, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessible
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
        style={[styles.header, { color: colors.text }]}
        accessible
        accessibilityRole="header"
      >
        {headerText}
      </Text>

      {localError ? (
        <InlineAlert message={localError} style={{ marginBottom: 12 }} />
      ) : null}

      {flowState !== "VERIFYING" && (
        <>
          {flowState === "INPUT_PHONE" && (
            <>
              <Text style={[styles.contextText, { color: colors.text }]}>
                We'll text you a code to verify your account. Standard message rates apply.
              </Text>

              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={[
                    styles.countryPickerButton,
                    styles.surfaceShadow,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => setPickerVisible(true)}
                  accessible
                  accessibilityLabel={`Country code: +${countryDialingCode}`}
                  accessibilityRole="button"
                  accessibilityHint="Opens country code selector"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.countryPickerText, { color: colors.text }]}>
                    +{countryDialingCode}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.text}
                    accessible={false}
                    importantForAccessibility="no"
                  />
                </TouchableOpacity>

                <TextInput
                  style={[
                    styles.phoneNumberInput,
                    styles.surfaceShadow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="(000) 000-0000"
                  placeholderTextColor={colors.subtitle}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
                  autoFocus
                  accessible
                  accessibilityLabel="Phone number"
                  accessibilityRole="none"
                  accessibilityHint="Enter your phone number"
                />
              </View>

              <SliderCaptcha onVerified={() => setCaptchaVerified(true)} />
            </>
          )}

          {flowState === "INPUT_CODE" && (
            <>
              <OTPInput
                length={6}
                value={verificationCode}
                onChange={setVerificationCode}
                autoFocus
              />

              <View style={styles.resendContainer}>
                {resendTimer > 0 ? (
                  <Text style={[styles.resendText, { color: colors.text }]}>
                    Resend code in {resendTimer}s
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={handleResendCode}
                    disabled={pending}
                    accessible
                    accessibilityLabel="Resend verification code"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.resendLink, { color: colors.accent }]}>
                      Resend Code
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setFlowState("INPUT_PHONE");
                    setVerificationCode("");
                    setSession(null);
                    setResendTimer(0);
                    if (resendTimerRef.current) {
                      clearInterval(resendTimerRef.current);
                      resendTimerRef.current = null;
                    }
                  }}
                  accessible
                  accessibilityLabel="Change phone number"
                  accessibilityRole="button"
                >
                  <Text style={[styles.changeNumberLink, { color: colors.accent }]}>
                    Change Number
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.surfaceShadow,
              {
                backgroundColor: colors.accent,
                opacity: buttonDisabled ? 0.5 : 1,
              },
            ]}
            disabled={buttonDisabled}
            onPress={flowState === "INPUT_PHONE" ? handleSendCode : handleVerifyCode}
            accessible
            accessibilityLabel={buttonText}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>{buttonText}</Text>
          </TouchableOpacity>
          {flowState === "INPUT_PHONE" && (
            <Text style={[styles.smsDisclosure, { color: colors.text }]}>
              By continuing, you agree to receive a one-time verification code via SMS. Message
              frequency varies. Reply STOP to opt out. For help, contact support@evendating.us
            </Text>
          )}
        </>
      )}

      {flowState === "VERIFYING" && (
        <View accessible accessibilityLabel="Verifying code" accessibilityRole="none">
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      )}

      <Modal transparent visible={pickerVisible} animationType="fade">
        <View style={styles.countryModal}>
          <View
            style={[
              styles.countryModalInner,
              styles.surfaceShadow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {COUNTRY_LIST.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.countryOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setCountryDialingCode(c.dial);
                  setPickerVisible(false);
                }}
                accessible
                accessibilityLabel={`${c.name}, country code +${c.dial}`}
                accessibilityRole="button"
              >
                <Text style={[styles.countryOptionText, { color: colors.text }]}>
                  {c.name} (+{c.dial})
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setPickerVisible(false)}
              accessible
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  phoneContainer: {
    flex: 1,
    padding: 30,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    minWidth: Platform.OS === "ios" ? 44 : 48,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
    marginTop: 70,
    zIndex: 1,
  },
  contextText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
    opacity: 0.8,
  },
  inputRow: { flexDirection: "row", marginBottom: 20, zIndex: 1 },
  countryPickerButton: {
    backgroundColor: "white",
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
    marginRight: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  surfaceShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  countryPickerText: {
    color: "black",
    fontSize: 18,
    marginRight: 5,
  },
  phoneNumberInput: {
    flex: 1,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    color: "black",
    fontSize: 18,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  button: {
    padding: 15,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 20,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
    zIndex: 1,
  },
  buttonText: { fontSize: 18, fontWeight: "bold" },
  smsDisclosure: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    opacity: 0.8,
  },
  error: { marginBottom: 15, textAlign: "center" },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 4,
  },
  resendText: {
    fontSize: 14,
    opacity: 0.7,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  changeNumberLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  countryModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  countryModalInner: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "100%",
    maxHeight: "70%",
    borderWidth: 1,
  },
  countryOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
  },
  countryOptionText: { fontSize: 18, color: "black" },
  closeModalButton: {
    paddingVertical: 12,
    marginTop: 10,
    alignItems: "center",
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
  },
  closeModalText: {
    fontSize: 18,
    color: "#111111",
    fontWeight: "600",
  },
});
