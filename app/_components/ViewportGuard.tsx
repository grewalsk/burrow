"use client";

import { useEffect, useState } from "react";

const MIN_WIDTH = 1100;

export function ViewportGuard({ children }: { children: React.ReactNode }) {
  const [tooNarrow, setTooNarrow] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const onResize = () => setTooNarrow(window.innerWidth < MIN_WIDTH);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (hydrated && tooNarrow) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p
          className="text-text-secondary"
          style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.3 }}
        >
          Burrow needs a wider window.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
