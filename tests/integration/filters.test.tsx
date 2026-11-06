/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: Smart View filters, sort and page size, as Compass sends them, against a fake Compass.
 */
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import DateTimePicker from "@react-native-community/datetimepicker";

import { agent, fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");

beforeEach(async () => {
  await resetAppState();
});

/** Filters on the most recent Smart View data request. */
const lastQuery = (server: ReturnType<typeof fakeCompass>) =>
  server.find("GET", "/smart-views/data").at(-1)?.query;

async function openHotLeads(server: ReturnType<typeof fakeCompass>) {
  renderRouter("./src/app", { initialUrl: "/" });
  await screen.findByLabelText("Asha Rao, open lead");
  fireEvent.press(screen.getByRole("tab", { name: /Hot Leads/ }));
  await screen.findByLabelText("Meera Iyer, open lead");
  await waitFor(() => expect(lastQuery(server)?.view).toBe("hot_leads"));
}

describe("lead view filters", () => {
  it("filters by stage, source and date range, and sends them like Compass", async () => {
    const server = fakeCompass();
    server.on("GET", "/settings/sources/dropdown", {
      body: [{ source_name: "facebook_lead_ads" }, { source_name: "google_ads" }],
    });
    signedInAs();
    await openHotLeads(server);
    // Compass's defaults for an agent on Hot Leads
    expect(lastQuery(server)).toMatchObject({
      view: "hot_leads",
      schedule: "this_week",
      date_type: "created_on",
    });

    // Stage (single select: picking closes the sheet)
    fireEvent.press(screen.getByLabelText("Stage: All Stages"));
    fireEvent.press(await screen.findByText("Hot - Appt Scheduled Not Paid"));
    await waitFor(() => expect(lastQuery(server)?.stage).toBe("hot_appt_scheduled_not_paid"));
    expect(screen.getByLabelText("Stage: Hot - Appt Scheduled Not Paid")).toBeTruthy();

    // Lead source, searched inside the sheet
    fireEvent.press(screen.getByLabelText("Lead Source: All Sources"));
    fireEvent.changeText(await screen.findByLabelText("Search Lead Source"), "goo");
    expect(screen.queryByText("facebook_lead_ads", { exact: true })).toBeNull();
    fireEvent.press(screen.getByText("google_ads"));
    await waitFor(() => expect(lastQuery(server)?.source).toBe("google_ads"));

    // Date range preset
    fireEvent.press(screen.getByLabelText("Date range: This Week"));
    fireEvent.press(await screen.findByText("Today"));
    await waitFor(() => expect(lastQuery(server)?.schedule).toBe("today"));

    expect(lastQuery(server)).toMatchObject({
      view: "hot_leads",
      stage: "hot_appt_scheduled_not_paid",
      source: "google_ads",
      schedule: "today",
      page: "1",
      limit: "20",
    });
  });

  it("sets a custom date range", async () => {
    const server = fakeCompass();
    signedInAs();
    await openHotLeads(server);

    fireEvent.press(screen.getByLabelText("Date range: This Week"));
    await screen.findByText("Custom Range");
    expect(screen.getByText("Apply")).toBeDisabled();

    // iPhone shows an inline calendar under the field being picked
    fireEvent.press(screen.getByLabelText("From date"));
    act(() => screen.UNSAFE_getByType(DateTimePicker).props.onValueChange({}, new Date(2026, 10, 1)));
    fireEvent.press(screen.getByLabelText("To date"));
    act(() => screen.UNSAFE_getByType(DateTimePicker).props.onValueChange({}, new Date(2026, 10, 5)));
    await waitFor(() => expect(screen.getByText("Apply")).toBeEnabled());
    fireEvent.press(screen.getByText("Apply"));

    await waitFor(() => expect(lastQuery(server)?.schedule).toBe("custom"));
    expect(lastQuery(server)).toMatchObject({ date_from: "2026-11-01", date_to: "2026-11-05" });
  });

  it("remembers each view's filters when the agent switches tabs", async () => {
    const server = fakeCompass();
    signedInAs();
    await openHotLeads(server);
    fireEvent.press(screen.getByLabelText("Date range: This Week"));
    fireEvent.press(await screen.findByText("Yesterday"));
    await waitFor(() => expect(lastQuery(server)?.schedule).toBe("yesterday"));

    fireEvent.press(screen.getByRole("tab", { name: /First Call/ }));
    // First Call keeps its own range (its list comes from the cache, so check the screen)
    expect(await screen.findByLabelText("Date range: This Week")).toBeTruthy();
    expect(screen.queryByLabelText("Date range: Yesterday")).toBeNull();

    fireEvent.press(screen.getByRole("tab", { name: /Hot Leads/ }));
    expect(await screen.findByLabelText("Date range: Yesterday")).toBeTruthy();
  });

  it("hides the owner filter from agents and shows it to a team lead", async () => {
    const server = fakeCompass();
    server.on("GET", "/agents/dropdown", {
      body: [
        { id: 31, name: "Test Agent" },
        { id: 40, name: "Rohit Shah" },
      ],
    });
    signedInAs();
    await openHotLeads(server);
    expect(screen.queryByLabelText(/^Owner:/)).toBeNull();
    expect(server.find("GET", "/agents/dropdown")).toHaveLength(0);
  });

  it("lets a team lead filter by owner", async () => {
    const server = fakeCompass();
    server.on("GET", "/agents/dropdown", {
      body: [
        { id: 31, name: "Test Agent", role: "agent", team_id: 7 },
        { id: 40, name: "Rohit Shah", role: "agent", team_id: 7 },
      ],
    });
    signedInAs({ ...agent, role: "tl", teamId: "7" });
    await openHotLeads(server);

    fireEvent.press(await screen.findByLabelText("Owner: Any Owner"));
    fireEvent.press(await screen.findByText("Rohit Shah"));
    await waitFor(() => expect(lastQuery(server)?.owner).toBe("40"));
  });
});

describe("task view filters", () => {
  it("filters First Call tasks by status", async () => {
    const server = fakeCompass();
    signedInAs();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByLabelText("Status: Pending and Overdue"));
    fireEvent.press(await screen.findByText("Completed"));
    await waitFor(() => expect(lastQuery(server)?.status).toBe("completed"));
    expect(lastQuery(server)).toMatchObject({ view: "first_call_tasks", sort_order: "ASC" });
  });
});

describe("sort and page size", () => {
  it("sorts like Compass's column headers and changes rows per page", async () => {
    const server = fakeCompass();
    signedInAs();
    await openHotLeads(server);

    // Pick Lead Score, then pick it again to flip the order
    fireEvent.press(screen.getByLabelText("Sort by Modified On, descending"));
    fireEvent.press(await screen.findByText("Lead Score"));
    await waitFor(() => expect(lastQuery(server)).toMatchObject({ sort_by: "lead_score" }));
    const firstOrder = lastQuery(server)?.sort_order;
    fireEvent.press(screen.getByLabelText(/^Sort by Lead Score/));
    fireEvent.press(await screen.findByText(/^Lead Score \(/));
    await waitFor(() => expect(lastQuery(server)?.sort_order).not.toBe(firstOrder));

    fireEvent.press(screen.getByLabelText("Rows per page 20"));
    expect(await screen.findByText("Rows per page")).toBeTruthy();
    fireEvent.press(screen.getByText("50"));
    await waitFor(() => expect(lastQuery(server)?.limit).toBe("50"));
    expect(screen.getByLabelText("Rows per page 50")).toBeTruthy();
  });
});
