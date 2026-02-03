import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from "react-native";

interface ConsentModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  messages: string[];
  confirmText: string;
  cancelText: string;
  colors: {
    card: string;
    text: string;
    subtitle: string;
    accent: string;
    buttonText: string;
  };
}

export function ConsentModal({
  visible,
  onClose,
  onConfirm,
  title,
  messages,
  confirmText,
  cancelText,
  colors,
}: ConsentModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessible={true}
      accessibilityViewIsModal={true}
    >
      <View style={styles.center} accessible={false} importantForAccessibility="no">
        <View
          style={[styles.box, { backgroundColor: colors.card, borderColor: colors.subtitle }]}
          accessible={false}
          importantForAccessibility="no"
        >
          <Text
            style={[styles.title, { color: colors.text }]}
            accessible={true}
            accessibilityRole="header"
            allowFontScaling={true}
          >
            {title}
          </Text>

          {messages.map((message, index) => (
            <Text
              key={index}
              style={[styles.subtitle, { color: colors.subtitle, marginTop: index > 0 ? 6 : 0 }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              {message}
            </Text>
          ))}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={onConfirm}
            accessible={true}
            accessibilityLabel={confirmText}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.btnText, { color: colors.buttonText }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {confirmText}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: colors.text }]}
            onPress={onClose}
            accessible={true}
            accessibilityLabel={cancelText}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.btnOutlineText, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {cancelText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  box: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 20,
  },
  btn: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
  },
  btnText: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
  btnOutline: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
  },
  btnOutlineText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});
