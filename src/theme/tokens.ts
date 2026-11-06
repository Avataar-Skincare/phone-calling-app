import { useColorScheme } from "react-native";

/** Palette shared with the design document: cool slate neutrals, signal-teal accent. */
const light = {
  bg: "#F4F6F7",
  surface: "#FFFFFF",
  ink: "#13202A",
  muted: "#55666F",
  line: "#D9E1E5",
  accent: "#0B7A6E",
  accentInk: "#FFFFFF",
  accentSoft: "#DFF1EE",
  amber: "#9A5508",
  amberSoft: "#FBEBD6",
  red: "#A8261D",
  redSoft: "#F8E1DE",
};

const dark: typeof light = {
  bg: "#0D1418",
  surface: "#141F25",
  ink: "#E4ECEF",
  muted: "#94A5AD",
  line: "#26343C",
  accent: "#3CC2B0",
  accentInk: "#06201C",
  accentSoft: "#12302C",
  amber: "#E8A24C",
  amberSoft: "#33250F",
  red: "#F08A80",
  redSoft: "#3A1916",
};

export type Colors = typeof light;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const TYPE = {
  title: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "600" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
};

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

/** Stage colours (Compass's stage tones), as [text, background] for light and dark. */
const TONES_LIGHT = {
  red: ["#A8261D", "#F8E1DE"],
  brand: ["#0B7A6E", "#DFF1EE"],
  gray: ["#55666F", "#E8EDF0"],
  cyan: ["#0E6E85", "#DDF2F7"],
  amber: ["#9A5508", "#FBEBD6"],
  orange: ["#B4470E", "#FDE6D7"],
  green: ["#1F7A35", "#DFF3E4"],
  purple: ["#6B3FA0", "#EEE5F8"],
  yellow: ["#7C6400", "#FBF3CC"],
} as const;
const TONES_DARK: Record<keyof typeof TONES_LIGHT, readonly [string, string]> = {
  red: ["#F08A80", "#3A1916"],
  brand: ["#3CC2B0", "#12302C"],
  gray: ["#94A5AD", "#1E2A31"],
  cyan: ["#6CCFE6", "#10303A"],
  amber: ["#E8A24C", "#33250F"],
  orange: ["#F2A06A", "#3A2010"],
  green: ["#7BD38F", "#123020"],
  purple: ["#C3A3EC", "#2A1C3D"],
  yellow: ["#E4CF63", "#332B0C"],
};
export type Tone = keyof typeof TONES_LIGHT;

export function useTone(tone: Tone): { fg: string; bg: string } {
  const pair = (useColorScheme() === "dark" ? TONES_DARK : TONES_LIGHT)[tone];
  return { fg: pair[0], bg: pair[1] };
}
