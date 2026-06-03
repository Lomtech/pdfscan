import type { Classification } from "./types";

const JD_PHRASES = [
  "wir suchen",
  "wir bieten",
  "deine aufgaben",
  "ihre aufgaben",
  "dein profil",
  "ihr profil",
  "was du mitbringst",
  "was sie mitbringen",
  "was dich erwartet",
  "was sie erwartet",
  "anforderungen",
  "qualifikationen",
  "stellenbeschreibung",
  "stellenangebot",
  "stellenausschreibung",
  "job description",
  "we are looking for",
  "we are hiring",
  "we offer",
  "your responsibilities",
  "your profile",
  "requirements",
  "responsibilities",
  "about the role",
  "about us",
  "über uns",
  "benefits",
  "unbefristete anstellung",
  "vollzeit",
  "teilzeit",
  "festanstellung",
  "homeoffice möglich",
  "hybrid",
  "remote möglich",
  "bewerbung an",
  "bewerbung über",
  "jetzt bewerben",
  "apply now",
  "send your application",
  "kontakt für rückfragen",
];

const CV_PHRASES = [
  "lebenslauf",
  "curriculum vitae",
  "persönliche daten",
  "personal details",
  "personalien",
  "geburtsdatum",
  "geburtsort",
  "geboren am",
  "date of birth",
  "anschrift",
  "kontaktdaten",
  "berufserfahrung",
  "beruflicher werdegang",
  "work experience",
  "professional experience",
  "ausbildung",
  "schulausbildung",
  "education",
  "akademischer werdegang",
  "studium",
  "abschluss",
  "praktikum",
  "praktika",
  "weiterbildung",
  "fortbildung",
  "zertifikate",
  "certifications",
  "kenntnisse",
  "fähigkeiten",
  "skills",
  "sprachen",
  "languages",
  "hobbys",
  "hobbies",
  "interessen",
  "interests",
  "referenzen",
  "references",
  "familienstand",
  "staatsangehörigkeit",
  "nationalität",
];

const DATE_RANGE_RE =
  /\b(0?[1-9]|1[0-2])[.\/-](19|20)\d{2}\s*[-–—bis]+\s*((0?[1-9]|1[0-2])[.\/-](19|20)\d{2}|heute|present|jetzt|today)/gi;
const STATION_HEADER_RE =
  /\b(seit|von)\s+(19|20)\d{2}\b|\b(19|20)\d{2}\s*[-–—]\s*((19|20)\d{2}|heute|present)\b/gi;

export function classify(text: string): Classification {
  const lower = text.toLowerCase();
  let jdScore = 0;
  let cvScore = 0;

  for (const p of JD_PHRASES) {
    let from = 0;
    while ((from = lower.indexOf(p, from)) !== -1) {
      jdScore += 1;
      from += p.length;
    }
  }
  for (const p of CV_PHRASES) {
    let from = 0;
    while ((from = lower.indexOf(p, from)) !== -1) {
      cvScore += 1;
      from += p.length;
    }
  }

  const dateRanges = (text.match(DATE_RANGE_RE) ?? []).length;
  const stations = (text.match(STATION_HEADER_RE) ?? []).length;
  cvScore += dateRanges * 2;
  cvScore += stations;

  const total = jdScore + cvScore;
  if (total === 0) {
    return { type: "unknown", confidence: 0, jdScore, cvScore };
  }
  if (jdScore === cvScore) {
    return { type: "unknown", confidence: 0.5, jdScore, cvScore };
  }
  const winner = jdScore > cvScore ? "JD" : "CV";
  const confidence = Math.abs(jdScore - cvScore) / total;
  return { type: winner, confidence, jdScore, cvScore };
}
