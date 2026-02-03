//********************************************************************
//
// SuggestionsScreen Component
//
// Displays a form for users to submit suggestions, feedback, and
// feature requests. Provides a text input for the suggestion and
// a submit button. Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the suggestions screen
//
// Value Parameters
// ----------------
// __prerender    boolean     Flag for prerendering (returns null if true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// navigation    any         Navigation object
// colors        Object      Theme colors
// suggestion    string      User's suggestion text
// saving        boolean     Whether submission is in progress
// submitted     boolean     Whether suggestion was submitted successfully
//
//*******************************************************************

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeProvider";
import GlobalBackground from "../components/GlobalBackground";
import { useAuth } from "../context/AuthContext";
import { apiPost } from "../services/apiService";
import { InlineAlert } from "../components/InlineAlert";

interface SuggestionsScreenProps {
  __prerender?: boolean;
}

export default function SuggestionsScreen({ __prerender }: SuggestionsScreenProps) {
  // Do not render anything during prerender
  if (__prerender) return null;

  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { idToken } = useAuth();

  const [suggestion, setSuggestion] = useState("");
  const [category, setCategory] = useState<"feature" | "improvement" | "bug" | "other">("feature");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref-based guard to prevent double submissions
  const submitInFlightRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  const categories = [
    { key: "feature" as const, label: "New Feature", icon: "bulb-outline" as const },
    { key: "improvement" as const, label: "Improvement", icon: "trending-up-outline" as const },
    { key: "bug" as const, label: "Bug Report", icon: "bug-outline" as const },
    { key: "other" as const, label: "Other", icon: "chatbox-outline" as const },
  ];

  const handleSubmit = useCallback(async () => {
    // Double-click protection
    const now = Date.now();
    if (submitInFlightRef.current || now - lastSubmitTimeRef.current < 300) {
      return;
    }

    if (!suggestion.trim()) {
      setError("Please enter your suggestion.");
      return;
    }

    if (suggestion.trim().length < 10) {
      setError("Please provide more detail (at least 10 characters).");
      return;
    }

    submitInFlightRef.current = true;
    lastSubmitTimeRef.current = now;
    setSaving(true);
    setError(null);

    try {
      await apiPost("/feedback/suggestions", {
        category,
        suggestion: suggestion.trim(),
      }, idToken || undefined);

      setSubmitted(true);
      setSuggestion("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to submit suggestion. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
      submitInFlightRef.current = false;
    }
  }, [suggestion, category, idToken]);

  const handleNewSuggestion = () => {
    setSubmitted(false);
    setSuggestion("");
    setCategory("feature");
    setError(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      {/* Back Button */}
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
        Suggestions
      </Text>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          accessible={false}
          importantForAccessibility="no"
        >
          {submitted ? (
            // Success state
            <View style={styles.successContainer}>
              <View
                style={[
                  styles.successBox,
                  styles.surfaceShadow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={64}
                  color={colors.accent}
                  accessible={false}
                  importantForAccessibility="no"
                />
                <Text
                  style={[styles.successTitle, { color: colors.text }]}
                  accessible={true}
                  accessibilityRole="text"
                  allowFontScaling={true}
                >
                  Thank You!
                </Text>
                <Text
                  style={[styles.successMessage, { color: colors.subtitle }]}
                  accessible={true}
                  accessibilityRole="text"
                  allowFontScaling={true}
                >
                  Your suggestion has been submitted. We appreciate your feedback and will review it carefully.
                </Text>
                <TouchableOpacity
                  style={[styles.newSuggestionBtn, { backgroundColor: colors.accent }]}
                  onPress={handleNewSuggestion}
                  accessible={true}
                  accessibilityLabel="Submit another suggestion"
                  accessibilityRole="button"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    style={[styles.newSuggestionText, { color: colors.buttonText }]}
                    allowFontScaling={true}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    Submit Another
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Form state
            <>
              <Text
                style={[styles.sectionHeader, { color: colors.text }]}
                accessible={true}
                accessibilityRole="header"
                allowFontScaling={true}
              >
                We'd love to hear from you
              </Text>
              <Text
                style={[styles.description, { color: colors.subtitle }]}
                accessible={true}
                accessibilityRole="text"
                allowFontScaling={true}
              >
                Share your ideas for new features, improvements, or report any issues you've encountered.
              </Text>

              {/* Category Selection */}
              <Text
                style={[styles.label, { color: colors.text }]}
                accessible={true}
                accessibilityRole="text"
                allowFontScaling={true}
              >
                Category
              </Text>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => {
                  const isSelected = category === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.categoryCard,
                        styles.surfaceShadow,
                        {
                          backgroundColor: isSelected ? colors.accent + "1A" : colors.card,
                          borderColor: isSelected ? colors.accent : colors.border,
                        },
                      ]}
                      onPress={() => setCategory(cat.key)}
                      accessible={true}
                      accessibilityLabel={cat.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={24}
                        color={isSelected ? colors.accent : colors.text}
                        accessible={false}
                        importantForAccessibility="no"
                      />
                      <Text
                        style={[
                          styles.categoryLabel,
                          { color: isSelected ? colors.accent : colors.text }
                        ]}
                        allowFontScaling={true}
                        accessible={false}
                        importantForAccessibility="no"
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Suggestion Input */}
              <Text
                style={[styles.label, { color: colors.text }]}
                accessible={true}
                accessibilityRole="text"
                allowFontScaling={true}
              >
                Your Suggestion
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.surfaceShadow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={suggestion}
                onChangeText={setSuggestion}
                placeholder="Describe your suggestion or feedback..."
                placeholderTextColor={colors.subtitle}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={1000}
                accessible={true}
                accessibilityLabel="Suggestion input"
                accessibilityHint="Enter your suggestion or feedback"
              />
              <Text
                style={[styles.charCount, { color: colors.subtitle }]}
                accessible={true}
                accessibilityRole="text"
                allowFontScaling={true}
              >
                {suggestion.length}/1000
              </Text>

              {error && (
                <InlineAlert message={error} style={{ marginTop: 10, marginBottom: 10 }} />
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  styles.surfaceShadow,
                  {
                    backgroundColor: colors.accent,
                    opacity: saving ? 0.7 : 1,
                  },
                ]}
                onPress={handleSubmit}
                disabled={saving}
                accessible={true}
                accessibilityLabel="Submit suggestion"
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <Text
                    style={[styles.submitText, { color: colors.buttonText }]}
                    allowFontScaling={true}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    Submit Suggestion
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Styles ---------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },

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

  scrollContent: {
    paddingBottom: 100,
  },

  sectionHeader: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 8,
  },

  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },

  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 15,
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  categoryCard: {
    width: "48%",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: "center",
    minHeight: Platform.OS === "ios" ? 80 : 84,
    justifyContent: "center",
  },

  categoryLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },

  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 15,
    fontSize: 16,
    minHeight: 150,
  },

  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 5,
  },

  submitBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    minHeight: Platform.OS === "ios" ? 50 : 52,
  },

  submitText: {
    fontSize: 16,
    fontWeight: "700",
  },

  surfaceShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },

  successBox: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    width: "100%",
  },

  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 12,
  },

  successMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },

  newSuggestionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
  },

  newSuggestionText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
