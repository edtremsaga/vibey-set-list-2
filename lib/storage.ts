import { validDuration } from "./duration";
import { RECORDING_ID_PATTERN } from "./recordings";

export type SavedSong = {
  durationSeconds?: number;
  source?: "youtube" | "local";
  videoId: string;
  title: string;
  thumbnailUrl: string;
  url: string;
};

export type SetListItem = {
  id: string;
  videoId: string;
};

export type SavedSetList = {
  id: string;
  name: string;
  createdAt: string;
  items: SetListItem[];
};

const SAVED_SONGS_STORAGE_KEY = "sl_savedSongs_v2";
const SET_LIST_DRAFT_STORAGE_KEY = "sl_setListDraft_v2";
const SAVED_SET_LISTS_STORAGE_KEY = "sl_savedSetLists_v2";
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

let lastSavedSongsLoadWasCorrupt = false;
let lastSetListLoadWasCorrupt = false;
let lastSavedSetListsLoadWasCorrupt = false;

// Remember original damaged bytes; loading never writes browser storage.
const damaged = new Map<string, string>();

function loadCollection<T>(key: string, validate: (value: unknown) => T | null, flag: () => void): T[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(key) ?? window.localStorage.getItem(key.replace("_v2", "_v1"));
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Invalid collection");
    const entries = parsed.map(validate);
    if (entries.some(entry => entry === null)) { flag(); damaged.set(key, raw); }
    return entries.filter((entry): entry is T => entry !== null);
  } catch {
    flag(); damaged.set(key, raw);
    return [];
  }
}

function saveCollection(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  const original = damaged.get(key);
  if (original !== undefined) {
    // Preserve each distinct original. If the backup fails, do not replace the collection.
    const backupKey = `${key}_recovery_${crypto.randomUUID()}`;
    window.localStorage.setItem(backupKey, original);
    damaged.delete(key);
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSavedSongs(): SavedSong[] {
  lastSavedSongsLoadWasCorrupt = false;
  return loadCollection(SAVED_SONGS_STORAGE_KEY, validateSavedSong, () => { lastSavedSongsLoadWasCorrupt = true; });
}
export function saveSavedSongs(songs: SavedSong[]): void { saveCollection(SAVED_SONGS_STORAGE_KEY, songs); }
// Keep identity separate so existing draft arrays and recovery backups remain compatible.
const LOADED_SET_ID_STORAGE_KEY = "sl_loadedSetId_v1";
export function loadLoadedSetId(): string | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(LOADED_SET_ID_STORAGE_KEY);
  return id?.trim() ? id : null;
}
export function saveLoadedSetId(id: string | null): void {
  if (typeof window !== "undefined") window.localStorage.setItem(LOADED_SET_ID_STORAGE_KEY, id ?? "");
}

export function loadSetListDraft(): SetListItem[] {
  lastSetListLoadWasCorrupt = false;
  return loadCollection(SET_LIST_DRAFT_STORAGE_KEY, validateSetListItem, () => { lastSetListLoadWasCorrupt = true; });
}
export function saveSetListDraft(items: SetListItem[]): void { saveCollection(SET_LIST_DRAFT_STORAGE_KEY, items); }
export function loadSavedSetLists(): SavedSetList[] {
  lastSavedSetListsLoadWasCorrupt = false;
  return loadCollection(SAVED_SET_LISTS_STORAGE_KEY, (value) => {
    const list = validateSavedSetList(value);
    if (list && lastSavedSetListsLoadWasCorrupt) {
      const raw = window.localStorage.getItem(SAVED_SET_LISTS_STORAGE_KEY) ?? window.localStorage.getItem("sl_savedSetLists_v1");
      if (raw !== null) damaged.set(SAVED_SET_LISTS_STORAGE_KEY, raw);
    }
    return list;
  }, () => { lastSavedSetListsLoadWasCorrupt = true; });
}
export function saveSavedSetLists(lists: SavedSetList[]): void { saveCollection(SAVED_SET_LISTS_STORAGE_KEY, lists); }

export function consumeSavedSongsCorruptionFlag(): boolean {
  const wasCorrupt = lastSavedSongsLoadWasCorrupt;
  lastSavedSongsLoadWasCorrupt = false;
  return wasCorrupt;
}

export function consumeSetListDraftCorruptionFlag(): boolean {
  const wasCorrupt = lastSetListLoadWasCorrupt;
  lastSetListLoadWasCorrupt = false;
  return wasCorrupt;
}

export function consumeSavedSetListsCorruptionFlag(): boolean {
  const wasCorrupt = lastSavedSetListsLoadWasCorrupt;
  lastSavedSetListsLoadWasCorrupt = false;
  return wasCorrupt;
}

function validateSavedSong(value: unknown): SavedSong | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const song = value as Partial<SavedSong>;
  if (song.source === "local") {
    if (typeof song.videoId !== "string" || !RECORDING_ID_PATTERN.test(song.videoId) ||
        typeof song.title !== "string" || !song.title.trim() ||
        typeof song.thumbnailUrl !== "string" || song.url !== "") return null;
    return { ...(validDuration(song.durationSeconds) ? { durationSeconds: song.durationSeconds } : {}), source: "local", videoId: song.videoId, title: song.title, thumbnailUrl: song.thumbnailUrl, url: "" };
  }
  if (song.source !== undefined && song.source !== "youtube") return null;
  if (
    typeof song.videoId !== "string" ||
    !VIDEO_ID_PATTERN.test(song.videoId) ||
    typeof song.title !== "string" ||
    song.title.trim() === "" ||
    typeof song.thumbnailUrl !== "string" ||
    song.thumbnailUrl.trim() === "" ||
    typeof song.url !== "string" ||
    song.url !== `https://www.youtube.com/watch?v=${song.videoId}`
  ) {
    return null;
  }

  return {
    ...(validDuration(song.durationSeconds) ? { durationSeconds: song.durationSeconds } : {}),
    videoId: song.videoId,
    title: song.title,
    thumbnailUrl: song.thumbnailUrl,
    url: song.url,
  };
}

function validateSetListItem(value: unknown): SetListItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<SetListItem>;
  if (
    typeof item.id !== "string" ||
    item.id.trim() === "" ||
    typeof item.videoId !== "string" ||
    (!VIDEO_ID_PATTERN.test(item.videoId) && !RECORDING_ID_PATTERN.test(item.videoId))
  ) {
    return null;
  }

  return {
    id: item.id,
    videoId: item.videoId,
  };
}

function validateSavedSetList(value: unknown): SavedSetList | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const list = value as Partial<SavedSetList>;
  if (
    typeof list.id !== "string" ||
    list.id.trim() === "" ||
    typeof list.name !== "string" ||
    list.name.trim() === "" ||
    typeof list.createdAt !== "string" ||
    list.createdAt.trim() === "" ||
    !Array.isArray(list.items)
  ) {
    return null;
  }

  const items = list.items.map(validateSetListItem);
  if (items.some((item) => item === null)) {
    lastSavedSetListsLoadWasCorrupt = true;
  }

  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    items: items.filter((item): item is SetListItem => item !== null),
  };
}
