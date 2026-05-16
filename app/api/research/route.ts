import { research } from "@/lib/researchClient";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) return Response.json({ error: "url required" }, { status: 400 });

  try {
    const result = await research(url);
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "research failed" },
      { status: 500 },
    );
  }
}
