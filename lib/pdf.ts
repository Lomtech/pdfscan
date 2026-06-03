"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const lib = await import("pdfjs-dist");
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    })();
  }
  return pdfjsLibPromise;
}

export async function loadPdf(file: Blob): Promise<{
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
}> {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await loadingTask.promise;
  return { doc, destroy: () => loadingTask.destroy() };
}

export async function extractTextFromDoc(doc: PDFDocumentProxy): Promise<string> {
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const txt = tc.items
      .map((it) => ("str" in it ? (it as TextItem).str : ""))
      .join(" ");
    pages.push(txt);
  }
  return pages.join("\n\n");
}
