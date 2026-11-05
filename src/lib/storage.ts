import * as SecureStore from "expo-secure-store";

/**
 * Secure key-value storage (iOS Keychain / Android Keystore).
 *
 * Reads are guarded: Keychain access can fail when the device is locked or on a background
 * launch before the first unlock. A failed read is treated as "nothing stored", so the agent
 * lands on login instead of an error screen. Writes are NOT swallowed: losing a value the caller
 * believes it saved is worse than surfacing the error. (Same approach as lume-mobile.)
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key, OPTIONS);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, OPTIONS);
  },
  async del(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key, OPTIONS);
    } catch {
      // Nothing stored, or Keychain unavailable. The in-memory session is cleared either way.
    }
  },
};
