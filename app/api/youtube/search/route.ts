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

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ items: [] });
  }
  const youtubeQuery = /\bofficial\b/i.test(query) ? query : `${query} official`;

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
    { cache: "no-store" }
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
    { cache: "no-store" }
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
