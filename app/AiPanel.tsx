"use client";

import type { ModelOption } from "@/lib/ai";

export function AiPanel({
  apiKey,
  model,
  modelOptions,
  modelsLoading,
  onLoadModels,
  onChangeKey,
  onChangeModel,
  onSave,
  onRunAll,
  onDownload,
  onDownloadExcel,
  busy,
  progress,
  analyzedCount,
  withBlobCount,
  pendingCount,
  totalDocs,
}: {
  apiKey: string;
  model: string;
  modelOptions: ModelOption[];
  modelsLoading: boolean;
  onLoadModels: () => void;
  onChangeKey: (v: string) => void;
  onChangeModel: (v: string) => void;
  onSave: () => void;
  onRunAll: () => void;
  onDownload: () => void;
  onDownloadExcel: () => void;
  busy: boolean;
  progress: string;
  analyzedCount: number;
  withBlobCount: number;
  pendingCount: number;
  totalDocs: number;
}) {
  const inputCls =
    "px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm";
  const oldDocs = totalDocs - withBlobCount;
  // Custom only when the field is empty (user picked "Benutzerdefiniert") or the
  // model isn't in a loaded list. Before any list is loaded, show the current
  // model as the selected option (no stray custom input).
  const isCustomModel =
    model === "" ||
    (modelOptions.length > 0 && !modelOptions.some((o) => o.id === model));

  return (
    <section className="mt-6 rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/20">
      <div className="px-4 py-3 border-b border-violet-200 dark:border-violet-900">
        <h2 className="font-semibold text-sm">
          KI-Analyse (Claude Vision) – Skills mit Level{" "}
          <span className="font-normal text-zinc-500">
            · {analyzedCount} analysiert
          </span>
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Rendert jede Seite als Bild und lässt Claude sie lesen → strukturiertes
          JSON {`{skill, level, levelMax, kategorie}`}. Versteht Matrix-Bewertungen
          („Java 0 von 5"), verklebte Chips und Homonyme. Nur das Seitenbild geht
          an die API (mit deinem Schlüssel) – die PDFs bleiben lokal. Kosten je
          nach Modell pro Seite.
        </p>
      </div>

      <div className="px-4 py-3 space-y-2">
        <input
          type="password"
          className={`${inputCls} w-full`}
          placeholder="Anthropic API-Key (sk-ant-…)"
          value={apiKey}
          onChange={(e) => onChangeKey(e.target.value)}
          autoComplete="off"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Modell:</span>
          <select
            className={inputCls}
            value={isCustomModel ? "__custom__" : model}
            onChange={(e) =>
              onChangeModel(e.target.value === "__custom__" ? "" : e.target.value)
            }
          >
            {modelOptions.length === 0 && model && (
              <option value={model}>{model}</option>
            )}
            {modelOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name === o.id ? o.id : `${o.name} — ${o.id}`}
              </option>
            ))}
            <option value="__custom__">Benutzerdefiniert…</option>
          </select>
          {isCustomModel && (
            <input
              className={`${inputCls} flex-1 min-w-[220px]`}
              placeholder="Modell-ID (z. B. claude-haiku-4-5)"
              value={model}
              onChange={(e) => onChangeModel(e.target.value)}
            />
          )}
          <button
            type="button"
            onClick={onLoadModels}
            disabled={modelsLoading || !apiKey.trim()}
            title="Verfügbare Modelle aus der Anthropic-API laden"
            className="px-3 py-1.5 rounded text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {modelsLoading ? "lädt…" : "↻ Modelle laden"}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-3 py-1.5 rounded text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Key speichern
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRunAll}
          disabled={busy || !apiKey.trim() || pendingCount === 0}
          className="px-4 py-2 rounded font-semibold text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy
            ? "Analysiere…"
            : pendingCount === 0 && analyzedCount > 0
              ? "Alle analysiert ✓"
              : `Analysieren (${pendingCount})`}
        </button>
        <button
          type="button"
          onClick={onDownloadExcel}
          disabled={analyzedCount === 0}
          className="px-4 py-2 rounded font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          KI-Excel herunterladen
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={analyzedCount === 0}
          className="px-4 py-2 rounded font-semibold text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          KI-JSON herunterladen
        </button>
        {progress && (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {progress}
          </span>
        )}
        {oldDocs > 0 && (
          <span className="text-xs text-amber-600">
            {oldDocs} Dokument(e) ohne gespeicherte PDF-Daten – für KI bitte neu
            hochladen.
          </span>
        )}
      </div>
    </section>
  );
}
