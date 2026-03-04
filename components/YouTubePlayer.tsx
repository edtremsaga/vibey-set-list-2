"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

type PlayerStateChangeEvent = {
  data: number;
};

type PlayerErrorEvent = {
  data: number;
};

type YouTubePlayerInstance = {
  cueVideoById(videoId: string): void;
  loadVideoById(videoId: string): void;
  playVideo(): void;
  stopVideo(): void;
  getPlayerState(): number;
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
        onStateChange: (event: PlayerStateChangeEvent) => void;
        onError: (event: PlayerErrorEvent) => void;
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
  onEnded(): void;
  onError(code: number): void;
};

export type YouTubePlayerHandle = {
  cue(videoId: string): void;
  play(videoId: string): void;
  stop(): void;
  getPlayerState(): number | null;
};

type PendingAction =
  | { type: "cue"; videoId: string }
  | { type: "play"; videoId: string }
  | { type: "stop" }
  | null;

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, onEmbedError, onEnded, onError },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const isReadyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  const pendingActionRef = useRef<PendingAction>(null);
  const onEmbedErrorRef = useRef(onEmbedError);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onEmbedErrorRef.current = onEmbedError;
  }, [onEmbedError]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const cuePreview = useCallback(
    (nextVideoId: string | null) => {
      if (!nextVideoId) {
        return;
      }

      if (!playerRef.current || !isReadyRef.current) {
        pendingActionRef.current = { type: "cue", videoId: nextVideoId };
        return;
      }

      if (loadedVideoIdRef.current === nextVideoId) {
        return;
      }

      onEmbedErrorRef.current(null);
      playerRef.current.cueVideoById(nextVideoId);
      loadedVideoIdRef.current = nextVideoId;
      pendingActionRef.current = null;
    },
    []
  );

  const playVideo = useCallback(
    (nextVideoId: string) => {
      if (!playerRef.current || !isReadyRef.current) {
        pendingActionRef.current = { type: "play", videoId: nextVideoId };
        return;
      }

      onEmbedErrorRef.current(null);
      playerRef.current.loadVideoById(nextVideoId);
      playerRef.current.playVideo();
      loadedVideoIdRef.current = nextVideoId;
      pendingActionRef.current = null;
    },
    []
  );

  const stopVideo = useCallback(() => {
    if (!playerRef.current || !isReadyRef.current) {
      pendingActionRef.current = { type: "stop" };
      return;
    }

    playerRef.current.stopVideo();
    pendingActionRef.current = null;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      cue: cuePreview,
      play: playVideo,
      stop: stopVideo,
      getPlayerState: () => {
        if (!playerRef.current || !isReadyRef.current) {
          return null;
        }

        return playerRef.current.getPlayerState();
      },
    }),
    [cuePreview, playVideo, stopVideo]
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
              onEmbedErrorRef.current(null);

              const pendingAction = pendingActionRef.current;
              if (pendingAction?.type === "play") {
                playVideo(pendingAction.videoId);
              } else if (pendingAction?.type === "cue") {
                cuePreview(pendingAction.videoId);
              } else if (pendingAction?.type === "stop") {
                stopVideo();
              }
            },
            onStateChange: (event) => {
              if (event.data === 0) {
                onEndedRef.current();
              }
            },
            onError: (event) => {
              onEmbedErrorRef.current("This video cannot be embedded.");
              onErrorRef.current(event.data);
            },
          },
        });
      } catch {
        onEmbedErrorRef.current("The YouTube player failed to load.");
      }
    };

    void initPlayer();

    return () => {
      cancelled = true;
    };
  }, [cuePreview, playVideo, stopVideo, videoId]);

  useEffect(() => {
    cuePreview(videoId);
  }, [cuePreview, videoId]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      isReadyRef.current = false;
      loadedVideoIdRef.current = null;
      pendingActionRef.current = null;
    };
  }, []);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-bg0 ring-1 ring-white/10">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
});

export default YouTubePlayer;

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
