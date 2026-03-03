"use client";

import SavedSongs from "@/components/SavedSongs";
import SavedSetLists from "@/components/SavedSetLists";
import SetList from "@/components/SetList";
import YouTubePlayer from "@/components/YouTubePlayer";
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
import { useEffect, useMemo, useState } from "react";

type StatusTone = "error" | "warning" | "info" | "success";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [loadedVideoId, setLoadedVideoId] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [savedSongs, setSavedSongs] = useState<SavedSong[]>([]);
  const [savedSetLists, setSavedSetLists] = useState<SavedSetList[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [setListItems, setSetListItems] = useState<SetListItem[]>([]);
  const [selectedSetListItemId, setSelectedSetListItemId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>("info");

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
  }, []);

  const songsById = useMemo(
    () =>
      Object.fromEntries(savedSongs.map((song) => [song.videoId, song])),
    [savedSongs]
  );

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
    if (!song) {
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

  const moveSetListItem = (itemId: string, direction: -1 | 1) => {
    setSetListItems((current) => {
      const index = current.findIndex((item) => item.id === itemId);
      const targetIndex = index + direction;

      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const nextItems = [...current];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(targetIndex, 0, item);
      saveSetListDraft(nextItems);
      return nextItems;
    });
  };

  const handleLoadSavedSetList = (id: string) => {
    const list = savedSetLists.find((entry) => entry.id === id);
    if (!list) {
      return;
    }

    setSetListItems(list.items);
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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
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
            <div className="rounded-3xl border border-white/8 bg-bg1/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-5">
              <YouTubePlayer videoId={loadedVideoId} onEmbedError={setPlayerError} />
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-text1">
                <span>Player preview</span>
                <span>{loadedVideoId ? `Video ID: ${loadedVideoId}` : "Waiting for a valid URL"}</span>
              </div>
            </div>

            <SavedSongs
              songs={savedSongs}
              selectedVideoId={selectedVideoId}
              onSelect={handleSelectSavedSong}
              onDelete={handleDeleteSavedSong}
              onAddToSetList={handleAddToSetList}
            />

            <SetList
              items={setListItems}
              songsById={songsById}
              selectedItemId={selectedSetListItemId}
              onSaveSetList={handleSaveSetList}
              onSelect={handleSelectSetListItem}
              onRemove={handleRemoveSetListItem}
              onMoveUp={(itemId) => moveSetListItem(itemId, -1)}
              onMoveDown={(itemId) => moveSetListItem(itemId, 1)}
            />

            <SavedSetLists
              lists={savedSetLists}
              onLoad={handleLoadSavedSetList}
              onDelete={handleDeleteSavedSetList}
            />
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
