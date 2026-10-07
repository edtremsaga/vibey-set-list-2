// Audio bytes stay on this device, separate from lightweight song metadata.
export const RECORDING_ID_PATTERN = /^audio:[a-f0-9]{64}$/;
export const RECORDING_ART = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect width="160" height="96" rx="12" fill="#172338"/><text x="80" y="65" text-anchor="middle" font-size="52" fill="#93c5fd">♫</text></svg>');
export const MAX_RECORDING_BYTES = 100 * 1024 * 1024;

function openRecordings(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sl_recordings_v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("audio");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other app tabs and try again."));
  });
}

export async function storeRecording(id: string, file: Blob): Promise<void> {
  const db = await openRecordings();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("audio", "readwrite");
      tx.objectStore("audio").put(file, id);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Could not store recording."));
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readRecording(id: string): Promise<Blob | undefined> {
  const db = await openRecordings();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db.transaction("audio").objectStore("audio").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function recordingId(file: File): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return "audio:" + Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateRecording(file: File): Promise<void> {
  if (!/\.mp3$/i.test(file.name)) throw new Error("Choose an MP3 file.");
  if (!file.size) throw new Error("This file is empty.");
  if (file.size > MAX_RECORDING_BYTES) throw new Error("Maximum size is 100 MB per recording.");
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio();
      const finish = (error?: Error) => {
        clearTimeout(timer);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        audio.removeAttribute("src");
        audio.load();
        if (error) reject(error); else resolve();
      };
      const timer = setTimeout(() => finish(new Error("Could not read this MP3. Try downloading it again.")), 10000);
      audio.preload = "metadata";
      audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? undefined : new Error("This MP3 has no playable duration."));
      audio.onerror = () => finish(new Error("This file could not be decoded as audio."));
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
