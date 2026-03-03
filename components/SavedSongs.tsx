"use client";

import type { SavedSong } from "@/lib/storage";
import { useEffect, useState } from "react";

type SavedSongsProps = {
  songs: SavedSong[];
  selectedVideoId: string | null;
  onSelect(videoId: string): void;
  onDelete(videoId: string): void;
  onAddToSetList(videoId: string): void;
};

export default function SavedSongs({
  songs,
  selectedVideoId,
  onSelect,
  onDelete,
  onAddToSetList,
}: SavedSongsProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [openInfoVideoId, setOpenInfoVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => {
      setIsTouchDevice(media.matches || window.navigator.maxTouchPoints > 0);
    };

    update();
    media.addEventListener("change", update);

    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  return (
    <section className="rounded-3xl border border-white/8 bg-bg1/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text0">Saved Songs</h2>
          <p className="text-sm text-text1">Quickly reload a paused preview.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-text1">
          {songs.length}
        </span>
      </div>

      {songs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-bg0/60 px-4 py-6 text-sm text-text1">
          No saved songs yet.
        </div>
      ) : (
        <div className="space-y-2">
          {songs.map((song) => {
            const isSelected = selectedVideoId === song.videoId;

            return (
              <div
                key={song.videoId}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(song.videoId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(song.videoId);
                  }
                }}
                className={`group relative flex items-center gap-3 overflow-visible rounded-2xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-accent/50 bg-accent/12 shadow-[inset_4px_0_0_0_#3B82F6]"
                    : "border-white/8 bg-bg0/55 hover:border-accent/30 hover:bg-white/[0.03]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={song.thumbnailUrl}
                  alt={song.title}
                  className="h-12 w-20 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text0">{song.title}</p>
                      {!isTouchDevice ? (
                        <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden max-w-xs rounded-xl border border-white/10 bg-bg2 px-3 py-2 text-xs leading-5 text-text0 shadow-xl group-hover:block">
                          {song.title}
                        </div>
                      ) : null}
                    </div>

                    {isTouchDevice ? (
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenInfoVideoId((current) =>
                              current === song.videoId ? null : song.videoId
                            );
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/12 bg-white/5 text-xs font-semibold text-text1"
                          aria-label={`Show full title for ${song.title}`}
                        >
                          i
                        </button>
                        {openInfoVideoId === song.videoId ? (
                          <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-white/10 bg-bg2 px-3 py-2 text-xs leading-5 text-text0 shadow-xl">
                            {song.title}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddToSetList(song.videoId);
                  }}
                  className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/12 px-3 text-sm font-semibold text-accent transition hover:bg-accent/20"
                  aria-label={`Add ${song.title} to set list`}
                >
                  +
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(song.videoId);
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-text1 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200"
                  aria-label={`Delete ${song.title}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
