/**
 * KI-Bewertungsraster-Builder | Joscha Falck | CC-BY 4.0
 * export-docx.js – DOCX-Export-Modul
 *
 * Formatierung exakt an den Original-DOCX-Dateien ausgerichtet.
 * Verwendet docx.js v8 (geladen via CDN).
 *
 * Öffentliche API:
 *   generateDocx(config, filename)          – direkter Download
 *   generateDocxBlob(config) → Promise<Blob> – für ZIP-Export
 */

'use strict';

// ============================================================
// FARBKONSTANTEN – exakt aus den Original-DOCX-Dateien
// ============================================================

const DOCX_COLORS = {
  lk: {
    headerKriterium: '3A6EA8',   // Erste Kopfspalte (Kriterium) – LK
    kriteriumFill:   'E5EFF8',   // Kriterium-Zellen Hintergrund – LK
    kriteriumText:   '2A4E7A',   // Kriterium-Zellen Text – LK
    title:           '2A4E7A',
  },
  su: {
    headerKriterium: '2D7A68',   // Erste Kopfspalte – SuS
    kriteriumFill:   'DDF0EA',   // Kriterium-Zellen Hintergrund – SuS
    kriteriumText:   '1A5C4A',   // Kriterium-Zellen Text – SuS
    title:           '1A5C4A',
  },
  // Stufenspezifische Header-Farben (gelten für LK und SuS identisch)
  stageHeader: ['7F96AA', 'C09060', '4A7FB5', '5E9E42', 'A855F7', 'EC4899'],
  // Stufenspezifische Daten-Zellen-Farben
  stageData:   ['F5F5F5', 'FEF8EC', 'EDF4FB', 'EDF7E8', 'F3E8FF', 'FDE8F0'],
  headerText:  'FFFFFF',
  bodyText:    '222222',
  metaText:    '666666',
  hintLabel:   '555555',
  hintText:    '999999',
  border:      'C8D8E8',
};

// ============================================================
// LAYOUT-KONSTANTEN – exakt aus den Original-DOCX-Dateien
// ============================================================

const CM = 567;                            // 1 cm in DXA/Twips
const MARGIN = 720;                        // Rand: 720 DXA ≈ 1,27 cm (Word-Standard)
const PAGE_W = 16838;                      // A4 Querformat Breite (DXA)
const PAGE_H = 11906;                      // A4 Querformat Höhe (DXA)
const NET_WIDTH = PAGE_W - 2 * MARGIN;    // 15398 DXA Nutzbreite
const COL_KRITERIUM = 2000;               // Kriterium-Spalte (DXA)

/** Berechnet Inhaltsspalten-Breiten so, dass sie zusammen NET_WIDTH ergeben. */
function getColWidths(stufen) {
  const rest = NET_WIDTH - COL_KRITERIUM;
  const base = Math.floor(rest / stufen);
  const widths = Array(stufen).fill(base);
  widths[stufen - 1] += rest - base * stufen; // Rest zur letzten Spalte
  return widths;
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

/** Erstellt eine Tabellenzelle mit exakten Original-Formatierungen. */
function makeCell(paragraphChildren, opts = {}) {
  const cellOpts = {
    width: { size: opts.width || 1000, type: 'dxa' },
    verticalAlign: 'center',
    margins: {
      top:    140,
      bottom: 140,
      left:   160,
      right:  160,
    },
    borders: {
      top:    { style: 'single', size: 3, color: DOCX_COLORS.border },
      bottom: { style: 'single', size: 3, color: DOCX_COLORS.border },
      left:   { style: 'single', size: 3, color: DOCX_COLORS.border },
      right:  { style: 'single', size: 3, color: DOCX_COLORS.border },
    },
    children: [new docx.Paragraph({
      alignment: opts.center ? 'center' : undefined,
      children: paragraphChildren,
    })],
  };

  if (opts.fill) {
    cellOpts.shading = { fill: opts.fill, type: 'clear', color: 'auto' };
  }

  return new docx.TableCell(cellOpts);
}

/** Erstellt einen TextRun mit Arial-Font und optionalem Zeilenumbruch. */
function makeRun(text, opts = {}) {
  return new docx.TextRun({
    text,
    font: 'Arial',
    bold:    opts.bold    || false,
    color:   opts.color   || DOCX_COLORS.bodyText,
    size:    opts.size    || 18,   // 9 pt default
    break:   opts.break   || undefined,
  });
}

// ============================================================
// HAUPTFUNKTION: DOCX GENERIEREN
// ============================================================

/**
 * Generiert ein DOCX und löst einen Download aus.
 */
async function generateDocx(config, filename) {
  try {
    const blob = await generateDocxBlob(config);
    triggerDownload(blob, filename);
  } catch (err) {
    console.error('DOCX Export Fehler:', err);
    alert('Fehler beim Erstellen der DOCX-Datei. Details in der Browser-Konsole.');
  }
}

/**
 * Generiert ein DOCX und gibt ein Blob zurück (für ZIP).
 */
async function generateDocxBlob(config) {
  const {
    titel, version, stufen, stufenLabels, punkteConfig,
    maxPunkte, kriterien, hinweis, fach, jahrgang,
  } = config;

  const isLk = version === 'lk';
  const colors = isLk ? DOCX_COLORS.lk : DOCX_COLORS.su;
  const colWidths = getColWidths(stufen);

  // ── 1. Titelzeile ────────────────────────────────────────
  const versionLabel = isLk ? 'Einschätzung der Lehrkraft' : 'Selbsteinschätzung Schüler:in';
  const titleParagraph = new docx.Paragraph({
    children: [new docx.TextRun({
      text: `Bewertungsraster ${titel} \u2013 ${versionLabel}`,
      font:  'Arial',
      bold:  true,
      color: colors.title,
      size:  26,   // 13 pt
    })],
    spacing: { after: 0 },
  });

  // ── 2. Meta-Zeile (VOR der Tabelle, wie im Original) ─────
  let metaText;
  if (isLk) {
    metaText = `Name: _________________________   Fach: _________________________   Datum: _______________   Punkte: _______ / ${maxPunkte}`;
  } else {
    metaText = 'Name: _________________________   Klasse: _________________________   Datum: _______________';
  }
  const metaParagraph = new docx.Paragraph({
    children: [new docx.TextRun({
      text:  metaText,
      font:  'Arial',
      color: DOCX_COLORS.metaText,
      size:  18,   // 9 pt
    })],
    spacing: { before: 0, after: 100 },
  });

  // ── 3. Optionaler Untertitel (Fach/Jahrgang) ─────────────
  const subtitleParts = [];
  if (fach && fach !== 'Fachunabhängig') subtitleParts.push(fach);
  if (jahrgang) subtitleParts.push(jahrgang);
  const subtitleParagraph = subtitleParts.length > 0
    ? new docx.Paragraph({
        children: [new docx.TextRun({
          text:  subtitleParts.join('  |  '),
          font:  'Arial',
          color: DOCX_COLORS.metaText,
          size:  16,
        })],
        spacing: { before: 0, after: 60 },
      })
    : null;

  // ── 4. Header-Zeile der Tabelle ──────────────────────────
  const headerCells = [
    makeCell(
      [makeRun('Kriterium', { bold: true, color: DOCX_COLORS.headerText, size: 19 })],
      { width: COL_KRITERIUM, fill: colors.headerKriterium, center: true }
    ),
  ];

  for (let i = 0; i < stufen; i++) {
    const label  = stufenLabels[i] || `Stufe ${i + 1}`;
    const ptsStr = isLk && punkteConfig[i] ? `(${punkteConfig[i].punkte} Pkt.)` : '';
    const runOpts = { bold: true, color: DOCX_COLORS.headerText, size: 19 };

    const runs = ptsStr
      ? [makeRun(label, runOpts), makeRun(ptsStr, { ...runOpts, break: 1 })]
      : [makeRun(label, runOpts)];

    headerCells.push(makeCell(runs, {
      width: colWidths[i],
      fill:  DOCX_COLORS.stageHeader[i] || DOCX_COLORS.stageHeader[0],
      center: true,
    }));
  }

  const headerRow = new docx.TableRow({
    children:      headerCells,
    tableHeader:   true,
    height: { value: 820, rule: docx.HeightRule.ATLEAST },
  });

  // ── 5. Daten-Zeilen ──────────────────────────────────────
  const dataRows = kriterien.map(k => {
    const nameCell = makeCell(
      [makeRun(k.name || 'Kriterium', { bold: true, color: colors.kriteriumText, size: 19 })],
      { width: COL_KRITERIUM, fill: colors.kriteriumFill }
    );

    const dataCells = Array.from({ length: stufen }, (_, i) => {
      const text = k.stufen?.[i] || '';
      return makeCell(
        [makeRun(text, { color: DOCX_COLORS.bodyText, size: 18 })],
        { width: colWidths[i], fill: DOCX_COLORS.stageData[i] || 'FFFFFF' }
      );
    });

    return new docx.TableRow({
      children: [nameCell, ...dataCells],
      height: { value: 1701, rule: docx.HeightRule.ATLEAST },
    });
  });

  // ── 6. Tabelle ───────────────────────────────────────────
  const table = new docx.Table({
    width: { size: NET_WIDTH, type: 'dxa' },
    rows:  [headerRow, ...dataRows],
  });

  // ── 7. Hinweis ───────────────────────────────────────────
  const hintChildren = [];
  if (hinweis) {
    hintChildren.push(new docx.Paragraph({
      children: [
        new docx.TextRun({
          text:  'Hinweis: ',
          font:  'Arial',
          bold:  true,
          color: DOCX_COLORS.hintLabel,
          size:  17,
        }),
        new docx.TextRun({
          text:  hinweis,
          font:  'Arial',
          color: DOCX_COLORS.hintText,
          size:  17,
        }),
      ],
      spacing: { before: 80, after: 0 },
    }));
  }

  // ── 8. Dokument zusammenbauen ────────────────────────────
  const docChildren = [titleParagraph];
  if (subtitleParagraph) docChildren.push(subtitleParagraph);
  docChildren.push(metaParagraph);
  docChildren.push(table);
  docChildren.push(...hintChildren);

  const doc = new docx.Document({
    sections: [{
      properties: {
        page: {
          size: {
            width:       PAGE_H,   // docx.js erwartet Hochformat-Maße und tauscht bei LANDSCAPE
            height:      PAGE_W,
            orientation: docx.PageOrientation.LANDSCAPE,
          },
          margin: {
            top:    MARGIN,
            bottom: MARGIN,
            left:   MARGIN,
            right:  MARGIN,
          },
        },
      },
      children: docChildren,
    }],
  });

  return await docx.Packer.toBlob(doc);
}

/**
 * Triggert einen Browser-Download.
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
