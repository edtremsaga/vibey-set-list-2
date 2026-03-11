"use client";

import SavedSongs from "@/components/SavedSongs";
import HelpModal from "@/components/HelpModal";
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
import { parseYouTubeVideoId } from "@/lib/youtube";
import { useEffect, useMemo, useRef, useState } from "react";

type StatusTone = "error" | "warning" | "info" | "success";
type PlaybackState = "idle" | "playing" | "countdown" | "blocked";
type PlaybackIntent = "user" | "auto";
type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
};
const PAUSE_SECONDS_STORAGE_KEY = "sl_pauseSeconds_v1";
const DEFAULT_PAUSE_SECONDS = 3;
const YT_STATE_PLAYING = 1;
const YT_STATE_BUFFERING = 3;
const AUTO_PLAYBACK_CHECK_DELAY_MS = 350;
const USER_PLAYBACK_CHECK_DELAY_MS = 1500;

export default function Home() {
  const playerControllerRef = useRef<YouTubePlayerHandle | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchMessageTone, setSearchMessageTone] = useState<StatusTone>("info");
  const [recentlyAddedVideoId, setRecentlyAddedVideoId] = useState<string | null>(null);
  const [loadedVideoId, setLoadedVideoId] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [savedSongs, setSavedSongs] = useState<SavedSong[]>([]);
  const [savedSongsSortDirection, setSavedSongsSortDirection] = useState<"asc" | "desc">("asc");
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const setListItemsRef = useRef<SetListItem[]>([]);
  const songsByIdRef = useRef<Record<string, SavedSong>>({});
  const playingIndexRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const playbackStateRef = useRef<PlaybackState>("idle");
  const sessionUnplayableRef = useRef<Set<string>>(new Set());
  const countdownIntervalRef = useRef<number | null>(null);
  const playbackCheckTimeoutRef = useRef<number | null>(null);
  const addedHighlightTimeoutRef = useRef<number | null>(null);

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

  const displaySavedSongs = useMemo(() => {
    const sorted = [...savedSongs].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );

    if (savedSongsSortDirection === "desc") {
      sorted.reverse();
    }

    return sorted;
  }, [savedSongs, savedSongsSortDirection]);

  const loadedSetName = useMemo(() => {
    if (!loadedSetId) {
      return null;
    }

    return savedSetLists.find((list) => list.id === loadedSetId)?.name ?? null;
  }, [loadedSetId, savedSetLists]);
  const setListVideoIds = useMemo(
    () => new Set(setListItems.map((item) => item.videoId)),
    [setListItems]
  );
  const showBroadSearchTip = useMemo(() => {
    const words = lastSearchQuery.trim().split(/\s+/).filter(Boolean);
    return words.length >= 1 && words.length <= 2;
  }, [lastSearchQuery]);

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
      if (addedHighlightTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(addedHighlightTimeoutRef.current);
      }
    };
  }, []);

  const handleSearchClick = async () => {
    const query = searchQuery.trim();
    if (!query) {
      return;
    }
    setLastSearchQuery(query);

    setIsSearching(true);
    setSearchMessageTone("info");
    setSearchMessage("Searching YouTube...");

    try {
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);

      if (response.status === 429) {
        setSearchResults([]);
        setSearchMessageTone("warning");
        setSearchMessage("Too many searches right now. Try again in a bit.");
        return;
      }

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = (await response.json()) as { items?: YouTubeSearchResult[] };
      const items = Array.isArray(data.items) ? data.items : [];
      setSearchResults(items);

      if (items.length === 0) {
        setSearchMessageTone("info");
        setSearchMessage("No results found");
      } else {
        setSearchMessage(null);
      }
    } catch {
      setSearchResults([]);
      setSearchMessageTone("error");
      setSearchMessage("Couldn’t reach YouTube. Try again or paste a URL instead.");
    } finally {
      setIsSearching(false);
    }
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

  const handleAddSearchResult = (result: YouTubeSearchResult) => {
    const canonicalUrl = `https://www.youtube.com/watch?v=${result.videoId}`;

    setSavedSongs((current) => {
      if (current.some((song) => song.videoId === result.videoId)) {
        return current;
      }

      const nextSongs = [
        ...current,
        {
          videoId: result.videoId,
          title: result.title,
          thumbnailUrl: result.thumbnailUrl,
          url: canonicalUrl,
        },
      ];
      saveSavedSongs(nextSongs);
      return nextSongs;
    });

    const nextItem: SetListItem = {
      id: createSetListItemId(),
      videoId: result.videoId,
    };

    setSetListItems((current) => {
      const nextItems = [...current, nextItem];
      saveSetListDraft(nextItems);
      return nextItems;
    });

    setSearchQuery("");
    setSearchMessageTone("success");
    setSearchMessage("Added to set list");
    setRecentlyAddedVideoId(result.videoId);
    if (typeof window !== "undefined") {
      if (addedHighlightTimeoutRef.current !== null) {
        window.clearTimeout(addedHighlightTimeoutRef.current);
      }
      addedHighlightTimeoutRef.current = window.setTimeout(() => {
        setRecentlyAddedVideoId((current) => (current === result.videoId ? null : current));
      }, 1400);
    }
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
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
      if (playbackStateRef.current !== "playing" || playingIndexRef.current !== index) {
        return;
      }

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

  const handlePlayerStateChange = (state: number) => {
    if (state !== YT_STATE_PLAYING) {
      return;
    }

    clearPlaybackTimers();

    if (playbackStateRef.current === "blocked") {
      setPlaybackState("playing");
      setPendingIndex(null);
    }
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
  const searchMessageClass =
    searchMessageTone === "warning"
      ? "text-amber-300"
      : searchMessageTone === "success"
        ? "text-emerald-300"
        : searchMessageTone === "error"
          ? "text-red-300"
          : "text-text1";

  return (
    <main className="min-h-screen bg-[linear-gradient(to_bottom,#0B0D12,#101522)] px-6 py-8 text-text0 md:px-10 lg:px-12 lg:py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:gap-4 xl:max-w-[1500px]">
        <header className="space-y-1.5 border-b border-white/5 pb-4">
          <h1 className="text-4xl font-semibold tracking-tight text-text0 md:text-5xl">
            Music Looper Set List
            <span className="ml-3 text-lg font-normal italic text-text1 md:text-2xl">
              by Vibey Craft
            </span>
          </h1>
          <p className="max-w-2xl text-base leading-7 text-text1 md:text-lg">
            Search YouTube in-app or paste a YouTube link to load a song. Save songs to build a set list and jam along.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
          <div className="rounded-3xl border border-white/8 bg-bg1/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur lg:p-4">
            <div className="space-y-3">
              <label htmlFor="youtube-url" className="block text-sm font-medium text-text0">
                YouTube URL or video ID
              </label>
              <div className="relative">
                <input
                  ref={urlInputRef}
                  id="youtube-url"
                  type="text"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="min-h-13 w-full rounded-2xl border border-white/10 bg-bg2 px-4 py-3 pr-12 text-base text-text0 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
                />
                {inputValue.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue("");
                      setDebouncedInput("");
                      window.requestAnimationFrame(() => {
                        urlInputRef.current?.focus();
                        urlInputRef.current?.setSelectionRange(0, 0);
                      });
                    }}
                    className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-text1 transition hover:border-white/20 hover:text-text0"
                    aria-label="Clear YouTube URL input"
                  >
                    ×
                  </button>
                ) : null}
              </div>
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
              <div className="border-t border-white/10 pt-3">
                <label htmlFor="youtube-search" className="block text-sm font-medium text-text0">
                  Search YouTube
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    ref={searchInputRef}
                    id="youtube-search"
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (
                          !isSearching &&
                          searchResults.length > 0 &&
                          searchQuery.trim().toLowerCase() === lastSearchQuery.trim().toLowerCase()
                        ) {
                          handleAddSearchResult(searchResults[0]);
                          return;
                        }
                        void handleSearchClick();
                      }
                    }}
                    placeholder="Search song or artist (example: Driver 8 or REM Driver 8)"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="min-h-12 w-full rounded-2xl border border-white/10 bg-bg2 px-4 py-3 text-sm text-text0 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleSearchClick();
                    }}
                    disabled={isSearching || !searchQuery.trim()}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-accent/50"
                  >
                    Search
                  </button>
                </div>
                <div className="mt-2 min-h-6 text-sm">
                  {searchMessage ? <span className={searchMessageClass}>{searchMessage}</span> : null}
                </div>
                {searchResults.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {searchResults.map((result) => {
                      const isInSetList = setListVideoIds.has(result.videoId);
                      const isInSavedSongs = savedSongs.some(
                        (song) => song.videoId === result.videoId
                      );
                      const isRecentlyAdded = recentlyAddedVideoId === result.videoId;
                      const decodedTitle = decodeHtmlEntities(result.title);
                      const { artist, song } = splitSearchResultTitle(decodedTitle);
                      const displayTitle = song;
                      const displayMeta = artist
                        ? `${artist} · ${result.channelTitle} · ${result.duration}`
                        : `${result.channelTitle} · ${result.duration}`;
                      return (
                        <div
                          key={result.videoId}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleAddSearchResult(result)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleAddSearchResult(result);
                            }
                          }}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-2.5 transition hover:border-accent/35 hover:bg-bg2 ${
                            isRecentlyAdded
                              ? "border-emerald-400/45 bg-emerald-500/10"
                              : "border-white/10 bg-bg2/70"
                          }`}
                        >
                          <img
                            src={result.thumbnailUrl}
                            alt={displayTitle}
                            className="h-14 w-20 rounded-lg object-cover"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <TruncatedTitle
                              text={displayTitle}
                              className="truncate text-sm font-semibold text-text0"
                            />
                            <p className="truncate text-xs text-text1">
                              {displayMeta}
                            </p>
                            {isInSavedSongs ? (
                              <p className="mt-1 text-xs text-emerald-300">Added ✓</p>
                            ) : null}
                            {isInSetList ? (
                              <p className="mt-1 text-xs text-amber-300">Already in set list</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAddSearchResult(result);
                            }}
                            className={`inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition ${
                              isRecentlyAdded
                                ? "border border-emerald-400/45 bg-emerald-500/10 text-emerald-200"
                                : isInSavedSongs
                                ? "border border-white/15 bg-white/5 text-text1 hover:border-white/25 hover:bg-white/10"
                                : "border border-accent/40 bg-accent/12 text-accent hover:bg-accent/18"
                            }`}
                          >
                            {isRecentlyAdded ? "Added ✓" : isInSavedSongs ? "Add again" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {searchResults.length > 0 && showBroadSearchTip ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-text1">
                    <p>Tip: add a song title to narrow results.</p>
                    <p className="mt-1">Examples:</p>
                    <p>• rolling stones gimme shelter</p>
                    <p>• rolling stones beast of burden</p>
                    <p>• paint it black</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:space-y-3">
            <div className="w-full lg:max-w-[480px]">
              <div className="rounded-3xl border border-white/8 bg-bg1/80 p-3.5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-4">
                <div className="relative overflow-hidden rounded-2xl">
                  <YouTubePlayer
                    ref={playerControllerRef}
                    videoId={loadedVideoId}
                    onEmbedError={setPlayerError}
                    onEnded={handlePlaybackEnded}
                    onError={handlePlaybackError}
                    onStateChange={handlePlayerStateChange}
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
                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-text1">
                  <span>Player preview</span>
                  <span>{loadedVideoId ? "Preview ready" : "Waiting for a valid URL"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/8 bg-bg1/80 p-3.5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlaySetList}
                    className={`inline-flex min-h-10 items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold text-white transition ${
                      playbackState === "idle"
                        ? "border border-green-500/40 bg-green-600 hover:bg-green-500"
                        : "border border-red-500/40 bg-red-600 hover:bg-red-500"
                    }`}
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
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-text0 transition hover:border-accent/30 hover:bg-white/[0.08]"
                  >
                    Help
                  </button>
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
                  songs={displaySavedSongs}
                  selectedVideoId={selectedVideoId}
                  sortDirection={savedSongsSortDirection}
                  onToggleSortDirection={() =>
                    setSavedSongsSortDirection((current) =>
                      current === "asc" ? "desc" : "asc",
                    )
                  }
                  onSelect={handleSelectSavedSong}
                  onDelete={handleDeleteSavedSong}
                  onAddToSetList={handleAddToSetList}
                />
              </div>

              <div className="min-w-0">
                <SetList
                  items={setListItems}
                  songsById={songsById}
                  loadedSetName={loadedSetName}
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
      <HelpModal open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </main>
  );
}

function TruncatedTitle({ text, className }: { text: string; className: string }) {
  const titleRef = useRef<HTMLParagraphElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = titleRef.current;
    if (!element) {
      return;
    }

    const measureTruncation = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    };

    measureTruncation();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(measureTruncation);
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, [text]);

  return (
    <p ref={titleRef} className={className} title={isTruncated ? text : undefined}>
      {text}
    </p>
  );
}

function decodeHtmlEntities(text: string): string {
  if (typeof window === "undefined") {
    return text;
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function splitSearchResultTitle(title: string): { artist: string | null; song: string } {
  const parts = title.split(" - ");
  if (parts.length === 2) {
    const artist = parts[0]?.trim() ?? "";
    const song = parts[1]?.trim() ?? "";
    if (artist && song) {
      return { artist, song };
    }
  }

  return { artist: null, song: title };
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
