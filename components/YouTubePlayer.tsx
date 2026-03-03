"use client";

import { useCallback, useEffect, useRef } from "react";

type YouTubePlayerInstance = {
  cueVideoById(videoId: string): void;
  destroy(): void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      videoId: string;
      playerVars: {
        autoplay: number;
        controls: number;
        rel: number;
        modestbranding: number;
        playsinline: number;
        origin: string;
        enablejsapi: number;
      };
      events: {
        onReady: () => void;
        onError: () => void;
      };
    }
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
    __youtubeIframeApiPromise__?: Promise<YouTubeNamespace>;
  }
}

type YouTubePlayerProps = {
  videoId: string | null;
  onEmbedError(message: string | null): void;
};

export default function YouTubePlayer({ videoId, onEmbedError }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const isReadyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);

  const cuePreview = useCallback(
    (nextVideoId: string | null) => {
      if (!nextVideoId || !playerRef.current || !isReadyRef.current) {
        return;
      }

      if (loadedVideoIdRef.current === nextVideoId) {
        return;
      }

      onEmbedError(null);
      playerRef.current.cueVideoById(nextVideoId);
      loadedVideoIdRef.current = nextVideoId;
    },
    [onEmbedError]
  );

  useEffect(() => {
    let cancelled = false;

    if (!videoId || !containerRef.current || playerRef.current) {
      return;
    }

    const initPlayer = async () => {
      try {
        const YT = await loadYouTubeIframeApi();
        if (cancelled || !containerRef.current || playerRef.current || !videoId) {
          return;
        }

        playerRef.current = new YT.Player(containerRef.current, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
            enablejsapi: 1,
          },
          events: {
            onReady: () => {
              isReadyRef.current = true;
              loadedVideoIdRef.current = videoId;
              onEmbedError(null);
            },
            onError: () => {
              onEmbedError("This video cannot be embedded.");
            },
          },
        });
      } catch {
        onEmbedError("The YouTube player failed to load.");
      }
    };

    void initPlayer();

    return () => {
      cancelled = true;
    };
  }, [onEmbedError, videoId]);

  useEffect(() => {
    cuePreview(videoId);
  }, [cuePreview, videoId]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      isReadyRef.current = false;
      loadedVideoIdRef.current = null;
    };
  }, []);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-bg0 ring-1 ring-white/10">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API can only load in the browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__youtubeIframeApiPromise__) {
    return window.__youtubeIframeApiPromise__;
  }

  window.__youtubeIframeApiPromise__ = new Promise((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) {
        resolve(window.YT);
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return window.__youtubeIframeApiPromise__;
}
