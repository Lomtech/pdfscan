"use client";

import { BUILTIN_TAXONOMY, setActiveTaxonomy } from "./taxonomy";
import type { Category, Skill } from "./types";

const KEY = "pdf-skill-extractor:taxonomy:v1";

function clone(skills: Skill[]): Skill[] {
  return skills.map((s) => ({ ...s, aliases: s.aliases ? [...s.aliases] : undefined, matchTerms: s.matchTerms ? [...s.matchTerms] : undefined }));
}

/**
 * Load the user's customizing taxonomy from localStorage. On first run it is
 * seeded from the built-in set, persisted, and becomes editable. Also installs
 * it as the active taxonomy used by extraction/display.
 */
export function loadTaxonomy(): Skill[] {
  let skills: Skill[] = clone(BUILTIN_TAXONOMY);
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Skill[];
        if (Array.isArray(parsed) && parsed.length > 0) skills = parsed;
      } else {
        window.localStorage.setItem(KEY, JSON.stringify(skills));
      }
    } catch {
      // ignore corrupt storage, fall back to built-in
    }
  }
  setActiveTaxonomy(skills);
  return skills;
}

/** Persist the taxonomy and install it as active. */
export function saveTaxonomy(skills: Skill[]): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(skills));
    } catch {
      // storage full / unavailable — keep it active in-memory at least
    }
  }
  setActiveTaxonomy(skills);
}

/** Reset to the shipped built-in taxonomy. */
export function resetTaxonomy(): Skill[] {
  const fresh = clone(BUILTIN_TAXONOMY);
  saveTaxonomy(fresh);
  return fresh;
}

/** Build the effective keyword list shown/edited for a skill. */
export function termsOf(s: Skill): string[] {
  return s.matchTerms ?? [s.label, ...(s.aliases ?? [])];
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "skill"
  );
}

export interface SkillInput {
  label: string;
  category: Category;
  keywords: string[];
  caseSensitive: boolean;
}

/** Add or update a skill. If editId is given, that skill is replaced. */
export function upsertSkill(
  skills: Skill[],
  input: SkillInput,
  editId?: string,
): Skill[] {
  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);
  const label = input.label.trim();
  if (!label) return skills;

  const next: Skill = {
    id: editId ?? uniqueId(skills, slugify(label)),
    label,
    category: input.category,
    matchTerms: keywords.length > 0 ? keywords : [label],
    caseSensitive: input.caseSensitive || undefined,
  };

  if (editId) {
    return skills.map((s) => (s.id === editId ? next : s));
  }
  return [next, ...skills];
}

function uniqueId(skills: Skill[], base: string): string {
  const taken = new Set(skills.map((s) => s.id));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function deleteSkill(skills: Skill[], id: string): Skill[] {
  return skills.filter((s) => s.id !== id);
}
