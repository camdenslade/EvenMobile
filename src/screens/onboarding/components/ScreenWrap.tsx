//********************************************************************
//
// ScreenWrap Component
//
// Wrapper component that provides consistent layout for onboarding
// steps. Provides ScrollView with keyboard handling and padding.
// GlobalBackground and background color are rendered at the OnboardingScreen
// level, not within this component.
// Maintains consistent padding and keyboard behavior across all steps.
//
// Return Value
// ------------
// React.ReactElement    JSX element with wrapped content
//
// Value Parameters
// ----------------
// children        ReactNode    Child components to wrap
// scrollEnabled   boolean      Whether scrolling is enabled (default: true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// None
//
// Side Effects
// ------------
// None
//
//*******************************************************************

import type { ReactNode } from "react";
import { View, ScrollView } from "react-native";

interface ScreenWrapProps {
  children: ReactNode;
  scrollEnabled?: boolean;
}

export function ScreenWrap({
  children,
  scrollEnabled = true,
}: ScreenWrapProps) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: "transparent" }}
        contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="none"
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled={true}
      >
        {children}
      </ScrollView>
    </View>
  );
}

