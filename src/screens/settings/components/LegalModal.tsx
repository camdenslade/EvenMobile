import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform } from "react-native";

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  content: string;
  colors: {
    card: string;
    text: string;
  };
}

export function LegalModal({
  visible,
  onClose,
  title,
  content,
  colors,
}: LegalModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      accessible={true}
      accessibilityViewIsModal={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay} accessible={false} importantForAccessibility="no">
        <View
          style={[styles.box, { backgroundColor: colors.card }]}
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
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true}>
            <Text
              style={[styles.bodyText, { color: colors.text }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              {content}
            </Text>
          </ScrollView>
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelBtn}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.cancelText, { color: colors.text }]} allowFontScaling={true}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  box: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 15,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    minWidth: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
  },
});
