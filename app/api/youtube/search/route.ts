import { NextRequest, NextResponse } from "next/server";

type YouTubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      medium?: { url?: string };
      default?: { url?: string };
      high?: { url?: string };
    };
  };
};

type YouTubeVideoItem = {
  id?: string;
  contentDetails?: {
    duration?: string;
  };
};

// Bounded process-local protection. A shared limiter/WAF is required across instances.
const cache = new Map<string, { body: unknown; expires: number }>();
const pending = new Map<string, Promise<NextResponse>>();
let windowStart = 0;
let searches = 0;
const CACHE_TTL = 15 * 60 * 1000;
const MAX_CACHE = 100;
const MAX_SEARCHES = 20;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q") ?? "";
  if (raw.length > 200) return NextResponse.json({ error: "Search must be 200 characters or fewer." }, { status: 400 });
  const query = raw.trim().replace(/\s+/g, " ");
  if (!query) return NextResponse.json({ items: [] });
  const youtubeQuery = /\bofficial\b/i.test(query) ? query : `${query} official`;
  const key = youtubeQuery.toLowerCase();
  const now = Date.now();
  for (const [id, entry] of cache) if (entry.expires <= now) cache.delete(id);
  const cached = cache.get(key);
  if (cached) return NextResponse.json(cached.body);
  const existing = pending.get(key);
  if (existing) return (await existing).clone();
  if (now - windowStart >= 60000) { windowStart = now; searches = 0; }
  if (searches >= MAX_SEARCHES) return NextResponse.json({ error: "Rate limit" }, {
    status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((windowStart + 60000 - now) / 1000))) },
  });
  searches += 1;
  const task = searchYouTube(youtubeQuery);
  pending.set(key, task);
  try {
    const response = await task;
    if (response.ok) {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(key, { body: await response.clone().json(), expires: Date.now() + CACHE_TTL });
    }
    return response;
  } finally { pending.delete(key); }
}

async function searchYouTube(youtubeQuery: string): Promise<NextResponse> {
  // One deadline includes both requests and reading their response bodies.
  const signal = AbortSignal.timeout(10000);
  try {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing YouTube API key" }, { status: 500 });
  }

  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "8",
    q: youtubeQuery,
    key: apiKey,
  });

  const searchResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
    { cache: "no-store", signal }
  );

  if (!searchResponse.ok) {
    const body = await searchResponse.json().catch(() => null);
    const reason = body?.error?.errors?.[0]?.reason;
    if (searchResponse.status === 429 || reason === "quotaExceeded" || reason === "rateLimitExceeded") {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }

    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }

  const searchData = (await searchResponse.json()) as { items?: YouTubeSearchItem[] };
  const searchItems = searchData.items ?? [];
  const videoIds = searchItems
    .map((item) => item.id?.videoId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (videoIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const videosParams = new URLSearchParams({
    part: "contentDetails",
    id: videoIds.join(","),
    key: apiKey,
  });

  const videosResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${videosParams.toString()}`,
    { cache: "no-store", signal }
  );

  if (!videosResponse.ok) {
    return NextResponse.json({ error: "Video details failed" }, { status: 502 });
  }

  const videosData = (await videosResponse.json()) as { items?: YouTubeVideoItem[] };
  const durationById = new Map<string, string>();

  for (const item of videosData.items ?? []) {
    if (!item.id) {
      continue;
    }

    durationById.set(item.id, formatIsoDuration(item.contentDetails?.duration ?? ""));
  }

  const items = searchItems
    .map((item) => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title;
      const channelTitle = item.snippet?.channelTitle;
      const thumbnailUrl =
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.default?.url;

      if (!videoId || !title || !channelTitle || !thumbnailUrl) {
        return null;
      }

      return {
        videoId,
        title,
        channelTitle,
        thumbnailUrl,
        duration: durationById.get(videoId) ?? "--:--",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: signal.aborted ? "Search timed out" : "Search unavailable" }, { status: signal.aborted ? 504 : 502 });
  }
}

function formatIsoDuration(isoDuration: string): string {
  const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return "--:--";
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const totalMinutes = hours * 60 + minutes;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${totalMinutes}:${String(seconds).padStart(2, "0")}`;
}
