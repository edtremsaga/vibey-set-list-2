"use client";

import SavedSongs from "@/components/SavedSongs";
import SavedSetLists from "@/components/SavedSetLists";
import SetList from "@/components/SetList";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import {
  consumeSavedSetListsCorruptionFlag,
  consumeSetListDraftCorruptionFlag,
  consumeSavedSongsCorruptionFlag,
  loadSavedSetLists,
  loadSavedSongs,
  loadSetListDraft,
  saveSavedSetLists,
  saveSavedSongs,
  saveSetListDraft,
  type SavedSetList,
  type SavedSong,
  type SetListItem,
} from "@/lib/storage";
import { buildYouTubeSearchUrl, parseYouTubeVideoId } from "@/lib/youtube";
import { useEffect, useMemo, useRef, useState } from "react";

type StatusTone = "error" | "warning" | "info" | "success";
type PlaybackState = "idle" | "playing" | "countdown" | "blocked";
type PlaybackIntent = "user" | "auto";
const PAUSE_SECONDS_STORAGE_KEY = "sl_pauseSeconds_v1";
const DEFAULT_PAUSE_SECONDS = 3;
const YT_STATE_PLAYING = 1;
const YT_STATE_BUFFERING = 3;
const AUTO_PLAYBACK_CHECK_DELAY_MS = 350;
const USER_PLAYBACK_CHECK_DELAY_MS = 1500;

export default function Home() {
  const playerControllerRef = useRef<YouTubePlayerHandle | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [loadedVideoId, setLoadedVideoId] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [savedSongs, setSavedSongs] = useState<SavedSong[]>([]);
  const [savedSetLists, setSavedSetLists] = useState<SavedSetList[]>([]);
  const [loadedSetId, setLoadedSetId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [setListItems, setSetListItems] = useState<SetListItem[]>([]);
  const [selectedSetListItemId, setSelectedSetListItemId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [pauseSeconds, setPauseSeconds] = useState(DEFAULT_PAUSE_SECONDS);
  const [pauseInput, setPauseInput] = useState(String(DEFAULT_PAUSE_SECONDS));
  const [sessionUnplayable, setSessionUnplayable] = useState<Set<string>>(() => new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const setListItemsRef = useRef<SetListItem[]>([]);
  const songsByIdRef = useRef<Record<string, SavedSong>>({});
  const playingIndexRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const playbackStateRef = useRef<PlaybackState>("idle");
  const sessionUnplayableRef = useRef<Set<string>>(new Set());
  const countdownIntervalRef = useRef<number | null>(null);
  const playbackCheckTimeoutRef = useRef<number | null>(null);

  const parsedVideoId = useMemo(() => parseYouTubeVideoId(debouncedInput), [debouncedInput]);
  const errorMessage = useMemo(() => {
    if (!debouncedInput.trim()) {
      return null;
    }

    return parsedVideoId ? null : "Enter a valid YouTube URL or 11-character video ID.";
  }, [debouncedInput, parsedVideoId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedInput(inputValue);
      const nextVideoId = parseYouTubeVideoId(inputValue);
      if (nextVideoId) {
        setLoadedVideoId((current) => (current === nextVideoId ? current : nextVideoId));
      }
    }, 500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [inputValue]);

  useEffect(() => {
    const songs = loadSavedSongs();
    setSavedSongs(songs);
    const lists = loadSavedSetLists();
    setSavedSetLists(sortSavedSetLists(lists));
    const draftItems = loadSetListDraft();
    setSetListItems(draftItems);

    if (consumeSavedSongsCorruptionFlag()) {
      setStatusTone("warning");
      setStatusMessage("Saved Songs data was reset because it was corrupted.");
    } else if (consumeSavedSetListsCorruptionFlag()) {
      setStatusTone("warning");
      setStatusMessage("Saved set lists data was reset because it was corrupted.");
    } else if (consumeSetListDraftCorruptionFlag()) {
      setStatusTone("warning");
      setStatusMessage("Set List draft data was reset because it was corrupted.");
    }

    if (typeof window !== "undefined") {
      const storedPauseSeconds = window.localStorage.getItem(PAUSE_SECONDS_STORAGE_KEY);
      const parsedPauseSeconds = Number(storedPauseSeconds);

      if (
        Number.isInteger(parsedPauseSeconds) &&
        parsedPauseSeconds >= 1 &&
        parsedPauseSeconds <= 9
      ) {
        setPauseSeconds(parsedPauseSeconds);
        setPauseInput(String(parsedPauseSeconds));
      } else {
        setPauseSeconds(DEFAULT_PAUSE_SECONDS);
        setPauseInput(String(DEFAULT_PAUSE_SECONDS));
      }
    }
  }, []);

  const songsById = useMemo(
    () =>
      Object.fromEntries(savedSongs.map((song) => [song.videoId, song])),
    [savedSongs]
  );

  useEffect(() => {
    setListItemsRef.current = setListItems;
  }, [setListItems]);

  useEffect(() => {
    songsByIdRef.current = songsById;
  }, [songsById]);

  useEffect(() => {
    playingIndexRef.current = playingIndex;
  }, [playingIndex]);

  useEffect(() => {
    pendingIndexRef.current = pendingIndex;
  }, [pendingIndex]);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    sessionUnplayableRef.current = sessionUnplayable;
  }, [sessionUnplayable]);

  useEffect(() => {
    return () => {
      clearPlaybackTimers();
    };
  }, []);

  const handleSearchClick = () => {
    const searchUrl = buildYouTubeSearchUrl(inputValue);
    window.open(searchUrl, "_blank", "noopener,noreferrer");
  };

  const handleAddSavedSong = async () => {
    if (!loadedVideoId) {
      setStatusTone("error");
      setStatusMessage("Paste a valid YouTube link or video ID first.");
      return;
    }

    if (savedSongs.some((song) => song.videoId === loadedVideoId)) {
      setStatusTone("info");
      setStatusMessage("Already saved.");
      return;
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${loadedVideoId}`;

    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`
      );

      if (!response.ok) {
        throw new Error("oEmbed failed");
      }

      const data = (await response.json()) as {
        title?: unknown;
        thumbnail_url?: unknown;
      };

      if (
        typeof data.title !== "string" ||
        data.title.trim() === "" ||
        typeof data.thumbnail_url !== "string" ||
        data.thumbnail_url.trim() === ""
      ) {
        throw new Error("oEmbed invalid");
      }

      const nextSongs = [
        ...savedSongs,
        {
          videoId: loadedVideoId,
          title: data.title,
          thumbnailUrl: data.thumbnail_url,
          url: canonicalUrl,
        },
      ];

      setSavedSongs(nextSongs);
      saveSavedSongs(nextSongs);
      setStatusTone("success");
      setStatusMessage("Saved to Saved Songs.");
    } catch {
      setStatusTone("error");
      setStatusMessage("Could not fetch video details. Try another link.");
    }
  };

  const handleSelectSavedSong = (videoId: string) => {
    setSelectedVideoId(videoId);
    setSelectedSetListItemId(null);
    setLoadedVideoId((current) => (current === videoId ? current : videoId));
    setInputValue(`https://www.youtube.com/watch?v=${videoId}`);
    setDebouncedInput(`https://www.youtube.com/watch?v=${videoId}`);
    setPlayerError(null);
  };

  const stopPlayback = (clearPreviewErrors = false) => {
    clearPlaybackTimers();
    playerControllerRef.current?.stop();
    setPlaybackState("idle");
    setPlayingIndex(null);
    setCountdownRemaining(0);
    setPendingIndex(null);
    const nextUnplayable = new Set<string>();
    sessionUnplayableRef.current = nextUnplayable;
    setSessionUnplayable(nextUnplayable);
    if (clearPreviewErrors) {
      setPlayerError(null);
    }
  };

  const playIndex = (startIndex: number, intent: PlaybackIntent) => {
    const currentItems = setListItemsRef.current;
    const currentSongsById = songsByIdRef.current;
    const unplayable = sessionUnplayableRef.current;

    for (let index = startIndex; index < currentItems.length; index += 1) {
      const item = currentItems[index];
      if (!item) {
        break;
      }

      if (unplayable.has(item.videoId) || !currentSongsById[item.videoId]) {
        continue;
      }

      clearPlaybackTimers();
      setPlaybackState("playing");
      setPlayingIndex(index);
      setPendingIndex(null);
      setCountdownRemaining(0);
      setLoadedVideoId(item.videoId);
      setInputValue(`https://www.youtube.com/watch?v=${item.videoId}`);
      setDebouncedInput(`https://www.youtube.com/watch?v=${item.videoId}`);
      setPlayerError(null);
      playerControllerRef.current?.play(item.videoId);
      schedulePlaybackCheck(
        index,
        intent,
        intent === "user" ? USER_PLAYBACK_CHECK_DELAY_MS : AUTO_PLAYBACK_CHECK_DELAY_MS,
        0
      );
      return;
    }

    stopPlayback(true);
  };

  const startPlayback = (startIndex: number, intent: PlaybackIntent) => {
    if (setListItemsRef.current.length === 0) {
      setStatusTone("error");
      setStatusMessage("Add songs to your set list.");
      return;
    }

    playIndex(startIndex, intent);
  };

  const handleDeleteSavedSong = (videoId: string) => {
    const nextSongs = savedSongs.filter((song) => song.videoId !== videoId);
    setSavedSongs(nextSongs);
    saveSavedSongs(nextSongs);

    if (selectedVideoId === videoId) {
      setSelectedVideoId(null);
    }
  };

  const handleAddToSetList = (videoId: string) => {
    const nextItem: SetListItem = {
      id: createSetListItemId(),
      videoId,
    };

    setSetListItems((current) => {
      const nextItems = [...current, nextItem];
      saveSetListDraft(nextItems);
      return nextItems;
    });
  };

  const handlePlaySetList = () => {
    if (setListItems.length === 0) {
      setStatusTone("error");
      setStatusMessage("Add songs to your set list.");
      return;
    }

    if (playbackState !== "idle") {
      stopPlayback(true);
      return;
    }

    const nextUnplayable = new Set<string>();
    sessionUnplayableRef.current = nextUnplayable;
    setSessionUnplayable(nextUnplayable);
    startPlayback(0, "user");
  };

  const handleSaveSetList = () => {
    if (setListItems.length === 0) {
      setStatusTone("error");
      setStatusMessage("Add songs to your set list.");
      return;
    }

    const proposedName = window.prompt("Name this set list:");
    if (proposedName === null) {
      return;
    }

    const trimmedName = proposedName.trim();
    if (!trimmedName) {
      setStatusTone("error");
      setStatusMessage("Set list name is required.");
      return;
    }

    const existing = savedSetLists.find(
      (list) => list.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    const now = new Date().toISOString();

    if (existing) {
      const shouldOverwrite = window.confirm(
        `Overwrite existing set list '${existing.name}'?`
      );
      if (!shouldOverwrite) {
        return;
      }

      const nextLists = sortSavedSetLists(
        savedSetLists.map((list) =>
          list.id === existing.id
            ? {
                ...list,
                name: trimmedName,
                createdAt: now,
                items: setListItems,
              }
            : list
        )
      );

      setSavedSetLists(nextLists);
      setLoadedSetId(existing.id);
      saveSavedSetLists(nextLists);
      setStatusTone("success");
      setStatusMessage(`Overwrote '${trimmedName}'.`);
      return;
    }

    const nextLists = sortSavedSetLists([
      {
        id: createId(),
        name: trimmedName,
        createdAt: now,
        items: setListItems,
      },
      ...savedSetLists,
    ]);

    setSavedSetLists(nextLists);
    setLoadedSetId(nextLists[0]?.id ?? null);
    saveSavedSetLists(nextLists);
    setStatusTone("success");
    setStatusMessage(`Saved '${trimmedName}'.`);
  };

  const handleSelectSetListItem = (itemId: string) => {
    const item = setListItems.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    setSelectedSetListItemId(itemId);
    setSelectedVideoId(null);

    const song = songsById[item.videoId];
    if (!song && playbackState === "idle") {
      return;
    }

    const itemIndex = setListItems.findIndex((entry) => entry.id === itemId);
    if (playbackState !== "idle") {
      playIndex(itemIndex, "user");
      return;
    }

    setLoadedVideoId((current) => (current === item.videoId ? current : item.videoId));
    setInputValue(song.url);
    setDebouncedInput(song.url);
    setPlayerError(null);
  };

  const handleRemoveSetListItem = (itemId: string) => {
    setSetListItems((current) => {
      const nextItems = current.filter((item) => item.id !== itemId);
      saveSetListDraft(nextItems);
      return nextItems;
    });

    if (selectedSetListItemId === itemId) {
      setSelectedSetListItemId(null);
    }
  };

  const handleReorderSetListItems = (nextItems: SetListItem[]) => {
    setSetListItems(nextItems);
    saveSetListDraft(nextItems);
  };

  const handleLoadSavedSetList = (id: string) => {
    const list = savedSetLists.find((entry) => entry.id === id);
    if (!list) {
      return;
    }

    setSetListItems(list.items);
    setLoadedSetId(id);
    saveSetListDraft(list.items);
    setSelectedSetListItemId(null);
    setSelectedVideoId(null);
    setStatusTone("success");
    setStatusMessage(`Loaded '${list.name}'.`);
  };

  const handleDeleteSavedSetList = (id: string) => {
    const nextLists = savedSetLists.filter((list) => list.id !== id);
    setSavedSetLists(nextLists);
    saveSavedSetLists(nextLists);

     if (loadedSetId === id) {
      setLoadedSetId(null);
    }
  };

  const handlePlaybackEnded = () => {
    if (playbackStateRef.current !== "playing") {
      return;
    }

    const currentIndex = playingIndexRef.current;
    if (currentIndex === null) {
      stopPlayback(true);
      return;
    }

    queueNextPlayableFrom(currentIndex + 1);
  };

  const handlePlaybackError = () => {
    if (playbackStateRef.current !== "playing" && playbackStateRef.current !== "blocked") {
      return;
    }

    const currentIndex = pendingIndexRef.current ?? playingIndexRef.current;
    if (currentIndex === null) {
      stopPlayback();
      return;
    }

    const currentItem = setListItemsRef.current[currentIndex];
    if (!currentItem) {
      stopPlayback();
      return;
    }

    setSessionUnplayable((current) => {
      const next = new Set(current);
      next.add(currentItem.videoId);
      sessionUnplayableRef.current = next;
      return next;
    });

    queueNextPlayableFrom(currentIndex + 1);
  };

  const pendingSongTitle = useMemo(() => {
    if (pendingIndex === null) {
      return null;
    }

    const item = setListItems[pendingIndex];
    if (!item) {
      return null;
    }

    return songsById[item.videoId]?.title ?? "Missing video";
  }, [pendingIndex, setListItems, songsById]);

  const commitPauseInput = () => {
    const trimmed = pauseInput.trim();
    const parsed = Number(trimmed);

    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 9) {
      setPauseSeconds(parsed);
      setPauseInput(String(parsed));

      if (typeof window !== "undefined") {
        window.localStorage.setItem(PAUSE_SECONDS_STORAGE_KEY, String(parsed));
      }
      return;
    }

    setPauseInput(String(pauseSeconds));
  };

  function clearPlaybackTimers() {
    if (countdownIntervalRef.current !== null && typeof window !== "undefined") {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (playbackCheckTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(playbackCheckTimeoutRef.current);
      playbackCheckTimeoutRef.current = null;
    }
  }

  function getNextPlayableIndex(startIndex: number): number | null {
    const currentItems = setListItemsRef.current;
    const currentSongsById = songsByIdRef.current;
    const unplayable = sessionUnplayableRef.current;

    for (let index = startIndex; index < currentItems.length; index += 1) {
      const item = currentItems[index];
      if (!item) {
        break;
      }

      if (unplayable.has(item.videoId) || !currentSongsById[item.videoId]) {
        continue;
      }

      return index;
    }

    return null;
  }

  function queueNextPlayableFrom(startIndex: number) {
    const nextIndex = getNextPlayableIndex(startIndex);
    if (nextIndex === null) {
      stopPlayback(true);
      return;
    }

    clearPlaybackTimers();
    setPlaybackState("countdown");
    setPendingIndex(nextIndex);
    setCountdownRemaining(pauseSeconds);

    if (typeof window === "undefined") {
      return;
    }

    countdownIntervalRef.current = window.setInterval(() => {
      setCountdownRemaining((current) => {
        if (current <= 1) {
          clearPlaybackTimers();
          const resolvedIndex = pendingIndexRef.current ?? nextIndex;
          window.setTimeout(() => {
            playIndex(resolvedIndex, "auto");
          }, 0);
          return 0;
        }

        return current - 1;
      });
    }, 1000);
  }

  function schedulePlaybackCheck(
    index: number,
    intent: PlaybackIntent,
    delayMs: number,
    attempt: 0 | 1
  ) {
    if (typeof window === "undefined") {
      return;
    }

    playbackCheckTimeoutRef.current = window.setTimeout(() => {
      const playerState = playerControllerRef.current?.getPlayerState();

      if (playerState === YT_STATE_PLAYING) {
        return;
      }

      if (playerState === YT_STATE_BUFFERING && attempt === 0) {
        schedulePlaybackCheck(
          index,
          intent,
          intent === "user" ? USER_PLAYBACK_CHECK_DELAY_MS : AUTO_PLAYBACK_CHECK_DELAY_MS,
          1
        );
        return;
      }

      setPlaybackState("blocked");
      setPendingIndex(index);
    }, delayMs);
  }

  const handleBlockedRetry = () => {
    const nextIndex = pendingIndexRef.current;
    if (nextIndex === null) {
      return;
    }

    playIndex(nextIndex, "user");
  };

  const inlineMessage = playerError ?? errorMessage ?? statusMessage ?? "";
  const inlineMessageTone: StatusTone =
    playerError || errorMessage ? "error" : statusTone;
  const inlineMessageClass =
    inlineMessageTone === "warning"
      ? "text-amber-300"
      : inlineMessageTone === "success"
        ? "text-emerald-300"
        : inlineMessageTone === "info"
          ? "text-text1"
          : "text-red-300";

  return (
    <main className="min-h-screen bg-[linear-gradient(to_bottom,#0B0D12,#101522)] px-6 py-10 text-text0 md:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 xl:max-w-[1500px]">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent/80">Preview</p>
          <h1 className="text-4xl font-semibold tracking-tight text-text0 md:text-5xl">Set List App</h1>
          <p className="max-w-2xl text-base leading-7 text-text1 md:text-lg">
            Paste a YouTube link or video ID and load a paused preview into the player.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
          <div className="rounded-3xl border border-white/8 bg-bg1/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="space-y-4">
              <label htmlFor="youtube-url" className="block text-sm font-medium text-text0">
                YouTube URL or video ID
              </label>
              <input
                id="youtube-url"
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="min-h-13 w-full rounded-2xl border border-white/10 bg-bg2 px-4 py-3 text-base text-text0 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
              />
              <button
                type="button"
                onClick={handleSearchClick}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Search on YouTube
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleAddSavedSong();
                }}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-accent/40 bg-accent/12 px-5 py-3 text-sm font-semibold text-accent transition hover:bg-accent/18"
              >
                Add to Saved Songs
              </button>
              <div className={`min-h-6 text-sm ${inlineMessageClass}`}>
                {inlineMessage}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="w-full lg:max-w-[700px]">
              <div className="rounded-3xl border border-white/8 bg-bg1/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-5">
                <div className="relative">
                  <YouTubePlayer
                    ref={playerControllerRef}
                    videoId={loadedVideoId}
                    onEmbedError={setPlayerError}
                    onEnded={handlePlaybackEnded}
                    onError={handlePlaybackError}
                  />
                  {playbackState === "countdown" ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/72 px-6 text-center">
                      <p className="text-sm uppercase tracking-[0.18em] text-text1">Next up:</p>
                      <p className="mt-2 max-w-md truncate text-lg font-semibold text-text0">
                        {pendingSongTitle ?? "Loading next song"}
                      </p>
                      <p className="mt-4 text-5xl font-semibold tracking-tight text-accent">
                        {countdownRemaining}
                      </p>
                    </div>
                  ) : null}
                  {playbackState === "blocked" ? (
                    <button
                      type="button"
                      onClick={handleBlockedRetry}
                      className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center bg-black/72 px-6 text-center"
                    >
                      <p className="text-2xl font-semibold text-text0">Tap to continue</p>
                      <p className="mt-2 text-sm text-text1">
                        Autoplay is blocked until you tap.
                      </p>
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-text1">
                  <span>Player preview</span>
                  <span>{loadedVideoId ? `Video ID: ${loadedVideoId}` : "Waiting for a valid URL"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/8 bg-bg1/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlaySetList}
                    className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/18"
                  >
                    {playbackState === "idle" ? "Play Set List" : "Stop Set List"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSetList}
                    className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-accent/40 bg-accent/12 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/18"
                  >
                    Save Set List
                  </button>
                  <SavedSetLists
                    lists={savedSetLists}
                    loadedSetId={loadedSetId}
                    onLoad={handleLoadSavedSetList}
                    onDelete={handleDeleteSavedSetList}
                  />
                  <label className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text1">
                    <span>Pause (sec)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[1-9]"
                      maxLength={1}
                      value={pauseInput}
                      onChange={(event) => {
                        const nextValue = event.target.value.replace(/[^1-9]/g, "");
                        setPauseInput(nextValue);
                      }}
                      onBlur={commitPauseInput}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitPauseInput();
                        }
                      }}
                      className="w-[2ch] min-w-[2ch] bg-transparent text-center font-semibold text-text0 outline-none"
                      aria-label="Pause in seconds"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
              <div className="min-w-0">
                <SavedSongs
                  songs={savedSongs}
                  selectedVideoId={selectedVideoId}
                  onSelect={handleSelectSavedSong}
                  onDelete={handleDeleteSavedSong}
                  onAddToSetList={handleAddToSetList}
                />
              </div>

              <div className="min-w-0">
                <SetList
                  items={setListItems}
                  songsById={songsById}
                  selectedItemId={selectedSetListItemId}
                  playingIndex={playingIndex}
                  isReorderDisabled={playbackState !== "idle"}
                  onSelect={handleSelectSetListItem}
                  onRemove={handleRemoveSetListItem}
                  onReorder={handleReorderSetListItems}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return String(Date.now());
}

function createSetListItemId(): string {
  return createId();
}

function sortSavedSetLists(lists: SavedSetList[]): SavedSetList[] {
  return [...lists].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
