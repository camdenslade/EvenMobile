import React, { useRef, useState, useEffect } from 'react';
import { Platform, View, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeProvider';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
}

/**
 * OTP Input Component
 * 
 * Multi-box OTP input with:
 * - Auto-advance between boxes
 * - Paste support (pastes full code and distributes across boxes)
 * - Keyboard navigation support
 * - Accessibility support
 */
export function OTPInput({
  length = 6,
  value,
  onChange,
  autoFocus = true,
  onComplete,
}: OTPInputProps) {
  const { colors } = useTheme();
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);

  // Sync value changes with input boxes
  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
        setFocusedIndex(0);
      }, 100);
    }
  }, [autoFocus]);

  // Handle individual digit input
  const handleChangeText = (text: string, index: number) => {
    // Handle paste: if text length > 1, user pasted the full code
    if (text.length > 1) {
      if (inputRefs.current[index]) {
        inputRefs.current[index]?.setNativeProps({ text: '' });
      }
      const digits = text.replace(/\D/g, '').slice(0, length);
      onChange(digits);

      // Focus the last filled box or the next empty one
      const nextIndex = Math.min(digits.length, length - 1);
      if (inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex]?.focus();
        setFocusedIndex(nextIndex);
      }
      return;
    }

    // Single character input
    const digit = text.replace(/\D/g, '');
    if (!digit) {
      // Backspace: clear this digit only
      if (value[index]) {
        const newValue = value.slice(0, index) + value.slice(index + 1);
        onChange(newValue);
      }
      return;
    }

    // Add/update digit at this index
    const newValue = value.slice(0, index) + digit + value.slice(index + 1);
    onChange(newValue.slice(0, length));

    // Auto-advance to next box
    if (index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  // Handle focus
  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  // Handle blur
  const handleBlur = () => {
    setFocusedIndex(null);
  };

  // Handle key press for backspace navigation
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      // Remove previous digit and move focus back only if current is empty
      const newValue = value.slice(0, index - 1) + value.slice(index);
      onChange(newValue);
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={`Verification code input, ${value.length} of ${length} digits entered`}
      accessibilityRole="none"
    >
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] || '';
        const isFocused = focusedIndex === index;
        const isFirstInput = index === 0;

        return (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[
              styles.input,
              {
                borderColor: isFocused ? colors.accent : colors.border || '#ccc',
                backgroundColor: colors.card,
                color: colors.text,
              },
              styles.inputShadow,
              isFocused && styles.inputFocused,
            ]}
            value={digit}
            onChangeText={(text) => handleChangeText(text, index)}
            onFocus={() => handleFocus(index)}
            onBlur={handleBlur}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={isFirstInput ? length : 1}
            textContentType={isFirstInput ? 'oneTimeCode' : 'none'}
            autoComplete={
              isFirstInput
                ? Platform.OS === 'android'
                  ? 'sms-otp'
                  : 'one-time-code'
                : 'off'
            }
            selectTextOnFocus={false}
            selectionColor="transparent"
            contextMenuHidden
            accessible={true}
            accessibilityLabel={`Digit ${index + 1} of ${length}`}
            accessibilityRole="none"
            accessibilityHint={digit ? `Current digit: ${digit}` : 'Enter digit'}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 16,
  },
  input: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 8,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  inputFocused: {
    borderWidth: 2,
  },
});

