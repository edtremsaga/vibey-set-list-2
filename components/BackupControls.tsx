"use client";

import { useRef, useState } from "react";

const PREFIX = "sl_";

type BackupFile = {
  app: "set-list-driver";
  exportedAt: string;
  storage: Record<string, string>;
  version: 1;
};

export default function BackupControls() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportBackup = () => {
    const storage = Object.fromEntries(
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(PREFIX))
        .map((key) => [key, window.localStorage.getItem(key) ?? ""]),
    );
    const backup: BackupFile = { app: "set-list-driver", exportedAt: new Date().toISOString(), storage, version: 1 };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    link.download = `set-list-driver-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage(`Backup downloaded with ${Object.keys(storage).length} saved data entries.`);
  };

  const importBackup = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("This backup file is too large.");
      const backup = JSON.parse(await file.text()) as Partial<BackupFile>;
      if (backup.app !== "set-list-driver" || backup.version !== 1 || !backup.storage || typeof backup.storage !== "object") {
        throw new Error("Choose a Set List Driver backup file.");
      }
      const entries = Object.entries(backup.storage);
      if (!entries.length || entries.some(([key, value]) => !key.startsWith(PREFIX) || typeof value !== "string")) {
        throw new Error("This backup does not contain valid Set List Driver data.");
      }
      if (!window.confirm("Import this backup and replace the Set List Driver data in this Chrome profile?")) return;
      entries.forEach(([key, value]) => window.localStorage.setItem(key, value));
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import this backup.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={exportBackup} className="inline-flex min-h-10 items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-text0 hover:bg-white/[0.08]">Export Backup</button>
      <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-text0 hover:bg-white/[0.08]">Import Backup</button>
      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.target.value = ""; }} />
      {message ? <span role="status" className="text-xs text-text1">{message}</span> : null}
    </div>
  );
}
