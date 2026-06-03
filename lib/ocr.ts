"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { createWorker, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(["deu", "eng"], 1, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract",
      langPath: "/tessdata",
      gzip: false,
      errorHandler: (e) => console.error("[tesseract]", e),
    });
  }
  return workerPromise;
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}

export interface OcrProgress {
  page: number;
  totalPages: number;
}

const RENDER_SCALE = 2;

/**
 * Render every page of an already-loaded PDF to a canvas and OCR it.
 * Used as a fallback when a PDF has no extractable text layer (scans).
 */
export async function ocrDoc(
  doc: PDFDocumentProxy,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  const worker = await getWorker();
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.({ page: i, totalPages: doc.numPages });
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    // Paint a white background: PDFs that don't draw their own page fill render
    // onto a transparent canvas, which OCR reads as black-on-black (nothing).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // intent:"print" disables pdf.js's requestAnimationFrame-based scheduling,
    // which never fires in a background/inactive tab and would hang render().
    await page.render({
      canvas,
      viewport,
      intent: "print",
      background: "#ffffff",
    }).promise;
    const { data } = await worker.recognize(canvas.toDataURL("image/png"));
    pages.push(data.text);

    canvas.width = 0;
    canvas.height = 0;
  }

  return pages.join("\n\n");
}
