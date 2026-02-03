//********************************************************************
//
// SupportScreen Component
//
// Displays support options including FAQs, contact methods, and
// helpful resources. Provides ways for users to get help with
// the app. Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the support screen
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
//
//*******************************************************************

import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeProvider";
import GlobalBackground from "../components/GlobalBackground";

interface SupportScreenProps {
  __prerender?: boolean;
}

//********************************************************************
//
// openLink Function
//
// Opens a URL using the device's default handler (browser, email, etc.).
// Silently fails if the URL cannot be opened.
//
// Return Value
// ------------
// void
//
// Value Parameters
// ----------------
// url    string    URL to open
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// None
//
//*******************************************************************
const openLink = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

//********************************************************************
//
// SupportCard Component
//
// Displays a support option card with icon, title, and description.
// Executes onPress callback when pressed.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing a support card
//
// Value Parameters
// ----------------
// icon       string    Ionicons icon name
// title      string    Card title text
// subtitle   string    Card description text
// colors     Object    Theme colors
// onPress    function  Callback when card is pressed
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// None
//
//*******************************************************************
const SupportCard = ({
  icon,
  title,
  subtitle,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  colors: any;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[
      styles.supportCard,
      styles.surfaceShadow,
      { backgroundColor: colors.card, borderColor: colors.border },
    ]}
    onPress={onPress}
    accessible={true}
    accessibilityLabel={title}
    accessibilityHint={subtitle}
    accessibilityRole="button"
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <View
      style={[styles.iconContainer, { backgroundColor: colors.accent + "1A" }]}
    >
      <Ionicons
        name={icon}
        size={24}
        color={colors.accent}
        accessible={false}
        importantForAccessibility="no"
      />
    </View>
    <View style={styles.cardContent}>
      <Text
        style={[styles.cardTitle, { color: colors.text }]}
        allowFontScaling={true}
        accessible={false}
        importantForAccessibility="no"
      >
        {title}
      </Text>
      <Text
        style={[styles.cardSubtitle, { color: colors.subtitle }]}
        allowFontScaling={true}
        accessible={false}
        importantForAccessibility="no"
      >
        {subtitle}
      </Text>
    </View>
    <Ionicons
      name="chevron-forward"
      size={20}
      color={colors.subtitle}
      accessible={false}
      importantForAccessibility="no"
    />
  </TouchableOpacity>
);

//********************************************************************
//
// FAQItem Component
//
// Displays a FAQ item with question and answer.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing a FAQ item
//
// Value Parameters
// ----------------
// question    string    FAQ question text
// answer      string    FAQ answer text
// colors      Object    Theme colors
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// None
//
//*******************************************************************
const FAQItem = ({
  question,
  answer,
  colors,
}: {
  question: string;
  answer: string;
  colors: any;
}) => (
  <View
    style={[
      styles.faqItem,
      styles.surfaceShadow,
      { backgroundColor: colors.card, borderColor: colors.border },
    ]}
    accessible={true}
    accessibilityRole="text"
    accessibilityLabel={`${question}. ${answer}`}
  >
    <Text
      style={[styles.faqQuestion, { color: colors.text }]}
      allowFontScaling={true}
      accessible={false}
      importantForAccessibility="no"
    >
      {question}
    </Text>
    <Text
      style={[styles.faqAnswer, { color: colors.subtitle }]}
      allowFontScaling={true}
      accessible={false}
      importantForAccessibility="no"
    >
      {answer}
    </Text>
  </View>
);

//********************************************************************
//
// SectionHeader Component
//
// Displays a section header with title text.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing a section header
//
// Value Parameters
// ----------------
// title      string    Section title text
// colors     Object    Theme colors
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// None
//
//*******************************************************************
const SectionHeader = ({ title, colors }: { title: string; colors: any }) => (
  <Text
    style={[styles.sectionHeader, { color: colors.text }]}
    accessible={true}
    accessibilityRole="header"
    allowFontScaling={true}
  >
    {title}
  </Text>
);

export default function SupportScreen({ __prerender }: SupportScreenProps) {
  // Do not render anything during prerender
  if (__prerender) return null;

  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const faqs = [
    {
      question: "How do I edit my profile?",
      answer: "Go to your Profile tab, then tap 'Edit Profile' to update your photos, bio, and other information.",
    },
    {
      question: "How do I change my preferences?",
      answer: "From your Profile, tap 'Preferences' to adjust your matching criteria like age range and distance.",
    },
    {
      question: "How do I report someone?",
      answer: "Open their profile and tap the report button, or go to Safety > Report a Concern.",
    },
    {
      question: "How do I delete my account?",
      answer: "Go to Settings > Delete Account. You can choose to keep your tokens or permanently delete everything.",
    },
  ];

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
        Support
      </Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        accessible={false}
        importantForAccessibility="no"
      >
        {/* Contact Options */}
        <SectionHeader title="Get Help" colors={colors} />

        <SupportCard
          icon="mail-outline"
          title="Email Support"
          subtitle="support@evenapp.com"
          colors={colors}
          onPress={() => openLink("mailto:support@evenapp.com?subject=Even App Support Request")}
        />

        <SupportCard
          icon="chatbubble-outline"
          title="Send Feedback"
          subtitle="Share your thoughts with us"
          colors={colors}
          onPress={() => navigation.navigate("Suggestions")}
        />

        <SupportCard
          icon="shield-outline"
          title="Safety Center"
          subtitle="Report concerns and safety resources"
          colors={colors}
          onPress={() => navigation.navigate("Safety")}
        />

        {/* FAQs */}
        <SectionHeader title="Frequently Asked Questions" colors={colors} />

        {faqs.map((faq, index) => (
          <FAQItem
            key={index}
            question={faq.question}
            answer={faq.answer}
            colors={colors}
          />
        ))}

        {/* Additional Resources */}
        <SectionHeader title="Additional Resources" colors={colors} />

        <TouchableOpacity
          onPress={() => openLink("https://evenapp.com/help")}
          style={styles.resourceLink}
          accessible={true}
          accessibilityLabel="Help Center"
          accessibilityRole="link"
          accessibilityHint="Opens help center website"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[styles.resourceText, { color: colors.accent }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Help Center
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openLink("https://evenapp.com/community-guidelines")}
          style={styles.resourceLink}
          accessible={true}
          accessibilityLabel="Community Guidelines"
          accessibilityRole="link"
          accessibilityHint="Opens community guidelines website"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[styles.resourceText, { color: colors.accent }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Community Guidelines
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openLink("https://evenapp.com/privacy")}
          style={styles.resourceLink}
          accessible={true}
          accessibilityLabel="Privacy Policy"
          accessibilityRole="link"
          accessibilityHint="Opens privacy policy website"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[styles.resourceText, { color: colors.accent }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginTop: 25,
    marginBottom: 12,
  },

  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    minHeight: Platform.OS === "ios" ? 70 : 74,
    borderWidth: 1,
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  cardContent: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },

  cardSubtitle: {
    fontSize: 13,
  },

  faqItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },

  faqQuestion: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },

  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },

  resourceLink: {
    marginBottom: 10,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
  },

  resourceText: {
    fontSize: 16,
    textDecorationLine: "underline",
  },

  surfaceShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
