const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (VIDEO_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return toVideoId(url.pathname.split("/").filter(Boolean)[0] ?? "");
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return toVideoId(url.searchParams.get("v") ?? "");
      }

      if (url.pathname.startsWith("/shorts/")) {
        return toVideoId(url.pathname.split("/")[2] ?? "");
      }
    }
  } catch {
    return null;
  }

  return null;
}

function toVideoId(value: string): string | null {
  return VIDEO_ID_PATTERN.test(value) ? value : null;
}

export function buildYouTubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
}
