/**
 * Contract tests against the real Compass API (`npm run test:contract`).
 *
 * Read-only: they log in and make GET requests, and never save anything. They need:
 *   COMPASS_TEST_PHONE   a Compass user's 10-digit number (use a bypass number: no SMS is sent)
 *   COMPASS_TEST_OTP     that user's code (the fixed bypass code)
 *   COMPASS_API_URL      optional, defaults to Compass testing; production is refused
 * Without the two credentials every test is skipped.
 *
 * Plain Node environment (not the React Native preset), so `fetch` is Node's real network client.
 */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/contract/**/*.test.ts"],
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { presets: ["babel-preset-expo"] }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testTimeout: 30_000,
};
