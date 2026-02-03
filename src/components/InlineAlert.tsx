import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeProvider";

interface InlineAlertProps {
  message: string;
  style?: ViewStyle;
}

export function InlineAlert({ message, style }: InlineAlertProps) {
  const { colors, isDark } = useTheme();
  const accent = "#ef4444";
  const background = isDark ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)";
  const border = isDark ? "rgba(163, 30, 30, 0.55)" : "rgba(239,68,68,0.4)";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: background, borderColor: border },
        style,
      ]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`Error: ${message}`}
    >
      <Ionicons
        name="alert-circle"
        size={16}
        color={accent}
        accessible={false}
        importantForAccessibility="no"
      />
      <Text style={[styles.text, { color: colors.text }]} allowFontScaling>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
});
