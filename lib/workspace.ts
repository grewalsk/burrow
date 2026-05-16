import { cookies } from "next/headers";

export async function getSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("burrow_session")?.value ?? null;
}

export function workspaceCollection(sessionId: string): string {
  return `brain-${sessionId}`;
}
