"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function SaveChangesDialog({ name, onSave, onCancel }: {
  name: string;
  onSave(): void;
  onCancel(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); onCancel(); }}
    className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-white/15 bg-bg1 p-6 text-text0 shadow-2xl backdrop:bg-black/70">
    <h2 id={id} className="text-lg font-semibold">Save changes to ‘{name}’?</h2>
    <p className="mt-3 text-sm text-text1">Update this saved set list with the current songs and order. Its name stays the same.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 flex justify-end gap-3">
      <button type="button" onClick={onCancel} className="rounded-xl border border-white/20 px-4 py-2">Cancel</button>
      <button type="button" onClick={() => {
        try { onSave(); } catch { setError("Could not save. Your changes are still in the draft. Please try again."); }
      }} className="rounded-xl bg-blue-600 px-4 py-2 text-white">Save changes</button>
    </div>
  </dialog>;
}
