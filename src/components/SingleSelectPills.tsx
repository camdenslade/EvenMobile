//********************************************************************
//
// SingleSelectPills Component
//
// Horizontal scrollable pill selector for single-select preferences.
// Only one option can be selected at a time.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the pill selector
//
// Value Parameters
// ----------------
// label           string        Label text
// value           string        Currently selected value
// options         string[]      Available options
// onSelect        function      Callback when an option is selected
//
//*******************************************************************

import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeProvider";

interface SingleSelectPillsProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}

export function SingleSelectPills({
  label,
  value,
  options,
  onSelect,
}: SingleSelectPillsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text 
        style={[styles.label, { color: colors.text }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        {label}
      </Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        accessible={false}
        importantForAccessibility="no"
      >
        {options.map((opt) => {
          const isSelected = value === opt;
          const borderColor = isSelected ? colors.buttonText : colors.accent;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.accent : colors.card,
                  borderColor,
                },
              ]}
              accessible={true}
              accessibilityLabel={opt}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityHint={isSelected ? `Deselects ${opt}` : `Selects ${opt}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected ? colors.buttonText : colors.text,
                  },
                ]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  scroll: {
    marginHorizontal: -4,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
});

