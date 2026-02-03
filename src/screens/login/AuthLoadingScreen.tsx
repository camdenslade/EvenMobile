//********************************************************************
//
// AuthLoadingScreen Component
//
// Lightweight loading gate shown while auth/session providers resolve.
// This component no longer performs navigation; routing is handled by
// AuthRouter in App.tsx.
//
//*******************************************************************

import { View, ActivityIndicator } from "react-native";
import { useTheme } from "../../context/ThemeProvider";

export default function AuthLoadingScreen() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}
