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
            <h2 className="text-lg font-semibold text-text0">Set List Driver — Help</h2>
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
          <p>Build and play ordered practice set lists using YouTube songs and your own MP3 recordings.</p>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Quick start</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Add songs by searching YouTube, pasting a YouTube link or video ID, or importing MP3 recordings.</li>
              <li>YouTube search results: click Add or the result row to save the song and add it directly to your Set List.</li>
              <li>Pasted YouTube links: when the preview loads, click Add to Saved Songs. Then click + in Saved Songs to add the song to your Set List.</li>
              <li>Imported MP3s go into Saved Songs. Click + to add them to your Set List.</li>
              <li>Reorder your songs, then click Play Set List to play them in order.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Import MP3 recordings</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Click Choose Files under Import MP3 recordings. You can select several MP3s at once, including files downloaded to your computer from OneDrive.</li>
              <li>Each file must be a playable MP3, no larger than 100 MB. Importing does not add it to the Set List automatically.</li>
              <li>The initial title comes from the filename. Click Edit in Saved Songs to rename a recording.</li>
              <li>Importing the same MP3 again refreshes its browser copy without adding a duplicate or changing its saved title. It can also reconnect a missing recording to existing set lists.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">YouTube links and search</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Paste a YouTube link or video ID to load a preview. Add to Saved Songs saves it without adding it to the Set List.</li>
              <li>Use Search YouTube to find songs. Press Enter or click Search to run a query; press Enter again to add the first result.</li>
              <li>Click Add or anywhere on a search-result row to add the song to both Saved Songs and the Set List.</li>
              <li>Add again allows another copy in the Set List. Already in set list warns that the song is already included.</li>
              <li>Some YouTube videos cannot be played in an embedded player. Try another version of the song.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Find and manage Saved Songs</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Type part of a saved title into Search saved songs. Results update as you type; capitalization does not matter.</li>
              <li>Use All, MP3, or YouTube to filter by source. Source filters and search work together.</li>
              <li>The count shows all saved songs, or matching songs out of the total when filtering. A→Z / Z→A sorts the results by title.</li>
              <li>The × inside the search field clears only the search text. Clear filters, shown when nothing matches, resets both search and source filters.</li>
              <li>Search and source filters reset when you reload the page. Filtering does not change your Set List or interrupt playback.</li>
              <li>Click a saved-song row to load a paused preview; doing this during set-list playback stops the sequence.</li>
              <li>+ adds the song to your Set List. × removes it from Saved Songs. Removing an MP3 entry currently does not reclaim its stored audio space.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Arrange your Set List</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Drag the handle (≡) to reorder songs while playback is stopped.</li>
              <li>Click a row while idle to load a paused preview. Click a row while playing to jump to that song.</li>
              <li>× removes a row from the Set List without deleting the song from Saved Songs.</li>
              <li>The same song can appear more than once. Songs removed from Saved Songs may appear as missing in saved set lists and cannot play until restored.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Save and reload set lists</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Open Save Set List and choose Save Set List. For a new draft, enter a name and click Save.</li>
              <li>When a saved set list is loaded, Save Set List updates that list. Choose Save As New Set List to save a separate named copy.</li>
              <li>Open Saved Set Lists and click Load beside a list to replace the current draft with that saved list.</li>
              <li>Unsaved changes means the current draft differs from the loaded saved list. Save it to update that list.</li>
              <li>The current draft is kept between page reloads. Use named saved lists to keep different gig or practice arrangements.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Playback</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Play Set List starts from the top and plays YouTube songs and imported MP3s in order.</li>
              <li>Stop Set List ends the sequence. Pause (sec) sets the countdown between songs, from 1 to 9 seconds.</li>
              <li>Use the player controls to play, pause, or seek within a song. YouTube controls appear when you interact with the player.</li>
              <li>If the browser blocks automatic playback, click Tap to continue.</li>
              <li>Unavailable songs are skipped during set-list playback. Check any displayed error and restore missing MP3s by importing the original files again.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-text0">Where your songs and lists are stored</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Saved-song details, set lists, and imported MP3 copies are stored in this browser for this website address. MP3s are copied into browser storage; they are not streamed from your computer folder or uploaded to our server.</li>
              <li>Keep your original recordings. Clearing site data, using another browser or device, or opening a different website address does not preserve access to the same browser copies.</li>
              <li>Browser storage is limited. The app requests persistent storage, but the browser decides whether to grant it. If an import fails because storage is full, keep your originals and try again when space is available.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
