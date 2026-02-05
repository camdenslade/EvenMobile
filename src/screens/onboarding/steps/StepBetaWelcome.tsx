import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from "react-native";

interface StepBetaWelcomeProps {
  colors: any;
  onContinue: () => void;
}

export function StepBetaWelcome({ colors, onContinue }: StepBetaWelcomeProps) {
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
              Welcome to the Beta!
            </Text>

            <Text
              style={[styles.modalSubtitle, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              Even is currently in beta in Springfield, MO. You're one of the first to try it out.
            </Text>

            <Text
              style={[styles.modalSubtitle, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              If you run into any issues, let us know through Support or Suggestions in Settings. Every report is read and will be addressed as quickly and effectively as possible.
            </Text>

            <Text
              style={[styles.modalSubtitle, { color: colors.subtitle, fontWeight: "600" }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              Thank you for being here early.
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={onContinue}
              accessible={true}
              accessibilityLabel="Continue onboarding"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[styles.modalBtnText, { color: colors.buttonText }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Let's go
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
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
  },
  modalBtnText: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
});
