/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: lead lists, search, lead screen and departments, against a fake Compass.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { agent, fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");

beforeEach(async () => {
  await resetAppState();
});

describe("lead lists", () => {
  it("shows the first tab's tasks with masked numbers, due times and counts", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("98•••••001 · First Call")).toBeTruthy();
    expect(screen.getByText(/^Overdue · /)).toBeTruthy();
    expect(screen.getByText(/^Due /)).toBeTruthy();
    expect(screen.getByText("2 leads")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /First Call\s+2/ })).toBeTruthy();

    // A lead without a number can't be called
    expect(screen.getByLabelText("Call Kiran")).toBeDisabled();
    expect(screen.getByLabelText("Call Asha Rao")).toBeEnabled();

    expect(server.find("GET", "/smart-views/counts")[0]?.query).toEqual({ department: "sales" });
    expect(server.find("GET", "/smart-views/data")[0]?.query).toEqual({
      view: "first_call_tasks",
      page: "1",
      limit: "25",
    });
  });

  it("switches tabs", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByText("Asha Rao");

    fireEvent.press(screen.getByRole("tab", { name: /Hot Leads/ }));
    expect(await screen.findByText("Meera Iyer")).toBeTruthy();
    expect(screen.getByText("98•••••003 · Facebook lead ads")).toBeTruthy();
    expect(server.find("GET", "/smart-views/data").at(-1)?.query.view).toBe("hot_leads");
  });

  it("searches the current tab after the agent stops typing", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByText("Asha Rao");

    fireEvent.changeText(screen.getByLabelText("Search leads"), "Asha");
    await waitFor(() => expect(server.find("GET", "/smart-views/data").at(-1)?.query.search).toBe("Asha"));
    expect(await screen.findByText('2 leads matching "Asha"')).toBeTruthy();
  });

  it("shows an empty state and an error state", async () => {
    const server = fakeCompass();
    signedInAs();
    server.on("GET", "/smart-views/data", {
      body: { data: [], meta: { total: 0, page: 1, limit: 25, total_pages: 0 } },
    });
    renderRouter("./src/app", { initialUrl: "/" });
    expect(await screen.findByText("No leads here right now")).toBeTruthy();

    server.on("GET", "/smart-views/data", { status: 500, body: {} });
    fireEvent.press(screen.getByRole("tab", { name: /Hot Leads/ }));
    // The app retries a 5xx twice (about 3 s) before showing the error.
    expect(await screen.findByText("Couldn't load leads", {}, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("still works when the counts endpoint times out", async () => {
    const server = fakeCompass();
    signedInAs();
    server.on("GET", "/smart-views/counts", { status: 504, body: {} });
    renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^First Call$/ })).toBeTruthy(); // no count
    expect(server.find("GET", "/smart-views/counts")).toHaveLength(1); // not retried
  });
});

describe("departments", () => {
  it("gives a user outside Sales and CS a department switch", async () => {
    fakeCompass();
    signedInAs({ ...agent, role: "administrator", departmentId: "3" }); // Central
    renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByText("Asha Rao")).toBeTruthy(); // Sales by default
    fireEvent.press(screen.getByText("Customer Support"));
    expect(await screen.findByRole("tab", { name: /Complaint open/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /First Call/ })).toBeNull();
  });

  it("doesn't show the switch to a Sales agent", async () => {
    fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByText("Asha Rao");
    expect(screen.queryByText("Customer Support")).toBeNull();
  });
});

describe("lead screen", () => {
  it("opens from the list with the full number, task and history", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByText("Asha Rao");

    fireEvent.press(screen.getByLabelText("Asha Rao, open lead"));

    expect(await screen.findByText("+91 98765 00001")).toBeTruthy();
    expect(screen.getByText(/First Call · overdue since/)).toBeTruthy();
    expect(screen.getByText("Pune")).toBeTruthy();
    expect(screen.getByText("Lead Capture")).toBeTruthy();
    expect(server.find("GET", "/opportunities/7001")).toHaveLength(1);
  });

  it("explains when the lead is no longer the agent's", async () => {
    const server = fakeCompass();
    signedInAs();
    server.on("GET", /^\/opportunities\/\d+$/, { status: 403, body: { message: "Forbidden resource" } });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByText("Asha Rao");

    fireEvent.press(screen.getByLabelText("Asha Rao, open lead"));
    expect(await screen.findByText("This lead isn't assigned to you any more")).toBeTruthy();
  });
});
