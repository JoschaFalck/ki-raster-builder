/**
 * KI-Bewertungsraster-Builder | Joscha Falck | CC-BY 4.0
 * export-pdf.js – PDF-Export-Modul
 *
 * Verwendet jsPDF v2 + jsPDF-AutoTable v3 (geladen via CDN).
 * Exportformat: DIN A4 Querformat, farbcodiert identisch mit DOCX.
 *
 * Öffentliche API:
 *   generatePdf(raster, version, filename)
 */

'use strict';

// ============================================================
// FARBKONSTANTEN (als RGB-Arrays für jsPDF)
// ============================================================

const PDF_COLORS = {
  lk: {
    header:    [58,  110, 168],  // #3A6EA8
    kriterium: [229, 239, 248],  // #E5EFF8
    title:     [42,  78,  122],  // #2A4E7A
  },
  su: {
    header:    [45,  122, 104],  // #2D7A68
    kriterium: [221, 240, 234],  // #DDF0EA
    title:     [26,  92,  74],   // #1A5C4A
  },
  stufen: {
    s1: [245, 245, 245],  // #F5F5F5
    s2: [255, 248, 240],  // #FFF8F0
    s3: [238, 243, 252],  // #EEF3FC
    s4: [240, 250, 240],  // #F0FAF0
    s5: [237, 231, 246],  // #EDE7F6
    s6: [252, 228, 236],  // #FCE4EC
  },
  text:     [26,  26,  26],   // #1A1A1A
  white:    [255, 255, 255],
  meta:     [102, 102, 102],  // #666666
  hint:     [153, 153, 153],  // #999999
  hintBold: [85,  85,  85],   // #555555
  footer:   [150, 150, 150],
};

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
 * @param {jsPDF} doc
 * @param {Object} raster
 * @param {'lk'|'su'} version
 */
function buildPdfPage(doc, raster, version) {
  const isLk = version === 'lk';
  const colors = isLk ? PDF_COLORS.lk : PDF_COLORS.su;
  const stufen = raster.stufen || 4;
  const stufenKeys = Array.from({ length: stufen }, (_, i) => 's' + (i + 1));
  const stufenFarbenKeys = ['s1', 's2', 's3', 's4', 's5', 's6'].slice(0, stufen);

  const stufenLabels = raster.stufenLabels || {
    lk: ['Nicht erf\u00fcllt', 'Teilweise erf\u00fcllt', 'Weitgehend erf\u00fcllt', 'Vollst\u00e4ndig erf\u00fcllt'],
    su: ['Das kann ich noch nicht sicher', 'Das kann ich teilweise', 'Das kann ich schon gut', 'Das kann ich sehr sicher'],
  };
  const punkteConfig = raster.punkteConfig || [
    { punkte: '0' }, { punkte: '1-2' }, { punkte: '3-4' }, { punkte: '5' },
  ];

  const labelArr = isLk ? stufenLabels.lk : stufenLabels.su;

  // Layout-Konstanten (mm)
  const margin = 15;
  const pageW = 297;
  const pageH = 210;
  const netW = pageW - 2 * margin;

  // Spaltenbreiten
  const colKriterium = 35;
  const restW = netW - colKriterium;
  const colW = restW / stufen;
  const colWidths = [colKriterium, ...Array(stufen).fill(colW)];

  // Schriftgrößen
  const FONT_TITLE   = 11;
  const FONT_TABLE   = 7.5;
  const FONT_META    = 7;
  const FONT_HINT    = 6.5;
  const FONT_FOOTER  = 6;

  let y = margin;

  // --- Titel ---
  const versionLabel = isLk ? 'Einsch\u00e4tzung der Lehrkraft' : 'Selbsteinsch\u00e4tzung Sch\u00fcler:in';
  doc.setFontSize(FONT_TITLE);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.title);
  doc.text(`Bewertungsraster ${raster.titel} \u2013 ${versionLabel}`, margin, y + 4);
  y += 8;

  // --- Untertitel Fach / Jahrgang ---
  const subtitleParts = [];
  if (raster.fach && raster.fach !== 'Fachunabh\u00e4ngig') subtitleParts.push(raster.fach);
  if (raster.jahrgang) subtitleParts.push(raster.jahrgang);
  if (subtitleParts.length > 0) {
    doc.setFontSize(FONT_META);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.meta);
    doc.text(subtitleParts.join('  \u2502  '), margin, y + 2);
    y += 5;
  }

  // --- AutoTable ---
  const head = [buildHeaderRow(stufen, labelArr, punkteConfig, isLk)];
  const body = buildBodyRows(raster.kriterien, version, stufen);

  doc.autoTable({
    startY: y,
    head,
    body,
    columnStyles: buildColumnStyles(stufen, colWidths, stufenFarbenKeys),
    headStyles: {
      fillColor: colors.header,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: FONT_TABLE,
      cellPadding: 2,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: FONT_TABLE,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      textColor: PDF_COLORS.text,
      valign: 'top',
      lineColor: [190, 190, 190],
      lineWidth: 0.1,
    },
    alternateRowStyles: {},
    margin: { left: margin, right: margin },
    tableWidth: netW,
    styles: {
      overflow: 'linebreak',
      font: 'helvetica',
      lineColor: [190, 190, 190],
      lineWidth: 0.1,
    },
    willDrawCell(data) {
      // Kriterium-Spalte: farbiger Hintergrund, fett
      if (data.column.index === 0 && data.section === 'body') {
        doc.setFillColor(...colors.kriterium);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        doc.setFont('helvetica', 'bold');
      }
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  // --- Meta-Zeile ---
  doc.setFontSize(FONT_META);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_COLORS.meta);

  const maxP = punkteConfig.reduce((acc, p) => {
    const pts = String(p.punkte).replace('\u2013', '-').split('-').map(x => parseInt(x, 10)).filter(n => !isNaN(n));
    return Math.max(acc, pts[pts.length - 1] || 0);
  }, 0);
  const total = raster.kriterien.length * maxP;

  let metaText;
  if (isLk) {
    metaText = `Name: _______________________    Fach: _____________    Datum: _____________    Punkte: _____/${total}`;
  } else {
    metaText = 'Name: _______________________    Klasse: _____________    Datum: _____________';
  }
  doc.text(metaText, margin, y);
  y += 5;

  // --- Hinweis ---
  const hint = isLk ? (raster.hinweis_lk || '') : (raster.hinweis_su || '');
  if (hint) {
    doc.setFontSize(FONT_HINT);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.hintBold);
    doc.text('Hinweis: ', margin, y);

    const labelW = doc.getTextWidth('Hinweis: ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.hint);
    doc.text(hint, margin + labelW, y);
    y += 4;
  }

  // --- Footer ---
  doc.setFontSize(FONT_FOOTER);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_COLORS.footer);
  const footerText = 'CC BY 4.0 Joscha Falck | joschafalck.de';
  const footerW = doc.getTextWidth(footerText);
  doc.text(footerText, pageW - margin - footerW, pageH - margin + 2);
  doc.text(`Seite 1`, margin, pageH - margin + 2);
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

/**
 * Baut die Header-Zeile für AutoTable.
 */
function buildHeaderRow(stufen, labelArr, punkteConfig, isLk) {
  const row = [{ content: 'Kriterium', styles: { fontStyle: 'bold', halign: 'center' } }];
  for (let i = 0; i < stufen; i++) {
    const label = labelArr[i] || `Stufe ${i + 1}`;
    const pts = isLk && punkteConfig[i] ? ` (${punkteConfig[i].punkte} Pkt.)` : '';
    row.push({ content: label + pts, styles: { halign: 'center' } });
  }
  return row;
}

/**
 * Baut die Body-Zeilen für AutoTable.
 */
function buildBodyRows(kriterien, version, stufen) {
  return kriterien.map(k => {
    const row = [{ content: k.name || 'Kriterium', styles: { fontStyle: 'bold' } }];
    for (let i = 0; i < stufen; i++) {
      const text = k[version]?.[`s${i + 1}`] || k.stufen?.[i] || '';
      const sfKey = 's' + (i + 1);
      const sfColor = PDF_COLORS.stufen[sfKey] || [255, 255, 255];
      row.push({
        content: text,
        styles: { fillColor: sfColor },
      });
    }
    return row;
  });
}

/**
 * Baut die ColumnStyles für AutoTable.
 */
function buildColumnStyles(stufen, colWidths, stufenFarbenKeys) {
  const styles = {
    0: { cellWidth: colWidths[0], fontStyle: 'bold' },
  };
  for (let i = 0; i < stufen; i++) {
    const sfKey = stufenFarbenKeys[i] || 's1';
    styles[i + 1] = {
      cellWidth: colWidths[i + 1],
      fillColor: PDF_COLORS.stufen[sfKey],
    };
  }
  return styles;
}
