"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import YouTubePlayer, { type YouTubePlayerHandle } from "./YouTubePlayer";
import { readRecording, RECORDING_ID_PATTERN } from "@/lib/recordings";

type Props = {
  videoId: string | null;
  title?: string;
  onEmbedError(message: string | null): void;
  onEnded(): void;
  onError(code: number): void;
  onStateChange(state: number): void;
};

// Retain the controller contract so both sources use the same set-list sequencing.
const SongPlayer = forwardRef<YouTubePlayerHandle, Props>(function SongPlayer(props, ref) {
  const youtube = useRef<YouTubePlayerHandle>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; });
  const activeId = useRef<string | null>(null);
  const generation = useRef(0);
  const objectUrl = useRef<string | null>(null);
  const audioState = useRef(-1);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [local, setLocal] = useState(false);

  const releaseAudio = useCallback(() => {
    audio.current?.pause();
    audio.current?.removeAttribute("src");
    audio.current?.load();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }, []);

  const select = useCallback(async (id: string, play: boolean) => {
    const token = ++generation.current;
    activeId.current = id;
    const isLocal = RECORDING_ID_PATTERN.test(id);
    setLocal(isLocal);
    audioState.current = play ? 3 : -1;
    releaseAudio();
    callbacks.current.onEmbedError(null);
    youtube.current?.stop();
    if (!isLocal) {
      setYoutubeId(id);
      if (play) youtube.current?.play(id); else youtube.current?.cue(id);
      return;
    }
    try {
      const blob = await readRecording(id);
      if (token !== generation.current) return;
      if (!blob) throw new Error("Recording unavailable in this browser. Import the same MP3 again to reconnect it to your set lists.");
      objectUrl.current = URL.createObjectURL(blob);
      const element = audio.current;
      if (!element) return;
      element.src = objectUrl.current;
      element.load();
      if (play) await element.play();
    } catch (error) {
      if (token !== generation.current) return;
      audioState.current = -1;
      if (error instanceof DOMException && error.name === "NotAllowedError") return;
      callbacks.current.onEmbedError(error instanceof Error ? error.message : "Could not load this recording. Import it again.");
      callbacks.current.onError(-1);
    }
  }, [releaseAudio]);

  useImperativeHandle(ref, () => ({
    cue: (id) => { if (activeId.current !== id) void select(id, false); },
    play: (id) => { void select(id, true); },
    stop: () => { generation.current += 1; audio.current?.pause(); audioState.current = -1; youtube.current?.stop(); },
    getPlayerState: () => activeId.current && RECORDING_ID_PATTERN.test(activeId.current) ? audioState.current : youtube.current?.getPlayerState() ?? null,
  }), [select]);

  useEffect(() => {
    if (props.videoId && props.videoId !== activeId.current) void select(props.videoId, false);
  }, [props.videoId, select]);

  useEffect(() => () => { generation.current += 1; releaseAudio(); }, [releaseAudio]);

  return (
    <>
      <div className={local ? "hidden" : ""}>
        <YouTubePlayer ref={youtube} videoId={youtubeId}
          onEmbedError={(message) => { if (!RECORDING_ID_PATTERN.test(activeId.current ?? "")) props.onEmbedError(message); }}
          onEnded={() => { if (!RECORDING_ID_PATTERN.test(activeId.current ?? "")) props.onEnded(); }}
          onError={(code) => { if (!RECORDING_ID_PATTERN.test(activeId.current ?? "")) props.onError(code); }}
          onStateChange={(state) => { if (!RECORDING_ID_PATTERN.test(activeId.current ?? "")) props.onStateChange(state); }} />
      </div>
      <div className={local ? "flex aspect-video flex-col items-center justify-center gap-4 rounded-2xl bg-bg0 p-5 ring-1 ring-white/10" : "hidden"}>
        <span className="text-4xl text-blue-300" aria-hidden="true">♫</span>
        <p className="max-w-full truncate text-center text-sm font-semibold">{props.title ?? "Your recording"}</p>
        <audio ref={audio} controls preload="metadata" className="w-full" aria-label="Recording player"
          onPlaying={() => { audioState.current = 1; props.onStateChange(1); }}
          onPause={() => { audioState.current = 2; }}
          onWaiting={() => { audioState.current = 3; }}
          onEnded={() => { audioState.current = 0; props.onEnded(); }}
          onError={() => {
            if (!audio.current?.getAttribute("src")) return;
            audioState.current = -1;
            props.onEmbedError("This recording could not play. Try importing the original MP3 again.");
            props.onError(-1);
          }} />
        <p className="text-xs text-text1">Recording stored in this browser</p>
      </div>
    </>
  );
});
export default SongPlayer;
