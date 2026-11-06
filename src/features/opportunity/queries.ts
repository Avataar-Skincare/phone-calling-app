/**
 * Data for the opportunity page. Every key starts with ["opportunity", id] so a save
 * (outcome, stage change, task completed) refreshes the whole page with one invalidation.
 * Each tab's data loads only when that tab is opened.
 */
import { useQuery } from "@tanstack/react-query";

import {
  getAppointments,
  getCsOverview,
  getLatestSessions,
  getLeadActivities,
  getLeadSources,
  getOpportunityCalls,
  getOpportunityTasks,
  getPackageDetails,
  getPurchaseHistory,
  getRecentService,
  getRecentWhatsApp,
  getSalesOverview,
  getVirtualConsultations,
} from "@/api/opportunities";

const key = (oppId: string, ...rest: (string | number)[]) => ["opportunity", oppId, ...rest] as const;
const STALE = 60_000;

export const useLeadSources = (oppId: string) =>
  useQuery({ queryKey: key(oppId, "lead-sources"), queryFn: () => getLeadSources(oppId), staleTime: STALE });

export const useSalesOverview = (oppId: string, enabled: boolean) =>
  useQuery({
    queryKey: key(oppId, "sales-overview"),
    queryFn: () => getSalesOverview(oppId),
    enabled,
    staleTime: STALE,
  });

export const useCsOverview = (oppId: string, enabled: boolean) =>
  useQuery({
    queryKey: key(oppId, "cs-overview"),
    queryFn: () => getCsOverview(oppId),
    enabled,
    staleTime: STALE,
  });

export const useRecentWhatsApp = (oppId: string) =>
  useQuery({
    queryKey: key(oppId, "recent-whatsapp"),
    queryFn: () => getRecentWhatsApp(oppId),
    staleTime: STALE,
  });

export const useVirtualConsultations = (oppId: string, leadId: string | null) =>
  useQuery({
    queryKey: key(oppId, "virtual-consultations"),
    queryFn: () => getVirtualConsultations(leadId!),
    enabled: !!leadId,
    staleTime: STALE,
  });

export const usePackageDetails = (oppId: string, leadId: string | null) =>
  useQuery({
    queryKey: key(oppId, "package-details"),
    queryFn: () => getPackageDetails(leadId!),
    enabled: !!leadId,
    staleTime: STALE,
  });

export const useRecentService = (oppId: string, leadId: string | null) =>
  useQuery({
    queryKey: key(oppId, "recent-service"),
    queryFn: () => getRecentService(leadId!),
    enabled: !!leadId,
    staleTime: STALE,
  });

export const useLatestSessions = (oppId: string, leadId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: key(oppId, "latest-sessions"),
    queryFn: () => getLatestSessions(leadId!),
    enabled: enabled && !!leadId,
    staleTime: STALE,
  });

export const usePurchaseHistory = (oppId: string, leadId: string | null) =>
  useQuery({
    queryKey: key(oppId, "purchase-history"),
    queryFn: () => getPurchaseHistory(leadId!),
    enabled: !!leadId,
    staleTime: STALE,
  });

export const useCalls = (oppId: string, page: number, limit: number) =>
  useQuery({
    queryKey: key(oppId, "calls", page, limit),
    queryFn: () => getOpportunityCalls(oppId, page, limit),
  });

export const useLeadActivities = (oppId: string, leadId: string | null) =>
  useQuery({
    queryKey: key(oppId, "lead-activities"),
    queryFn: () => getLeadActivities(leadId!),
    enabled: !!leadId,
  });

export const useOpportunityTasks = (oppId: string, status: string) =>
  useQuery({ queryKey: key(oppId, "tasks", status), queryFn: () => getOpportunityTasks(oppId, status) });

export const useAppointments = (oppId: string, leadId: string | null, page: number) =>
  useQuery({
    queryKey: key(oppId, "appointments", page),
    queryFn: () => getAppointments(leadId!, page),
    enabled: !!leadId,
  });
