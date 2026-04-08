/**
 * KI-Bewertungsraster-Builder | Joscha Falck | CC-BY 4.0
 * export-pdf.js – PDF-Export-Modul
 *
 * Formatierung identisch mit export-docx.js:
 *   - Layout: Titel → Meta → Tabelle → Hinweis
 *   - Stufenspezifische Kopfzeilenfarben je Spalte
 *   - Kriterium-Spalte: versionsabhängige Farbe
 *   - Exakte Farben aus den Original-DOCX-Dateien
 *
 * Verwendet jsPDF v2 + jsPDF-AutoTable v3.
 *
 * Öffentliche API:
 *   generatePdf(raster, version, filename)
 */

'use strict';

// ============================================================
// FARBKONSTANTEN – identisch mit export-docx.js
// ============================================================

const PDF_COLORS = {
  lk: {
    headerKriterium: [58,  110, 168],   // #3A6EA8
    kriteriumFill:   [229, 239, 248],   // #E5EFF8
    kriteriumText:   [42,  78,  122],   // #2A4E7A
    title:           [42,  78,  122],   // #2A4E7A
  },
  su: {
    headerKriterium: [45,  122, 104],   // #2D7A68
    kriteriumFill:   [221, 240, 234],   // #DDF0EA
    kriteriumText:   [26,  92,  74],    // #1A5C4A
    title:           [26,  92,  74],    // #1A5C4A
  },
  // Stufenspezifische Kopffarben – identisch mit DOCX stageHeader[]
  stageHeader: [
    [127, 150, 170],  // #7F96AA
    [192, 144,  96],  // #C09060
    [ 74, 127, 181],  // #4A7FB5
    [ 94, 158,  66],  // #5E9E42
    [168,  85, 247],  // #A855F7
    [236,  72, 153],  // #EC4899
  ],
  // Stufenspezifische Datenzellen-Farben – identisch mit DOCX stageData[]
  stageData: [
    [245, 245, 245],  // #F5F5F5
    [254, 248, 236],  // #FEF8EC
    [237, 244, 251],  // #EDF4FB
    [237, 247, 232],  // #EDF7E8
    [243, 232, 255],  // #F3E8FF
    [253, 232, 240],  // #FDE8F0
  ],
  bodyText:  [ 34,  34,  34],   // #222222
  metaText:  [102, 102, 102],   // #666666
  hintLabel: [ 85,  85,  85],   // #555555
  hintText:  [153, 153, 153],   // #999999
  white:     [255, 255, 255],
  border:    [200, 216, 232],   // #C8D8E8
};

// ============================================================
// LAYOUT-KONSTANTEN – proportional zu export-docx.js
// ============================================================

const PDF_MARGIN      = 12.7;    // mm ≈ 720 DXA wie im DOCX
const PDF_PAGE_W      = 297;     // mm A4 Querformat
const PDF_PAGE_H      = 210;     // mm A4 Querformat
const PDF_NET_W       = PDF_PAGE_W - 2 * PDF_MARGIN;  // 271.6 mm
// Kriterium-Spalte: 2000/15398 × NET_WIDTH (proportional zu DOCX)
const PDF_COL_KRIT    = Math.round(PDF_NET_W * 2000 / 15398);  // ≈ 35 mm

// ============================================================
// HAUPTFUNKTION
// ============================================================

/**
 * Generiert ein PDF und löst einen Download aus.
 * @param {Object} raster   - Raster-Objekt (aus buildCurrentRasterData oder Wissensbasis)
 * @param {'lk'|'su'} version
 * @param {string} filename
 */
function generatePdf(raster, version, filename) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    buildPdfPage(doc, raster, version);

    doc.save(filename);
  } catch (err) {
    console.error('PDF Export Fehler:', err);
    alert('Fehler beim Erstellen der PDF-Datei. Details in der Browser-Konsole.');
  }
}

/**
 * Baut eine PDF-Seite mit dem Raster.
 * Layout identisch mit DOCX: Titel → Meta → Tabelle → Hinweis
 */
function buildPdfPage(doc, raster, version) {
  const isLk     = version === 'lk';
  const colors   = isLk ? PDF_COLORS.lk : PDF_COLORS.su;
  const stufen   = raster.stufen || 4;

  const stufenLabels = raster.stufenLabels || {
    lk: ['Nicht erf\u00fcllt', 'Teilweise erf\u00fcllt', 'Weitgehend erf\u00fcllt', 'Vollst\u00e4ndig erf\u00fcllt'],
    su: ['Das kann ich noch nicht sicher', 'Das kann ich teilweise', 'Das kann ich schon gut', 'Das kann ich sehr sicher'],
  };
  const punkteConfig = raster.punkteConfig || [
    { punkte: '0' }, { punkte: '1\u20132' }, { punkte: '3\u20134' }, { punkte: '5' },
  ];
  const labelArr = isLk ? stufenLabels.lk : stufenLabels.su;

  // Spaltenbreiten proportional zum DOCX
  const restW  = PDF_NET_W - PDF_COL_KRIT;
  const colW   = restW / stufen;
  const colWidths = [PDF_COL_KRIT, ...Array(stufen).fill(colW)];

  let y = PDF_MARGIN;

  // ── 1. Titel ──────────────────────────────────────────────
  const versionLabel = isLk
    ? 'Einsch\u00e4tzung der Lehrkraft'
    : 'Selbsteinsch\u00e4tzung Sch\u00fcler:in';

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.title);
  doc.text(
    `Bewertungsraster ${raster.titel} \u2013 ${versionLabel}`,
    PDF_MARGIN, y + 4
  );
  y += 8;

  // ── 2. Untertitel Fach / Jahrgang ─────────────────────────
  const subtitleParts = [];
  if (raster.fach && raster.fach !== 'Fachunabh\u00e4ngig') subtitleParts.push(raster.fach);
  if (raster.jahrgang) subtitleParts.push(raster.jahrgang);
  if (subtitleParts.length) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.metaText);
    doc.text(subtitleParts.join('  \u2502  '), PDF_MARGIN, y + 2);
    y += 5;
  }

  // ── 3. Meta-Zeile (VOR Tabelle, wie im DOCX) ──────────────
  const maxP = punkteConfig.reduce((acc, p) => {
    const pts = String(p.punkte).replace('\u2013', '-').split('-')
      .map(x => parseInt(x, 10)).filter(n => !isNaN(n));
    return Math.max(acc, pts[pts.length - 1] || 0);
  }, 0);
  const total = raster.kriterien.length * maxP;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_COLORS.metaText);
  if (isLk) {
    doc.text(
      `Name: _______________________    Fach: _____________    Datum: _____________    Punkte: _____/${total}`,
      PDF_MARGIN, y + 2
    );
  } else {
    doc.text(
      'Name: _______________________    Klasse: _____________    Datum: _____________',
      PDF_MARGIN, y + 2
    );
  }
  y += 6;

  // ── 4. Tabelle ────────────────────────────────────────────
  const head = [buildPdfHeaderRow(stufen, labelArr, punkteConfig, isLk, colors)];
  const body = buildPdfBodyRows(raster.kriterien, version, stufen);

  doc.autoTable({
    startY: y,
    head,
    body,
    columnStyles: buildPdfColumnStyles(stufen, colWidths),
    headStyles: {
      // fillColor wird per willDrawCell gesetzt
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize:  9.5,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize:    9,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      textColor:   PDF_COLORS.bodyText,
      valign:      'top',
      lineColor:   PDF_COLORS.border,
      lineWidth:   0.2,
    },
    alternateRowStyles: {},
    margin:      { left: PDF_MARGIN, right: PDF_MARGIN },
    tableWidth:  PDF_NET_W,
    styles: {
      overflow:   'linebreak',
      font:       'helvetica',
      lineColor:  PDF_COLORS.border,
      lineWidth:  0.2,
    },
    willDrawCell(data) {
      // Header: stufenspezifische Kopffarben je Spalte
      if (data.section === 'head') {
        if (data.column.index === 0) {
          doc.setFillColor(...colors.headerKriterium);
        } else {
          const stageColor = PDF_COLORS.stageHeader[data.column.index - 1]
            || PDF_COLORS.stageHeader[0];
          doc.setFillColor(...stageColor);
        }
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
      }
      // Body: Kriterium-Spalte mit versionsabhängiger Füllfarbe
      if (data.section === 'body' && data.column.index === 0) {
        doc.setFillColor(...colors.kriteriumFill);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
      }
    },
    didParseCell(data) {
      // Kriterium-Spalte: versionsabhängige Textfarbe, fett
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.fontStyle  = 'bold';
        data.cell.styles.textColor  = colors.kriteriumText;
      }
      // Stufenspalten: Datenzellen-Hintergrundfarbe
      if (data.section === 'body' && data.column.index > 0) {
        const stageData = PDF_COLORS.stageData[data.column.index - 1]
          || PDF_COLORS.stageData[0];
        data.cell.styles.fillColor = stageData;
      }
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  // ── 5. Hinweis (nach Tabelle) ─────────────────────────────
  const hint = isLk ? (raster.hinweis_lk || '') : (raster.hinweis_su || '');
  if (hint) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.hintLabel);
    doc.text('Hinweis: ', PDF_MARGIN, y);

    const labelW = doc.getTextWidth('Hinweis: ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.hintText);

    // Langer Hinweistext ggf. umbrechen
    const maxW = PDF_NET_W - labelW;
    const lines = doc.splitTextToSize(hint, maxW);
    doc.text(lines, PDF_MARGIN + labelW, y);
  }
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

/**
 * Header-Zeile – Farben werden per willDrawCell gesetzt.
 */
function buildPdfHeaderRow(stufen, labelArr, punkteConfig, isLk) {
  const row = [{ content: 'Kriterium', styles: { halign: 'center', fontStyle: 'bold' } }];
  for (let i = 0; i < stufen; i++) {
    const label = labelArr[i] || `Stufe ${i + 1}`;
    const pts   = isLk && punkteConfig[i] ? `\n(${punkteConfig[i].punkte} Pkt.)` : '';
    row.push({ content: label + pts, styles: { halign: 'center' } });
  }
  return row;
}

/**
 * Body-Zeilen – Farben werden per didParseCell gesetzt.
 */
function buildPdfBodyRows(kriterien, version, stufen) {
  return kriterien.map(k => {
    const row = [{ content: k.name || 'Kriterium' }];
    for (let i = 0; i < stufen; i++) {
      const text = k[version]?.[`s${i + 1}`] || k.stufen?.[i] || '';
      row.push({ content: text });
    }
    return row;
  });
}

/**
 * Spaltenbreiten für AutoTable.
 */
function buildPdfColumnStyles(stufen, colWidths) {
  const styles = { 0: { cellWidth: colWidths[0] } };
  for (let i = 0; i < stufen; i++) {
    styles[i + 1] = { cellWidth: colWidths[i + 1] };
  }
  return styles;
}
