import { ThemeColors } from "../../context/ThemeProvider";
import { CustomThemeDraft, ThemePreset, THEME_COLOR_KEYS, MAX_THEME_PRESETS } from "./types";

export const normalizeHexInput = (value: string): string => {
  const cleaned = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 6);
  return cleaned.length ? `#${cleaned}` : "";
};

export const isValidHex = (value: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(value);

export const isDarkColor = (hex: string): boolean => {
  if (!isValidHex(hex)) return false;
  const raw = hex.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5;
};

export const contrastColor = (hex: string): string => {
  if (!isValidHex(hex)) return "#FFFFFF";
  const raw = hex.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55 ? "#FFFFFF" : "#111111";
};

export const themeToDraft = (theme: ThemeColors): CustomThemeDraft => ({
  background: theme.background,
  card: theme.card,
  text: theme.text,
  subtitle: theme.subtitle,
  accent: theme.accent,
  border: theme.border,
  circle: theme.circle,
  shapeRect: theme.shapeRect,
});

export const buildCustomTheme = (base: CustomThemeDraft): ThemeColors => {
  const overlay = isDarkColor(base.background)
    ? "rgba(0,0,0,0.45)"
    : "rgba(0,0,0,0.2)";
  const buttonText = contrastColor(base.accent);
  return {
    background: base.background,
    card: base.card,
    text: base.text,
    subtitle: base.subtitle,
    accent: base.accent,
    circle: base.circle,
    shapeRect: base.shapeRect,
    textSecondary: base.subtitle,
    buttonText,
    overlay,
    border: base.border,
    bottomButton: base.accent,
    bottomButtonIcon: contrastColor(base.accent),
  };
};

export const isThemeColors = (value: unknown): value is ThemeColors => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return THEME_COLOR_KEYS.every((key) => typeof record[key] === "string");
};

export const isThemePreset = (value: unknown): value is ThemePreset => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    isThemeColors(record.colors)
  );
};

export const normalizeThemePresets = (value: unknown): ThemePreset[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: ThemePreset[] = [];
  for (const entry of value) {
    if (!isThemePreset(entry)) continue;
    const id = entry.id.trim();
    const name = entry.name.trim().slice(0, 40);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      name,
      colors: entry.colors,
      favorite: !!entry.favorite,
    });
    if (normalized.length >= MAX_THEME_PRESETS) break;
  }
  return normalized;
};

export const nextPresetName = (presets: ThemePreset[]): string => {
  const prefix = "Preset ";
  let maxIndex = 0;
  presets.forEach((preset) => {
    if (preset.name.startsWith(prefix)) {
      const parsed = Number(preset.name.slice(prefix.length));
      if (!Number.isNaN(parsed)) {
        maxIndex = Math.max(maxIndex, parsed);
      }
    }
  });
  return `${prefix}${maxIndex + 1}`;
};

// Check if two hex colors are too similar (distance < threshold)
export const colorDistance = (hex1: string, hex2: string): number => {
  if (!isValidHex(hex1) || !isValidHex(hex2)) return 255;
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  // Simple Euclidean distance in RGB space
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

export const hasProblematicColors = (draft: CustomThemeDraft): boolean => {
  const threshold = 30; // Colors with distance < 30 are considered too similar
  // Check critical pairs: background vs text, background vs accent, card vs text
  const criticalPairs: [keyof CustomThemeDraft, keyof CustomThemeDraft][] = [
    ["background", "text"],
    ["background", "accent"],
    ["card", "text"],
    ["card", "accent"],
    ["background", "card"],
  ];
  for (const [a, b] of criticalPairs) {
    if (colorDistance(draft[a], draft[b]) < threshold) {
      return true;
    }
  }
  return false;
};
