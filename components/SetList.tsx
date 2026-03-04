"use client";

import type { SavedSong, SetListItem } from "@/lib/storage";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";

type SetListProps = {
  items: SetListItem[];
  songsById: Record<string, SavedSong>;
  selectedItemId: string | null;
  playingIndex: number | null;
  isReorderDisabled: boolean;
  onSelect(itemId: string): void;
  onRemove(itemId: string): void;
  onReorder(nextItems: SetListItem[]): void;
};

export default function SetList({
  items,
  songsById,
  selectedItemId,
  playingIndex,
  isReorderDisabled,
  onSelect,
  onRemove,
  onReorder,
}: SetListProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [openInfoItemId, setOpenInfoItemId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 220,
        tolerance: 8,
      },
    })
  );

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

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!sectionRef.current?.contains(event.target as Node)) {
        setOpenInfoItemId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (isReorderDisabled || !over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return;
    }

    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <section
      ref={sectionRef}
      className="flex max-h-[58vh] min-h-0 flex-col rounded-3xl border border-white/8 bg-bg1/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:max-h-[62vh] md:p-5"
    >
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
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <SortableSetListRow
                    key={item.id}
                    item={item}
                    index={index}
                    song={songsById[item.videoId]}
                    isSelected={selectedItemId === item.id}
                    isPlayingRow={playingIndex === index}
                    isTouchDevice={isTouchDevice}
                    openInfoItemId={openInfoItemId}
                    setOpenInfoItemId={setOpenInfoItemId}
                    isReorderDisabled={isReorderDisabled}
                    onSelect={onSelect}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </section>
  );
}

type SortableSetListRowProps = {
  item: SetListItem;
  index: number;
  song: SavedSong | undefined;
  isSelected: boolean;
  isPlayingRow: boolean;
  isTouchDevice: boolean;
  openInfoItemId: string | null;
  setOpenInfoItemId: React.Dispatch<React.SetStateAction<string | null>>;
  isReorderDisabled: boolean;
  onSelect(itemId: string): void;
  onRemove(itemId: string): void;
};

function SortableSetListRow({
  item,
  index,
  song,
  isSelected,
  isPlayingRow,
  isTouchDevice,
  openInfoItemId,
  setOpenInfoItemId,
  isReorderDisabled,
  onSelect,
  onRemove,
}: SortableSetListRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: isReorderDisabled,
  });
  const isMissing = !song;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item.id);
        }
      }}
      className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        isDragging
          ? "border-accent/50 bg-bg2 shadow-2xl"
          : isSelected
            ? "border-accent/50 bg-accent/12 shadow-[inset_4px_0_0_0_#3B82F6]"
            : isPlayingRow
              ? "border-accent/35 bg-accent/8"
              : isMissing
                ? "border-white/8 bg-bg0/40 text-text1/70"
                : "border-white/8 bg-bg0/55 hover:border-accent/30 hover:bg-white/[0.03]"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...(isReorderDisabled ? {} : listeners)}
        onClick={(event) => event.stopPropagation()}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-base text-text1 transition ${
          isReorderDisabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-grab active:cursor-grabbing hover:border-accent/30 hover:text-text0"
        }`}
        aria-label={`Reorder ${song?.title ?? "missing video"}`}
      >
        ≡
      </button>
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
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <p className={`truncate text-sm font-medium ${isMissing ? "text-text1/70" : "text-text0"}`}>
              {song?.title ?? "Missing video"}
            </p>
            {!isTouchDevice && !isMissing ? (
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden max-w-xs rounded-xl border border-white/10 bg-bg2 px-3 py-2 text-xs leading-5 text-text0 shadow-xl group-hover:block">
                {song.title}
              </div>
            ) : null}
          </div>

          {isTouchDevice && !isMissing ? (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenInfoItemId((current) => (current === item.id ? null : item.id));
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/12 bg-white/5 text-xs font-semibold text-text1"
                aria-label={`Show full title for ${song.title}`}
              >
                i
              </button>
              {openInfoItemId === item.id ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-white/10 bg-bg2 px-3 py-2 text-xs leading-5 text-text0 shadow-xl">
                  {song.title}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
}
