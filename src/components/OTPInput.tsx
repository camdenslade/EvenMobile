import React, { useRef, useState, useEffect } from 'react';
import { Platform, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
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
 * Uses a single hidden TextInput to capture autofill from iOS (SMS/email) and
 * Android, while rendering visible digit boxes as display-only views.
 * This is the only reliable pattern for iOS oneTimeCode autofill.
 */
export function OTPInput({
  length = 6,
  value,
  onChange,
  autoFocus = true,
  onComplete,
}: OTPInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <Pressable
      onPress={focusInput}
      style={styles.container}
      accessible={true}
      accessibilityLabel={`Verification code input, ${value.length} of ${length} digits entered`}
    >
      {/* Hidden real input — captures keyboard + autofill */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        style={styles.hiddenInput}
        caretHidden
        importantForAccessibility="no"
        accessibilityElementsHidden
      />

      {/* Visual digit boxes */}
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] || '';
        const isActive = isFocused && value.length === index;
        const isFilled = !!digit;

        return (
          <View
            key={index}
            style={[
              styles.box,
              {
                borderColor: isActive
                  ? colors.accent
                  : isFilled
                  ? colors.accent
                  : colors.border || '#ccc',
                backgroundColor: colors.card,
              },
              styles.boxShadow,
              isActive && styles.boxActive,
            ]}
          >
            <Text
              style={[styles.digit, { color: colors.text }]}
              accessibilityElementsHidden
            >
              {digit}
            </Text>
            {isActive && !digit && <View style={[styles.cursor, { backgroundColor: colors.accent }]} />}
          </View>
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 16,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
  },
  box: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  boxActive: {
    borderWidth: 2,
  },
  digit: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  cursor: {
    position: 'absolute',
    width: 2,
    height: 28,
    borderRadius: 1,
    opacity: 0.8,
  },
});
