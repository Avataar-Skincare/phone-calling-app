// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");

module.exports = defineConfig([
  expoConfig,
  // Formatting is Prettier's job; turn off every stylistic rule that would fight it.
  prettierConfig,
  {
    ignores: [
      "dist/*",
      "android/*",
      "ios/*",
      "modules/*/android/*",
      "modules/*/ios/*",
      ".expo/*",
      ".expo-export-check/*",
      "coverage/*",
    ],
  },
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // An HTML concern: React Native <Text> renders ' and " exactly as written.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
  {
    // Tests: jest.mock factories must use require().
    files: ["jest.setup.ts", "**/*.test.{ts,tsx}", "tests/**", "**/__mocks__/**"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
