/**
 * KI-Bewertungsraster-Builder | Joscha Falck | CC-BY 4.0
 * export-docx.js – DOCX-Export-Modul
 *
 * Verwendet docx.js v8 (geladen via CDN).
 * Exportformat: DIN A4 Querformat, identisch mit den 22 Original-DOCX-Dateien.
 *
 * Öffentliche API:
 *   generateDocx(config, filename)          – direkter Download
 *   generateDocxBlob(config) → Promise<Blob> – für ZIP-Export
 */

'use strict';

// ============================================================
// FARBKONSTANTEN (identisch mit den Original-DOCX-Dateien)
// ============================================================

const DOCX_COLORS = {
  lk: {
    header:    '3A6EA8',
    kriterium: 'E5EFF8',
    title:     '2A4E7A',
  },
  su: {
    header:    '2D7A68',
    kriterium: 'DDF0EA',
    title:     '1A5C4A',
  },
  stufen: {
    s1: 'F5F5F5',
    s2: 'FFF8F0',
    s3: 'EEF3FC',
    s4: 'F0FAF0',
    s5: 'EDE7F6',
    s6: 'FCE4EC',
  },
  text:       '1A1A1A',
  headerText: 'FFFFFF',
  metaText:   '666666',
  hintText:   '999999',
  hintLabel:  '555555',
  border:     'BFBFBF',
};

// ============================================================
// LAYOUT-KONSTANTEN
// Seitenformat: DIN A4 Querformat (297 × 210 mm)
// Ränder: 1,5 cm = 851 Twips (1 cm = 567,17 Twips)
// Nutzbreite: 297 - 3 = 294 mm → aber Nutzbreite inkl. Ränder
// Spaltenbreiten in DXA (1 cm = 567 DXA / Twips)
// ============================================================

const CM = 567;   // 1 cm in DXA/Twips
const MARGIN = Math.round(1.5 * CM);  // 851

// Nutzbreite: A4 Landscape = 11906 Twips (29,7 cm * 400) minus 2 Ränder
// A4 landscape: page width = 16838 DXA (29,7 cm), height = 11906 DXA (21 cm)
// Nutzbreite: 16838 - 2*851 = 15136 DXA
const PAGE_WIDTH   = 16838;
const PAGE_HEIGHT  = 11906;
const NET_WIDTH    = PAGE_WIDTH - 2 * MARGIN;  // 15136

// Spaltenbreiten (in DXA, muss zusammen NET_WIDTH ergeben)
// Kriterium: 3,5 cm = 1985 DXA, Rest gleichmäßig verteilt
const COL_KRITERIUM = Math.round(3.5 * CM);  // 1985

function getColWidths(stufen) {
  const rest = NET_WIDTH - COL_KRITERIUM;
  const colW = Math.floor(rest / stufen);
  // Letzte Spalte bekommt Rest, damit Summe stimmt
  const widths = [];
  for (let i = 0; i < stufen; i++) {
    if (i === stufen - 1) {
      widths.push(NET_WIDTH - COL_KRITERIUM - colW * (stufen - 1));
    } else {
      widths.push(colW);
    }
  }
  return widths;
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

/**
 * Erstellt einen Paragraph mit optionalen Optionen.
 * @param {string} text
 * @param {Object} opts
 * @returns {docx.Paragraph}
 */
function makeParagraph(text, opts = {}) {
  const runOpts = {};
  if (opts.bold)     runOpts.bold = true;
  if (opts.color)    runOpts.color = opts.color;
  if (opts.size)     runOpts.size = opts.size;      // half-points
  if (opts.font)     runOpts.font = opts.font;
  if (opts.italics)  runOpts.italics = true;

  const paraOpts = {};
  if (opts.alignment) paraOpts.alignment = opts.alignment;
  if (opts.spacing)   paraOpts.spacing = opts.spacing;

  return new docx.Paragraph({
    ...paraOpts,
    children: [new docx.TextRun({ text: text || '', ...runOpts })],
  });
}

/**
 * Erstellt eine Tabellenzelle.
 * @param {string} text
 * @param {Object} opts
 * @returns {docx.TableCell}
 */
function makeCell(text, opts = {}) {
  const runOpts = {
    font: 'Calibri',
    size: opts.headerCell ? 18 : 16,  // 9pt = 18 half-points, 8pt = 16
    color: opts.headerCell ? DOCX_COLORS.headerText : DOCX_COLORS.text,
  };
  if (opts.bold || opts.headerCell) runOpts.bold = true;

  const paraChildren = [new docx.TextRun({ text: text || '', ...runOpts })];

  const paraOpts = {
    children: paraChildren,
    spacing: { before: 40, after: 40 },
  };
  if (opts.headerCell) paraOpts.alignment = 'center';

  const cellOpts = {
    width: { size: opts.width || 1000, type: 'dxa' },
    children: [new docx.Paragraph(paraOpts)],
    verticalAlign: 'center',
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    borders: {
      top:    { style: 'single', size: 4, color: DOCX_COLORS.border },
      bottom: { style: 'single', size: 4, color: DOCX_COLORS.border },
      left:   { style: 'single', size: 4, color: DOCX_COLORS.border },
      right:  { style: 'single', size: 4, color: DOCX_COLORS.border },
    },
  };

  if (opts.shading) {
    cellOpts.shading = {
      fill: opts.shading,
      type: 'clear',
      color: 'auto',
    };
  }

  return new docx.TableCell(cellOpts);
}

// ============================================================
// HAUPTFUNKTION: DOCX GENERIEREN
// ============================================================

/**
 * Generiert ein DOCX und löst einen Download aus.
 * @param {Object} config  - Exportkonfiguration (aus buildDocxConfigFromRaster)
 * @param {string} filename
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
 * @param {Object} config
 * @returns {Promise<Blob>}
 */
async function generateDocxBlob(config) {
  const { titel, version, stufen, stufenLabels, punkteConfig, maxPunkte, kriterien, hinweis } = config;
  const isLk = version === 'lk';
  const colors = isLk ? DOCX_COLORS.lk : DOCX_COLORS.su;
  const stufenFarben = ['s1', 's2', 's3', 's4', 's5', 's6'].slice(0, stufen);
  const colWidths = getColWidths(stufen);

  // --- Titelzeile ---
  const versionLabel = isLk ? 'Einsch\u00e4tzung der Lehrkraft' : 'Selbsteinsch\u00e4tzung Sch\u00fcler:in';
  const titleParagraph = new docx.Paragraph({
    children: [
      new docx.TextRun({
        text: `Bewertungsraster ${titel} \u2013 ${versionLabel}`,
        bold: true,
        color: colors.title,
        size: 22,   // 11pt
        font: 'Calibri',
      }),
    ],
    spacing: { before: 0, after: 120 },
  });

  // --- Header-Zeile der Tabelle ---
  const headerCells = [
    makeCell('Kriterium', {
      width: COL_KRITERIUM,
      headerCell: true,
      shading: colors.header,
    }),
  ];

  stufenFarben.forEach((sk, i) => {
    const label = stufenLabels[i] || `Stufe ${i + 1}`;
    const ptsText = isLk && punkteConfig[i] ? ` (${punkteConfig[i].punkte} Pkt.)` : '';
    headerCells.push(makeCell(label + ptsText, {
      width: colWidths[i],
      headerCell: true,
      shading: colors.header,
    }));
  });

  const headerRow = new docx.TableRow({
    children: headerCells,
  });

  // --- Kriterium-Zeilen ---
  const dataRows = kriterien.map(k => {
    const cells = [
      makeCell(k.name || 'Kriterium', {
        width: COL_KRITERIUM,
        bold: true,
        shading: colors.kriterium,
      }),
    ];

    stufenFarben.forEach((sk, i) => {
      const text = k.stufen[i] || '';
      cells.push(makeCell(text, {
        width: colWidths[i],
        shading: DOCX_COLORS.stufen[sk],
      }));
    });

    return new docx.TableRow({ children: cells });
  });

  // --- Tabelle ---
  const table = new docx.Table({
    width: { size: NET_WIDTH, type: 'dxa' },
    rows: [headerRow, ...dataRows],
  });

  // --- Meta-Zeile ---
  let metaText;
  if (isLk) {
    metaText = `Name: _______________________ \u00a0\u00a0\u00a0 Fach: _____________ \u00a0\u00a0\u00a0 Datum: _____________ \u00a0\u00a0\u00a0 Punkte: _____/${maxPunkte}`;
  } else {
    metaText = 'Name: _______________________ \u00a0\u00a0\u00a0 Klasse: _____________ \u00a0\u00a0\u00a0 Datum: _____________';
  }

  const metaParagraph = new docx.Paragraph({
    children: [
      new docx.TextRun({
        text: metaText,
        color: DOCX_COLORS.metaText,
        size: 16,
        font: 'Calibri',
      }),
    ],
    spacing: { before: 120, after: 60 },
  });

  // --- Hinweis-Zeile ---
  const docChildren = [titleParagraph, table, metaParagraph];

  if (hinweis) {
    const hintParagraph = new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: 'Hinweis: ',
          bold: true,
          color: DOCX_COLORS.hintLabel,
          size: 14,
          font: 'Calibri',
        }),
        new docx.TextRun({
          text: hinweis,
          color: DOCX_COLORS.hintText,
          size: 14,
          font: 'Calibri',
        }),
      ],
      spacing: { before: 0, after: 0 },
    });
    docChildren.push(hintParagraph);
  }

  // --- Dokument ---
  const doc = new docx.Document({
    sections: [{
      properties: {
        page: {
          size: {
            width:  PAGE_WIDTH,
            height: PAGE_HEIGHT,
            orientation: 'landscape',
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
 * Triggert einen Browser-Download (Fallback, falls app.js noch nicht geladen).
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
