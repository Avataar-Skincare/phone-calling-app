import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Filters } from "@/features/leads/viewConfig";
import { persistStorage } from "./persistStorage";

interface ViewFiltersState {
  /** Filters per Smart View key, kept between sessions (Compass web keeps them in the browser). */
  byView: Record<string, Partial<Filters>>;
  /** Rows per page: 20, 50 or 100. */
  pageSize: number;
  /** Department tab picked last (Sales / Customer Support). */
  department: string | null;
  /** Sub-tab picked last, per department. */
  selectedView: Record<string, string>;
  patch: (view: string, change: Partial<Filters>) => void;
  reset: (view: string) => void;
  setPageSize: (n: number) => void;
  setDepartment: (d: string) => void;
  selectView: (department: string, view: string) => void;
}

export const useViewFilters = create<ViewFiltersState>()(
  persist(
    (set) => ({
      byView: {},
      pageSize: 20,
      department: null,
      selectedView: {},
      patch: (view, change) =>
        set((s) => ({ byView: { ...s.byView, [view]: { ...s.byView[view], ...change } } })),
      reset: (view) =>
        set((s) => {
          const rest = { ...s.byView };
          delete rest[view];
          return { byView: rest };
        }),
      setPageSize: (pageSize) => set({ pageSize }),
      setDepartment: (department) => set({ department }),
      selectView: (department, view) =>
        set((s) => ({ selectedView: { ...s.selectedView, [department]: view } })),
    }),
    { name: "view-filters", storage: persistStorage, version: 1 },
  ),
);
