import { allSkillTerms } from "./taxonomy";
import type { ExtractionResult, SkillHit } from "./types";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeTermRegex(term: string, caseSensitive: boolean): RegExp {
  return new RegExp(escapeRegex(term), caseSensitive ? "gu" : "giu");
}

const WORD = /[A-Za-z0-9_]/;
const LOWER_OR_DIGIT = /[a-z0-9äöüß]/;
const UPPER = /[A-ZÄÖÜ]/;

// Boundary check on the ACTUAL matched text (case matters even when matching is
// case-insensitive). Valid when: at the document edge, next to a non-word char,
// OR a real camelCase hump — which lets "Java" be found inside glued skill-chip
// lists like "AngularJavaSpring" that some PDFs export without separators.
function validLeft(text: string, start: number, matched: string): boolean {
  const first = matched[0];
  if (!WORD.test(first)) return true; // term begins with punctuation (.NET, …)
  if (start === 0) return true;
  const prev = text[start - 1];
  if (!WORD.test(prev)) return true;
  return LOWER_OR_DIGIT.test(prev) && UPPER.test(first); // lower→Upper hump
}

function validRight(text: string, end: number, matched: string): boolean {
  const last = matched[matched.length - 1];
  if (!WORD.test(last)) return true; // term ends with punctuation (C++, C#, …)
  if (end >= text.length) return true;
  const next = text[end];
  if (!WORD.test(next)) return true;
  return LOWER_OR_DIGIT.test(last) && UPPER.test(next); // lower→Upper hump
}

const YEARS_RE =
  /(\d+)\s*\+?\s*(?:jahre?|jahren|years?)\s*(?:berufs)?(?:erfahrung|experience|in|im|of|als)?/giu;

const EDUCATION_RE =
  /\b(bachelor|master|diplom|magister|promotion|doktor|phd|ph\.d\.|abitur|fachabitur|mittlere reife|realschule|gymnasium|berufsausbildung|ausbildung|fachinformatiker|m\.sc\.|b\.sc\.|m\.a\.|b\.a\.|mba|m\.eng\.|b\.eng\.|staatsexamen)\b/giu;

const LANG_LEVEL_RE =
  /\b(deutsch|englisch|französisch|franzosisch|spanisch|italienisch|portugiesisch|niederländisch|niederlandisch|russisch|chinesisch|japanisch|polnisch|türkisch|turkisch|arabisch|english|german|french|spanish|italian|portuguese|dutch|russian|chinese|japanese|polish|turkish|arabic)\s*[:\-–—()]*\s*(muttersprache|verhandlungssicher|fließend|fliessend|c2|c1|b2|b1|a2|a1|grundkenntnisse|gute kenntnisse|sehr gute kenntnisse|native|fluent|business|advanced|intermediate|basic|conversational)?/giu;

export function extract(text: string): ExtractionResult {
  const hits = new Map<string, number>();
  const claimed: { start: number; end: number }[] = [];

  for (const { skill, term, caseSensitive } of allSkillTerms()) {
    const re = makeTermRegex(term, caseSensitive);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!validLeft(text, start, m[0]) || !validRight(text, end, m[0])) {
        continue;
      }
      const overlaps = claimed.some(
        (r) => !(end <= r.start || start >= r.end),
      );
      if (overlaps) continue;
      claimed.push({ start, end });
      hits.set(skill.id, (hits.get(skill.id) ?? 0) + 1);
    }
  }

  const skills: SkillHit[] = Array.from(hits.entries())
    .map(([skillId, count]) => ({ skillId, count }))
    .sort((a, b) => b.count - a.count);

  let yearsExperience: number | null = null;
  const yearsMatches: number[] = [];
  let ym: RegExpExecArray | null;
  YEARS_RE.lastIndex = 0;
  while ((ym = YEARS_RE.exec(text)) !== null) {
    const n = parseInt(ym[1], 10);
    if (!Number.isNaN(n) && n > 0 && n < 60) yearsMatches.push(n);
  }
  if (yearsMatches.length > 0) {
    yearsExperience = Math.max(...yearsMatches);
  }

  const eduSet = new Set<string>();
  let em: RegExpExecArray | null;
  EDUCATION_RE.lastIndex = 0;
  while ((em = EDUCATION_RE.exec(text)) !== null) {
    eduSet.add(em[0].toLowerCase());
  }

  const langSet = new Set<string>();
  let lm: RegExpExecArray | null;
  LANG_LEVEL_RE.lastIndex = 0;
  while ((lm = LANG_LEVEL_RE.exec(text)) !== null) {
    const lang = lm[1].toLowerCase();
    const level = lm[2]?.toLowerCase().trim();
    langSet.add(level ? `${lang} (${level})` : lang);
  }

  return {
    skills,
    yearsExperience,
    educationKeywords: Array.from(eduSet),
    spokenLanguages: Array.from(langSet),
  };
}
