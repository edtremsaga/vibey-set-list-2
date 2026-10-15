"use client";

import { useId, useRef, useState } from "react";
import type { SavedSong } from "@/lib/storage";

export default function SongActions({ song, onEdit, onRemove, inSetList = false }: {
  song?: SavedSong;
  onEdit?: () => void;
  onRemove(): void;
  inSetList?: boolean;
}) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState(false);
  const title = song?.title ?? "missing song";
  const url = song && song.source !== "local"
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(song.videoId)}` : null;
  const close = () => { popup.current?.hidePopover(); trigger.current?.focus(); };
  const actionClass = "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-blue-400";

  return (
    <div className="shrink-0" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <button ref={trigger} type="button" popoverTarget={id} aria-label={`Actions for ${title}`}
        onClick={() => {
          const rect = trigger.current!.getBoundingClientRect();
          setPosition({ left: Math.max(8, Math.min(rect.right - 240, window.innerWidth - 248)),
            top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 280)) });
          setFallback(false); setMessage("");
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-text1 hover:text-text0">⋯</button>
      <div ref={popup} id={id} popover="auto" style={position}
        aria-label={`Song actions for ${title}`}
        className="fixed m-0 w-60 max-w-[calc(100vw-1rem)] rounded-xl border border-white/15 bg-bg2 p-2 text-text0 shadow-2xl">
        {url && <button type="button" className={actionClass} onClick={async () => {
          try { await navigator.clipboard.writeText(url); setMessage("Link copied"); close(); }
          catch { setFallback(true); setMessage("Select and copy the link below."); }
        }}>Copy YouTube link</button>}
        {fallback && url && <label className="block px-3 py-2 text-xs">YouTube link
          <input aria-label="YouTube link" readOnly value={url} onFocus={event => event.target.select()}
            className="mt-1 w-full rounded border border-white/20 p-2" />
        </label>}
        {onEdit && <button type="button" className={actionClass} aria-label={`Rename ${title}`}
          onClick={() => { close(); onEdit(); }}>Edit</button>}
        <button type="button" className={`${actionClass} text-red-300`}
          aria-label={inSetList ? `Remove ${title} from set list` : `Delete ${title}`}
          onClick={() => { close(); onRemove(); }}>{inSetList ? "Remove from set list" : "Remove from saved songs"}</button>
      </div>
      <span aria-live="polite" className={fallback ? "sr-only" : "pointer-events-none absolute right-2 bottom-full rounded bg-bg2 px-2 text-xs text-green-300"}>{message}</span>
    </div>
  );
}
