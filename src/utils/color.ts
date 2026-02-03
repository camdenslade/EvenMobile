export type HsvColor = {
  h: number;
  s: number;
  v: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const componentToHex = (value: number) =>
  clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

export const fromHsv = ({ h, s, v }: HsvColor) => {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const red = (r + m) * 255;
  const green = (g + m) * 255;
  const blue = (b + m) * 255;

  return `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
};

export const toHsv = (hex: string): HsvColor => {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) {
    return { h: 0, s: 0, v: 0 };
  }

  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * (((b - r) / delta) + 2);
    } else {
      h = 60 * (((r - g) / delta) + 4);
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
};
