"use client";

import type { SavedSetList } from "@/lib/storage";
import { useEffect, useRef, useState } from "react";

type SavedSetListsProps = {
  lists: SavedSetList[];
  loadedSetId: string | null;
  onLoad(id: string): void;
  onDelete(id: string): void;
};

export default function SavedSetLists({
  lists,
  loadedSetId,
  onLoad,
  onDelete,
}: SavedSetListsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousOverflowRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-text0 transition hover:border-accent/30 hover:bg-white/[0.08]"
      >
        Saved Set Lists ({lists.length})
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-white/8 bg-bg1 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text0">Saved Set Lists</h2>
                <p className="text-sm text-text1">Load a saved snapshot into your draft.</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-text1 transition hover:border-white/20 hover:text-text0"
                aria-label="Close saved set lists"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {lists.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-bg0/60 px-4 py-6 text-sm text-text1">
                  No saved set lists yet.
                </div>
              ) : (
                lists.map((list) => (
                  <div
                    key={list.id}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
                      loadedSetId === list.id
                        ? "border-accent/40 bg-accent/10"
                        : "border-white/8 bg-bg0/55"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-text0">{list.name}</p>
                        {loadedSetId === list.id ? (
                          <span className="rounded-full border border-accent/30 bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">
                            Loaded
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-text1">
                        {new Date(list.createdAt).toLocaleString()} · {list.items.length} item{list.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onLoad(list.id);
                        setIsOpen(false);
                      }}
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
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
