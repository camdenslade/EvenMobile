//********************************************************************
//
// AppImage Component
//
// Global image component with automatic caching, loading states, and
// fade-in transitions. Replaces react-native Image throughout the app
// to provide consistent image loading behavior and performance.
//
// IMPORTANT: expo-image requires explicit dimensions. All usages must
// provide width/height in style, or be wrapped in a constrained parent.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the image
//
// Value Parameters
// ----------------
// source        string|object|number    Image source URI, { uri: string }, or require()
// style         StyleProp<ImageStyle>    Image style (MUST include width/height)
// contentFit    string                   How to fit image (default: "cover")
// priority      "low"|"normal"|"high"   Image loading priority (default: "normal")
// accessibilityLabel string             Accessibility label
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// resolvedSource  ImageSource    Normalized source for expo-image
//
//*******************************************************************

import { Image, ImageSource } from "expo-image";
import { StyleProp, ImageStyle, View } from "react-native";
import { useState } from "react";

interface AppImageProps {
  source: string | { uri: string } | number;
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain" | "fill" | "scale-down" | "none";
  priority?: "low" | "normal" | "high";
  accessibilityLabel?: string;
  accessibilityRole?: "image" | "button" | "none";
}

export function AppImage({
  source,
  style,
  contentFit = "cover",
  priority = "normal",
  accessibilityLabel,
  accessibilityRole = "image",
}: AppImageProps) {
  const [hasError, setHasError] = useState(false);

  // Handle empty/null/undefined sources (Batch D)
  if (!source || (typeof source === "string" && !source.trim())) {
    return (
      <View
        style={[style, { backgroundColor: "#2a2a2a" }]}
        accessibilityLabel={accessibilityLabel || "No image"}
        accessibilityRole="image"
      />
    );
  }

  // Show fallback on error (Batch D)
  if (hasError) {
    return (
      <View
        style={[style, { backgroundColor: "#2a2a2a" }]}
        accessibilityLabel={accessibilityLabel || "Image unavailable"}
        accessibilityRole="image"
      />
    );
  }

  // Normalize source for expo-image
  // - String URIs → { uri: string }
  // - require() static assets (number) → pass through as-is (expo-image accepts numbers)
  // - { uri: string } → pass through as-is
  // expo-image's source prop accepts: number, { uri: string }, or array of sources
  const resolvedSource: any =
    typeof source === "string" ? { uri: source } : source;

  return (
    <Image
      source={resolvedSource}
      style={style} // Pass through style exactly - DO NOT wrap or modify
      contentFit={contentFit}
      transition={120}
      cachePolicy="memory-disk"
      priority={priority}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      onError={() => setHasError(true)}
    />
  );
}
