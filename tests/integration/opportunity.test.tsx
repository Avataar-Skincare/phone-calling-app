/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: the client (opportunity) page with real data in every card and tab, against a
 * fake Compass. Empty states are covered in leads.test.tsx.
 */
import { Linking } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { fakeCompass, opportunity } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");

beforeEach(async () => {
  await resetAppState();
  signedInAs();
});

const page = <T,>(data: T[], total = data.length, limit = 20) => ({
  data,
  meta: { total, page: 1, limit, total_pages: Math.ceil(total / limit) },
});

async function openPage(server = fakeCompass()) {
  renderRouter("./src/app", { initialUrl: "/lead/7001" });
  await screen.findByText("+91-9876500001");
  return server;
}

describe("Overview with data (Sales)", () => {
  it("shows lead sources, add to cart, consultation, WhatsApp and packages", async () => {
    const server = fakeCompass();
    server.on("GET", /lead-sources$/, {
      body: { lead_sources: [{ source: "facebook_lead_ads", campaign_name: "Diwali Glow" }] },
    });
    server.on("GET", /sales-overview$/, {
      body: {
        haut_ai: [],
        last_add_to_cart: {
          activity_id: 1,
          date: "2026-11-04T14:48:00Z",
          product_name: "HydraFacial",
          number_of_sessions: 3,
        },
        recent_photos: [],
        skin_analysis_report: null,
      },
    });
    server.on("GET", /virtual-consultations$/, {
      body: {
        data: [
          {
            consultation_id: 1,
            consultation_date: "2026-11-03T10:00:00Z",
            doctor_name: "Dr. Mehta",
            consultation_type: "Pre-Payment",
            services_recommended: "Chemical Peel",
            prescription_report: null,
          },
        ],
      },
    });
    server.on("GET", /recent-whatsapp$/, {
      body: {
        messages: [
          {
            direction: "inbound",
            message_text: "Is the offer still on?",
            occurred_at: "2026-11-04T09:00:00Z",
          },
        ],
      },
    });
    server.on("GET", /package-details$/, {
      body: {
        packages: [
          {
            product_name: "Laser Hair Removal",
            total_sessions: 6,
            completed_sessions: 2,
            remaining_sessions: 4,
          },
        ],
      },
    });
    await openPage(server);

    expect(await screen.findByText("Diwali Glow")).toBeTruthy();
    expect(await screen.findByText("HydraFacial")).toBeTruthy();
    expect(await screen.findByText("Dr. Mehta")).toBeTruthy();
    expect(screen.getByText("Chemical Peel")).toBeTruthy();
    expect(await screen.findByText(/Is the offer still on\?/)).toBeTruthy();
    expect(await screen.findByText("Laser Hair Removal")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy(); // remaining sessions
  });
});

describe("Overview (Customer Support)", () => {
  it("shows Basic Info and complaints for a CS opportunity, and no Sales cards", async () => {
    const server = fakeCompass();
    server.on("GET", /^\/opportunities\/\d+$/, {
      body: { ...opportunity(), department: { id: "2", code: "cs", label: "Customer Support" } },
    });
    server.on("GET", /cs-overview$/, {
      body: {
        complaints: [
          {
            activity_id: 3,
            date: "2026-11-02T08:00:00Z",
            complaint_type: "Burn",
            notes: "Redness after session",
            ptc_received: "Yes",
          },
        ],
        escalated_status: "Yes",
        address: "Baner, Pune",
        rm_name: null,
      },
    });
    await openPage(server);

    expect(screen.getByText("OPPORTUNITY DETAILS · CUSTOMER SUPPORT")).toBeTruthy();
    expect(await screen.findByText("Baner, Pune")).toBeTruthy();
    expect(screen.getByText("N/A")).toBeTruthy(); // no RM
    expect(await screen.findByText("Redness after session")).toBeTruthy();
    expect(server.find("GET", /sales-overview$/)).toHaveLength(0);
    expect(screen.queryByText("Last Add to Cart")).toBeNull();
  });
});

describe("tabs with data", () => {
  it("Activities: hides failed dialer attempts, shows score and who added it", async () => {
    const server = fakeCompass();
    const base = { title: null, added_by_type: "user", created_at: "2026-11-04T10:00:00Z" };
    server.on("GET", /^\/leads\/\d+$/, {
      body: {
        total_activities: 3,
        activities: [
          {
            ...base,
            id: "1",
            type: { code: "outbound_call", label: "Outbound Call" },
            score: 0,
            data: { success: "0", call_id: "C9" },
            added_by: null,
            occurred_at: "2026-11-04T10:00:00Z",
          },
          {
            ...base,
            id: "2",
            type: { code: "disposition", label: "Call Disposition" },
            score: 0,
            data: { call_id: "C9", notes: "should be hidden too" },
            added_by: null,
            occurred_at: "2026-11-04T10:01:00Z",
          },
          {
            ...base,
            id: "3",
            type: { code: "add_to_cart", label: "Add to Cart" },
            score: 5,
            data: { notes: "Wants evening slot" },
            added_by: { id: "31", name: "Test Agent" },
            occurred_at: "2026-11-04T11:00:00Z",
          },
        ],
      },
    });
    await openPage(server);
    fireEvent.press(screen.getByText("Activities"));

    expect(await screen.findByText("Add to Cart")).toBeTruthy();
    expect(screen.getByText("+5")).toBeTruthy();
    expect(screen.getByText("Wants evening slot")).toBeTruthy();
    expect(screen.getByText(/^Added by Test Agent on /)).toBeTruthy();
    expect(screen.queryByText("Outbound Call")).toBeNull();
    expect(screen.queryByText(/should be hidden/)).toBeNull();

    // Tapping a card shows its details
    fireEvent.press(screen.getByText("Add to Cart"));
    expect(screen.getByText("notes")).toBeTruthy();
  });

  it("Tasks: groups by due date and filters by status, read-only", async () => {
    const server = fakeCompass();
    server.on("GET", "/tasks", (req) => ({
      body: page(
        req.query.status === "pending"
          ? [
              {
                id: 9001,
                title: "Call back about package",
                description: null,
                status: "pending",
                priority: "high",
                due_at: "2020-01-01T05:30:00Z",
                completed_at: null,
                task_type: { code: "follow_up", label: "Follow Up" },
                assigned_to: { id: "31", name: "Test Agent" },
              },
            ]
          : [],
        undefined,
        50,
      ),
    }));
    await openPage(server);
    fireEvent.press(screen.getByText("Tasks"));

    expect(await screen.findByText("Call back about package")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Assigned to Test Agent")).toBeTruthy();

    // Read-only: tasks are completed on the Compass website
    expect(screen.queryByLabelText("Mark as completed")).toBeNull();

    fireEvent.press(screen.getByText("Completed"));
    expect(await screen.findByText("No completed tasks for this opportunity")).toBeTruthy();
    expect(server.find("GET", "/tasks").at(-1)?.query.status).toBe("completed");
  });

  it("Calls: shows calls, opens a recording, and pages", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const server = fakeCompass();
    const row = (id: number) => ({
      id,
      direction: "outbound",
      agent: { id: "31", name: "Test Agent" },
      system_disposition: "CONNECTED",
      disposition_code: "Interested",
      talk_time_seconds: 192,
      recording_url: "/api/ameyo/recording/55",
      started_at: "2026-11-04T14:48:00Z",
    });
    server.on("GET", /^\/ameyo\/opportunities\/\d+\/calls$/, (req) => ({
      body: {
        data: [row(Number(req.query.page) * 100)],
        meta: { total: 21, page: Number(req.query.page), limit: 20, total_pages: 2 },
      },
    }));
    await openPage(server);
    fireEvent.press(screen.getByText("Calls"));

    expect(await screen.findByText("21 calls total")).toBeTruthy();
    expect(screen.getAllByText("3m 12s").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Interested").length).toBeGreaterThan(0);

    fireEvent.press(screen.getAllByText("Play")[0]!);
    expect(openURL).toHaveBeenLastCalledWith("https://compass.avataarskin.com/api/ameyo/recording/55");

    fireEvent.press(screen.getByText("Next"));
    await waitFor(() =>
      expect(server.find("GET", /\/calls$/).at(-1)?.query).toEqual({ page: "2", limit: "20" }),
    );
    openURL.mockRestore();
  });

  it("Stage History: shows each change with who made it and why", async () => {
    const server = fakeCompass();
    server.on("GET", /^\/opportunities\/\d+$/, {
      body: {
        ...opportunity(),
        stage_history: [
          {
            id: "2",
            from_stage: { id: "1", label: "New Lead" },
            to_stage: { id: "4", label: "Warm - Consultation Done" },
            changed_by: { id: "31", name: "Test Agent" },
            changed_at: "2026-11-04T14:48:00Z",
            reason: "VC done",
          },
          ...opportunity().stage_history!,
        ],
      },
    });
    await openPage(server);
    fireEvent.press(screen.getByText("Stage History"));

    expect(await screen.findByText("New Lead → Warm - Consultation Done")).toBeTruthy();
    expect(screen.getByText("Test Agent · 04/11/2026, 08:18 pm")).toBeTruthy();
    expect(screen.getByText("“VC done”")).toBeTruthy();
    expect(screen.getByText("Created at New Lead")).toBeTruthy();
    expect(screen.getByText(/^System · /)).toBeTruthy();
  });

  it("Purchase History: shows orders and their items", async () => {
    const server = fakeCompass();
    server.on("GET", /purchase-history$/, {
      body: {
        data: [
          {
            order_id: "ORD-2026-0001",
            order_date: "2026-11-01T06:00:00Z",
            formatted_address: "Baner, Pune",
            payable_amount: 123456,
            amount_paid: 100000,
            left_amount: 23456,
            payment_status: "partial_paid",
            items: [
              {
                order_detail_id: 1,
                product_name: "Laser Hair Removal",
                item_price: 123456,
                sessions_taken: 2,
              },
            ],
          },
        ],
      },
    });
    await openPage(server);
    fireEvent.press(screen.getByText("Purchase History"));

    expect(await screen.findByText("ORD-2026...")).toBeTruthy();
    expect(screen.getAllByText("₹1,23,456").length).toBeGreaterThan(0);
    expect(screen.getByText("Partial")).toBeTruthy();

    fireEvent.press(screen.getByText("ORD-2026..."));
    expect(screen.getByText("Order Details · ORD-2026-0001")).toBeTruthy();
    expect(screen.getByText("Laser Hair Removal")).toBeTruthy();
  });

  it("Appointments: shows the count and each appointment", async () => {
    const server = fakeCompass();
    server.on("GET", /appointments$/, {
      body: page(
        [
          {
            session_id: 77,
            client_id: 501,
            address: "Baner, Pune",
            service_name: "HydraFacial",
            session_status: "SCHEDULED",
            appointment_date: "2026-11-10T06:00:00Z",
            therapist_assigned: "Neha",
          },
        ],
        1,
        10,
      ),
    });
    await openPage(server);
    fireEvent.press(screen.getByText("Appointments"));

    expect(await screen.findByText("1 appointment found")).toBeTruthy();
    expect(screen.getByText("HydraFacial")).toBeTruthy();
    expect(screen.getByText("Neha")).toBeTruthy();
    expect(screen.getByText("10 Nov 2026, 11:30 am")).toBeTruthy();
  });
});
