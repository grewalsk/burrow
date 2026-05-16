"use client";

import { usePathname } from "next/navigation";
import { LeftRail } from "./LeftRail";
import { TopStrip } from "./TopStrip";
import { ViewportGuard } from "./ViewportGuard";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/onboarding");

  if (bare) {
    return <>{children}</>;
  }

  return (
    <ViewportGuard>
      <div className="flex min-h-screen flex-col">
        <TopStrip />
        <div className="flex min-h-0 flex-1">
          <LeftRail />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </ViewportGuard>
  );
}
