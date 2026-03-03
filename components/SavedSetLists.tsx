"use client";

import type { SavedSetList } from "@/lib/storage";

type SavedSetListsProps = {
  lists: SavedSetList[];
  onLoad(id: string): void;
  onDelete(id: string): void;
};

export default function SavedSetLists({ lists, onLoad, onDelete }: SavedSetListsProps) {
  return (
    <section className="rounded-3xl border border-white/8 bg-bg1/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text0">Saved Set Lists</h2>
          <p className="text-sm text-text1">Load a saved snapshot into your draft.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-text1">
          {lists.length}
        </span>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-bg0/60 px-4 py-6 text-sm text-text1">
          No saved set lists yet.
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center gap-3 rounded-2xl border border-white/8 bg-bg0/55 px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text0">{list.name}</p>
                <p className="text-xs text-text1">
                  {new Date(list.createdAt).toLocaleString()} · {list.items.length} item{list.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onLoad(list.id)}
                className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-accent/40 bg-accent/12 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/18"
              >
                Load
              </button>
              <button
                type="button"
                onClick={() => onDelete(list.id)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-text1 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200"
                aria-label={`Delete ${list.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
