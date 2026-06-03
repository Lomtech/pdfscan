"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { aggregate } from "@/lib/aggregate";
import { classify } from "@/lib/classify";
import { buildWorkbook } from "@/lib/excel";
import { extract } from "@/lib/extract";
import { parsePdf } from "@/lib/parse";
import { clearAll, deleteDoc, listDocs, putDoc } from "@/lib/storage";
import { skillById } from "@/lib/taxonomy";
import { CustomizingPanel } from "./CustomizingPanel";
import {
  deleteSkill,
  loadTaxonomy,
  resetTaxonomy,
  saveTaxonomy,
  upsertSkill,
} from "@/lib/customizing";
import {
  CATEGORY_LABELS,
  type DocRecord,
  type DocType,
  type Skill,
} from "@/lib/types";

interface JobStatus {
  id: string;
  name: string;
  state: "queued" | "parsing" | "ocr" | "analyzing" | "done" | "error";
  message?: string;
  ocrPage?: number;
  ocrTotal?: number;
}

function newId() {
  return (
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)
  );
}

function typeBadge(t: DocType) {
  const base = "text-xs font-semibold px-2 py-0.5 rounded";
  if (t === "JD") return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200`;
  if (t === "CV") return `${base} bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200`;
  return `${base} bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300`;
}

export default function Home() {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [taxonomy, setTaxonomy] = useState<Skill[]>([]);
  const [showCust, setShowCust] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    setTaxonomy(loadTaxonomy());
    listDocs().then((d) => {
      setDocs(d);
      setLoaded(true);
    });
  }, []);

  const agg = useMemo(() => aggregate(docs), [docs, taxonomy]);

  const processFiles = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfFiles.length === 0) return;

    const newJobs: JobStatus[] = pdfFiles.map((f) => ({
      id: newId(),
      name: f.name,
      state: "queued",
    }));
    setJobs((j) => [...j, ...newJobs]);

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      const jobId = newJobs[i].id;
      try {
        setJobs((j) =>
          j.map((x) => (x.id === jobId ? { ...x, state: "parsing" } : x)),
        );
        const { text, method } = await parsePdf(file, {
          onOcrStart: () =>
            setJobs((j) =>
              j.map((x) => (x.id === jobId ? { ...x, state: "ocr" } : x)),
            ),
          onOcrProgress: ({ page, totalPages }) =>
            setJobs((j) =>
              j.map((x) =>
                x.id === jobId
                  ? { ...x, state: "ocr", ocrPage: page, ocrTotal: totalPages }
                  : x,
              ),
            ),
        });
        setJobs((j) =>
          j.map((x) => (x.id === jobId ? { ...x, state: "analyzing" } : x)),
        );
        const classification = classify(text);
        const extraction = extract(text);
        const rec: DocRecord = {
          id: jobId,
          name: file.name,
          bytes: file.size,
          text,
          parseMethod: method,
          classification,
          extraction,
          addedAt: Date.now(),
        };
        await putDoc(rec);
        setDocs((d) => [...d, rec]);
        setJobs((j) =>
          j.map((x) => (x.id === jobId ? { ...x, state: "done" } : x)),
        );
      } catch (e) {
        setJobs((j) =>
          j.map((x) =>
            x.id === jobId
              ? { ...x, state: "error", message: (e as Error).message }
              : x,
          ),
        );
      }
    }
    setTimeout(() => {
      setJobs((j) => j.filter((x) => x.state !== "done"));
    }, 2000);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      void processFiles(files);
    },
    [processFiles],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      void processFiles(files);
      e.target.value = "";
    },
    [processFiles],
  );

  const onDelete = useCallback(async (id: string) => {
    await deleteDoc(id);
    setDocs((d) => d.filter((x) => x.id !== id));
  }, []);

  const onClearAll = useCallback(async () => {
    if (!confirm("Alle Dokumente und Auswertungen löschen?")) return;
    await clearAll();
    setDocs([]);
  }, []);

  const onExport = useCallback(async () => {
    if (docs.length === 0) return;
    setExporting(true);
    try {
      const blob = await buildWorkbook(docs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `skill-auswertung-${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [docs]);

  // Re-run extraction on already-stored text (no PDF re-parsing) and persist.
  const reanalyze = useCallback(async (current: DocRecord[]) => {
    if (current.length === 0) return;
    setReanalyzing(true);
    try {
      const updated = current.map((d) => ({ ...d, extraction: extract(d.text) }));
      await Promise.all(updated.map((r) => putDoc(r)));
      setDocs(updated);
    } finally {
      setReanalyzing(false);
    }
  }, []);

  // Single mutation path: persist + activate + re-analyze open documents.
  const applyTaxonomy = useCallback(
    async (next: Skill[]) => {
      saveTaxonomy(next);
      setTaxonomy(next);
      await reanalyze(docs);
    },
    [docs, reanalyze],
  );

  const onResetTaxonomy = useCallback(() => {
    if (
      !confirm(
        "Customizing auf den Standard zurücksetzen? Eigene Einträge gehen verloren.",
      )
    )
      return;
    void applyTaxonomy(resetTaxonomy());
  }, [applyTaxonomy]);

  const topSkills = agg.skillsTotal;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          PDF Skill Extractor
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm max-w-2xl">
          Stellenanzeigen und Lebensläufe als PDF einwerfen → Hard- und
          Soft-Skills werden lokal extrahiert → Auswertung als Excel exportieren.
          Alles läuft im Browser, kein Upload an einen Server.
        </p>
      </header>

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "rounded-xl border-2 border-dashed transition-colors p-10 text-center cursor-pointer",
          dragOver
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900",
        ].join(" ")}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept="application/pdf"
          className="hidden"
          onChange={onFileInput}
        />
        <p className="text-lg font-medium">PDFs hierher ziehen</p>
        <p className="text-sm text-zinc-500 mt-1">
          oder klicken, um mehrere PDFs auszuwählen
        </p>
      </section>

      {jobs.length > 0 && (
        <section className="mt-6 space-y-2">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="flex items-center gap-3 px-3 py-2 rounded bg-zinc-100 dark:bg-zinc-800 text-sm"
            >
              <span className="flex-1 truncate">{j.name}</span>
              <span className="text-xs text-zinc-500">
                {j.state === "queued" && "wartet"}
                {j.state === "parsing" && "PDF wird gelesen…"}
                {j.state === "ocr" &&
                  (j.ocrTotal
                    ? `Scan erkannt – OCR (Seite ${j.ocrPage}/${j.ocrTotal})…`
                    : "Scan erkannt – OCR startet…")}
                {j.state === "analyzing" && "Auswertung läuft…"}
                {j.state === "done" && "fertig"}
                {j.state === "error" && `Fehler: ${j.message}`}
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm">
          <span className="font-semibold">{agg.totalDocs}</span> Dokumente
          {" · "}
          <span className="text-emerald-700 dark:text-emerald-400">
            {agg.jdCount} JD
          </span>
          {" · "}
          <span className="text-sky-700 dark:text-sky-400">
            {agg.cvCount} CV
          </span>
          {agg.unknownCount > 0 && (
            <>
              {" · "}
              <span className="text-zinc-500">
                {agg.unknownCount} unklar
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCust((v) => !v)}
            className="px-4 py-2 rounded font-semibold text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {showCust ? "Customizing schließen" : `Skills verwalten (${taxonomy.length})`}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={docs.length === 0 || exporting}
            className="px-4 py-2 rounded font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? "Erstelle Excel…" : "Excel herunterladen"}
          </button>
          <button
            type="button"
            onClick={onClearAll}
            disabled={docs.length === 0}
            className="px-4 py-2 rounded font-semibold text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Alles löschen
          </button>
        </div>
      </section>

      {showCust && (
        <CustomizingPanel
          taxonomy={taxonomy}
          reanalyzing={reanalyzing}
          onUpsert={(input, editId) =>
            void applyTaxonomy(upsertSkill(taxonomy, input, editId))
          }
          onDelete={(id) => void applyTaxonomy(deleteSkill(taxonomy, id))}
          onReset={onResetTaxonomy}
        />
      )}

      {loaded && docs.length === 0 && jobs.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-500">
          Noch keine PDFs verarbeitet. Wirf einen Stapel oben rein.
        </p>
      )}

      {docs.length > 0 && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <h2 className="px-4 py-3 font-semibold border-b border-zinc-200 dark:border-zinc-800 text-sm">
              Dokumente
            </h2>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-2 text-sm"
                >
                  <span className={typeBadge(d.classification.type)}>
                    {d.classification.type}
                  </span>
                  <span className="flex-1 truncate" title={d.name}>
                    {d.name}
                  </span>
                  {d.parseMethod === "ocr" && (
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      title="Per Texterkennung (OCR) ausgelesen – war ein Scan ohne Text-Layer"
                    >
                      OCR
                    </span>
                  )}
                  {d.parseMethod === "empty" && (
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                      title="Kein Text lesbar – auch OCR fand nichts"
                    >
                      leer
                    </span>
                  )}
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {d.extraction.skills.length} Skills
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(d.id)}
                    className="text-zinc-400 hover:text-red-600 text-xs"
                    title="Löschen"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <h2 className="px-4 py-3 font-semibold border-b border-zinc-200 dark:border-zinc-800 text-sm">
              Alle Skills im Stapel{" "}
              <span className="font-normal text-zinc-500">
                ({topSkills.length})
              </span>
            </h2>
            {topSkills.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-500">
                Keine Skills erkannt.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
                {topSkills.map((s) => {
                  const meta = skillById(s.skillId);
                  return (
                    <li
                      key={s.skillId}
                      className="flex items-center gap-3 px-4 py-2 text-sm"
                    >
                      <span className="flex-1 truncate">{s.label}</span>
                      <span className="text-xs text-zinc-500">
                        {meta ? CATEGORY_LABELS[meta.category] : ""}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {s.totalCount}
                      </span>
                      <span className="text-xs text-zinc-500 tabular-nums w-12 text-right">
                        in {s.docCount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      <footer className="mt-16 text-xs text-zinc-500 text-center">
        Daten liegen ausschließlich lokal im Browser (IndexedDB). Excel-Export
        nutzt ExcelJS, PDF-Parsing pdf.js.
      </footer>
    </main>
  );
}
