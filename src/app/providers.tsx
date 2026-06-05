"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so it isn't shared across requests on the server.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } }
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
