"use client";

import { useRef, useState } from "react";
import type { SavedSong } from "@/lib/storage";
import { recordingId, RECORDING_ART, storeRecording, validateRecording } from "@/lib/recordings";

type Props = { onImport(song: SavedSong): boolean };

export default function RecordingImport({ onImport }: Props) {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function importFiles(files: File[]) {
    if (busyRef.current || !files.length) return;
    busyRef.current = true;
    setBusy(true);
    setErrors([]);
    let added = 0;
    let existing = 0;
    const failures: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setMessage(`Importing ${index + 1} of ${files.length}: ${file.name}`);
        try {
          await validateRecording(file);
          const id = await recordingId(file);
          // Reimport also repairs missing browser copies without changing set-list references.
          await storeRecording(id, file);
          const wasAdded = onImport({ source: "local", videoId: id, title: file.name.replace(/\.mp3$/i, "").trim() || file.name, thumbnailUrl: RECORDING_ART, url: "" });
          if (wasAdded) added += 1; else existing += 1;
        } catch (error) {
          const reason = error instanceof DOMException && error.name === "QuotaExceededError"
            ? "Browser storage is full. This recording was not added."
            : error instanceof Error ? error.message : "Browser storage is unavailable.";
          failures.push(`${file.name}: ${reason}`);
        }
      }
      setMessage(`${added} recording${added === 1 ? "" : "s"} added.${existing ? ` ${existing} already saved; browser copies refreshed.` : ""}${failures.length ? ` ${failures.length} could not be imported.` : ""}`);
      setErrors(failures);
      if (added && navigator.storage?.persist) {
        void navigator.storage.persist().catch(() => undefined);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 space-y-2 border-b border-white/10 pb-4">
      <label htmlFor="recording-files" className="block text-sm font-semibold text-text0">Import MP3 recordings</label>
      <p id="recording-help" className="text-xs leading-5 text-text1">Choose MP3s from your computer or a downloaded OneDrive folder. Stored only in this browser; keep your originals. Up to 100 MB per file.</p>
      <input id="recording-files" type="file" accept=".mp3,audio/mpeg" multiple disabled={busy} aria-describedby="recording-help" className="block w-full text-sm text-text1 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-500/20 file:px-3 file:py-2 file:text-blue-200 disabled:opacity-50" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void importFiles(files); }} />
      <p role="status" className="text-xs text-text1">{message}</p>
      {errors.length > 0 && <ul className="space-y-1 text-xs text-red-300">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    </div>
  );
}
