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
