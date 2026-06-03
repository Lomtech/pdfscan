"use client";

import ExcelJS from "exceljs";
import { aggregate, type SkillStat } from "./aggregate";
import { skillById } from "./taxonomy";
import { CATEGORY_LABELS, type DocRecord } from "./types";

const THIN: Partial<ExcelJS.Border> = {
  style: "thin",
  color: { argb: "FFD9DCE1" },
};

function autoWidth(ws: ExcelJS.Worksheet, max = 60) {
  ws.columns.forEach((col) => {
    let w = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = String(cell.value ?? "");
      if (v.length > w) w = Math.min(v.length, max);
    });
    col.width = w + 2;
  });
}

/**
 * Apply the standard look to a finished sheet: dark header, frozen header row,
 * thin borders, wrapped + top-aligned body cells, auto-filter. Call AFTER all
 * rows are added. `center` lists 1-based column indexes to center horizontally.
 */
function styleSheet(
  ws: ExcelJS.Worksheet,
  opts: { center?: number[]; widthCap?: number } = {},
) {
  autoWidth(ws, opts.widthCap ?? 60);
  const center = new Set(opts.center ?? []);

  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF111827" } } };
  });

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell, colNumber) => {
      cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
      cell.alignment = {
        vertical: "top",
        wrapText: true,
        horizontal: center.has(colNumber) ? "center" : "left",
      };
    });
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columnCount },
  };
}

function fillSkillSheet(ws: ExcelJS.Worksheet, stats: SkillStat[]) {
  ws.columns = [
    { header: "Skill", key: "label" },
    { header: "Kategorie", key: "category" },
    { header: "Treffer gesamt", key: "totalCount" },
    { header: "In Dokumenten", key: "docCount" },
    { header: "Dokumente", key: "inDocs" },
  ];
  for (const s of stats) {
    ws.addRow({
      label: s.label,
      category: CATEGORY_LABELS[s.category],
      totalCount: s.totalCount,
      docCount: s.docCount,
      inDocs: s.inDocs.join("; "),
    });
  }
  styleSheet(ws, { center: [3, 4] });
}

export async function buildWorkbook(docs: DocRecord[]): Promise<Blob> {
  const agg = aggregate(docs);
  const wb = new ExcelJS.Workbook();
  wb.creator = "PDF Skill Extractor";
  wb.created = new Date();

  // Sheet 1: Übersicht
  const overview = wb.addWorksheet("Übersicht");
  overview.columns = [
    { header: "Dokument", key: "name" },
    { header: "Typ", key: "type" },
    { header: "Konfidenz", key: "confidence" },
    { header: "Berufserfahrung (Jahre)", key: "years" },
    { header: "Anzahl Skills", key: "skillCount" },
    { header: "Top-Skills (Top 8)", key: "topSkills" },
    { header: "Sprachen", key: "languages" },
    { header: "Ausbildung", key: "education" },
    { header: "Größe (KB)", key: "kb" },
  ];
  for (const d of docs) {
    const topSkills = d.extraction.skills
      .slice(0, 8)
      .map((h) => `${skillById(h.skillId)?.label ?? h.skillId} (${h.count})`)
      .join(", ");
    overview.addRow({
      name: d.name,
      type: d.classification.type,
      confidence: Math.round(d.classification.confidence * 100) + "%",
      years: d.extraction.yearsExperience ?? "",
      skillCount: d.extraction.skills.length,
      topSkills,
      languages: d.extraction.spokenLanguages.join("; "),
      education: d.extraction.educationKeywords.join("; "),
      kb: Math.round(d.bytes / 1024),
    });
  }
  // Summary row
  overview.addRow({});
  const sumRow = overview.addRow({
    name: `Σ ${agg.totalDocs} Dokumente`,
    type: `${agg.jdCount} JD / ${agg.cvCount} CV / ${agg.unknownCount} ?`,
  });
  styleSheet(overview, { center: [3, 4, 5, 9] });
  sumRow.font = { bold: true };

  // Sheet 2-4: Skill rollups
  fillSkillSheet(wb.addWorksheet("Skills gesamt"), agg.skillsTotal);
  fillSkillSheet(wb.addWorksheet("Skills JDs"), agg.skillsInJDs);
  fillSkillSheet(wb.addWorksheet("Skills CVs"), agg.skillsInCVs);

  // Sheet 5: Per-PDF Detail (long format)
  const detail = wb.addWorksheet("Pro PDF (Detail)");
  detail.columns = [
    { header: "Dokument", key: "name" },
    { header: "Typ", key: "type" },
    { header: "Skill", key: "skill" },
    { header: "Kategorie", key: "category" },
    { header: "Treffer", key: "count" },
  ];
  for (const d of docs) {
    for (const h of d.extraction.skills) {
      const s = skillById(h.skillId);
      if (!s) continue;
      detail.addRow({
        name: d.name,
        type: d.classification.type,
        skill: s.label,
        category: CATEGORY_LABELS[s.category],
        count: h.count,
      });
    }
  }
  styleSheet(detail, { center: [5] });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
