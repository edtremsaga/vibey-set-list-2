import { NextRequest, NextResponse } from "next/server";
import { parseDuration } from "@/lib/duration";

// Bounded process-local cache and limiter, matching search's protection model.
const cache = new Map<string, { duration: number; expires: number }>();
const pending = new Map<string, Promise<Record<string, number>>>();
let windowStart = 0;
let requests = 0;
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") ?? "";
  if (!raw || raw.length > 600) return NextResponse.json({ error: "Provide up to 50 video IDs." }, { status: 400 });
  const ids = [...new Set(raw.split(","))];
  if (ids.length > 50 || ids.some(id => !/^[\w-]{11}$/.test(id))) return NextResponse.json({ error: "Invalid video IDs." }, { status: 400 });
  const now = Date.now();
  for (const [id, entry] of cache) if (entry.expires <= now) cache.delete(id);
  const durations: Record<string, number> = {};
  const missing = ids.filter(id => { const hit = cache.get(id); if (hit) durations[id] = hit.duration; return !hit; });
  if (!missing.length) return NextResponse.json({ durations });
  const key = missing.sort().join(",");
  if (now - windowStart >= 60000) { windowStart = now; requests = 0; }
  if (!pending.has(key)) {
    if (requests >= 20) return NextResponse.json({ error: "Rate limit" }, { status: 429, headers: { "Retry-After": "60" } });
    requests++;
    pending.set(key, fetchDurations(key));
  }
  try { return NextResponse.json({ durations: { ...durations, ...await pending.get(key)! } }); }
  catch { return NextResponse.json({ error: "Could not retrieve durations." }, { status: 502 }); }
  finally { pending.delete(key); }
}
async function fetchDurations(ids: string): Promise<Record<string, number>> {
  if (!process.env.YOUTUBE_API_KEY) throw new Error("Missing key");
  const params = new URLSearchParams({ part: "contentDetails", id: ids, key: process.env.YOUTUBE_API_KEY });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Upstream failed");
  const data = await response.json() as { items?: { id?: string; contentDetails?: { duration?: string } }[] };
  const result: Record<string, number> = {};
  for (const item of data.items ?? []) {
    const duration = parseDuration(item.contentDetails?.duration ?? "");
    if (item.id && ids.split(",").includes(item.id) && duration) {
      result[item.id] = duration;
      if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
      cache.set(item.id, { duration, expires: Date.now() + 86400000 });
    }
  }
  return result;
}
