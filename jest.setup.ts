/// <reference types="jest" />
/// <reference types="node" />
/**
 * Test environment shared by every Jest suite.
 *
 * Native storage is replaced by in-memory versions so stores and the session behave exactly as in
 * the app, without a device. Network is never real in unit/integration tests: each test that
 * needs Compass installs a fetch mock (see tests/support/compass.ts).
 */

// AsyncStorage: the library's official in-memory mock.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// SecureStore: simple in-memory key-value store with the same async API.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 0,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    __reset: () => store.clear(),
  };
});

// Fail loudly if any test forgets to mock the network.
beforeEach(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    throw new Error(`Unmocked fetch: ${String(input)}`);
  }) as unknown as typeof fetch;
});

// Safe areas: the library's official mock (fixed insets, no native module).
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

// Tests run "in the foreground": the outcome sheet opens only while the app is active.
const { AppState } = require("react-native") as typeof import("react-native");
Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });

// TanStack Query keeps garbage-collection timers; clear them so Jest workers exit cleanly.
afterAll(() => {
  require("@/api/queryClient").queryClient.clear();
});

// expo-router's renderRouter switches to fake timers. Flush whatever the app scheduled in a test
// (navigation, retry loops, the call tracker) before the next one starts, then restore real timers,
// so one test's leftovers can never fire inside another test's render.
afterEach(() => {
  if (jest.isMockFunction(setTimeout)) {
    const { act } =
      require("@testing-library/react-native") as typeof import("@testing-library/react-native");
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  }
});
