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
// Real prose is ~0.85+ letters among non-space chars. PDFs with broken text
// encoding (Type-3 fonts, missing ToUnicode) extract scrambled symbols/digits
// at ~0.10-0.16 — looks like "text" but is garbage. Below this we OCR instead.
const MIN_ALPHA_RATIO = 0.4;

function stripped(s: string): number {
  return s.replace(/\s+/g, "").length;
}

// True when the extracted text reads like real language, not mojibake.
function looksLikeRealText(s: string): boolean {
  const nonSpace = stripped(s);
  if (nonSpace < TEXT_THRESHOLD) return false;
  const letters = (s.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? []).length;
  return letters / nonSpace >= MIN_ALPHA_RATIO;
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
    if (looksLikeRealText(text)) {
      return { text, method: "text", pages: doc.numPages };
    }
    // No usable text layer (scan) or broken encoding (garbage) → OCR fallback.
    callbacks?.onOcrStart?.();
    const ocrText = await ocrDoc(doc, callbacks?.onOcrProgress);
    // Prefer OCR result; if OCR somehow yields less than the raw layer, keep
    // whichever has more real letters so we never regress.
    if (stripped(ocrText) >= 1) {
      return { text: ocrText, method: "ocr", pages: doc.numPages };
    }
    return { text, method: "empty", pages: doc.numPages };
  } finally {
    await destroy();
  }
}
