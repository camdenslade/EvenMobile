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
];

export const ALLOWED_SCHOOL_DOMAINS = [
  "missouristate.edu",
  "drury.edu",
  "evangel.edu",
  "otc.edu",
  "mission.edu",
  "sbuniv.edu",
];

export const SCHOOL_DOMAIN_MAP: Record<string, string> = {
  "missouristate.edu": "Missouri State University",
  "drury.edu": "Drury University",
  "evangel.edu": "Evangel University",
  "otc.edu": "Ozarks Technical College",
  "mission.edu": "Mission University",
  "sbuniv.edu": "Southern Baptist University",
};

export const DANGER_COLOR = "#E5484D";
