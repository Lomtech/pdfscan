import { skillById } from "./taxonomy";
import type { Category, DocRecord } from "./types";

export interface SkillStat {
  skillId: string;
  label: string;
  category: Category;
  totalCount: number;
  docCount: number;
  inDocs: string[];
}

export interface Aggregate {
  totalDocs: number;
  jdCount: number;
  cvCount: number;
  unknownCount: number;
  skillsTotal: SkillStat[];
  skillsInJDs: SkillStat[];
  skillsInCVs: SkillStat[];
}

function rollup(docs: DocRecord[]): SkillStat[] {
  const totals = new Map<string, { count: number; docs: Set<string> }>();
  for (const d of docs) {
    for (const h of d.extraction.skills) {
      const cur = totals.get(h.skillId) ?? { count: 0, docs: new Set<string>() };
      cur.count += h.count;
      cur.docs.add(d.name);
      totals.set(h.skillId, cur);
    }
  }
  const out: SkillStat[] = [];
  for (const [skillId, { count, docs: ds }] of totals) {
    const s = skillById(skillId);
    if (!s) continue;
    out.push({
      skillId,
      label: s.label,
      category: s.category,
      totalCount: count,
      docCount: ds.size,
      inDocs: Array.from(ds).sort(),
    });
  }
  out.sort((a, b) => b.totalCount - a.totalCount || a.label.localeCompare(b.label));
  return out;
}

export function aggregate(docs: DocRecord[]): Aggregate {
  const jds = docs.filter((d) => d.classification.type === "JD");
  const cvs = docs.filter((d) => d.classification.type === "CV");
  const unknowns = docs.filter((d) => d.classification.type === "unknown");
  return {
    totalDocs: docs.length,
    jdCount: jds.length,
    cvCount: cvs.length,
    unknownCount: unknowns.length,
    skillsTotal: rollup(docs),
    skillsInJDs: rollup(jds),
    skillsInCVs: rollup(cvs),
  };
}
