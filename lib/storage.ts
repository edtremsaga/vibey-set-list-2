export type SavedSong = {
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

const SAVED_SONGS_STORAGE_KEY = "sl_savedSongs_v1";
const SET_LIST_DRAFT_STORAGE_KEY = "sl_setListDraft_v1";
const SAVED_SET_LISTS_STORAGE_KEY = "sl_savedSetLists_v1";
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

let lastSavedSongsLoadWasCorrupt = false;
let lastSetListLoadWasCorrupt = false;
let lastSavedSetListsLoadWasCorrupt = false;

export function loadSavedSongs(): SavedSong[] {
  lastSavedSongsLoadWasCorrupt = false;

  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(SAVED_SONGS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return resetCorruptSavedSongs();
    }

    const songs = parsed.map(validateSavedSong);
    if (songs.some((song) => song === null)) {
      return resetCorruptSavedSongs();
    }

    return songs as SavedSong[];
  } catch {
    return resetCorruptSavedSongs();
  }
}

export function saveSavedSongs(songs: SavedSong[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SAVED_SONGS_STORAGE_KEY, JSON.stringify(songs));
}

export function loadSetListDraft(): SetListItem[] {
  lastSetListLoadWasCorrupt = false;

  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(SET_LIST_DRAFT_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return resetCorruptSetListDraft();
    }

    const items = parsed.map(validateSetListItem);
    if (items.some((item) => item === null)) {
      return resetCorruptSetListDraft();
    }

    return items as SetListItem[];
  } catch {
    return resetCorruptSetListDraft();
  }
}

export function saveSetListDraft(items: SetListItem[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SET_LIST_DRAFT_STORAGE_KEY, JSON.stringify(items));
}

export function loadSavedSetLists(): SavedSetList[] {
  lastSavedSetListsLoadWasCorrupt = false;

  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(SAVED_SET_LISTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return resetCorruptSavedSetLists();
    }

    const lists = parsed.map(validateSavedSetList);
    if (lists.some((list) => list === null)) {
      return resetCorruptSavedSetLists();
    }

    return lists as SavedSetList[];
  } catch {
    return resetCorruptSavedSetLists();
  }
}

export function saveSavedSetLists(lists: SavedSetList[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SAVED_SET_LISTS_STORAGE_KEY, JSON.stringify(lists));
}

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

function resetCorruptSavedSongs(): SavedSong[] {
  lastSavedSongsLoadWasCorrupt = true;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SAVED_SONGS_STORAGE_KEY, "[]");
  }

  return [];
}

function resetCorruptSetListDraft(): SetListItem[] {
  lastSetListLoadWasCorrupt = true;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SET_LIST_DRAFT_STORAGE_KEY, "[]");
  }

  return [];
}

function resetCorruptSavedSetLists(): SavedSetList[] {
  lastSavedSetListsLoadWasCorrupt = true;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SAVED_SET_LISTS_STORAGE_KEY, "[]");
  }

  return [];
}

function validateSavedSong(value: unknown): SavedSong | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const song = value as Partial<SavedSong>;
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
    !VIDEO_ID_PATTERN.test(item.videoId)
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
    return null;
  }

  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    items: items as SetListItem[],
  };
}
