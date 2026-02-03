//********************************************************************
//
// StepGuidelines Component
//
// Step 7 of onboarding flow. Displays Community Guidelines document
// that user must accept to continue. Declining navigates back to login.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing guidelines step
//
// Value Parameters
// ----------------
// colors        Object      Theme colors object
// onAccept      function    Callback when user accepts (continues)
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
// None
//
//*******************************************************************

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
} from "react-native";
import { COMMUNITY_GUIDELINES } from "../../legal/guidelines";
import { onboardingStyles } from "../styles";
import { useState, useRef, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface StepGuidelinesProps {
  colors: any;
  onAccept: () => void;
  onDecline: () => void;
}

export function StepGuidelines({
  colors,
  onAccept,
  onDecline,
}: StepGuidelinesProps) {
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const insets = useSafeAreaInsets();

  // Animation values for footer entrance
  const slideAnim = useRef(new Animated.Value(160)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } =
      event.nativeEvent;

    const paddingToBottom = 24;
    const isBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isBottom) {
      setHasReachedBottom(true);
    }
  };

  useEffect(() => {
    if (hasReachedBottom) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [hasReachedBottom, slideAnim, opacityAnim]);

  const resolvedFooterHeight = footerHeight || 220;

  const handleDecline = () => {
    Alert.alert(
      "Required Feature",
      "Sorry, we cannot allow you to create an account.",
      [
        {
          text: "OK",
          onPress: onDecline,
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: hasReachedBottom ? resolvedFooterHeight + 24 : 140,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Text
          style={[
            onboardingStyles.header,
            { color: colors.text, marginTop: 70 },
          ]}
          accessibilityRole="header"
          allowFontScaling
        >
          Community Guidelines
        </Text>

        <Text
          style={[
            onboardingStyles.guidelinesText,
            { color: colors.text },
          ]}
          allowFontScaling
          accessible={false}
          importantForAccessibility="no"
        >
          {COMMUNITY_GUIDELINES}
        </Text>
      </ScrollView>

      {hasReachedBottom && (
        <Animated.View
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            if (height !== footerHeight) {
              setFooterHeight(height);
            }
          }}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: 24,
            paddingBottom: 32 + Math.max(insets.bottom, 0),
            borderTopWidth: 1,
            borderTopColor: colors.subtitle,
            backgroundColor: colors.background,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 },
            elevation: 8,
          }}
        >
          <TouchableOpacity
            style={[
              onboardingStyles.mainButton,
              { backgroundColor: colors.accent },
            ]}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="Accept and Continue"
            accessibilityHint="Accepts Community Guidelines and continues"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                onboardingStyles.mainButtonText,
                { color: colors.buttonText },
              ]}
              allowFontScaling
              accessible={false}
              importantForAccessibility="no"
            >
              Accept and Continue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              onboardingStyles.declineButton,
              { borderColor: colors.subtitle },
            ]}
            onPress={handleDecline}
            accessibilityRole="button"
            accessibilityLabel="Decline"
            accessibilityHint="Declines Community Guidelines and returns to login"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                onboardingStyles.declineButtonText,
                { color: colors.text },
              ]}
              allowFontScaling
              accessible={false}
              importantForAccessibility="no"
            >
              Decline
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}
