import { Dimensions, Platform } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Breakpoints
export const BREAKPOINTS = {
  mobile: 600,
  tablet: 900,
  desktop: 1200,
} as const;

// Max content widths for different contexts
export const MAX_CONTENT_WIDTH = {
  narrow: 500,   // Forms, buttons, inputs
  standard: 600, // Cards, lists
  wide: 900,     // Grid layouts
} as const;

// Check if device is tablet-sized
export const isTablet = (): boolean => {
  const dim = Dimensions.get("window");
  return Math.min(dim.width, dim.height) >= BREAKPOINTS.mobile;
};

// Get current breakpoint
export const getBreakpoint = (): "mobile" | "tablet" | "desktop" => {
  const dim = Dimensions.get("window");
  const width = dim.width;
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.mobile) return "tablet";
  return "mobile";
};

// Get responsive value based on screen size
export const responsive = <T>(mobile: T, tablet: T, desktop?: T): T => {
  const breakpoint = getBreakpoint();
  if (breakpoint === "desktop") return desktop ?? tablet;
  if (breakpoint === "tablet") return tablet;
  return mobile;
};

// Get responsive padding
export const getResponsivePadding = (): number => {
  return responsive(20, 40, 60);
};

// Get responsive card width for grids
export const getCardWidth = (
  containerWidth: number,
  minCardWidth: number = 160,
  gap: number = 16
): { width: number; columns: number } => {
  const availableWidth = containerWidth - getResponsivePadding() * 2;
  const columns = Math.max(2, Math.floor((availableWidth + gap) / (minCardWidth + gap)));
  const width = (availableWidth - gap * (columns - 1)) / columns;
  return { width, columns };
};

// Get max width for content containers
export const getMaxContentWidth = (type: keyof typeof MAX_CONTENT_WIDTH = "standard"): number => {
  return MAX_CONTENT_WIDTH[type];
};

// Calculate swipe card dimensions for tablets
export const getSwipeCardDimensions = (
  screenWidth: number,
  screenHeight: number
): { width: number; height: number } => {
  const tablet = isTablet();

  if (tablet) {
    // On tablets, use proportional sizing that fills more of the screen
    return {
      width: screenWidth * 0.70,
      height: screenHeight * 0.68,
    };
  }

  // Mobile: use percentage-based sizing
  return {
    width: screenWidth * 0.88,
    height: screenHeight * 0.68,
  };
};

// Scale a value based on screen width (useful for fonts, icons)
export const scale = (size: number, factor: number = 0.3): number => {
  const tablet = isTablet();
  if (!tablet) return size;
  return Math.round(size * (1 + factor));
};
