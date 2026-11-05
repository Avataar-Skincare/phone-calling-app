/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: login screens → session → lead lists, rendering the real app routes
 * (src/app) with expo-router's test renderer and a fake Compass.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { useAuthStore } from "@/store/auth.store";
import { fakeCompass } from "../support/compass";
import { resetAppState } from "../support/state";

jest.mock("@modules/sim-dialer");

beforeEach(async () => {
  await resetAppState();
});

async function openLogin() {
  renderRouter("./src/app", { initialUrl: "/" });
  return screen.findByText("Log in with your Compass number");
}

describe("login", () => {
  it("logs in with phone and code, then shows the agent's lists", async () => {
    const server = fakeCompass();
    await openLogin();

    expect(screen.getByText("Send code")).toBeDisabled();
    fireEvent.changeText(screen.getByTestId("login-phone"), "+91 90000 00001");
    fireEvent.press(screen.getByText("Send code"));

    await screen.findByText("Enter the code");
    expect(screen.getByText(/Sent to \+91 90000 00001/)).toBeTruthy();
    expect(server.find("POST", "/auth/send-otp")[0]?.body).toEqual({ phoneNumber: "9000000001" });

    fireEvent.changeText(screen.getByTestId("otp-input"), "1234");

    await screen.findByText("My leads");
    expect(server.find("POST", "/auth/verify-otp")[0]?.body).toEqual({ token: "otp-token", otp: "1234" });
    expect(useAuthStore.getState().session?.user.name).toBe("Test Agent");

    // Lists: tabs for the agent's department, rows from the first tab
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /First Call/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Hot Leads/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Complaint open/ })).toBeNull(); // CS tab hidden for a Sales agent
    expect(screen.getByText(/Overdue ·/)).toBeTruthy();
  });

  it("blocks a number that isn't an Indian mobile", async () => {
    fakeCompass();
    await openLogin();
    fireEvent.changeText(screen.getByTestId("login-phone"), "5871107094");
    expect(screen.getByText("Enter a valid 10-digit Indian mobile number.")).toBeTruthy();
    expect(screen.getByText("Send code")).toBeDisabled();
  });

  it("explains when the number isn't a Compass user", async () => {
    const server = fakeCompass();
    server.on("POST", "/auth/send-otp", {
      status: 404,
      body: { statusCode: 404, message: "No CRM user found" },
    });
    await openLogin();
    fireEvent.changeText(screen.getByTestId("login-phone"), "9000000009");
    fireEvent.press(screen.getByText("Send code"));
    expect(await screen.findByText(/isn't registered in Compass/)).toBeTruthy();
  });

  it("explains when Compass can't be reached", async () => {
    const server = fakeCompass();
    server.on("POST", "/auth/send-otp", "network-error");
    await openLogin();
    fireEvent.changeText(screen.getByTestId("login-phone"), "9000000001");
    fireEvent.press(screen.getByText("Send code"));
    expect(await screen.findByText(/Can't reach Compass/)).toBeTruthy();
  });

  it("rejects a wrong code and accepts the right one after", async () => {
    fakeCompass();
    await openLogin();
    fireEvent.changeText(screen.getByTestId("login-phone"), "9000000001");
    fireEvent.press(screen.getByText("Send code"));
    await screen.findByText("Enter the code");

    fireEvent.changeText(screen.getByTestId("otp-input"), "0000");
    expect(await screen.findByText(/That code isn't right/)).toBeTruthy();
    expect(useAuthStore.getState().session).toBeNull();

    fireEvent.changeText(screen.getByTestId("otp-input"), "1234");
    await screen.findByText("My leads");
  });

  it("tells the agent when the code has expired", async () => {
    const server = fakeCompass();
    server.on("POST", "/auth/verify-otp", {
      status: 400,
      body: { statusCode: 400, message: "OTP expired or invalid token" },
    });
    await openLogin();
    fireEvent.changeText(screen.getByTestId("login-phone"), "9000000001");
    fireEvent.press(screen.getByText("Send code"));
    await screen.findByText("Enter the code");
    fireEvent.changeText(screen.getByTestId("otp-input"), "1234");
    expect(await screen.findByText(/This code has expired/)).toBeTruthy();
  });

  it("goes back to login when Compass rejects the token", async () => {
    const server = fakeCompass();
    server.on("GET", "/smart-views/definitions", { status: 401, body: { message: "Unauthorized" } });
    await openLogin();
    fireEvent.changeText(screen.getByTestId("login-phone"), "9000000001");
    fireEvent.press(screen.getByText("Send code"));
    await screen.findByText("Enter the code");
    fireEvent.changeText(screen.getByTestId("otp-input"), "1234");

    await waitFor(() => expect(useAuthStore.getState().session).toBeNull());
    expect(await screen.findByText("Log in with your Compass number")).toBeTruthy();
  });
});
