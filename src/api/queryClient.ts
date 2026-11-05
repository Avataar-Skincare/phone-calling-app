import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry network blips, never auth or validation errors.
      retry: (failureCount, error) =>
        failureCount < 2 && (!(error instanceof ApiError) || error.isNetwork || error.status >= 500),
    },
  },
});
