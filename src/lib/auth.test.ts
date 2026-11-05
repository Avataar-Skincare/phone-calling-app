/// <reference types="jest" />
/// <reference types="node" />
import * as SecureStore from "expo-secure-store";

import { queryClient } from "@/api/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { agent, jwt } from "../../tests/support/compass";
import { resetAppState } from "../../tests/support/state";
import { loadSession, signIn, signOut, signOutIfExpired } from "./auth";

beforeEach(async () => {
  await resetAppState();
});

describe("session lifecycle", () => {
  it("signIn stores the session securely and in memory", async () => {
    const session = await signIn({ token: jwt(), user: agent });
    expect(useAuthStore.getState().session).toEqual(session);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "compass_session",
      JSON.stringify(session),
      expect.anything(),
    );
  });

  it("loadSession restores a valid stored session and marks the store hydrated", async () => {
    const session = await signIn({ token: jwt(), user: agent });
    useAuthStore.setState({ session: null, hydrated: false });

    await loadSession();
    expect(useAuthStore.getState()).toMatchObject({ session, hydrated: true });
  });

  it("loadSession discards an expired session", async () => {
    await signIn({ token: jwt(1_000), user: agent }); // exp in 1970
    useAuthStore.setState({ session: null, hydrated: false });

    await loadSession();
    expect(useAuthStore.getState()).toMatchObject({ session: null, hydrated: true });
    expect(await SecureStore.getItemAsync("compass_session")).toBeNull();
  });

  it("loadSession still hydrates when storage can't be read", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error("Keychain locked"));
    await loadSession();
    expect(useAuthStore.getState()).toMatchObject({ session: null, hydrated: true });
  });

  it("signOut clears memory, storage and cached Compass data", async () => {
    await signIn({ token: jwt(), user: agent });
    queryClient.setQueryData(["anything"], 1);

    await signOut();
    expect(useAuthStore.getState().session).toBeNull();
    expect(await SecureStore.getItemAsync("compass_session")).toBeNull();
    expect(queryClient.getQueryData(["anything"])).toBeUndefined();
  });

  it("signOutIfExpired only signs out an expired session", async () => {
    await signIn({ token: jwt(), user: agent });
    expect(await signOutIfExpired()).toBe(false);

    await signIn({ token: jwt(1_000), user: agent });
    expect(await signOutIfExpired()).toBe(true);
    expect(useAuthStore.getState().session).toBeNull();
  });
});
