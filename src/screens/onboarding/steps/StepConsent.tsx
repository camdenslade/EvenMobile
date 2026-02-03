//********************************************************************
//
// StepConsent Component
//
// First step of onboarding flow. Displays a modal requesting location
// permission and user consent for discoverability. Users must grant
// location permission to continue; declining navigates back to login.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing consent modal
//
// Value Parameters
// ----------------
// colors        Object      Theme colors object
// onAllow       function    Callback when user accepts location permission
// onDecline     function    Callback when user declines (navigates to login)
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
// Requests location permissions (Location.requestForegroundPermissionsAsync)
// Gets current position (Location.getCurrentPositionAsync)
// Shows native alert dialogs
//
//*******************************************************************

import { View, Text, TouchableOpacity, Modal, Alert, StyleSheet, Platform } from "react-native";
import * as Location from "expo-location";

interface StepConsentProps {
  colors: any;
  onAllow: () => void;
  onDecline: () => void;
}

export function StepConsent({ colors, onAllow, onDecline }: StepConsentProps) {
  const handleAllow = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Location Required",
        "Even needs your location to show nearby profiles.",
        [
          {
            text: "OK",
            onPress: onDecline,
          },
        ]
      );
      return;
    }

    try {
      await Location.getCurrentPositionAsync({});
    } catch {}

    onAllow();
  };

  const handleDecline = () => {
    Alert.alert(
      "Required Feature",
      "We cannot allow you to create an account without discoverability.",
      [
        {
          text: "OK",
          onPress: onDecline,
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Modal
        transparent
        animationType="fade"
        visible
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View
          style={styles.modalCenter}
          accessible={false}
          importantForAccessibility="no"
        >
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.subtitle },
            ]}
            accessible={false}
            importantForAccessibility="no"
          >
            <Text
              style={[styles.modalTitle, { color: colors.text }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              Allow people nearby to discover you?
            </Text>

            <Text
              style={[styles.modalSubtitle, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              Even needs your consent and location to show your profile in local search results.
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: colors.subtitle, marginTop: 6 }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              Location is used to find nearby matches. We do not share your precise location. You can turn this off later, but you may become undiscoverable.
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={handleAllow}
              accessible={true}
              accessibilityLabel="Allow location access"
              accessibilityRole="button"
              accessibilityHint="Grants location permission and continues onboarding"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[styles.modalBtnText, { color: colors.buttonText }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Allow
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnOutline, { borderColor: colors.text }]}
              onPress={handleDecline}
              accessible={true}
              accessibilityLabel="Don't allow location access"
              accessibilityRole="button"
              accessibilityHint="Declines location permission and returns to login"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[styles.modalBtnOutlineText, { color: colors.text }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Don't Allow
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  modalBox: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtn: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  modalBtnText: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
  modalBtnOutline: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  modalBtnOutlineText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});

