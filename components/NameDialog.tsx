"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function NameDialog({ title, label, initialValue = "", onSave, onCancel }: {
  title: string;
  label: string;
  initialValue?: string;
  onSave(value: string): void;
  onCancel(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    input.current?.focus();
    input.current?.select();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); onCancel(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-white/15 bg-bg1 p-6 text-text0 shadow-2xl backdrop:bg-black/70">
      <form onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) { setError(`${label} is required.`); input.current?.focus(); return; }
        try { onSave(trimmed); } catch { setError("Could not save. Please try again. Your text is still here."); }
      }}>
        <h2 id={`${id}-title`} className="mb-4 text-lg font-semibold">{title}</h2>
        <label htmlFor={`${id}-input`} className="mb-2 block text-sm">{label}</label>
        <input ref={input} id={`${id}-input`} value={value} onChange={(event) => { setValue(event.target.value); setError(""); }}
          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
          className="w-full rounded-xl border border-white/20 bg-bg2 px-3 py-2 outline-none focus:border-accent" />
        {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/20 px-4 py-2">Cancel</button>
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-white">Save</button>
        </div>
      </form>
    </dialog>
  );
}
