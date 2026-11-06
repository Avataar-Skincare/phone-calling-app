/**
 * Jest: unit and integration tests (`npm test`).
 *
 * - `jest-expo` preset: React Native + Expo module mocks, Babel via babel-preset-expo.
 * - Contract tests against the real Compass testing API live in tests/contract and run only with
 *   `npm run test:contract` (they need credentials and network).
 */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@modules/(.*)$": "<rootDir>/modules/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/", "/.expo/", "<rootDir>/tests/contract/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "modules/sim-dialer/index.ts",
    "!src/**/*.test.{ts,tsx}",
    "!src/types/**",
  ],
  coverageReporters: ["text-summary", "text", "lcov"],
  // Screen tests load the whole app on their first render: about 10 s alone, 20–30 s when six
  // integration files start together on a busy machine or a CI runner. Later tests take < 1 s.
  testTimeout: 60_000,
};
