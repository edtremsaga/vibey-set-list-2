"use client";

import type { SavedSong, SetListItem } from "@/lib/storage";

type SetListProps = {
  items: SetListItem[];
  songsById: Record<string, SavedSong>;
  selectedItemId: string | null;
  playingIndex: number | null;
  onSelect(itemId: string): void;
  onRemove(itemId: string): void;
  onMoveUp(itemId: string): void;
  onMoveDown(itemId: string): void;
};

export default function SetList({
  items,
  songsById,
  selectedItemId,
  playingIndex,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
}: SetListProps) {
  return (
    <section className="flex max-h-[58vh] min-h-0 flex-col rounded-3xl border border-white/8 bg-bg1/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:max-h-[62vh] md:p-5">
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 bg-bg1/95 pb-3 backdrop-blur">
        <div>
          <h2 className="text-lg font-semibold text-text0">Set List</h2>
          <p className="text-sm text-text1">Build an ordered draft from your saved songs.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-text1">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-bg0/60 px-4 py-6 text-sm text-text1">
          Add songs from Saved Songs to start a draft set list.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-2">
          {items.map((item, index) => {
            const song = songsById[item.videoId];
            const isSelected = selectedItemId === item.id;
            const isMissing = !song;
            const isPlayingRow = playingIndex === index;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-accent/50 bg-accent/12 shadow-[inset_4px_0_0_0_#3B82F6]"
                    : isPlayingRow
                      ? "border-accent/35 bg-accent/8"
                    : isMissing
                      ? "border-white/8 bg-bg0/40 text-text1/70"
                      : "border-white/8 bg-bg0/55 hover:border-accent/30 hover:bg-white/[0.03]"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-sm font-semibold text-text1">{index + 1}</span>
                {isPlayingRow ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
                    aria-label="Currently playing"
                  />
                ) : (
                  <span className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                )}

                {song ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={song.thumbnailUrl}
                    alt={song.title}
                    className="h-12 w-20 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-[11px] text-text1/70">
                    Missing
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${isMissing ? "text-text1/70" : "text-text0"}`}>
                    {song?.title ?? "Missing video"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMoveUp(item.id);
                    }}
                    disabled={index === 0}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-text1 transition hover:border-accent/30 hover:text-text0 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${song?.title ?? "missing video"} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMoveDown(item.id);
                    }}
                    disabled={index === items.length - 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-text1 transition hover:border-accent/30 hover:text-text0 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${song?.title ?? "missing video"} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-text1 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200"
                    aria-label={`Remove ${song?.title ?? "missing video"} from set list`}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </section>
  );
}
