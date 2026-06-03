"use client";

import { ocrDoc, type OcrProgress } from "./ocr";
import { extractTextFromDoc, loadPdf } from "./pdf";
import type { ParseMethod } from "./types";

export interface ParseResult {
  text: string;
  method: ParseMethod;
  pages: number;
}

// A real text page yields hundreds of chars; scans yield ~0. Below this we OCR.
const TEXT_THRESHOLD = 100;

function stripped(s: string): number {
  return s.replace(/\s+/g, "").length;
}

export async function parsePdf(
  file: File,
  callbacks?: {
    onOcrStart?: () => void;
    onOcrProgress?: (p: OcrProgress) => void;
  },
): Promise<ParseResult> {
  const { doc, destroy } = await loadPdf(file);
  try {
    const text = await extractTextFromDoc(doc);
    if (stripped(text) >= TEXT_THRESHOLD) {
      return { text, method: "text", pages: doc.numPages };
    }
    // No usable text layer → OCR fallback (scanned document).
    callbacks?.onOcrStart?.();
    const ocrText = await ocrDoc(doc, callbacks?.onOcrProgress);
    if (stripped(ocrText) >= 1) {
      return { text: ocrText, method: "ocr", pages: doc.numPages };
    }
    return { text, method: "empty", pages: doc.numPages };
  } finally {
    await destroy();
  }
}
