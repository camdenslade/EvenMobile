//********************************************************************
//
// LoginScreen Component
//
// Initial login screen with app logo, create account/sign in options,
// and legal policy links. Supports two modes: default (create account
// button) and sign-in options (Google/Phone buttons). Displays legal
// modals for Terms, Privacy, and Cookies policies.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the login screen
//
// Value Parameters
// ----------------
// None
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// navigation      any         Navigation object
// colors          Object      Theme colors
// showOptions     boolean     Whether sign-in options are visible
// showTerms       boolean     Whether Terms modal is visible
// showPrivacy     boolean     Whether Privacy modal is visible
// showCookies     boolean     Whether Cookies modal is visible
//
//*******************************************************************

import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeProvider";
import GlobalBackground from "../../components/GlobalBackground";
import { AppImage } from "../../components/AppImage";

import { TERMS_OF_SERVICE } from "../legal/terms";
import { PRIVACY_POLICY } from "../legal/privacy";
import { COOKIES_POLICY } from "../legal/cookies";

const APP_LOGO = require("../../../assets/images/Even-App-Logos/TransparentBG/EE-SolidWhite.png");

//********************************************************************
//
// SocialButton Component
//
// Reusable button component for social login options (Google, Phone).
//
// Return Value
// ------------
// React.ReactElement    JSX element representing social button
//
// Value Parameters
// ----------------
// iconName        string    Ionicons icon name
// title           string    Button text
// onPress         () => void Button press handler
// iconColor       string    Icon color
// backgroundColor string    Button background color
// textColor       string    Text color
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
const SocialButton = ({
  iconName,
  title,
  onPress,
  iconColor,
  backgroundColor,
  textColor,
  borderColor,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  iconColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
}) => (
  <TouchableOpacity
    style={[
      styles.socialButton,
      styles.surfaceShadow,
      { backgroundColor, borderColor: borderColor || backgroundColor },
    ]}
    onPress={onPress}
    accessible={true}
    accessibilityLabel={title}
    accessibilityRole="button"
    accessibilityHint={`Signs in using ${title.replace('Sign in with ', '')}`}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Ionicons 
      name={iconName} 
      size={24} 
      color={iconColor} 
      style={styles.socialIcon}
      accessible={false}
      importantForAccessibility="no"
    />
    <Text 
      style={[styles.socialText, { color: textColor }]}
      allowFontScaling={true}
      accessible={false}
      importantForAccessibility="no"
    >
      {title}
    </Text>
  </TouchableOpacity>
);

//********************************************************************
//
// PrimaryActionButton Component
//
// Primary CTA button with optional inverted style.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing primary button
//
// Value Parameters
// ----------------
// title       string    Button text
// onPress     () => void Button press handler
// inverted    boolean   Whether to use inverted style
// colors      Object    Theme colors object
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
const PrimaryActionButton = ({
  title,
  onPress,
  inverted = false,
  colors,
}: {
  title: string;
  onPress: () => void;
  inverted?: boolean;
  colors: any;
}) => (
  <TouchableOpacity
    style={[
      styles.primaryButton,
      styles.surfaceShadow,
      inverted
        ? { borderColor: colors.text, backgroundColor: "transparent" }
        : { backgroundColor: colors.accent, borderColor: colors.accent },
    ]}
    onPress={onPress}
    accessible={true}
    accessibilityLabel={title}
    accessibilityRole="button"
    accessibilityHint={title === "Search Nearby" ? "Opens search screen" : undefined}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Text
      style={[
        styles.primaryButtonText,
        inverted ? { color: colors.text } : { color: colors.buttonText },
      ]}
      allowFontScaling={true}
      accessible={false}
      importantForAccessibility="no"
    >
      {title}
    </Text>
  </TouchableOpacity>
);

//********************************************************************
//
// LegalModal Component
//
// Reusable modal component for displaying legal documents (Terms,
// Privacy, Cookies).
//
// Return Value
// ------------
// React.ReactElement    JSX element representing legal modal
//
// Value Parameters
// ----------------
// visible     boolean    Whether modal is visible
// onClose     () => void Close handler
// title       string     Modal title
// content     string     Modal content text
// colors      Object     Theme colors object
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
function LegalModal({
  visible,
  onClose,
  title,
  content,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  content: string;
  colors: any;
}) {
  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent
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
            {title}
          </Text>

          <ScrollView 
            style={{ maxHeight: "75%" }}
            accessible={true}
            accessibilityLabel={`${title} content`}
            accessibilityRole="text"
          >
            <Text 
              style={[styles.modalText, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {content}
            </Text>
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.modalCloseButton, { backgroundColor: colors.accent }]}
            accessible={true}
            accessibilityLabel="Close"
            accessibilityRole="button"
            accessibilityHint={`Closes ${title}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text 
              style={[styles.modalCloseText, { color: colors.buttonText }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function LoginScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const { colors, isDark, mode } = useTheme();

  const [showOptions, setShowOptions] = useState(false);

  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showCookies, setShowCookies] = useState(false);
  const [showSearchConfirm, setShowSearchConfirm] = useState(false);

  //********************************************************************
  //
  // handleSocialLogin Function
  //
  // Navigates to PhoneAuth screen with specified provider.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // provider    "Phone"|"Google"    Authentication provider
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
  const handleSocialLogin = (provider: "Phone" | "Google" | "Apple") => {
    navigation.navigate("PhoneAuth", { provider });
  };

  //********************************************************************
  //
  // handleTroubleSigningIn Function
  //
  // Opens email client with support email address.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // None
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
  const handleTroubleSigningIn = () => {
    Linking.openURL("mailto:support@evendating.us").catch(() => {
      // Silently fail if email client is not available
    });
  };

  const PolicyText = (
    <Text 
      style={[styles.policyText, { color: colors.subtitle }]}
      accessible={true}
      accessibilityRole="text"
      allowFontScaling={true}
    >
      By tapping 'Create account' or 'Sign in', you agree to our{" "}
      <Text
        style={[styles.link, { color: colors.accent }]}
        onPress={() => setShowTerms(true)}
        accessible={true}
        accessibilityRole="link"
        accessibilityLabel="Terms of Service"
        accessibilityHint="Opens Terms of Service"
      >
        Terms
      </Text>
      . Learn how we process your data in our{" "}
      <Text
        style={[styles.link, { color: colors.accent }]}
        onPress={() => setShowPrivacy(true)}
        accessible={true}
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
        accessibilityHint="Opens Privacy Policy"
      >
        Privacy Policy
      </Text>{" "}
      and{" "}
      <Text
        style={[styles.link, { color: colors.accent }]}
        onPress={() => setShowCookies(true)}
        accessible={true}
        accessibilityRole="link"
        accessibilityLabel="Cookies Policy"
        accessibilityHint="Opens Cookies Policy"
      >
        Cookies Policy
      </Text>
      .
    </Text>
  );

  if (showOptions) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlobalBackground />

        <AppImage 
          source={APP_LOGO} 
          style={[styles.logoImage, !isDark && { tintColor: '#000000' }]} 
          contentFit="contain" 
        />
        <Text style={[styles.logoText, { color: colors.text }]}>Even Dating</Text>

        <View style={styles.policyTextWrapper}>{PolicyText}</View>

        {Platform.OS === 'android' && (
          <SocialButton
            iconName="logo-google"
            title="Sign in with Google"
            onPress={() => handleSocialLogin("Google")}
            iconColor={isDark ? "white" : "black"}
            backgroundColor={isDark ? colors.card : "white"}
            textColor={isDark ? colors.text : "black"}
            borderColor={colors.border}
          />
        )}

        {/* Apple Sign in temporarily disabled
        {Platform.OS === 'ios' && (
          <SocialButton
            iconName="logo-apple"
            title="Sign in with Apple"
            onPress={() => handleSocialLogin("Apple")}
            iconColor={isDark ? "black" : "white"}
            backgroundColor={isDark ? "white" : "black"}
            textColor={isDark ? "black" : "white"}
            borderColor={isDark ? colors.border : "black"}
          />
        )} */}

          <SocialButton
            iconName="call"
            title="Sign in with Phone Number"
            onPress={() => handleSocialLogin("Phone")}
            iconColor={mode === "default" ? "#00A2AA" : isDark ? colors.text : "black"}
            backgroundColor={mode === "default" ? "#FFFFFF" : isDark ? colors.card : "white"}
            textColor={mode === "default" ? "#00A2AA" : isDark ? colors.text : "black"}
            borderColor={colors.border}
          />

        <TouchableOpacity
          style={styles.troubleButton}
          onPress={handleTroubleSigningIn}
          accessible={true}
          accessibilityLabel="Trouble signing in"
          accessibilityRole="button"
          accessibilityHint="Opens email to contact support"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={[styles.troubleText, { color: colors.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Trouble signing in?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowOptions(false)}
          style={styles.backButton}
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

        <LegalModal
          visible={showTerms}
          onClose={() => setShowTerms(false)}
          title="Terms of Service"
          content={TERMS_OF_SERVICE}
          colors={colors}
        />

        <LegalModal
          visible={showPrivacy}
          onClose={() => setShowPrivacy(false)}
          title="Privacy Policy"
          content={PRIVACY_POLICY}
          colors={colors}
        />

        <LegalModal
          visible={showCookies}
          onClose={() => setShowCookies(false)}
          title="Cookies Policy"
          content={COOKIES_POLICY}
          colors={colors}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <AppImage 
        source={APP_LOGO} 
        style={[styles.logoImage, !isDark && { tintColor: '#000000' }]} 
        contentFit="contain"
        accessibilityLabel="Even Dating logo"
        accessibilityRole="image"
      />
      <Text 
        style={[styles.logoText, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Even Dating
      </Text>

      <View style={styles.policyTextWrapper}>{PolicyText}</View>

      <PrimaryActionButton
        title="Create Account"
        onPress={() => handleSocialLogin("Phone")}
        colors={colors}
      />

  <PrimaryActionButton
    title="Sign In"
    onPress={() => setShowOptions(true)}
    inverted
    colors={colors}
  />

  <PrimaryActionButton
    title="Search Nearby"
    onPress={() => setShowSearchConfirm(true)}
    inverted
    colors={colors}
  />

      <TouchableOpacity
        style={styles.troubleButton}
        onPress={handleTroubleSigningIn}
      >
        <Text style={[styles.troubleText, { color: colors.text }]}>
          Trouble signing in?
        </Text>
      </TouchableOpacity>

      <LegalModal
        visible={showTerms}
        onClose={() => setShowTerms(false)}
        title="Terms of Service"
        content={TERMS_OF_SERVICE}
        colors={colors}
      />

      <LegalModal
        visible={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        title="Privacy Policy"
        content={PRIVACY_POLICY}
        colors={colors}
      />

      <LegalModal
        visible={showCookies}
        onClose={() => setShowCookies(false)}
        title="Cookies Policy"
        content={COOKIES_POLICY}
        colors={colors}
      />

      <Modal
        transparent
        visible={showSearchConfirm}
        animationType="fade"
        onRequestClose={() => setShowSearchConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Open Search?</Text>
            <Text style={[styles.modalText, { color: colors.subtitle }]}>
              Continue to Search. A token is only used when you actually run a search.
            </Text>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: colors.background }]}
              onPress={() => setShowSearchConfirm(false)}
            >
              <Text style={[styles.modalCloseText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: colors.accent }]}
              onPress={() => {
                setShowSearchConfirm(false);
                navigation.navigate("Search");
              }}
            >
              <Text style={[styles.modalCloseText, { color: colors.buttonText }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    justifyContent: "flex-end",
    paddingBottom: 60,
    position: "relative",
  },

  logoImage: {
    width: 250,
    height: 80,
    position: "absolute",
    top: 100,
    alignSelf: "center",
    zIndex: 1,
  },

  logoText: {
    fontSize: 48,
    fontWeight: "bold",
    textAlign: "center",
    position: "absolute",
    top: 200,
    alignSelf: "center",
    zIndex: 1,
  },

  policyTextWrapper: {
    marginBottom: 20,
    paddingHorizontal: 15,
    zIndex: 1,
  },

  policyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  link: {
    textDecorationLine: "underline",
    fontWeight: "600",
  },

  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },

  primaryButton: {
    height: 50,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    borderRadius: 25,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 1,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    borderRadius: 25,
    marginBottom: 10,
    borderWidth: 1,
    zIndex: 1,
  },

  socialIcon: {
    marginRight: 10,
  },

  socialText: {
    fontSize: 16,
    fontWeight: "600",
  },

  troubleButton: {
    marginTop: 15,
  },

  troubleText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  modalBox: {
    padding: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },

  modalText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },

  modalCloseButton: {
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  modalCloseText: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "700",
  },
  surfaceShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
});
