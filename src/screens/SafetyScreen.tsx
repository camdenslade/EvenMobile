//********************************************************************
//
// SafetyScreen Component
//
// Displays safety information including emergency contacts (911),
// national safety hotlines, online dating safety tips, meeting in
// person guidelines, and app safety policies. Provides links to
// external safety resources. Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the safety screen
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

interface SafetyScreenProps {
  __prerender?: boolean;
}

//********************************************************************
//
// openLink Function
//
// Opens a URL using the device's default handler (browser, phone, etc.).
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
// HotlineCard Component
//
// Displays a hotline card with icon, label, and phone number.
// Opens phone dialer when pressed.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing a hotline card
//
// Value Parameters
// ----------------
// label      string    Hotline label text
// phone      string    Phone number to dial
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
const HotlineCard = ({
  label,
  phone,
  colors,
}: {
  label: string;
  phone: string;
  colors: any;
}) => (
  <TouchableOpacity
    style={[
      styles.hotlineCard,
      styles.surfaceShadow,
      { backgroundColor: colors.card, borderColor: colors.border },
    ]}
    onPress={() => openLink(`tel:${phone}`)}
    accessible={true}
    accessibilityLabel={`${label}. Phone number: ${phone}`}
    accessibilityRole="button"
    accessibilityHint={`Calls ${label} at ${phone}`}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Ionicons 
      name="call" 
      size={24} 
      color={colors.text} 
      style={styles.hotlineIcon}
      accessible={false}
      importantForAccessibility="no"
    />

    <View 
      style={{ flex: 1 }}
      accessible={false}
      importantForAccessibility="no"
    >
      <Text 
        style={[styles.hotlineLabel, { color: colors.text }]}
        allowFontScaling={true}
        accessible={false}
        importantForAccessibility="no"
      >
        {label}
      </Text>
      <Text 
        style={[styles.hotlinePhone, { color: colors.subtitle }]}
        allowFontScaling={true}
        accessible={false}
        importantForAccessibility="no"
      >
        {phone}
      </Text>
    </View>
  </TouchableOpacity>
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

export default function SafetyScreen({ __prerender }: SafetyScreenProps) {
  // Do not render anything during prerender
  if (__prerender) return null;

  const navigation = useNavigation<any>();
  const { colors } = useTheme();

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
        Safety Center
      </Text>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        accessible={false}
        importantForAccessibility="no"
      >
        {/* Immediate Danger */}
        <SectionHeader title="If you're in immediate danger:" colors={colors} />

        <TouchableOpacity 
          style={styles.emergencyButton} 
          onPress={() => openLink("tel:911")}
          accessible={true}
          accessibilityLabel="Call 911"
          accessibilityRole="button"
          accessibilityHint="Calls emergency services"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="alert-circle" 
            size={26} 
            color="white"
            accessible={false}
            importantForAccessibility="no"
          />
          <Text 
            style={styles.emergencyButtonText}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Call 911
          </Text>
        </TouchableOpacity>

        {/* Hotlines */}
        <SectionHeader title="National Safety Hotlines" colors={colors} />

        <HotlineCard
          label="National Domestic Violence Hotline"
          phone="1-800-799-7233"
          colors={colors}
        />
        <HotlineCard
          label="National Sexual Assault Hotline (RAINN)"
          phone="1-800-656-4673"
          colors={colors}
        />
        <HotlineCard
          label="National Human Trafficking Hotline"
          phone="1-888-373-7888"
          colors={colors}
        />
        <HotlineCard label="988 Suicide & Crisis Lifeline" phone="988" colors={colors} />

        {/* Safety Tips */}
        <SectionHeader title="Online Dating Safety Tips" colors={colors} />
        <View 
          style={[
            styles.tipBox,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Online Dating Safety Tips: Never share your full address or workplace. Keep conversations inside the app until trust is built. Avoid sending money or financial info. Use video chat to verify identity."
        >
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Never share your full address or workplace.
          </Text>
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Keep conversations inside the app until trust is built.
          </Text>
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Avoid sending money or financial info.
          </Text>
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Use video chat to verify identity.
          </Text>
        </View>

        <SectionHeader title="Meeting in Person" colors={colors} />
        <View 
          style={[
            styles.tipBox,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Meeting in Person: Meet in a public place. Tell a friend who and where. Arrange your own transport. Leave if it feels wrong."
        >
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Meet in a public place.
          </Text>
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Tell a friend who & where.
          </Text>
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Arrange your own transport.
          </Text>
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Leave if it feels wrong.
          </Text>
        </View>

        <SectionHeader title="Even App Safety Policies" colors={colors} />
        <View 
          style={[
            styles.tipBox,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Even App Safety Policies: You can block or report anytime. Emergency reviews are preserved. Suspicious actions trigger safety checks."
        >
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • You can block or report anytime.
          </Text>
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Emergency reviews are preserved.
          </Text>
          <Text 
            style={[styles.tipText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            • Suspicious actions trigger safety checks.
          </Text>
        </View>

        {/* Resources */}
        <SectionHeader title="Additional Resources" colors={colors} />

        <TouchableOpacity
          onPress={() => openLink("https://www.rainn.org/safety-tips")}
          style={styles.resourceLink}
          accessible={true}
          accessibilityLabel="RAINN Safety Tips"
          accessibilityRole="link"
          accessibilityHint="Opens RAINN safety tips website"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={[styles.resourceText, { color: colors.accent }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            RAINN Safety Tips
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            openLink("https://www.thehotline.org/resources/safety-planning")
          }
          style={styles.resourceLink}
          accessible={true}
          accessibilityLabel="Domestic Violence Safety Planning"
          accessibilityRole="link"
          accessibilityHint="Opens domestic violence safety planning website"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[styles.resourceText, { color: colors.accent }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Domestic Violence Safety Planning
          </Text>
        </TouchableOpacity>

        {/* Support */}
        <SectionHeader title="Need Help?" colors={colors} />

        <TouchableOpacity
          style={[
            styles.supportCard,
            styles.surfaceShadow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => navigation.navigate("Support")}
          accessible={true}
          accessibilityLabel="Contact Support"
          accessibilityRole="button"
          accessibilityHint="Opens support page for help and FAQs"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="help-circle-outline"
            size={24}
            color={colors.text}
            style={styles.supportIcon}
            accessible={false}
            importantForAccessibility="no"
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.supportTitle, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Contact Support
            </Text>
            <Text
              style={[styles.supportSubtitle, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Get help, FAQs, and more
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
    marginBottom: 10,
  },

  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D7263D",
    padding: 15,
    borderRadius: 10,
    justifyContent: "center",
    marginBottom: 20,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emergencyButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 10,
  },

  hotlineCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    borderWidth: 1,
  },
  hotlineIcon: { marginRight: 12 },
  hotlineLabel: { fontSize: 16, fontWeight: "600" },
  hotlinePhone: { fontSize: 14 },

  tipBox: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },

  resourceLink: { 
    marginBottom: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
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

  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    minHeight: Platform.OS === "ios" ? 60 : 64,
    borderWidth: 1,
  },
  supportIcon: {
    marginRight: 12,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  supportSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
