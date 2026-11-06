import { Image, Linking, Pressable, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/StagePill";
import {
  formatCallDuration,
  formatDateIN,
  formatLongIN,
  formatRupees,
  formatShortIN,
  paymentStatusLabel,
} from "@/lib/format";
import { RADIUS, SPACE, useColors } from "@/theme/tokens";
import type { OpportunityDetail } from "@/types/compass";
import type { HautAiEntry } from "@/types/opportunityPage";
import {
  useCalls,
  useCsOverview,
  useLatestSessions,
  useLeadSources,
  usePackageDetails,
  usePurchaseHistory,
  useRecentService,
  useRecentWhatsApp,
  useSalesOverview,
  useVirtualConsultations,
} from "./queries";
import { Record, Row, Section, SectionState } from "./Section";

const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const open = (url: string | null | undefined) => {
  if (url) void Linking.openURL(url);
};

/**
 * Compass Overview tab. Sales: Lead Sources, Last Add to Cart, Virtual Consultation, Haut AI,
 * Photos, Recent WhatsApp Engagement, Existing Package Details, Call Details, Recent Payment &
 * Last Order, Recent Service / Appointments. CS: Lead Sources, WhatsApp, Basic Info, Virtual
 * Consultation, Packages, Complaint Status, Sessions Status, Call Details, Payment, Recent Service.
 */
export function OverviewTab({ opp }: { opp: OpportunityDetail }) {
  const oppId = String(opp.id);
  const leadId = opp.lead ? String(opp.lead.id) : null;
  const isSales = opp.department?.code !== "cs";
  const sales = useSalesOverview(oppId, isSales);

  return (
    <View style={{ gap: SPACE.md }}>
      <LeadSources oppId={oppId} />
      {isSales ? (
        <>
          {sales.error ? <SectionState error={sales.error} emptyText="" /> : null}
          <Section title="Last Add to Cart">
            <SectionState
              loading={sales.isLoading}
              empty={!sales.data?.last_add_to_cart}
              emptyText="No add to cart activity"
            />
            {sales.data?.last_add_to_cart ? (
              <View>
                <Row
                  label="Product Name"
                  value={dash(sales.data.last_add_to_cart.product_name)}
                  divider={false}
                />
                <Row
                  label="Number of Sessions"
                  value={dash(sales.data.last_add_to_cart.number_of_sessions)}
                />
                <Row label="Date" value={formatDateIN(sales.data.last_add_to_cart.date)} />
              </View>
            ) : null}
          </Section>
          <VirtualConsultations oppId={oppId} leadId={leadId} />
          <HautAi
            entries={sales.data?.haut_ai}
            report={sales.data?.skin_analysis_report}
            loading={sales.isLoading}
          />
          <Photos photos={sales.data?.recent_photos} loading={sales.isLoading} />
          <WhatsApp oppId={oppId} />
          <Packages oppId={oppId} leadId={leadId} />
        </>
      ) : (
        <>
          <WhatsApp oppId={oppId} />
          <CsBasicInfo oppId={oppId} />
          <VirtualConsultations oppId={oppId} leadId={leadId} />
          <Packages oppId={oppId} leadId={leadId} />
          <CsComplaints oppId={oppId} />
          <Sessions oppId={oppId} leadId={leadId} />
        </>
      )}
      <CallDetails oppId={oppId} />
      <Payment oppId={oppId} leadId={leadId} />
      <RecentService oppId={oppId} leadId={leadId} />
    </View>
  );
}

function LeadSources({ oppId }: { oppId: string }) {
  const q = useLeadSources(oppId);
  const rows = q.data?.lead_sources ?? [];
  return (
    <Section title="Lead Sources">
      <SectionState
        loading={q.isLoading}
        error={q.error}
        empty={!rows.length}
        emptyText="No lead sources recorded"
      />
      {rows.map((s, i) => (
        <Record key={`${s.source}-${i}`}>
          <Row label={`#${i + 1} Source`} value={s.source} divider={false} />
          <Row label="Campaign" value={dash(s.campaign_name)} />
        </Record>
      ))}
    </Section>
  );
}

function VirtualConsultations({ oppId, leadId }: { oppId: string; leadId: string | null }) {
  const c = useColors();
  const q = useVirtualConsultations(oppId, leadId);
  const rows = q.data?.data ?? [];
  return (
    <Section title="Virtual Consultation">
      <SectionState
        loading={q.isLoading}
        loadingText="Loading consultation data..."
        error={q.error}
        empty={!rows.length}
        emptyText="No consultations found"
      />
      {rows.map((v, i) => {
        const pre = /pre|before/i.test(v.consultation_type ?? "");
        return (
          <Record key={String(v.consultation_id ?? i)}>
            <Row label="Date" value={formatDateIN(v.consultation_date)} divider={false} />
            <Row label="Doctor" value={dash(v.doctor_name)} />
            <Row label="Services Recommended" value={dash(v.services_recommended)} />
            <Row
              label="Type"
              value={<Badge label={pre ? "Pre Sales" : "Post Sales"} tone={pre ? "purple" : "brand"} />}
            />
            <Row
              label="Prescription"
              value={
                v.prescription_report ? (
                  <Pressable
                    onPress={() => open(v.prescription_report)}
                    accessibilityRole="link"
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <AppText tone="accent">View</AppText>
                    <Icon name="open" size={14} color={c.accent} />
                  </Pressable>
                ) : (
                  "—"
                )
              }
            />
          </Record>
        );
      })}
    </Section>
  );
}

function HautAi({
  entries,
  report,
  loading,
}: {
  entries: HautAiEntry[] | undefined;
  report: string | null | undefined;
  loading: boolean;
}) {
  const rows = entries ?? [];
  return (
    <Section title="Haut AI">
      <SectionState
        loading={loading}
        loadingText="Loading Haut AI data..."
        empty={!rows.length}
        emptyText="No Haut AI tests found"
      />
      {report ? (
        <Button title="View Full Skin Analysis Report" kind="secondary" onPress={() => open(report)} />
      ) : null}
      {rows.map((h) => {
        // Same as Compass web: the three lowest-scoring concerns.
        const concerns = [...(h.concerns ?? [])].sort((a, b) => a.score - b.score).slice(0, 3);
        return (
          <Record key={String(h.activity_id)}>
            <Row label="Date" value={formatDateIN(h.date)} divider={false} />
            <Row label="Overall Score" value={<Badge label={dash(h.overall_skin_score)} tone="brand" />} />
            {concerns.map((cn) => (
              <View key={cn.name} style={{ paddingVertical: SPACE.sm, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                  <AppText variant="label">{cn.name}</AppText>
                  <Badge
                    label={String(cn.score)}
                    tone={cn.score >= 70 ? "red" : cn.score >= 40 ? "orange" : "green"}
                  />
                </View>
                {cn.analysis ? (
                  <AppText variant="small" tone="muted">
                    {cn.analysis}
                  </AppText>
                ) : null}
              </View>
            ))}
          </Record>
        );
      })}
    </Section>
  );
}

function Photos({
  photos,
  loading,
}: {
  photos: { date: string; url: string }[] | undefined;
  loading: boolean;
}) {
  const c = useColors();
  const rows = photos ?? [];
  return (
    <Section title="Photos">
      <SectionState loading={loading} empty={!rows.length} emptyText="No photos found" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {rows.map((p) => (
          <Pressable
            key={p.url}
            onPress={() => open(p.url)}
            accessibilityRole="imagebutton"
            style={{ width: "31%", gap: 4 }}
          >
            <Image
              source={{ uri: p.url }}
              style={{ width: "100%", aspectRatio: 1, borderRadius: RADIUS.sm, backgroundColor: c.line }}
              accessibilityLabel="Patient photo"
            />
            <AppText variant="small" tone="muted" style={{ fontSize: 11 }}>
              {formatDateIN(p.date)}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

function WhatsApp({ oppId }: { oppId: string }) {
  const q = useRecentWhatsApp(oppId);
  const rows = [...(q.data?.messages ?? [])].sort(
    (a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at),
  );
  return (
    <Section title="Recent WhatsApp Engagement">
      <SectionState
        loading={q.isLoading}
        error={q.error}
        empty={!rows.length}
        emptyText="No WhatsApp messages yet"
      />
      {rows.map((m, i) => (
        <Record key={`${m.occurred_at}-${i}`}>
          <Row
            label={formatShortIN(m.occurred_at)}
            value={
              <Badge
                label={m.direction === "inbound" ? "Inbound" : "Outbound"}
                tone={m.direction === "inbound" ? "brand" : "gray"}
              />
            }
            divider={false}
          />
          <AppText style={{ paddingBottom: SPACE.sm }}>{m.message_text || "No message text"}</AppText>
        </Record>
      ))}
    </Section>
  );
}

function Packages({ oppId, leadId }: { oppId: string; leadId: string | null }) {
  const q = usePackageDetails(oppId, leadId);
  const rows = q.data?.packages ?? [];
  return (
    <Section title="Existing Package Details">
      <SectionState
        loading={q.isLoading}
        error={q.error}
        empty={!rows.length}
        emptyText="No active packages"
      />
      {rows.map((p, i) => (
        <Record key={`${p.product_name}-${i}`}>
          <Row label="Service Name" value={dash(p.product_name)} divider={false} />
          <Row label="Sessions Bought" value={dash(p.total_sessions)} />
          <Row label="Sessions Availed" value={dash(p.completed_sessions)} />
          <Row label="Remaining" value={dash(p.remaining_sessions)} />
        </Record>
      ))}
    </Section>
  );
}

function CallDetails({ oppId }: { oppId: string }) {
  const q = useCalls(oppId, 1, 3);
  const rows = q.data?.data ?? [];
  return (
    <Section title="Call Details">
      <SectionState
        loading={q.isLoading}
        error={q.error}
        empty={!rows.length}
        emptyText="No calls recorded yet"
      />
      {rows.map((call) => (
        <Record key={String(call.id)}>
          <Row label="Date" value={formatShortIN(call.started_at)} divider={false} />
          <Row
            label="Direction"
            value={<Badge label={call.direction} tone={call.direction === "missed" ? "red" : "brand"} />}
          />
          <Row label="Agent" value={dash(call.agent?.name)} />
          <Row label="Disposition" value={dash(call.disposition_code || call.system_disposition)} />
          <Row label="Duration" value={formatCallDuration(call.talk_time_seconds)} />
        </Record>
      ))}
    </Section>
  );
}

function Payment({ oppId, leadId }: { oppId: string; leadId: string | null }) {
  const q = usePurchaseHistory(oppId, leadId);
  const order = q.data?.data?.[0];
  return (
    <Section title="Recent Payment & Last Order">
      <SectionState loading={q.isLoading} error={q.error} empty={!order} emptyText="No orders found" />
      {order ? (
        <View>
          <Row label="Last Order Placed" value={formatDateIN(order.order_date)} divider={false} />
          <Row label="Payable Amount" value={formatRupees(order.payable_amount)} />
          <Row label="Amount Paid" value={formatRupees(order.amount_paid)} />
          <Row label="Left Amount" value={formatRupees(order.left_amount)} />
          <Row label="Payment Status" value={<PaymentBadge status={order.payment_status} />} />
        </View>
      ) : null}
    </Section>
  );
}

export function PaymentBadge({ status }: { status: string | null }) {
  const label = paymentStatusLabel(status);
  return <Badge label={label} tone={label === "Paid" ? "green" : label === "Partial" ? "amber" : "gray"} />;
}

function RecentService({ oppId, leadId }: { oppId: string; leadId: string | null }) {
  const q = useRecentService(oppId, leadId);
  const last = q.data?.data?.last_completed_session ?? null;
  const next = q.data?.data?.next_appointment ?? null;
  return (
    <Section title="Recent Service / Appointments">
      <SectionState
        loading={q.isLoading}
        error={q.error}
        empty={!last && !next}
        emptyText="No service or appointment data found"
      />
      {last || next ? (
        <>
          <AppText variant="label" tone="muted" style={{ letterSpacing: 1 }}>
            LAST COMPLETED SESSION
          </AppText>
          {last ? (
            <Record>
              <Row label="Product Name" value={dash(last.product_name)} divider={false} />
              <Row label="Session Date" value={formatLongIN(last.session_date)} />
              <Row
                label="Progress"
                value={`${dash(last.completed_sessions)} / ${dash(last.total_sessions)} completed`}
              />
            </Record>
          ) : (
            <AppText tone="muted" style={{ fontStyle: "italic" }}>
              No completed sessions found
            </AppText>
          )}
          <AppText variant="label" tone="muted" style={{ letterSpacing: 1, marginTop: SPACE.sm }}>
            NEXT APPOINTMENT
          </AppText>
          {next ? (
            <Record>
              <Row label="Product Name" value={dash(next.product_name)} divider={false} />
              <Row label="Appointment Date" value={formatLongIN(next.appointment_date)} />
              <Row label="Status" value={<Badge label={dash(next.status)} tone="brand" />} />
            </Record>
          ) : (
            <AppText tone="muted" style={{ fontStyle: "italic" }}>
              No upcoming appointments
            </AppText>
          )}
        </>
      ) : null}
    </Section>
  );
}

function CsBasicInfo({ oppId }: { oppId: string }) {
  const q = useCsOverview(oppId, true);
  return (
    <Section title="Basic Info" collapsible={false}>
      <SectionState loading={q.isLoading} error={q.error} emptyText="" />
      {q.data ? (
        <View>
          <Row label="Address" value={dash(q.data.address)} divider={false} />
          <Row label="RM Name" value={q.data.rm_name || "N/A"} />
          <Row
            label="Escalated Status"
            value={
              <Badge
                label={q.data.escalated_status}
                tone={q.data.escalated_status === "Yes" ? "red" : "gray"}
              />
            }
          />
        </View>
      ) : null}
    </Section>
  );
}

function CsComplaints({ oppId }: { oppId: string }) {
  const q = useCsOverview(oppId, true);
  const rows = q.data?.complaints ?? [];
  return (
    <Section title="Complaint Status">
      <SectionState loading={q.isLoading} empty={!rows.length} emptyText="No complaints recorded" />
      {rows.map((cmp) => (
        <Record key={String(cmp.activity_id)}>
          <Row label="Date" value={formatDateIN(cmp.date)} divider={false} />
          <Row label="Complaint Type" value={dash(cmp.complaint_type)} />
          <Row label="Notes" value={dash(cmp.notes)} />
          <Row label="PTC Received" value={dash(cmp.ptc_received)} />
        </Record>
      ))}
    </Section>
  );
}

function Sessions({ oppId, leadId }: { oppId: string; leadId: string | null }) {
  const q = useLatestSessions(oppId, leadId, true);
  const rows = q.data?.data ?? [];
  return (
    <Section title="Sessions Status">
      <SectionState
        loading={q.isLoading}
        error={q.error}
        empty={!rows.length}
        emptyText="No recent sessions found"
      />
      {rows.map((s, i) => (
        <Record key={String(s.session_id ?? i)}>
          <Row label="Session ID" value={dash(s.session_id)} divider={false} />
          <Row label="Service" value={dash(s.service_name)} />
          <Row label="Status" value={<Badge label={dash(s.session_status)} tone="brand" />} />
          <Row label="Date" value={formatLongIN(s.appointment_date)} />
          <Row label="Therapist" value={dash(s.therapist_assigned)} />
          <Row label="Rating" value={s.session_status === "completed" && s.rating ? `${s.rating}/10` : "—"} />
        </Record>
      ))}
    </Section>
  );
}
