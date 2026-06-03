"use client";

import type { AiResult, AiSkill } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export interface AiConfig {
  apiKey: string;
  model: string;
}

const PROMPT = `Du analysierst die Seiten EINES Dokuments (Stellenanzeige, Tätigkeits-/Anforderungsprofil, Skill-Matrix oder Lebenslauf).

Extrahiere ALLE genannten fachlichen Skills: Programmiersprachen, Frameworks, Tools, Plattformen, Datenbanken, Methoden, Cloud/DevOps und Soft Skills.

Wichtig:
- Wenn das Dokument Skills BEWERTET (z. B. Matrix "Java 0 (0 – Keine Bekanntheit) von 5 (5 – Experte)"), gib das Level und das Maximum an (level=0, levelMax=5).
- "level": die geforderte/vorhandene Stufe als Zahl, sonst null.
- "required": true wenn Pflicht/zwingend, false wenn optional/wünschenswert, sonst null.
- Fasse Dubletten zusammen. Übersetze Skill-Namen NICHT, nutze die gängige Schreibweise (z. B. "JavaScript", "Spring Boot").

Antworte mit GENAU EINEM JSON-Objekt, KEIN weiterer Text, KEIN Markdown:
{"roleTitle": string|null, "docType": "JD"|"CV"|"profile"|"matrix"|"other", "skills": [{"name": string, "category": string, "level": number|null, "levelMax": number|null, "required": boolean|null}]}`;

function stripDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed.trim());
  } catch {
    // Find the outermost {...} if the model added stray prose.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Antwort war kein gültiges JSON");
  }
}

function coerceSkills(raw: unknown): AiSkill[] {
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as { skills?: unknown }).skills;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s): AiSkill | null => {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      if (!name) return null;
      const num = (v: unknown) => (typeof v === "number" ? v : null);
      return {
        name,
        category: typeof o.category === "string" ? o.category : null,
        level: num(o.level),
        levelMax: num(o.levelMax),
        required: typeof o.required === "boolean" ? o.required : null,
      };
    })
    .filter((s): s is AiSkill => s !== null);
}

/**
 * Send rendered page images to Claude vision and get structured skills back.
 * Runs entirely from the browser using the user's own API key.
 */
export async function analyzeWithClaude(
  pageImages: string[],
  cfg: AiConfig,
): Promise<AiResult> {
  const content: unknown[] = [{ type: "text", text: PROMPT }];
  for (const img of pageImages) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: stripDataUrl(img),
      },
    });
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message ?? JSON.stringify(err);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(`Claude API ${res.status}: ${detail || res.statusText}`);
  }

  const data = await res.json();
  const text: string = (data?.content ?? [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");

  const parsed = extractJson(text) as Record<string, unknown>;
  return {
    roleTitle:
      typeof parsed.roleTitle === "string" ? parsed.roleTitle : null,
    docType: typeof parsed.docType === "string" ? parsed.docType : null,
    skills: coerceSkills(parsed),
    model: cfg.model,
    at: Date.now(),
  };
}
