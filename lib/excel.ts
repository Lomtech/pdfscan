"use client";

import ExcelJS from "exceljs";
import { aggregate, type SkillStat } from "./aggregate";
import { skillById } from "./taxonomy";
import { CATEGORY_LABELS, type DocRecord } from "./types";

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = String(cell.value ?? "");
      if (v.length > max) max = Math.min(v.length, 60);
    });
    col.width = max + 2;
  });
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
}

function fillSkillSheet(ws: ExcelJS.Worksheet, stats: SkillStat[]) {
  ws.columns = [
    { header: "Skill", key: "label" },
    { header: "Kategorie", key: "category" },
    { header: "Treffer gesamt", key: "totalCount" },
    { header: "In Dokumenten", key: "docCount" },
    { header: "Dokumente", key: "inDocs" },
  ];
  styleHeader(ws.getRow(1));
  for (const s of stats) {
    ws.addRow({
      label: s.label,
      category: CATEGORY_LABELS[s.category],
      totalCount: s.totalCount,
      docCount: s.docCount,
      inDocs: s.inDocs.join("; "),
    });
  }
  autoWidth(ws);
  ws.views = [{ state: "frozen", ySplit: 1 }];
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
  styleHeader(overview.getRow(1));
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
  sumRow.font = { bold: true };
  autoWidth(overview);
  overview.views = [{ state: "frozen", ySplit: 1 }];

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
  styleHeader(detail.getRow(1));
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
  autoWidth(detail);
  detail.views = [{ state: "frozen", ySplit: 1 }];
  detail.autoFilter = { from: "A1", to: "E1" };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
