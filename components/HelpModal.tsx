"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type HelpModalProps = {
  open: boolean;
  onClose(): void;
};

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousOverflowRef = useRef<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = previousOverflowRef.current ?? "";
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 md:items-center md:py-6"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/8 bg-bg1 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text0">Music Looper Set List — Help</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-text1 transition hover:border-white/20 hover:text-text0"
            aria-label="Close help"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 text-sm text-text1">
          <p>
            Music Looper Set List lets you build a set list from your saved YouTube songs and play
            them sequentially for practice.
          </p>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Quick start (60 seconds)</h3>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Paste a YouTube link (or video ID).</li>
              <li>When the preview loads, click Add to Saved Songs.</li>
              <li>In Saved Songs, click + to add songs to your Set List.</li>
              <li>Click Play Set List to start. It will play songs in order.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">URL input + Player</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Search on YouTube: opens YouTube search in a new tab.</li>
              <li>Add to Saved Songs: saves the current preview song.</li>
              <li>Player controls (progress bar / play-pause) appear when you hover the player.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Saved Songs</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Click a song row to load it as a paused preview.</li>
              <li>+ adds the song to your Set List.</li>
              <li>× removes the song from Saved Songs.</li>
              <li>Sorting (A→Z / Z→A) is available in the header.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Set List</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Drag by handle (≡) to reorder songs.</li>
              <li>Click a row while idle to load paused preview.</li>
              <li>Click a row while playing to jump playback to that song.</li>
              <li>× removes the row from the Set List.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Playback</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Play Set List starts sequential playback from the top.</li>
              <li>Stop Set List ends playback and returns to idle.</li>
              <li>Pause (sec) controls between-song countdown (1–9 seconds).</li>
              <li>If autoplay is blocked, use Tap to continue.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
