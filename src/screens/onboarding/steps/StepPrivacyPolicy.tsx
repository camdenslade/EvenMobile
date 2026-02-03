import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, useRef, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIVACY_POLICY } from "../../legal/privacy";
import { onboardingStyles } from "../styles";

interface StepPrivacyPolicyProps {
  colors: any;
  onAccept: () => void;
  onDecline: () => void;
  onBack: () => void;
}

export function StepPrivacyPolicy({
  colors,
  onAccept,
  onDecline,
  onBack,
}: StepPrivacyPolicyProps) {
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const insets = useSafeAreaInsets();

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
      {/* Back button */}
      <TouchableOpacity
        onPress={onBack}
        style={onboardingStyles.back}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Returns to previous step"
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
          Privacy Policy
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
          {PRIVACY_POLICY}
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
            accessibilityHint="Accepts Privacy Policy and continues"
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
            accessibilityHint="Declines Privacy Policy and returns to login"
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
