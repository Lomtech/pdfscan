"use client";

import { useMemo, useState } from "react";
import { termsOf, type SkillInput } from "@/lib/customizing";
import { CATEGORY_LABELS, type Category, type Skill } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

const EMPTY: SkillInput = {
  label: "",
  category: "programming",
  keywords: [],
  caseSensitive: false,
};

export function CustomizingPanel({
  taxonomy,
  reanalyzing,
  onUpsert,
  onDelete,
  onReset,
}: {
  taxonomy: Skill[];
  reanalyzing: boolean;
  onUpsert: (input: SkillInput, editId?: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<Category>("programming");
  const [keywords, setKeywords] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);

  const resetForm = () => {
    setEditId(null);
    setLabel("");
    setCategory("programming");
    setKeywords("");
    setCaseSensitive(false);
  };

  const startEdit = (s: Skill) => {
    setEditId(s.id);
    setLabel(s.label);
    setCategory(s.category);
    setKeywords(termsOf(s).join(", "));
    setCaseSensitive(!!s.caseSensitive);
    window.scrollTo({ top: document.getElementById("cust-form")?.offsetTop ?? 0, behavior: "smooth" });
  };

  const submit = () => {
    if (!label.trim()) return;
    onUpsert(
      {
        label: label.trim(),
        category,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        caseSensitive,
      },
      editId ?? undefined,
    );
    resetForm();
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? taxonomy.filter(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            termsOf(s).some((t) => t.toLowerCase().includes(q)),
        )
      : taxonomy;
    return list;
  }, [taxonomy, filter]);

  const inputCls =
    "px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm";

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="font-semibold text-sm">
          Customizing – Skill-Schlüsselwörter{" "}
          <span className="font-normal text-zinc-500">({taxonomy.length})</span>
          {reanalyzing && (
            <span className="ml-2 text-xs text-amber-600">
              werte neu aus…
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Auf Standard zurücksetzen
        </button>
      </div>

      {/* Add / edit form */}
      <div id="cust-form" className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className={inputCls}
          placeholder="Bezeichnung (z. B. Next.js)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <input
          className={inputCls}
          placeholder="Schlüsselwörter, kommagetrennt (z. B. NextJS, Next.js). Leer = Bezeichnung"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <select
          className={inputCls}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:col-span-2">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Groß-/Kleinschreibung beachten (z. B. für „REST", „SAP" — verhindert
          Treffer auf Alltagswörter)
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!label.trim()}
            className="px-3 py-1.5 rounded font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {editId ? "Speichern" : "Hinzufügen"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 rounded text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>

      {/* Filter + list */}
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <input
          className={`${inputCls} w-full`}
          placeholder="Skills filtern…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[28rem] overflow-y-auto">
        {filtered.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 px-4 py-2 text-sm"
          >
            <span className="font-medium w-40 shrink-0 truncate" title={s.label}>
              {s.label}
            </span>
            <span className="text-xs text-zinc-500 w-32 shrink-0">
              {CATEGORY_LABELS[s.category]}
            </span>
            <span
              className="flex-1 text-xs text-zinc-500 truncate"
              title={termsOf(s).join(", ")}
            >
              {termsOf(s).join(", ")}
              {s.caseSensitive && (
                <span className="ml-1 text-zinc-400">· Aa</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => startEdit(s)}
              className="text-xs text-zinc-400 hover:text-emerald-600"
              title="Bearbeiten"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              className="text-xs text-zinc-400 hover:text-red-600"
              title="Löschen"
            >
              ✕
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-sm text-zinc-500">
            Keine Treffer für „{filter}".
          </li>
        )}
      </ul>
    </section>
  );
}
