//********************************************************************
//
// SettingsScreen Component
//
// Displays user settings including theme toggle, school-email verification,
// account pause/resume, account deletion, and sign out. Refreshes
// settings and profile data in background on mount. Uses Zustand
// cache for instant UI. Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the settings screen
//
// Value Parameters
// ----------------
// navigation    any         Navigation object for routing
// __prerender   boolean     Flag for prerendering (returns null if true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors                  Object                  Theme colors
// isDark                  boolean                 Whether dark mode is active
// toggleTheme             function                 Function to toggle theme
// cachedSettings          any|null                 Settings from Zustand cache
// cachedProfile           any|null                 Profile from Zustand cache
// setSettings             function                 Zustand setter for settings
// email                   string                  Email input value
// saving                  boolean                 Saving state
// error                   string|null             Error message
// isPaused                boolean                 Whether account is paused
// pauseConfirmVisible     boolean                 Pause confirmation modal visibility
// deleteConfirmVisible    boolean                 Delete confirmation modal visibility
// pauseSuccessVisible     boolean                 Pause success modal visibility
// deleteSuccessVisible    boolean                 Delete success modal visibility
// user                    Object|null             User data from API
// profile                 Object|null             Profile data from API
// res                     any                     Response from API calls
// clearCache              function                 Function to clear Zustand cache
// endpoint                string                  API endpoint for pause/resume
//
//*******************************************************************

import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";

import { apiGet, apiPost, apiPatch, apiDelete } from "../services/apiService";
import { clearTokens, clearOAuthData } from "../services/authStorage";
import { clearSession } from "../services/sessionPersistence";
import { useTheme, type ThemeColors } from "../context/ThemeProvider";
import { useSessionData } from "../context/SessionDataContext";
import GlobalBackground from "../components/GlobalBackground";
import { useAppCache } from "../services/appCache";
import { useAuth } from "../context/AuthContext";
import { fromHsv, toHsv } from "../utils/color";
import { Slider } from "../components/Slider";
import { InlineAlert } from "../components/InlineAlert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGlobalRefresh } from "../context/RefreshContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { OTPInput } from "../components/OTPInput";
import { TERMS_OF_SERVICE } from "./legal/terms";
import { PRIVACY_POLICY } from "./legal/privacy";

// Settings types and utilities
import {
  CustomThemeDraft,
  ThemePreset,
  CUSTOM_THEME_PRESETS_KEY,
  MAX_THEME_PRESETS,
  CUSTOM_FIELDS,
  ALLOWED_SCHOOL_DOMAINS,
  SCHOOL_DOMAIN_MAP,
  DANGER_COLOR,
} from "./settings/types";
import {
  normalizeHexInput,
  isValidHex,
  themeToDraft,
  buildCustomTheme,
  normalizeThemePresets,
  nextPresetName,
  hasProblematicColors,
} from "./settings/themeUtils";
import { ConsentModal, LegalModal } from "./settings/components";

interface SettingsScreenProps {
  __prerender?: boolean;
}

export default function SettingsScreen({
  navigation,
  __prerender,
}: SettingsScreenProps & { navigation?: any }) {
  const { user, idToken, logout } = useAuth();
  const { userSummary, refreshSessionData, error: sessionError } = useSessionData();
  const { refresh, refreshing, registerRefresher } = useGlobalRefresh();
  if (__prerender) return null;

  const { colors, isDark, mode, setThemeMode, customTheme, setCustomTheme } = useTheme();

  // GLOBAL CACHE
  const cachedProfile = useAppCache((s) => s.profile);
  const setSettings = useAppCache((s) => s.setSettings);

  // Use email and role from SessionDataContext
  const [email, setEmail] = useState(userSummary?.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(
    userSummary?.schoolEmailVerified ?? false
  );
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);

  const [isPaused, setIsPaused] = useState(cachedProfile?.paused || false);

  const [pauseConfirmVisible, setPauseConfirmVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard' | null>(null);

  const [pauseSuccessVisible, setPauseSuccessVisible] = useState(false);
  const [deleteSuccessVisible, setDeleteSuccessVisible] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [analyticsConsent, setAnalyticsConsentState] = useState<boolean | null>(null);
    const ANALYTICS_CONSENT_KEY = "@EvenApp:analyticsConsent";
  const [showSchoolPrompt, setShowSchoolPrompt] = useState(false);
  const [prefillSchool, setPrefillSchool] = useState<string | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showThemeConsentModal, setShowThemeConsentModal] = useState(false);
  const [showCustomThemeModal, setShowCustomThemeModal] = useState(false);
  const [customDraft, setCustomDraft] = useState<CustomThemeDraft | null>(null);
  const [customPresets, setCustomPresets] = useState<ThemePreset[]>([]);
  const didSyncPresetsRef = useRef(false);
  const verifyEmailInFlightRef = useRef(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [activeCustomKey, setActiveCustomKey] =
    useState<keyof CustomThemeDraft>("background");
  // HSV state for manual slider control (Slider Fix Part 2)
  const [hsvState, setHsvState] = useState({ h: 0, s: 1, v: 1 });
  const scrollViewRef = useRef<ScrollView>(null);
  const [showColorWarningModal, setShowColorWarningModal] = useState(false);
  const [pendingColorAction, setPendingColorAction] = useState<'save' | 'apply' | null>(null);

  // Sync HSV state when active color changes (Slider Fix Part 2)
  useEffect(() => {
    if (customDraft && customDraft[activeCustomKey]) {
      const hexColor = customDraft[activeCustomKey];
      if (/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
        const hsv = toHsv(hexColor);
        setHsvState(hsv);
      }
    }
  }, [activeCustomKey, customDraft]);

  // Memoize gradient arrays to prevent unnecessary recalculations
  const hueGradient = useMemo(
    () => ['#ff0000', '#ff00ff', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
    []
  );

  const saturationGradient = useMemo(
    () => [
      "#808080",
      fromHsv({ h: hsvState.h, s: 0.25, v: hsvState.v }),
      fromHsv({ h: hsvState.h, s: 0.5, v: hsvState.v }),
      fromHsv({ h: hsvState.h, s: 0.75, v: hsvState.v }),
      fromHsv({ h: hsvState.h, s: 1, v: hsvState.v })
    ],
    [hsvState.h, hsvState.v]
  );

  const brightnessGradient = useMemo(
    () => [
      "#000000",
      fromHsv({ h: hsvState.h, s: hsvState.s, v: 0.25 }),
      fromHsv({ h: hsvState.h, s: hsvState.s, v: 0.5 }),
      fromHsv({ h: hsvState.h, s: hsvState.s, v: 0.75 }),
      fromHsv({ h: hsvState.h, s: hsvState.s, v: 1 })
    ],
    [hsvState.h, hsvState.s]
  );

    const themeLabel =
      mode === "dark" ? "Dark" : mode === "light" ? "Light" : mode === "custom" ? "Custom" : "Default";

    const saveCustomPresets = (nextPresets: ThemePreset[], syncRemote = true) => {
      const normalized = normalizeThemePresets(nextPresets);
      setCustomPresets(normalized);
      AsyncStorage.setItem(CUSTOM_THEME_PRESETS_KEY, JSON.stringify(normalized)).catch(() => {});
      if (syncRemote && idToken) {
        void apiPost("/users/theme-presets", { presets: normalized }, idToken);
      }
    };

    const openCustomTheme = () => {
      setShowThemeConsentModal(true);
    };

    const openCustomThemeAfterConsent = () => {
      setShowThemeConsentModal(false);
      const seed = customTheme ?? colors;
      setCustomDraft({
        background: seed.background,
        card: seed.card,
        text: seed.text,
        subtitle: seed.subtitle,
        accent: seed.accent,
        border: seed.border,
        circle: seed.circle,
        shapeRect: seed.shapeRect,
      });
      setActiveCustomKey("background");
      setCustomError(null);
      setShowCustomThemeModal(true);
    };

    const activeCustomLabel =
      CUSTOM_FIELDS.find((field) => field.key === activeCustomKey)?.label ?? "Color";

    const updateCustomColor = (value: string) => {
      const normalized = normalizeHexInput(value);
      if (!normalized) return;
      setCustomDraft((prev) =>
        prev ? { ...prev, [activeCustomKey]: normalized } : prev,
      );
      if (customError) {
        setCustomError(null);
      }
    };

    const handleColorWheelChange = (color: { h: number; s: number; v: number }) => {
      setHsvState(color); // Update HSV state for manual sliders (Slider Fix Part 2)
      updateCustomColor(fromHsv(color));
    };

    const executeColorAction = (action: 'save' | 'apply') => {
      if (!customDraft) return;
      if (action === 'apply') {
        const theme = buildCustomTheme(customDraft);
        setCustomTheme(theme);
        setThemeMode("custom");
        setCustomError(null);
        setShowCustomThemeModal(false);
      } else {
        if (customPresets.length >= MAX_THEME_PRESETS) {
          setCustomError(`You can save up to ${MAX_THEME_PRESETS} presets.`);
          return;
        }
        const theme = buildCustomTheme(customDraft);
        const preset: ThemePreset = {
          id: `preset-${Date.now()}`,
          name: nextPresetName(customPresets),
          colors: theme,
          favorite: false,
        };
        saveCustomPresets([preset, ...customPresets]);
        setCustomError(null);
      }
    };

    const persistCustomTheme = () => {
      if (!customDraft) return;
      const invalid = CUSTOM_FIELDS
        .filter((field) => !isValidHex(customDraft[field.key]))
        .map((field) => field.label);
      if (invalid.length > 0) {
        setCustomError(
          `Pick a valid color for: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "..." : ""}`,
        );
        return;
      }
      // Check for problematic color combinations
      if (hasProblematicColors(customDraft)) {
        setPendingColorAction('apply');
        setShowColorWarningModal(true);
        return;
      }
      executeColorAction('apply');
    };

    const saveCustomPreset = () => {
      if (!customDraft) return;
      if (customPresets.length >= MAX_THEME_PRESETS) {
        setCustomError(`You can save up to ${MAX_THEME_PRESETS} presets.`);
        return;
      }
      const invalid = CUSTOM_FIELDS
        .filter((field) => !isValidHex(customDraft[field.key]))
        .map((field) => field.label);
      if (invalid.length > 0) {
        setCustomError(
          `Pick a valid color for: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "..." : ""}`,
        );
        return;
      }
      // Check for problematic color combinations
      if (hasProblematicColors(customDraft)) {
        setPendingColorAction('save');
        setShowColorWarningModal(true);
        return;
      }
      executeColorAction('save');
    };

    const togglePresetFavorite = (presetId: string) => {
      const next = customPresets.map((preset) =>
        preset.id === presetId
          ? { ...preset, favorite: !preset.favorite }
          : preset,
      );
      saveCustomPresets(next);
    };

    const movePreset = (presetId: string, direction: -1 | 1) => {
      const index = customPresets.findIndex((preset) => preset.id === presetId);
      if (index === -1) return;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= customPresets.length) return;
      const next = [...customPresets];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      saveCustomPresets(next);
    };

    const deletePreset = (presetId: string) => {
      const preset = customPresets.find((item) => item.id === presetId);
      if (!preset) return;
      Alert.alert(
        "Delete preset?",
        `Remove "${preset.name}" from your saved themes?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              const next = customPresets.filter((item) => item.id !== presetId);
              saveCustomPresets(next);
            },
          },
        ],
      );
    };

  // Update email when userSummary changes
  useEffect(() => {
    if (userSummary?.email !== undefined) {
      setEmail(userSummary.email || "");
      if (userSummary.email) {
        setSettings({ email: userSummary.email });
      }
    }
    if (userSummary?.schoolEmailVerified !== undefined) {
      setEmailVerified(userSummary.schoolEmailVerified ?? false);
      if (userSummary.schoolEmailVerified) {
        setCodeSent(false);
      }
    }
  }, [userSummary?.email, userSummary?.schoolEmailVerified, setSettings]);

  // Load stored analytics consent
  useEffect(() => {
    AsyncStorage.getItem(ANALYTICS_CONSENT_KEY)
      .then((val) => setAnalyticsConsentState(val === "true"))
      .catch(() => setAnalyticsConsentState(false));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_THEME_PRESETS_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const normalized = normalizeThemePresets(parsed);
        setCustomPresets(normalized);
      })
      .catch(() => setCustomPresets([]));
  }, []);

  useEffect(() => {
    if (!idToken || didSyncPresetsRef.current) return;
    didSyncPresetsRef.current = true;
    apiGet<{ presets?: ThemePreset[] }>("/users/theme-presets", idToken)
      .then((res) => {
        const remote = normalizeThemePresets(res?.presets);
        if (remote.length > 0) {
          saveCustomPresets(remote, false);
          return;
        }
        if (customPresets.length > 0) {
          saveCustomPresets(customPresets);
        }
      })
      .catch(() => {});
  }, [idToken, customPresets.length]);

  const toggleAnalyticsConsent = async () => {
    if (analyticsConsent === null) return;
    const next = !analyticsConsent;
    setAnalyticsConsentState(next);
    await AsyncStorage.setItem(ANALYTICS_CONSENT_KEY, next ? "true" : "false");
  };

  // ---------------------------------------------------------------------------
  // BACKGROUND REFRESH (silent update, doesn't block UI)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Wait for user and token to be available
    if (!user || !idToken) {
      return;
    }

    async function refresh() {
      try {
        // Only refresh profile paused status, userSummary comes from SessionDataContext
        const profile = await apiGet<{ paused: boolean }>("/profiles/me", idToken);
        if (profile) setIsPaused(profile.paused);
      } catch {
        // Silent fail for background refresh
      }
    }
    // Only refresh if we have cached profile data (preload already happened)
    if (cachedProfile) {
      refresh();
    }
  }, [cachedProfile, user, idToken]);

  const handleRefresh = async () => {
    await refresh();
  };

  useEffect(() => {
    return registerRefresher(handleRefresh);
  }, [registerRefresher]);

  // ---------------------------------------------------------------------------
  // SAVE SCHOOL EMAIL (SEND VERIFICATION CODE)
  // ---------------------------------------------------------------------------
  async function handleSaveEmail() {
    if (!idToken) return;
    
    setError(null);
    setVerificationSuccess(null);
    setCodeSent(false);
    setVerificationCode("");

    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setError("Enter a valid school email.");
      return;
    }
    
    // Check if domain ends with allowed domain (handles subdomains)
    const domain = normalized.split("@").pop();
    const isValidDomain = domain && ALLOWED_SCHOOL_DOMAINS.some(
      (allowedDomain) =>
        domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
    );
    
    if (!isValidDomain) {
      setError(
        `Use a school email ending in: ${ALLOWED_SCHOOL_DOMAINS.join(", ")}`
      );
      return;
    }

    setSaving(true);
    try {
      const res = await apiPost("/auth/update-email", { email: normalized }, idToken);
      setSaving(false);

      if (!res) {
        setError("Failed to send verification code.");
        return;
      }

      setCodeSent(true);
    } catch (err: any) {
      setSaving(false);
      if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError("Failed to send verification code.");
      }
    }
  }

  // ---------------------------------------------------------------------------
  // VERIFY EMAIL CODE
  // ---------------------------------------------------------------------------
  async function handleVerifyCode() {
    if (!idToken) return;
    if (verifyEmailInFlightRef.current) return;
    
    setError(null);
    setVerificationSuccess(null);

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Email is required.");
      return;
    }

    setSaving(true);
    verifyEmailInFlightRef.current = true;
    try {
      const res = await apiPost<{ success: boolean; message: string; bonusTokenGranted?: boolean }>(
        "/auth/verify-email",
        { email: normalized, code: verificationCode },
        idToken
      );

      if (!res) {
        setError("Failed to verify code.");
        return;
      }

      setEmailVerified(true);
      setCodeSent(false);
      setVerificationCode("");
      
      // Show success message with bonus token notification if applicable
      if (res.bonusTokenGranted) {
        setVerificationSuccess("Email verified! You received 1 free search token.");
      } else {
        setVerificationSuccess("Email verified successfully!");
      }

      // Prompt to add school info based on verified domain
      const verifiedDomain = normalized.split("@").pop() ?? "";
      const mappedSchool = SCHOOL_DOMAIN_MAP[verifiedDomain];
      if (mappedSchool) {
        setPrefillSchool(mappedSchool);
        setShowSchoolPrompt(true);
      } else {
        setPrefillSchool(null);
        setShowSchoolPrompt(false);
      }

      // Refresh session data to update email in cache and context
      await refreshSessionData();
    } catch (err: any) {
      if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError("Failed to verify code.");
      }
    } finally {
      verifyEmailInFlightRef.current = false;
      setSaving(false);
    }
  }

  const handleUnlinkEmail = () => {
    Alert.alert(
      "Unlink Student Email",
      "To protect account integrity, unlinking a verified student email requires support assistance. Please contact support if you need this removed.",
      [{ text: "OK", style: "default" }]
    );
  };

  // ---------------------------------------------------------------------------
  // PAUSE / RESUME
  // ---------------------------------------------------------------------------
  async function handlePauseToggle() {
    if (!idToken) return;
    
    setSaving(true);

    const endpoint = isPaused
      ? "/profiles/me/unpause"
      : "/profiles/me/pause";

    const res = await apiPatch(endpoint, {}, idToken);
    setSaving(false);

    if (!res) {
      setError(isPaused ? "Failed to resume." : "Failed to pause.");
      return;
    }

    setIsPaused(!isPaused);
    setPauseSuccessVisible(true);
  }

  // ---------------------------------------------------------------------------
  // DELETE ACCOUNT
  // ---------------------------------------------------------------------------
  async function handleDelete(mode: "soft" | "hard") {
    if (!idToken) return;
    
    setError(null);
    setSaving(true);
    setDeleteMode(mode);

    try {
      const res =
        mode === "soft"
          ? await apiPost("/users/me/soft-delete", {}, idToken)
          : await apiDelete("/users/me", idToken);

      if (!res) {
        throw new Error(
          mode === "soft"
            ? "Failed to start fresh."
            : "Failed to delete account."
        );
      }

      setDeleteSuccessVisible(true);
    } catch (err: any) {
      setDeleteMode(null);
      if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError(
          mode === "soft"
            ? "Failed to start fresh."
            : "Failed to delete account."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // CLEANUP HELPER (DRY Principle)
  // ---------------------------------------------------------------------------
  /**
   * Performs local cleanup (cache, session, tokens) and navigates to login.
   * Used by both sign out and account deletion flows.
   */
  async function performLocalCleanup() {
    const clearCache = useAppCache.getState().clearCache;
    clearCache(); // Clear all cached data
    await clearSession(); // Clear persisted session
    await clearTokens();
    await clearOAuthData();
  }

  async function finishDeleteFlow() {
    setDeleteMode(null);
    await logout();
    await performLocalCleanup();
  }

  // ---------------------------------------------------------------------------
  // SIGN OUT
  // ---------------------------------------------------------------------------
  async function handleSignOut() {
    try {
      // First, revoke tokens server-side before clearing client state
      if (idToken) {
        await apiPost("/auth/logout", {}, idToken);
      }
    } catch (error) {
      // Log error but continue with client-side logout
      console.error("Failed to revoke tokens server-side:", error);
    }

    await logout();
    // Perform local cleanup; navigation will reroute via auth state
    await performLocalCleanup();
  }

  // ---------------------------------------------------------------------------
  // MAIN UI
  // ---------------------------------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
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
        Settings
      </Text>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        accessible={false}
        importantForAccessibility="no"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        {sessionError && (
          <View style={styles.errorBanner}>
            <Text style={[styles.errorText, { color: colors.text }]}>{sessionError}</Text>
            <TouchableOpacity onPress={handleRefresh} accessibilityRole="button" accessibilityLabel="Retry loading settings">
              <Text style={[styles.retryText, { color: colors.accent ?? colors.text }]}>
                {refreshing ? "Retrying..." : "Retry"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* THEME TOGGLE */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Appearance
        </Text>

        <TouchableOpacity
          style={[
            styles.themeToggle,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.subtitle },
          ]}
          onPress={() => setShowThemePicker(true)}
          accessible={true}
          accessibilityLabel="Change theme"
          accessibilityRole="button"
            accessibilityHint="Opens theme picker"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.themeRow}>
              <Text
                style={{ color: colors.text, fontSize: 16 }}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Theme: {themeLabel}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.text}
                accessible={false}
                importantForAccessibility="no"
              />
            </View>
          </TouchableOpacity>

          <Modal
            visible={showThemePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowThemePicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowThemePicker(false)}
              accessible={false}
              importantForAccessibility="no"
            >
              <TouchableOpacity
                style={[styles.modalBox, { backgroundColor: colors.card }]}
                activeOpacity={1}
                onPress={() => {}}
                accessible={false}
                importantForAccessibility="no"
              >
                <View style={styles.modalHeaderRow}>
                  <TouchableOpacity
                    onPress={() => setShowThemePicker(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={colors.text}
                      accessible={false}
                      importantForAccessibility="no"
                    />
                  </TouchableOpacity>
                  <Text
                    style={[styles.modalTitle, { color: colors.text }]}
                    accessibilityRole="header"
                    allowFontScaling={true}
                  >
                    Choose Theme
                  </Text>
                  <View style={{ width: 24 }} />
                </View>
                {([
                  { label: "Light", value: "light" },
                  { label: "Dark", value: "dark" },
                  { label: "Default", value: "default" },
                  { label: "Custom", value: "custom" },
                ] as const).map((option) => {
                  const selected = mode === option.value;
                  return (
                    <View key={option.value}>
                      <TouchableOpacity
                        style={[
                          styles.themeOption,
                          {
                            borderColor: selected ? colors.accent : colors.border,
                            backgroundColor: selected ? colors.accent + "1A" : colors.background,
                          },
                        ]}
                        onPress={() => {
                          if (option.value === "custom" && !customTheme) {
                            setShowThemePicker(false);
                            openCustomTheme();
                            return;
                          }
                          setThemeMode(option.value);
                          setShowThemePicker(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Set theme to ${option.label}`}
                        accessibilityState={{ selected }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 16,
                            fontWeight: selected ? "700" : "600",
                          }}
                          allowFontScaling={true}
                        >
                          {option.label}
                        </Text>
                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={colors.accent}
                            accessible={false}
                            importantForAccessibility="no"
                          />
                        )}
                      </TouchableOpacity>
                      {option.value === "custom" && (
                        <View style={styles.customInlineRow}>
                          <TouchableOpacity
                            onPress={() => {
                              setShowThemePicker(false);
                              openCustomTheme();
                            }}
                            style={[styles.customInlineButton, { borderColor: colors.border }]}
                            accessibilityRole="button"
                            accessibilityLabel="Customize theme"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text
                              style={[styles.customInlineText, { color: colors.accent }]}
                              allowFontScaling={true}
                            >
                              Customize
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
                {customPresets.length > 0 && (
                  <View style={styles.themePresetSection}>
                    <Text style={[styles.customPresetTitle, { color: colors.text }]}>
                      Saved presets
                    </Text>
                    <View style={styles.customPresetGrid}>
                      {customPresets.map((preset) => (
                        <TouchableOpacity
                          key={preset.id}
                          style={[
                            styles.customPresetCard,
                            { borderColor: colors.border, backgroundColor: colors.background },
                          ]}
                          onPress={() => {
                            setCustomTheme(preset.colors);
                            setThemeMode("custom");
                            setShowThemePicker(false);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Apply ${preset.name}`}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <View style={styles.customPresetSwatchHeader}>
                            <View style={styles.customPresetSwatchRow}>
                              <View
                                style={[
                                  styles.customPresetSwatch,
                                  {
                                    backgroundColor: preset.colors.background,
                                    borderColor: colors.border,
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.customPresetSwatch,
                                  {
                                    backgroundColor: preset.colors.accent,
                                    borderColor: colors.border,
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.customPresetSwatch,
                                  {
                                    backgroundColor: preset.colors.text,
                                    borderColor: colors.border,
                                  },
                                ]}
                              />
                            </View>
                            {preset.favorite ? (
                              <Ionicons
                                name="star"
                                size={16}
                                color={colors.accent}
                                accessibilityElementsHidden
                                importantForAccessibility="no"
                              />
                            ) : null}
                          </View>
                          <Text style={[styles.customPresetName, { color: colors.text }]}>
                            {preset.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* Theme Consent Modal */}
          <ConsentModal
            visible={showThemeConsentModal}
            onClose={() => setShowThemeConsentModal(false)}
            onConfirm={openCustomThemeAfterConsent}
            title="Customize Theme"
            messages={[
              "Custom themes may impact readability and accessibility.",
              "We cannot guarantee text legibility with unofficial color combinations. Proceed at your own discretion.",
            ]}
            confirmText="I Understand"
            cancelText="Cancel"
            colors={colors}
          />

          <Modal
            visible={showCustomThemeModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCustomThemeModal(false)}
          >
            <View style={styles.modalOverlay} accessible={false} importantForAccessibility="no">
              <View style={[styles.customModalBox, { backgroundColor: colors.card }]}>
                <Text
                  style={[styles.modalTitle, { color: colors.text }]}
                  accessibilityRole="header"
                  allowFontScaling={true}
                >
                  Customize Theme
                </Text>

                {customDraft && (
                  <>
                    <View style={styles.customSelectedRow}>
                      <View
                        style={[
                          styles.customSelectedPreview,
                          {
                            backgroundColor: customDraft[activeCustomKey] || colors.border,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.customSelectedLabel, { color: colors.text }]}>
                          {activeCustomLabel}
                        </Text>
                        <Text style={[styles.customSelectedHint, { color: colors.subtitle }]}>
                          Use the hue slider and controls to fine-tune.
                        </Text>
                      </View>
                    </View>

                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Slider
                        value={hsvState.h}
                        onValueChange={(h) => {
                          const newHsv = { ...hsvState, h };
                          setHsvState(newHsv);
                          updateCustomColor(fromHsv(newHsv));
                        }}
                        min={0}
                        max={360}
                        step={1}
                        label="Hue"
                        formatValue={(v) => `${Math.round(v)}°`}
                        gradient={hueGradient}
                      />
                    </View>

                    {/* Saturation and Brightness sliders */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Slider
                        value={hsvState.s * 100}
                        onValueChange={(s) => {
                          const newHsv = { ...hsvState, s: s / 100 };
                          setHsvState(newHsv);
                          updateCustomColor(fromHsv(newHsv));
                        }}
                        min={0}
                        max={100}
                        step={1}
                        label="Saturation"
                        formatValue={(v) => `${Math.round(v)}%`}
                        gradient={saturationGradient}
                      />
                      <Slider
                        value={hsvState.v * 100}
                        onValueChange={(v) => {
                          const newHsv = { ...hsvState, v: v / 100 };
                          setHsvState(newHsv);
                          updateCustomColor(fromHsv(newHsv));
                        }}
                        min={0}
                        max={100}
                        step={1}
                        label="Brightness"
                        formatValue={(v) => `${Math.round(v)}%`}
                        gradient={brightnessGradient}
                      />
                    </View>
                  </>
                )}

                <ScrollView
                  style={{ maxHeight: 200 }}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                >
                  <Text style={[styles.customHint, { color: colors.subtitle }]} allowFontScaling={true}>
                    Tap an option below to select which color to edit.
                  </Text>

                  {customDraft && (
                    <View style={styles.customSwatchGrid}>
                      {CUSTOM_FIELDS.map((field) => {
                        const selected = activeCustomKey === field.key;
                        return (
                          <TouchableOpacity
                            key={field.key}
                            style={[
                              styles.customSwatch,
                              {
                                borderColor: selected ? colors.accent : colors.border,
                                backgroundColor: selected ? `${colors.accent}1A` : "transparent",
                              },
                            ]}
                            onPress={() => setActiveCustomKey(field.key)}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${field.label} color`}
                            accessibilityState={{ selected }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <View
                              style={[
                                styles.colorPreview,
                                {
                                  backgroundColor: customDraft[field.key] || colors.border,
                                  borderColor: colors.border,
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.customSwatchLabel,
                                { color: selected ? colors.text : colors.subtitle },
                              ]}
                            >
                              {field.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {customPresets.length > 0 && (
                    <View style={styles.customPresetSection}>
                      <Text style={[styles.customPresetTitle, { color: colors.text }]}>
                        Saved presets
                      </Text>
                      <View style={styles.customPresetGrid}>
                        {customPresets.map((preset, index) => {
                          const isFirst = index === 0;
                          const isLast = index === customPresets.length - 1;
                          return (
                            <TouchableOpacity
                              key={preset.id}
                              style={[
                                styles.customPresetCard,
                                { borderColor: colors.border, backgroundColor: colors.card },
                              ]}
                              onPress={() => {
                                setCustomDraft(themeToDraft(preset.colors));
                                setActiveCustomKey("background");
                                setCustomError(null);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Load ${preset.name}`}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <View style={styles.customPresetSwatchHeader}>
                                <View style={styles.customPresetSwatchRow}>
                                  <View
                                    style={[
                                      styles.customPresetSwatch,
                                      {
                                        backgroundColor: preset.colors.background,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.customPresetSwatch,
                                      {
                                        backgroundColor: preset.colors.accent,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.customPresetSwatch,
                                      {
                                        backgroundColor: preset.colors.text,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                  />
                                </View>
                                {preset.favorite ? (
                                  <Ionicons
                                    name="star"
                                    size={16}
                                    color={colors.accent}
                                    accessibilityElementsHidden
                                    importantForAccessibility="no"
                                  />
                                ) : null}
                              </View>
                              <Text style={[styles.customPresetName, { color: colors.text }]}>
                                {preset.name}
                              </Text>
                              <Text style={[styles.customPresetHint, { color: colors.subtitle }]}>
                                Tap to edit
                              </Text>
                              <View style={styles.customPresetActions}>
                                <View style={styles.customPresetActionGroup}>
                                  <TouchableOpacity
                                    style={[styles.customPresetAction, { borderColor: colors.border }]}
                                    onPress={() => togglePresetFavorite(preset.id)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Toggle favorite for ${preset.name}`}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Ionicons
                                      name={preset.favorite ? "star" : "star-outline"}
                                      size={16}
                                      color={colors.accent}
                                    />
                                  </TouchableOpacity>
                                </View>
                                <View style={styles.customPresetActionGroup}>
                                  <TouchableOpacity
                                    style={[
                                      styles.customPresetAction,
                                      { borderColor: colors.border, opacity: isFirst ? 0.4 : 1 },
                                    ]}
                                    onPress={() => movePreset(preset.id, -1)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Move ${preset.name} up`}
                                    disabled={isFirst}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Ionicons name="chevron-up" size={16} color={colors.text} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[
                                      styles.customPresetAction,
                                      { borderColor: colors.border, opacity: isLast ? 0.4 : 1 },
                                    ]}
                                    onPress={() => movePreset(preset.id, 1)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Move ${preset.name} down`}
                                    disabled={isLast}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Ionicons name="chevron-down" size={16} color={colors.text} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.customPresetAction, { borderColor: colors.border }]}
                                    onPress={() => deletePreset(preset.id)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Delete ${preset.name}`}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Ionicons name="trash-outline" size={16} color={DANGER_COLOR} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </ScrollView>

                {customError && (
                  <Text style={[styles.customError, { color: colors.text }]} allowFontScaling={true}>
                    {customError}
                  </Text>
                )}
                <View style={styles.customActions}>
                  <TouchableOpacity
                    style={[styles.customButton, { borderColor: colors.border }]}
                    onPress={() => setShowCustomThemeModal(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel custom theme"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.customButtonText, { color: colors.text }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.customButton, { borderColor: colors.border }]}
                    onPress={saveCustomPreset}
                    accessibilityRole="button"
                    accessibilityLabel="Save custom theme preset"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.customButtonText, { color: colors.text }]}>
                      Save Preset
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.customButton, { backgroundColor: colors.accent }]}
                    onPress={() => {
                      persistCustomTheme();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Save custom theme"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.customButtonText, { color: colors.buttonText }]}>
                      Save & Apply
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Color Warning Modal */}
          <ConsentModal
            visible={showColorWarningModal}
            onClose={() => {
              setShowColorWarningModal(false);
              setPendingColorAction(null);
            }}
            onConfirm={() => {
              setShowColorWarningModal(false);
              if (pendingColorAction) {
                executeColorAction(pendingColorAction);
                setPendingColorAction(null);
              }
            }}
            title="Color Warning"
            messages={[
              "Some of your selected colors are very similar to each other.",
              "This may cause text or UI elements to be difficult to read. Are you sure you want to continue?",
            ]}
            confirmText="Continue Anyway"
            cancelText="Go Back"
            colors={colors}
          />

        {/* PRIVACY & ANALYTICS */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Privacy & Analytics
        </Text>
        <TouchableOpacity
          style={[
            styles.themeToggle,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.subtitle, opacity: analyticsConsent === null ? 0.6 : 1 },
          ]}
          onPress={toggleAnalyticsConsent}
          disabled={analyticsConsent === null}
          accessible={true}
          accessibilityLabel="Toggle analytics opt-in"
          accessibilityRole="switch"
          accessibilityState={{ checked: !!analyticsConsent, disabled: analyticsConsent === null }}
          accessibilityHint="Analytics is off by default and only enabled if you opt in."
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={{ color: colors.text, fontSize: 16 }}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            {analyticsConsent ? "Analytics: On (consented)" : "Analytics: Off"}
          </Text>
          <Text 
            style={{ color: colors.subtitle, fontSize: 12, marginTop: 6 }}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Off by default. Turning on lets us collect performance/usage metrics.
          </Text>
        </TouchableOpacity>

        {/* LEGAL */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Legal
        </Text>
        <TouchableOpacity
          style={[
            styles.themeToggle,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.subtitle },
          ]}
          onPress={() => setShowTerms(true)}
          accessible={true}
          accessibilityLabel="Terms of Service"
          accessibilityRole="button"
          accessibilityHint="Opens Terms of Service"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={{ color: colors.text, fontSize: 16 }}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.themeToggle,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.subtitle },
          ]}
          onPress={() => setShowPrivacy(true)}
          accessible={true}
          accessibilityLabel="Privacy Policy"
          accessibilityRole="button"
          accessibilityHint="Opens Privacy Policy"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={{ color: colors.text, fontSize: 16 }}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Privacy Policy
          </Text>
        </TouchableOpacity>

        {/* SCHOOL EMAIL */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Verify School Email
        </Text>
        <Text
          style={[styles.description, { color: colors.subtitle }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          {emailVerified
            ? "Your school email has been verified. Email verification is only available once. By verifying, you confirm eligibility and accept our Terms and Privacy"
            : `Use a .edu address from: ${ALLOWED_SCHOOL_DOMAINS.join(", ")}`}
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="name@school.edu"
          placeholderTextColor={colors.subtitle}
          underlineColorAndroid="transparent"
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[
            styles.input,
            styles.surfaceShadow,
            {
              backgroundColor: emailVerified ? colors.border : colors.card,
              color: emailVerified ? colors.subtitle : colors.text,
              borderColor: colors.border,
            },
          ]}
          editable={!emailVerified && !codeSent}
          accessible={true}
          accessibilityLabel="School email address"
          accessibilityRole="none"
          accessibilityHint={emailVerified ? "Email verified" : "Enter your school email address"}
          allowFontScaling={true}
        />

        {emailVerified && (
          <TouchableOpacity
            onPress={handleUnlinkEmail}
            accessibilityRole="button"
            accessibilityLabel="Unlink verified email"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.unlinkText, { color: colors.text }]} allowFontScaling={true}>
              Unlink Email
            </Text>
          </TouchableOpacity>
        )}

        {!emailVerified && (
          <>
            {!codeSent ? (
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  styles.surfaceShadow,
                  { backgroundColor: colors.accent },
                ]}
                onPress={handleSaveEmail}
                accessible={true}
                accessibilityLabel="Send verification code"
                accessibilityRole="button"
                accessibilityHint="Sends a verification code to your school email"
                accessibilityState={{ disabled: saving }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <Text 
                    style={[styles.saveText, { color: colors.buttonText }]}
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
                  style={[styles.description, { color: colors.subtitle, marginTop: 10 }]}
                  accessible={true}
                  accessibilityRole="text"
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
                    styles.saveBtn,
                    styles.surfaceShadow,
                    { backgroundColor: colors.accent },
                  ]}
                  onPress={handleVerifyCode}
                  accessible={true}
                  accessibilityLabel="Verify code"
                  accessibilityRole="button"
                  accessibilityHint="Verifies your email with the code"
                  accessibilityState={{ disabled: saving || verificationCode.length !== 6 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <Text 
                      style={[styles.saveText, { color: colors.buttonText }]}
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
          </>
        )}

        {verificationSuccess && (
          <Text
            style={{
              color: "green",
              marginTop: 10,
              textAlign: "center",
            }}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={`Success: ${verificationSuccess}`}
            allowFontScaling={true}
          >
            {verificationSuccess}
          </Text>
        )}

        <Modal
          visible={showSchoolPrompt}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSchoolPrompt(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]} allowFontScaling={true}>
                Add your school info?
              </Text>
              <Text style={[styles.modalBody, { color: colors.subtitle }]} allowFontScaling={true}>
                We verified your student email{prefillSchool ? ` for ${prefillSchool}` : ""}. Want to add your school, major, and graduation year to your profile?
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => setShowSchoolPrompt(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Maybe later"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]} allowFontScaling={true}>
                    Maybe later
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.accent }]}
                  onPress={() => {
                    setShowSchoolPrompt(false);
                    navigation.navigate("EditProfile", {
                      prefillSchool: prefillSchool ?? undefined,
                      showSchoolInfo: true,
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add school info"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.buttonText }]} allowFontScaling={true}>
                    Add now
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* FEEDBACK & SUPPORT */}
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Feedback & Support
        </Text>

        <TouchableOpacity
          style={[
            styles.feedbackBtn,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => navigation.navigate("Suggestions")}
          accessible={true}
          accessibilityLabel="Suggestions"
          accessibilityRole="button"
          accessibilityHint="Opens suggestions page to share feedback"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="bulb-outline"
            size={22}
            color={colors.text}
            style={{ marginRight: 12 }}
            accessible={false}
            importantForAccessibility="no"
          />
          <Text
            style={[styles.feedbackText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Suggestions
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.subtitle}
            style={{ marginLeft: "auto" }}
            accessible={false}
            importantForAccessibility="no"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.feedbackBtn,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => navigation.navigate("Support")}
          accessible={true}
          accessibilityLabel="Support"
          accessibilityRole="button"
          accessibilityHint="Opens support page for help and FAQs"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="help-circle-outline"
            size={22}
            color={colors.text}
            style={{ marginRight: 12 }}
            accessible={false}
            importantForAccessibility="no"
          />
          <Text
            style={[styles.feedbackText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Support
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.subtitle}
            style={{ marginLeft: "auto" }}
            accessible={false}
            importantForAccessibility="no"
          />
        </TouchableOpacity>

        {/* PAUSE ACCOUNT */}
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Pause Account
        </Text>
        <Text 
          style={[styles.description, { color: colors.subtitle }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          {isPaused
            ? "Your account is currently paused."
            : "Pausing hides your profile temporarily."}
        </Text>

        <TouchableOpacity
          style={[
            styles.pauseBtn,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.subtitle },
          ]}
          onPress={() => setPauseConfirmVisible(true)}
          accessible={true}
          accessibilityLabel={isPaused ? "Resume Account" : "Pause Account"}
          accessibilityRole="button"
          accessibilityHint={isPaused ? "Makes your profile visible again" : "Hides your profile temporarily"}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={[styles.pauseText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            {isPaused ? "Resume Account" : "Pause Account"}
          </Text>
        </TouchableOpacity>

        {/* DELETE ACCOUNT */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Delete Account
        </Text>
        <Text 
          style={[styles.description, { color: colors.subtitle }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          You can start fresh (retain purchases) or permanently delete everything. Tokens and purchases are only removed if you choose permanent deletion.
        </Text>

        <TouchableOpacity
          style={[
            styles.deleteBtn,
            styles.surfaceShadow,
            { borderColor: DANGER_COLOR, backgroundColor: DANGER_COLOR },
          ]}
          onPress={() => setDeleteConfirmVisible(true)}
          accessible={true}
          accessibilityLabel="Delete Account"
          accessibilityRole="button"
          accessibilityHint="Opens options to start fresh while keeping tokens or permanently delete your account and purchases."
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[styles.deleteText, { color: "#FFFFFF" }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Delete Account
          </Text>
        </TouchableOpacity>

        {/* SIGN OUT */}
        <TouchableOpacity
          style={[
            styles.signOutBtn,
            styles.surfaceShadow,
            { borderColor: colors.text },
          ]}
          onPress={handleSignOut}
          accessible={true}
          accessibilityLabel="Sign Out"
          accessibilityRole="button"
          accessibilityHint="Signs out of your account"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={[styles.signOutText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Sign Out
          </Text>
        </TouchableOpacity>

        {error && (
          <InlineAlert message={error} style={{ marginTop: 10 }} />
        )}
      </ScrollView>

      {/* ---------- MODALS ---------- */}

      {/* Terms of Service */}
      <LegalModal
        visible={showTerms}
        onClose={() => setShowTerms(false)}
        title="Terms of Service"
        content={TERMS_OF_SERVICE}
        colors={colors}
      />

      {/* Privacy Policy */}
      <LegalModal
        visible={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        title="Privacy Policy"
        content={PRIVACY_POLICY}
        colors={colors}
      />

      {/* Pause Confirm */}
      <Modal 
        visible={pauseConfirmVisible} 
        transparent 
        animationType="fade"
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View 
          style={styles.modalOverlay}
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
              {isPaused ? "Resume Account?" : "Pause Account?"}
            </Text>
            <Text 
              style={[styles.modalMessage, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              {isPaused
                ? "Your profile will be visible again."
                : "Your profile will be hidden until you return."}
            </Text>

            <View 
              style={styles.modalButtonsRow}
              accessible={false}
              importantForAccessibility="no"
            >
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPauseConfirmVisible(false)}
                accessible={true}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                accessibilityHint="Cancels the pause action"
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
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: colors.accent },
                ]}
                onPress={() => {
                  setPauseConfirmVisible(false);
                  handlePauseToggle();
                }}
                accessible={true}
                accessibilityLabel="Confirm"
                accessibilityRole="button"
                accessibilityHint={isPaused ? "Resumes your account" : "Pauses your account"}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalConfirmText, { color: colors.buttonText }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pause Success */}
      <Modal 
        visible={pauseSuccessVisible} 
        transparent 
        animationType="fade"
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View 
          style={styles.modalOverlay}
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
              {isPaused ? "Account Resumed" : "Account Paused"}
            </Text>
            <Text 
              style={[styles.modalMessage, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              {isPaused ? "Your profile is hidden." : "Your account is now active."}
            </Text>

            <TouchableOpacity
              style={[
                styles.modalConfirmBtn,
                { backgroundColor: colors.accent },
              ]}
              onPress={() => setPauseSuccessVisible(false)}
              accessible={true}
              accessibilityLabel="OK"
              accessibilityRole="button"
              accessibilityHint="Closes this message"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[styles.modalConfirmText, { color: colors.buttonText }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm */}
      <Modal 
        visible={deleteConfirmVisible} 
        transparent 
        animationType="fade"
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View 
          style={styles.modalOverlay}
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
              Delete Account?
            </Text>
            <Text 
              style={[styles.modalMessage, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="alert"
              allowFontScaling={true}
            >
              Choose how you want to remove your account.
            </Text>

            <TouchableOpacity
              style={[
                styles.deleteOption,
                { borderColor: colors.subtitle, backgroundColor: colors.card },
              ]}
              onPress={() => {
                setDeleteConfirmVisible(false);
                handleDelete("soft");
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Start fresh and keep tokens"
              accessibilityHint="Hides your account and clears your data but keeps your tokens so you can return later."
              disabled={saving}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[styles.modalOptionTitle, { color: colors.text }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Start fresh (keep tokens)
              </Text>
              <Text
                style={[styles.modalOptionText, { color: colors.subtitle }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                This hides your account and clears your data but keeps your tokens. You can sign in again to continue with your balance.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deleteOption,
                {
                  borderColor: "red",
                  backgroundColor: isDark ? "rgba(255,0,0,0.12)" : "#ffe8e8",
                },
              ]}
              onPress={() => {
                setDeleteConfirmVisible(false);
                handleDelete("hard");
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Permanently delete account"
              accessibilityHint="Permanently deletes your account, tokens, and any purchases."
              disabled={saving}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[styles.modalOptionTitle, { color: "red" }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Permanently delete
              </Text>
              <Text
                style={[styles.modalOptionText, { color: colors.subtitle }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                This permanently deletes your account, tokens, and any purchases. This cannot be undone.
              </Text>
            </TouchableOpacity>

            <View 
              style={styles.modalButtonsRow}
              accessible={false}
              importantForAccessibility="no"
            >
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteConfirmVisible(false)}
                accessible={true}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                accessibilityHint="Cancels account deletion"
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
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Success */}
      <Modal 
        visible={deleteSuccessVisible} 
        transparent 
        animationType="fade"
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View 
          style={styles.modalOverlay}
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
              {deleteMode === "soft" ? "Account Hidden" : "Account Deleted"}
            </Text>
            <Text 
              style={[styles.modalMessage, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              {deleteMode === "soft"
                ? "Your account is hidden and your data was cleared. Tokens stay linked for when you return."
                : "Your account, tokens, and any purchases have been permanently removed."}
            </Text>

            <TouchableOpacity
              style={[
                styles.modalConfirmBtn,
                {
                  backgroundColor:
                    deleteMode === "soft" ? colors.accent : "red",
                },
              ]}
              onPress={finishDeleteFlow}
              accessible={true}
              accessibilityLabel="OK"
              accessibilityRole="button"
              accessibilityHint="Returns to login screen"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.modalConfirmText,
                  {
                    color:
                      deleteMode === "soft"
                        ? colors.buttonText ?? "white"
                        : "white",
                  },
                ]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 10 },

  // Header
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

  // Sections
  sectionTitle: {
    fontSize: 22,
    marginTop: 30,
    marginBottom: 10,
    fontWeight: "600",
  },

  description: {
    fontSize: 14,
    marginBottom: 10,
  },
  unlinkText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  legalNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
  },

  // Theme toggle
  themeToggle: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  surfaceShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeOption: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customInlineRow: {
    alignItems: "center",
    marginTop: 8,
  },
  customInlineButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  customInlineText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  customModalBox: {
    width: "88%",
    maxHeight: "90%",
    padding: 20,
    borderRadius: 14,
  },
  customHint: {
    fontSize: 12,
    marginBottom: 10,
  },
  customPresetSection: {
    marginBottom: 12,
  },
  themePresetSection: {
    marginTop: 16,
  },
  customPresetTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  customPresetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  customPresetCard: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  customPresetSwatchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  customPresetSwatchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flex: 1,
    marginRight: 6,
  },
  customPresetSwatch: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
  },
  customPresetName: {
    fontSize: 12,
    fontWeight: "700",
  },
  customPresetHint: {
    fontSize: 11,
    marginTop: 2,
  },
  customPresetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  customPresetActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customPresetAction: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderTextHidden: {
    height: 0,
    opacity: 0,
    margin: 0,
    padding: 0,
  },
  customSelectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  customSelectedPreview: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  customSelectedLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  customSelectedHint: {
    fontSize: 12,
    marginTop: 2,
  },
  customWheelWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  customWheel: {
    width: 220,
    height: 220,
  },
  customSwatchScroll: {
    paddingVertical: 6,
    paddingBottom: 8,
  },
  customSwatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  customSwatch: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: "48%",
    marginBottom: 12,
  },
  customSwatchLabel: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: "600",
  },
  colorPreview: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  customActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
    marginBottom: 6,
  },
  customButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  customButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  customError: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
  },

  // Email
  input: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
  },

  saveBtn: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  saveText: {
    textAlign: "center",
    fontWeight: "600",
  },

  // Pause
  pauseBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  pauseText: { textAlign: "center", fontWeight: "600" },

  // Feedback & Support
  feedbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: Platform.OS === "ios" ? 44 : 48,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: "600",
  },

  // Delete
  deleteBtn: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginBottom: 30,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  deleteText: {
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  // Sign Out
  signOutBtn: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  signOutText: {
    textAlign: "center",
    fontWeight: "600",
    fontSize: 17,
  },

  // Errors
  errorBanner: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    fontWeight: "600",
    marginBottom: 6,
  },
  retryText: {
    textDecorationLine: "underline",
    fontWeight: "500",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  modalCard: {
    width: "85%",
    padding: 20,
    borderRadius: 14,
  },

  modalBody: {
    fontSize: 15,
    marginBottom: 18,
    lineHeight: 20,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginLeft: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  modalBox: {
    width: "80%",
    padding: 20,
    borderRadius: 14,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },

  modalMessage: {
    fontSize: 15,
    marginBottom: 20,
  },

  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  deleteOption: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalOptionText: {
    fontSize: 14,
    lineHeight: 18,
  },
  modalBodyText: {
    fontSize: 14,
    lineHeight: 20,
  },

  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginRight: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 16 },

  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  modalConfirmText: {
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },

  modalInput: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
  },
});
