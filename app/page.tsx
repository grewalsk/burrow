"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const done = window.localStorage.getItem("burrow.onboarded") === "1";
    router.replace(done ? "/signals" : "/onboarding");
  }, [router]);

  return null;
}
