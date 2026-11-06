import { View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { fullName } from "@/features/leads/leadItem";
import { formatDateIN, formatPhoneCompass, formatSourceName, stageTone } from "@/lib/format";
import { toE164 } from "@/lib/phone";
import { RADIUS, SPACE, useColors, useTone } from "@/theme/tokens";
import type { OpportunityDetail } from "@/types/compass";
import { Row, Section } from "./Section";

/** Compass's left panel: identity, Call, the four tiles and Properties. */
export function ProfilePanel({
  opp,
  phone,
  onCall,
  onChangeStage,
}: {
  opp: OpportunityDetail;
  phone: string | null;
  onCall: () => void;
  onChangeStage: () => void;
}) {
  const c = useColors();
  const lead = opp.lead;
  const tone = useTone(stageTone(opp.stage?.code, opp.stage?.stage_type));
  const dialable = !!toE164(phone);
  // Compass shows these two as placeholders too; the backend has no data for them yet.
  const tiles: [string, string][] = [
    ["Lead Score", lead?.lead_score != null ? String(lead.lead_score) : "0"],
    ["Disengaged", "0"],
    ["Lead Quality", "--"],
    ["Not Connected Count", "--"],
  ];

  return (
    <View style={{ gap: SPACE.lg }}>
      <View
        style={{
          backgroundColor: c.surface,
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: c.line,
          padding: SPACE.lg,
          gap: SPACE.sm,
        }}
      >
        <AppText variant="title">{fullName(lead?.first_name, lead?.last_name)}</AppText>
        <AppText variant="label" style={{ color: tone.fg }}>
          {opp.stage?.label ?? "—"}
        </AppText>
        {lead?.email ? <AppText tone="muted">{lead.email}</AppText> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
          <AppText
            selectable
            style={{ flex: 1, fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] }}
          >
            {formatPhoneCompass(phone)}
          </AppText>
          <Button title={dialable ? "Call" : "No number"} disabled={!dialable} onPress={onCall} />
          <WhatsAppButton
            label={`WhatsApp ${fullName(lead?.first_name, lead?.last_name)}`}
            phone={phone}
            size={44}
          />
        </View>
        {lead?.city ? <AppText tone="muted">{lead.city}</AppText> : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {tiles.map(([label, value]) => (
          <View
            key={label}
            style={{
              flexGrow: 1,
              flexBasis: "45%",
              backgroundColor: c.surface,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: c.line,
              padding: SPACE.md,
              gap: 2,
            }}
          >
            <AppText variant="small" tone="muted">
              {label}
            </AppText>
            <AppText variant="heading">{value}</AppText>
          </View>
        ))}
      </View>

      <Section title="Properties">
        <Row label="Lead" value={fullName(lead?.first_name, lead?.last_name)} divider={false} />
        <Row label="Department" value={opp.department?.label ?? "—"} />
        <Row label="Owner" value={opp.owner?.name ?? "—"} />
        <Row label="Lead Source" value={formatSourceName(lead?.lead_source)} />
        <Row label="Created" value={formatDateIN(opp.created_at)} />
        <Row label="Updated" value={formatDateIN(opp.updated_at)} />
      </Section>

      <Button title="Change Stage" kind="secondary" onPress={onChangeStage} />
    </View>
  );
}
