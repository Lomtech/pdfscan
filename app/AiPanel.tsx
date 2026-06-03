"use client";

import type { AiProvider, ModelOption } from "@/lib/ai";

export function AiPanel({
  provider,
  baseUrl,
  apiKey,
  model,
  modelOptions,
  modelsLoading,
  modelsError,
  pullName,
  pulling,
  pullProgress,
  onChangePullName,
  onPullModel,
  onChangeProvider,
  onChangeBaseUrl,
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
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  modelOptions: ModelOption[];
  modelsLoading: boolean;
  modelsError: string;
  pullName: string;
  pulling: boolean;
  pullProgress: string;
  onChangePullName: (v: string) => void;
  onPullModel: () => void;
  onChangeProvider: (v: AiProvider) => void;
  onChangeBaseUrl: (v: string) => void;
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
  const ready = provider === "anthropic" ? !!apiKey.trim() : !!baseUrl.trim();
  const remoteOrigin =
    typeof window !== "undefined" &&
    !/^(localhost|127\.0\.0\.1|\[::1\])/.test(window.location.hostname);
  const localEndpointOnRemote =
    provider === "local" &&
    remoteOrigin &&
    /localhost|127\.0\.0\.1/.test(baseUrl);
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => onChangeProvider("anthropic")}
              className={
                provider === "anthropic"
                  ? "px-3 py-1.5 bg-violet-600 text-white font-semibold"
                  : "px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }
            >
              ☁️ Cloud (Anthropic)
            </button>
            <button
              type="button"
              onClick={() => onChangeProvider("local")}
              className={
                provider === "local"
                  ? "px-3 py-1.5 bg-emerald-600 text-white font-semibold"
                  : "px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }
            >
              🔒 Souverän · lokal / Air-Gap
            </button>
          </div>
          {provider === "local" && (
            <input
              className={`${inputCls} flex-1 min-w-[260px]`}
              placeholder="Base-URL (z. B. http://localhost:11434/v1)"
              value={baseUrl}
              onChange={(e) => onChangeBaseUrl(e.target.value)}
            />
          )}
        </div>
        <p
          className={
            provider === "local"
              ? "text-xs text-emerald-700 dark:text-emerald-400"
              : "text-xs text-zinc-500"
          }
        >
          {provider === "local"
            ? "🔒 Souverän: PDFs und Tokens verlassen deine Umgebung nicht — Inferenz läuft auf dem angegebenen Endpoint (lokal/VPC)."
            : "☁️ Cloud: Seitenbilder gehen mit deinem Schlüssel an Anthropic. PDFs selbst bleiben lokal."}
        </p>
        <input
          type="password"
          className={`${inputCls} w-full`}
          placeholder={
            provider === "anthropic"
              ? "Anthropic API-Key (sk-ant-…)"
              : "API-Key / Token (optional bei lokal)"
          }
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
            disabled={modelsLoading || !ready}
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
        {provider === "local" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-zinc-500">Modell ziehen:</span>
            <input
              className={`${inputCls} flex-1 min-w-[180px]`}
              placeholder="z. B. qwen2.5vl:7b  (oder :32b für mehr Genauigkeit)"
              value={pullName}
              onChange={(e) => onChangePullName(e.target.value)}
            />
            <button
              type="button"
              onClick={onPullModel}
              disabled={pulling || !pullName.trim() || !baseUrl.trim()}
              className="px-3 py-1.5 rounded text-sm border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pulling ? "lädt…" : "⬇ Modell herunterladen"}
            </button>
            {pullProgress && (
              <span className="text-xs text-zinc-600 dark:text-zinc-400 break-words">
                {pullProgress}
              </span>
            )}
          </div>
        )}
        {provider === "local" && !modelsError && modelOptions.length > 0 && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            ✓ Ollama erreichbar · {modelOptions.length} Modell(e) lokal
          </p>
        )}
        {localEndpointOnRemote && (
          <p className="text-xs text-amber-600">
            ⚠️ Souverän mit localhost-Endpoint geht nur, wenn die App selbst
            lokal läuft – nicht über diese öffentliche URL. Repo lokal starten
            („npm run dev" → http://localhost:3035) oder intern hosten.
          </p>
        )}
        {modelsError && (
          <p className="text-xs text-red-600 break-words">{modelsError}</p>
        )}
      </div>

      <div className="px-4 pb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRunAll}
          disabled={busy || !ready || pendingCount === 0}
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
