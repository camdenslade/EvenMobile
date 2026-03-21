import React from "react";
import { View, StyleSheet, ViewStyle, useWindowDimensions } from "react-native";
import { MAX_CONTENT_WIDTH, getResponsivePadding, isTablet } from "../utils/responsive";

type MaxWidthType = keyof typeof MAX_CONTENT_WIDTH | number;

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: MaxWidthType;
  style?: ViewStyle;
  padding?: boolean;
  center?: boolean;
}

/**
 * ResponsiveContainer wraps content with a max-width constraint
 * and centers it on larger screens (tablets/iPads).
 *
 * Usage:
 * <ResponsiveContainer maxWidth="narrow">
 *   <Button />
 * </ResponsiveContainer>
 */
export function ResponsiveContainer({
  children,
  maxWidth = "standard",
  style,
  padding = false,
  center = true,
}: ResponsiveContainerProps) {
  const { width } = useWindowDimensions();

  const resolvedMaxWidth =
    typeof maxWidth === "number" ? maxWidth : MAX_CONTENT_WIDTH[maxWidth];

  const tablet = isTablet();
  const responsivePadding = padding ? getResponsivePadding() : 0;

  // Only apply max-width constraints on larger screens
  const containerStyle: ViewStyle = {
    width: "100%",
    maxWidth: tablet ? resolvedMaxWidth : undefined,
    alignSelf: center && tablet ? "center" : undefined,
    paddingHorizontal: responsivePadding,
  };

  return <View style={[containerStyle, style]}>{children}</View>;
}

/**
 * ResponsiveScrollContainer is for use inside ScrollViews.
 * It ensures content is centered with max-width on tablets.
 */
export function ResponsiveScrollContent({
  children,
  maxWidth = "standard",
  style,
}: ResponsiveContainerProps) {
  const resolvedMaxWidth =
    typeof maxWidth === "number" ? maxWidth : MAX_CONTENT_WIDTH[maxWidth];

  const tablet = isTablet();
  const responsivePadding = getResponsivePadding();

  return (
    <View
      style={[
        styles.scrollContent,
        {
          maxWidth: tablet ? resolvedMaxWidth : undefined,
          alignSelf: tablet ? "center" : undefined,
          paddingHorizontal: responsivePadding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: "100%",
  },
});

export default ResponsiveContainer;
