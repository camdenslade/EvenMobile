export type CardPalette = {
  surface: string;
  text: string;
  subtitle: string;
  muted: string;
  border: string;
  pill: string;
  pillText: string;
  gaugeAccent: string;
  gaugeTrack: string;
};

export function isDarkColor(hex: string): boolean {
  const normalized = hex.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => `${ch}${ch}`)
          .join("")
      : normalized;
  if (expanded.length !== 6) return false;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5;
}

export function buildCardPalette(backgroundColor: string): CardPalette {
  if (isDarkColor(backgroundColor)) {
    return {
      surface: "#FFFFFF",
      text: "#111111",
      subtitle: "#555555",
      muted: "#777777",
      border: "rgba(0,0,0,0.08)",
      pill: "#F2F2F2",
      pillText: "#333333",
      gaugeAccent: "#111111",
      gaugeTrack: "rgba(0,0,0,0.15)",
    };
  }

  return {
    surface: "#222222",
    text: "#FFFFFF",
    subtitle: "rgba(255,255,255,0.78)",
    muted: "rgba(255,255,255,0.7)",
    border: "rgba(255,255,255,0.2)",
    pill: "rgba(255,255,255,0.12)",
    pillText: "#FFFFFF",
    gaugeAccent: "#FFFFFF",
    gaugeTrack: "rgba(255,255,255,0.28)",
  };
}

export function ensureContrastingColor(
  color: string | undefined,
  surface: string,
  fallback: string,
): string {
  if (!color) return fallback;
  const normalized = color.trim().toLowerCase();
  const normalizedSurface = surface.trim().toLowerCase();
  if (normalized === normalizedSurface) {
    return fallback;
  }
  return color;
}
