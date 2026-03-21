import { ThemeColors } from "../../context/ThemeProvider";

export type CustomThemeDraft = {
  background: string;
  card: string;
  text: string;
  subtitle: string;
  accent: string;
  border: string;
  circle: string;
  shapeRect: string;
  shuffleBtn: string;
};

export type ThemePreset = {
  id: string;
  name: string;
  colors: ThemeColors;
  favorite?: boolean;
};

export const CUSTOM_THEME_PRESETS_KEY = "@EvenApp:customThemePresets";
export const MAX_THEME_PRESETS = 20;

export const THEME_COLOR_KEYS: Array<keyof ThemeColors> = [
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

export const CUSTOM_FIELDS: Array<{ key: keyof CustomThemeDraft; label: string }> = [
  { key: "background", label: "Screen Background" },
  { key: "card", label: "Cards & Buttons" },
  { key: "text", label: "Primary Text" },
  { key: "subtitle", label: "Secondary Text" },
  { key: "accent", label: "Highlights & Links" },
  { key: "border", label: "Dividers & Borders" },
  { key: "circle", label: "Circle Shape" },
  { key: "shapeRect", label: "Rectangle Shape" },
  { key: "shuffleBtn", label: "Shuffle Button" },
];

export const ALLOWED_SCHOOL_DOMAINS = [
  "missouristate.edu",
  // "drury.edu",     // fall release
  // "evangel.edu",  // fall release
  // "otc.edu",      // fall release
  // "mission.edu",  // fall release
  // "sbuniv.edu",   // fall release
];

export const SCHOOL_DOMAIN_MAP: Record<string, string> = {
  "missouristate.edu": "Missouri State University",
  // "drury.edu": "Drury University",                   // fall release
  // "evangel.edu": "Evangel University",               // fall release
  // "otc.edu": "Ozarks Technical College",             // fall release
  // "mission.edu": "Mission University",               // fall release
  // "sbuniv.edu": "Southern Baptist University",       // fall release
};

export const DANGER_COLOR = "#E5484D";
