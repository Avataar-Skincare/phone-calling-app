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
  it("shows the first tab's tasks like Compass, with masked numbers, statuses and counts", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByLabelText("Asha Rao, open lead")).toBeTruthy();
    expect(screen.getByText("Smart Views")).toBeTruthy();
    expect(screen.getByText(/98•••••001/)).toBeTruthy();
    expect(screen.getByText("overdue")).toBeTruthy();
    expect(screen.getByText("01/01/2020, 11:00 am")).toBeTruthy();
    expect(screen.getByText("Showing 2 of 2")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /First Call\s+2/ })).toBeTruthy();
    // Compass's defaults for a task view
    expect(screen.getByLabelText("Status: Pending and Overdue")).toBeTruthy();
    expect(screen.getByLabelText("Date range: This Week")).toBeTruthy();

    // A lead without a number can't be called
    expect(screen.getByLabelText("Call Kiran")).toBeDisabled();
    expect(screen.getByLabelText("Call Asha Rao")).toBeEnabled();

    expect(server.find("GET", "/smart-views/counts")[0]?.query).toEqual({ department: "sales" });
    expect(server.find("GET", "/smart-views/data")[0]?.query).toEqual({
      view: "first_call_tasks",
      page: "1",
      limit: "20",
      schedule: "this_week",
      status: "pending_and_overdue",
      sort_order: "ASC",
    });
  });

  it("switches tabs", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByRole("tab", { name: /Hot Leads/ }));
    expect(await screen.findByLabelText("Meera Iyer, open lead")).toBeTruthy();
    expect(screen.getByText(/98•••••003/)).toBeTruthy();
    expect(screen.getByText(/facebook_lead_ads/)).toBeTruthy(); // sources shown as stored, like Compass
    expect(server.find("GET", "/smart-views/data").at(-1)?.query.view).toBe("hot_leads");
  });

  it("searches the current tab after the agent stops typing", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.changeText(screen.getByLabelText("Search leads"), "Asha");
    await waitFor(() => expect(server.find("GET", "/smart-views/data").at(-1)?.query.search).toBe("Asha"));
    expect(await screen.findByText("Showing 2 of 2")).toBeTruthy();
  });

  it("shows an empty state and an error state", async () => {
    const server = fakeCompass();
    signedInAs();
    server.on("GET", "/smart-views/data", {
      body: { data: [], meta: { total: 0, page: 1, limit: 25, total_pages: 0 } },
    });
    renderRouter("./src/app", { initialUrl: "/" });
    expect(await screen.findByText("No tasks found")).toBeTruthy();

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

    expect(await screen.findByLabelText("Asha Rao, open lead")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^First Call$/ })).toBeTruthy(); // no count
    expect(server.find("GET", "/smart-views/counts")).toHaveLength(1); // not retried
  });
});

describe("task views", () => {
  it("shows tasks to call, with no Mark as completed (tasks are completed on the website)", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    expect(screen.getByLabelText("Call Asha Rao")).toBeTruthy();
    expect(screen.getByLabelText("WhatsApp Asha Rao")).toBeTruthy();
    expect(screen.queryByLabelText("Mark as completed")).toBeNull();
    expect(server.requests.filter((r) => r.method !== "GET")).toEqual([]);
  });
});

describe("departments", () => {
  it("opens a Central user on Sales and switches to Customer Support", async () => {
    fakeCompass();
    signedInAs({ ...agent, role: "administrator", departmentId: "3" }); // Central
    renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByLabelText("Asha Rao, open lead")).toBeTruthy(); // Sales by default
    fireEvent.press(screen.getByText("Customer Support"));
    expect(await screen.findByRole("tab", { name: /Complaint open/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /First Call/ })).toBeNull();
  });

  it("shows both departments to a Sales agent too, like Compass", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    fireEvent.press(screen.getByText("Customer Support"));
    expect(await screen.findByRole("tab", { name: /Complaint open/ })).toBeTruthy();
    await waitFor(() =>
      expect(server.find("GET", "/smart-views/counts").at(-1)?.query).toEqual({ department: "cs" }),
    );
  });
});

describe("lead screen", () => {
  it("opens the Compass opportunity page with profile, tiles, properties and Overview", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByLabelText("Asha Rao, open lead"));

    expect(await screen.findByText("+91-9876500001")).toBeTruthy();
    expect(screen.getByText("OPPORTUNITY DETAILS · SALES")).toBeTruthy();
    expect(screen.getByText(/First Call · overdue since/)).toBeTruthy();
    expect(screen.getByText("Pune")).toBeTruthy();
    expect(screen.getByText("Lead Score")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("Not Connected Count")).toBeTruthy();
    expect(screen.getByText("Properties")).toBeTruthy();
    expect(screen.getByText("Lead Source")).toBeTruthy();
    // Overview cards load from their own endpoints
    await waitFor(() => expect(server.find("GET", "/opportunities/7001/lead-sources")).toHaveLength(1));
    expect(server.find("GET", "/opportunities/7001/sales-overview")).toHaveLength(1);
    expect(server.find("GET", "/opportunities/7001/cs-overview")).toHaveLength(0); // Sales only
    expect(server.find("GET", "/opportunities/7001")).toHaveLength(1);
  });

  it("shows each tab from its Compass endpoint", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/lead/7001" });
    await screen.findByText("+91-9876500001");

    fireEvent.press(screen.getByText("Activities"));
    expect(await screen.findByText("Lead Capture")).toBeTruthy();
    expect(server.find("GET", "/leads/501")).toHaveLength(1);

    fireEvent.press(screen.getByText("Tasks"));
    expect(await screen.findByText("No pending tasks for this opportunity")).toBeTruthy();
    expect(server.find("GET", "/tasks").at(-1)?.query).toEqual({
      opportunity_id: "7001",
      status: "pending",
      sort_by: "due_at",
      sort_order: "ASC",
      limit: "50",
    });

    fireEvent.press(screen.getByText("Calls"));
    expect(await screen.findByText("No calls recorded yet.")).toBeTruthy();
    await waitFor(() =>
      expect(server.find("GET", "/ameyo/opportunities/7001/calls").at(-1)?.query).toEqual({
        page: "1",
        limit: "20",
      }),
    );

    fireEvent.press(screen.getByText("Stage History"));
    expect(await screen.findByText("Created at New Lead")).toBeTruthy();

    fireEvent.press(screen.getByText("Purchase History"));
    expect(await screen.findByText("No purchase history found.")).toBeTruthy();

    fireEvent.press(screen.getByText("Appointments"));
    expect(await screen.findByText("No appointments found")).toBeTruthy();
    expect(screen.getByText("0 appointments found")).toBeTruthy();
  });

  it("has no Change Stage: stages and outcomes are changed on the Compass website", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/lead/7001" });
    await screen.findByText("+91-9876500001");

    expect(screen.queryByText("Change Stage")).toBeNull();
    expect(screen.getByText("New Lead")).toBeTruthy(); // the stage is still shown
    expect(server.find("POST", /\/stage$/)).toHaveLength(0);
  });

  it("explains when the lead is no longer the agent's", async () => {
    const server = fakeCompass();
    signedInAs();
    server.on("GET", /^\/opportunities\/\d+$/, { status: 403, body: { message: "Forbidden resource" } });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByLabelText("Asha Rao, open lead"));
    expect(await screen.findByText("This lead isn't assigned to you any more")).toBeTruthy();
  });
});
