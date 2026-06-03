import { allSkillTerms } from "./taxonomy";
import type { ExtractionResult, SkillHit } from "./types";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeBoundaryRegex(term: string, caseSensitive: boolean): RegExp {
  const esc = escapeRegex(term);
  const startsWord = /^[A-Za-z0-9]/.test(term);
  const endsWord = /[A-Za-z0-9]/.test(term[term.length - 1]);
  const left = startsWord ? "(?<![A-Za-z0-9_])" : "";
  const right = endsWord ? "(?![A-Za-z0-9_])" : "";
  const flags = caseSensitive ? "gu" : "giu";
  return new RegExp(`${left}${esc}${right}`, flags);
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
    const re = makeBoundaryRegex(term, caseSensitive);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
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
