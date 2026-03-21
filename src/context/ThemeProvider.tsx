//********************************************************************
//
// ThemeProvider Component
//
// Provides theme context (light/dark mode) to the entire application.
// Loads theme preference from storage on mount, syncs with Zustand cache,
// and exposes toggle functionality. Provides color palette based on
// current theme mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element with ThemeContext.Provider
//
// Value Parameters
// ----------------
// children    ReactNode    Child components to wrap with theme context
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// cachedThemeMode    ThemeMode        Theme mode from Zustand cache
// setThemeMode       function         Zustand setter for theme mode
// mode               ThemeMode        Current theme mode state
// isInitialized      boolean          Flag indicating if theme has been loaded from storage
// storedTheme        ThemeMode        Theme loaded from storage
// newMode            ThemeMode        New theme mode when toggling
// isDark             boolean          Derived boolean indicating dark mode
// value              ThemeContextValue Complete context value object
//
//*******************************************************************

import React, { createContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppCache, loadThemePreference } from "../services/appCache";

type ThemeMode = "light" | "dark" | "default" | "custom";

export type ThemeColors = {
  background: string;
  card: string;
  text: string;
  subtitle: string;
  accent: string;
  circle: string;
  shapeRect: string;
  textSecondary: string;
  buttonText: string;
  overlay: string;
  border: string;
  bottomButton: string;
  bottomButtonIcon: string;
  shuffleBtn: string;
};

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setCustomTheme: (colors: ThemeColors) => void;
  customTheme: ThemeColors | null;
  colors: ThemeColors;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "default",
  isDark: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
  setCustomTheme: () => {},
  customTheme: null,
  colors: {
    background: "#ffffff",
    card: "#ffffff",
    text: "#111111",
    subtitle: "#666666",
    accent: "#000000",
    circle: "#222222",
    shapeRect: "#222222",
    textSecondary: "#666666",
    buttonText: "#ffffff",
    overlay: "rgba(0,0,0,0.65)",
    border: "#E0E0E0",
    bottomButton: "#222222",
    bottomButtonIcon: "#ffffff",
    shuffleBtn: "#ffffff",
  },
});

const lightColors: ThemeColors = {
  background: "#F7F7F7",
  card: "#ffffff",
  text: "#111111",
  subtitle: "#666666",
  accent: "#222222",
  circle: "#222222",
  shapeRect: "#222222",
  textSecondary: "#666666",
  buttonText: "#ffffff",
  overlay: "rgba(0,0,0,0.65)",
  border: "#E0E0E0",
  bottomButton: "#222222",
  bottomButtonIcon: "#ffffff",
  shuffleBtn: "#ffffff",
};

const darkColors: ThemeColors = {
  background: "#222222",
  card: "#333333",
  text: "#ffffff",
  subtitle: "#aaaaaa",
  accent: "#ffffff",
  circle: "#ffffff",
  shapeRect: "#ffffff",
  textSecondary: "#aaaaaa",
  buttonText: "#000000",
  overlay: "rgba(0,0,0,0.75)",
  border: "#555555",
  bottomButton: "#ffffff",
  bottomButtonIcon: "#222222",
  shuffleBtn: "#333333",
};

const defaultColors: ThemeColors = {
  background: "#00A2AA",
  card: "#34A4A8",
  text: "#FFFFFF",
  subtitle: "#E6F6F7",
  accent: "#FFFFFF",
  circle: "#7FDDE0",
  shapeRect: "#198686",
  textSecondary: "#E6F6F7",
  buttonText: "#00A2AA",
  overlay: "rgba(0,0,0,0.4)",
  border: "#59C5C7",
  bottomButton: "#FFFFFF",
  bottomButtonIcon: "#00A2AA",
  shuffleBtn: "#34A4A8",
};

const CUSTOM_THEME_KEY = "@EvenApp:customTheme";

const THEME_COLOR_KEYS: Array<keyof ThemeColors> = [
  "background",
  "card",
  "text",
  "subtitle",
  "accent",
  "circle",
  "shapeRect",
  "textSecondary",
  "buttonText",
  "overlay",
  "border",
  "bottomButton",
  "bottomButtonIcon",
  "shuffleBtn",
];

const THEME_COLOR_DEFAULTS: Partial<ThemeColors> = {
  shuffleBtn: "#ffffff",
};

function isValidThemeColors(value: unknown): value is ThemeColors {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return THEME_COLOR_KEYS.every((key) => typeof record[key] === "string");
}

async function loadCustomTheme(): Promise<ThemeColors | null> {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_THEME_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    // Migrate older stored themes by filling in defaults for new keys
    const withDefaults = { ...THEME_COLOR_DEFAULTS, ...(parsed as object) } as unknown;
    return isValidThemeColors(withDefaults) ? withDefaults : null;
  } catch {
    return null;
  }
}

function isDarkColor(hex: string): boolean {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return false;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const cachedThemeMode = useAppCache((s) => s.themeMode);
  const setThemeMode = useAppCache((s) => s.setThemeMode);
  
  const [mode, setMode] = useState<ThemeMode>(cachedThemeMode);
  const [isInitialized, setIsInitialized] = useState(false);
  const [customTheme, setCustomThemeState] = useState<ThemeColors | null>(null);

  useEffect(() => {
    async function initializeTheme() {
      const [storedTheme, storedCustom] = await Promise.all([
        loadThemePreference(),
        loadCustomTheme(),
      ]);
      setCustomThemeState(storedCustom);
      const resolvedTheme =
        storedTheme === "custom" && !storedCustom ? "default" : storedTheme;
      setMode(resolvedTheme);
      if (resolvedTheme !== cachedThemeMode) {
        setThemeMode(resolvedTheme);
      }
      setIsInitialized(true);
    }
    initializeTheme();
  }, []);

  useEffect(() => {
    if (!isInitialized || cachedThemeMode === mode) return;
    const resolvedTheme =
      cachedThemeMode === "custom" && !customTheme
        ? "default"
        : cachedThemeMode;
    setMode(resolvedTheme);
  }, [cachedThemeMode, customTheme, isInitialized, mode]);

  //********************************************************************
  //
  // toggleTheme Function
  //
  // Toggles between light and dark theme modes. Updates both local
  // state and Zustand cache.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // None
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // newMode    ThemeMode    The opposite of current mode
  //
  //*******************************************************************
  const toggleTheme = () => {
    const order: ThemeMode[] = ["light", "dark", "default", "custom"];
    const currentIndex = order.indexOf(mode);
    const nextMode = order[(currentIndex + 1) % order.length];
    setMode(nextMode);
    setThemeMode(nextMode);
  };

  const resolvedCustomTheme = customTheme ?? defaultColors;
  const isDark =
    mode === "dark" ||
    mode === "default" ||
    (mode === "custom" && isDarkColor(resolvedCustomTheme.background));
  const colors =
    mode === "dark"
      ? darkColors
      : mode === "custom"
      ? resolvedCustomTheme
      : mode === "default"
      ? defaultColors
      : lightColors;

  const value: ThemeContextValue = {
    mode,
    isDark,
    toggleTheme,
    setThemeMode: (nextMode: ThemeMode) => {
      setMode(nextMode);
      setThemeMode(nextMode);
    },
    setCustomTheme: (nextTheme: ThemeColors) => {
      setCustomThemeState(nextTheme);
      AsyncStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(nextTheme)).catch(() => {});
    },
    customTheme,
    colors,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

//********************************************************************
//
// useTheme Hook
//
// Hook to access theme context. Returns the complete theme context
// value including mode, colors, and toggle function.
//
// Return Value
// ------------
// ThemeContextValue    Complete theme context value
//
// Value Parameters
// ----------------
// None
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// None
//
//*******************************************************************
export function useTheme() {
  return React.useContext(ThemeContext);
}
