/**
 * KI-Bewertungsraster-Builder | Joscha Falck | CC-BY 4.0
 * app.js – Hauptlogik für index.html und builder.html
 *
 * Abhängigkeiten:
 *  - wissensbasis_raster.json (Datendatei)
 *  - export-docx.js (DOCX-Export)
 *  - export-pdf.js  (PDF-Export)
 */

'use strict';

// ============================================================
// GLOBALER ZUSTAND
// ============================================================

/** @type {Object|null} Geladene Wissensbasis */
let WB = null;

/** Aktueller Builder-Zustand */
const STATE = {
  startOption: null,       // 'fertig' | 'pool' | 'neu'
  selectedRasterId: null,  // ID des gewählten fertigen Rasters
  selectedPoolTopic: null, // ID des gewählten Pool-Themas
  currentStep: 1,

  // Konfiguration (Schritt 2)
  titel: '',
  fach: 'fachunabhaengig',
  jahrgang: 'klasse-8-10',
  niveau: 2,               // 1=einfach, 2=standard, 3=anspruchsvoll
  perspektive: 'beide',
  stufen: 4,
  punkteConfig: [
    { label: 'Nicht erfüllt',       punkte: '0',   lkDefault: 'Nicht erfüllt',       suDefault: 'Das kann ich noch nicht sicher' },
    { label: 'Teilweise erfüllt',   punkte: '1\u20132', lkDefault: 'Teilweise erfüllt',   suDefault: 'Das kann ich teilweise' },
    { label: 'Weitgehend erfüllt',  punkte: '3\u20134', lkDefault: 'Weitgehend erfüllt',  suDefault: 'Das kann ich schon gut' },
    { label: 'Vollst\u00e4ndig erf\u00fcllt', punkte: '5', lkDefault: 'Vollst\u00e4ndig erf\u00fcllt', suDefault: 'Das kann ich sehr sicher' },
  ],
  stufenLabels: {
    lk: ['Nicht erf\u00fcllt', 'Teilweise erf\u00fcllt', 'Weitgehend erf\u00fcllt', 'Vollst\u00e4ndig erf\u00fcllt'],
    su: ['Das kann ich noch nicht sicher', 'Das kann ich teilweise', 'Das kann ich schon gut', 'Das kann ich sehr sicher'],
  },
  kriterien: [],           // Array von Kriterium-Objekten
  hinweis: '',
  ccBy: true,

  // Vorschau
  previewVersion: 'beide',
};

/** Pool-Themen (fachunabhängige Kriterienpools, werden nach Laden der WB gefüllt) */
const POOL_TOPICS = [
  { id: 'ki-ideenfindung',        label: 'KI zur Ideenfindung nutzen' },
  { id: 'ki-als-erklaerer',       label: 'KI als Lernbegleitung' },
  { id: 'ki-ergebnis-verifizieren', label: 'KI-Ergebnis verifizieren' },
  { id: 'ki-dialogfuehrung',      label: 'KI-Dialog f\u00fchren' },
  { id: 'ki-kooperativer-einsatz', label: 'KI in der Gruppenarbeit' },
  { id: 'ki-recherche',           label: 'KI zur Recherche nutzen' },
  { id: 'ki-schreiben',           label: 'KI-gest\u00fctztes Schreiben' },
  { id: 'ki-praesentation',       label: 'KI f\u00fcr Pr\u00e4sentationen' },
];

// ============================================================
// INITIALISIERUNG
// ============================================================

/**
 * Lädt die Wissensbasis und initialisiert die entsprechende Seite.
 */
async function init() {
  // Primär: per script-Tag vorgeladene Daten (funktioniert auch bei file://)
  if (window.WISSENSBASIS) {
    WB = window.WISSENSBASIS;
  } else {
    // Fallback: fetch (funktioniert auf HTTP-Server / GitHub Pages)
    try {
      const resp = await fetch('wissensbasis_raster.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      WB = await resp.json();
    } catch (err) {
      console.error('Wissensbasis konnte nicht geladen werden:', err);
      showLoadError();
      return;
    }
  }

  const page = detectPage();
  if (page === 'index') {
    initIndexPage();
  } else if (page === 'builder') {
    initBuilderPage();
  }
}

/** Erkennt die aktuelle Seite anhand der URL */
function detectPage() {
  const path = window.location.pathname;
  if (path.includes('builder')) return 'builder';
  return 'index';
}

function showLoadError() {
  const el = document.getElementById('loading-state') || document.getElementById('cards-grid');
  if (el) el.innerHTML = '<p style="color:red;">Fehler: Die Wissensbasis konnte nicht geladen werden. Bitte Seite neu laden.</p>';
}

// ============================================================
// INDEX-SEITE
// ============================================================

/** Initialisiert die Übersichtsseite (index.html) */
function initIndexPage() {
  const grid = document.getElementById('cards-grid');
  const loading = document.getElementById('loading-state');
  if (!grid) return;

  WB.raster_fertig.forEach(raster => {
    grid.appendChild(createRasterCard(raster));
  });

  if (loading) loading.style.display = 'none';
  grid.style.display = 'grid';
}

/**
 * Erstellt eine Rasterkarte für die Übersicht.
 * @param {Object} raster - Raster-Objekt aus der Wissensbasis
 * @returns {HTMLElement}
 */
function createRasterCard(raster) {
  const card = document.createElement('article');
  card.className = 'raster-card';
  card.dataset.id = raster.id;
  card.dataset.kompetenz = raster.kompetenzbereich.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // GS-Empfehlung prüfen
  const gsIds = ['01', '02', '04', '07', '09', '10'];
  const isGsRecommended = gsIds.includes(raster.id);
  card.dataset.gs = isGsRecommended ? 'true' : 'false';

  const tagClass = getTagClass(raster.kompetenzbereich);
  const tagLabel = getTagLabel(raster.kompetenzbereich);
  const criteriaNames = raster.kriterien.map(k => `<li>${escapeHtml(k.name)}</li>`).join('');
  const gsNote = isGsRecommended ? '<span class="gs-notice" title="F\u00fcr Grundschule empfohlen">GS ✓</span>' : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-num">Raster ${raster.id}</div>
      <div class="card-title">${escapeHtml(raster.titel)}${gsNote}</div>
      <span class="competency-tag ${tagClass}" aria-label="Kompetenzbereich: ${tagLabel}">${tagLabel}</span>
    </div>
    <div class="card-body">
      <ul class="criteria-list" aria-label="Kriterien">${criteriaNames}</ul>
    </div>
    <div class="card-footer">
      <button class="btn btn-secondary btn-sm" onclick="openPreviewModal('${raster.id}')" aria-label="Vorschau Raster ${raster.id} \u00f6ffnen">
        👁 Vorschau
      </button>
      <button class="btn btn-primary btn-sm" onclick="downloadRasterDocx('${raster.id}', 'lk')" aria-label="Lehrkraft-Version herunterladen">
        ⬇ LK (DOCX)
      </button>
      <button class="btn btn-su btn-sm" onclick="downloadRasterDocx('${raster.id}', 'su')" aria-label="Sch\u00fcler:in-Version herunterladen">
        ⬇ SuS (DOCX)
      </button>
    </div>
  `;
  return card;
}

/**
 * Filtert Rasterkarten nach Kompetenzbereich.
 * @param {HTMLElement} btn - Geklickter Filter-Button
 * @param {string} filter - 'alle' | 'instrumental' | 'analytisch' | 'personell' | 'integrativ'
 */
function filterRaster(btn, filter) {
  // Chip-Status aktualisieren
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');

  const cards = document.querySelectorAll('.raster-card');
  cards.forEach(card => {
    let show = true;
    if (filter !== 'alle') {
      show = card.dataset.kompetenz.includes(filter);
    }
    card.classList.toggle('hidden', !show);
  });
}

// ============================================================
// PREVIEW MODAL (INDEX-SEITE)
// ============================================================

let _currentModalRasterId = null;

/**
 * Öffnet das Vorschau-Modal für ein fertiges Raster.
 * @param {string} rasterId
 */
function openPreviewModal(rasterId) {
  _currentModalRasterId = rasterId;
  const raster = WB.raster_fertig.find(r => r.id === rasterId);
  if (!raster) return;

  document.getElementById('modal-title').textContent = `Raster ${raster.id} \u2013 ${raster.titel}`;

  // Builder-Link mit vorgewähltem Raster
  const link = document.getElementById('modal-builder-link');
  if (link) link.href = `builder.html?raster=${rasterId}`;

  // LK-Vorschau
  document.getElementById('preview-lk').innerHTML = buildRasterTableHTML(raster, 'lk');
  // SuS-Vorschau
  document.getElementById('preview-su').innerHTML = buildRasterTableHTML(raster, 'su');

  // Tab zurücksetzen
  switchTab('lk');

  const modal = document.getElementById('preview-modal');
  modal.classList.add('open');
  modal.querySelector('.modal-close').focus();
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('preview-modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/**
 * Wechselt den Tab im Preview-Modal.
 * @param {'lk'|'su'} tab
 */
function switchTab(tab) {
  const tabLk = document.getElementById('tab-lk');
  const tabSu = document.getElementById('tab-su');
  const panelLk = document.getElementById('panel-lk');
  const panelSu = document.getElementById('panel-su');

  if (tab === 'lk') {
    tabLk.classList.add('active');
    tabSu.classList.remove('active');
    panelLk.hidden = false;
    panelSu.hidden = true;
    tabLk.setAttribute('aria-selected', 'true');
    tabSu.setAttribute('aria-selected', 'false');
  } else {
    tabSu.classList.add('active');
    tabLk.classList.remove('active');
    panelSu.hidden = false;
    panelLk.hidden = true;
    tabSu.setAttribute('aria-selected', 'true');
    tabLk.setAttribute('aria-selected', 'false');
  }
}

/**
 * Download aus dem Preview-Modal heraus.
 * @param {'lk'|'su'} version
 */
function downloadFromModal(version) {
  if (!_currentModalRasterId) return;
  downloadRasterDocx(_currentModalRasterId, version);
}

/**
 * Lädt ein fertiges Raster als DOCX herunter.
 * @param {string} rasterId
 * @param {'lk'|'su'} version
 */
function downloadRasterDocx(rasterId, version) {
  const raster = WB.raster_fertig.find(r => r.id === rasterId);
  if (!raster) return;

  const config = buildDocxConfigFromRaster(raster, version);
  const filename = `Raster_${raster.id}_${sanitizeFilename(raster.slug)}_${version === 'lk' ? 'Lehrkraft' : 'Schueler'}.docx`;
  generateDocx(config, filename);
}

// ============================================================
// BUILDER-SEITE
// ============================================================

/** Initialisiert den Builder (builder.html) */
function initBuilderPage() {
  // Dropdown für fertige Raster befüllen
  const sel = document.getElementById('select-fertig-raster');
  if (sel) {
    WB.raster_fertig.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.id} \u2013 ${r.titel}`;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', onFertigRasterChange);
  }

  // Pool-Topics direkt aus der Wissensbasis befüllen (nur vorhandene Einträge)
  const poolGrid = document.getElementById('pool-topics-grid');
  if (poolGrid && WB.kriterien_pool && WB.kriterien_pool.fachunabhaengig) {
    WB.kriterien_pool.fachunabhaengig.forEach(entry => {
      const btn = document.createElement('button');
      btn.className = 'pool-option';
      btn.dataset.topicId = entry.id;
      btn.textContent = entry.name;
      btn.addEventListener('click', function() {
        selectPoolTopic(entry.id, this);
      });
      poolGrid.appendChild(btn);
    });
  }

  // Standard-Kriterien anlegen
  initDefaultKriterien();

  // Punkte-Display initialisieren
  renderPunkteDisplay();

  // Stufen-Labels initialisieren
  renderStufenLabels();

  // URL-Param: Raster vorladen
  if (window._preloadRasterId) {
    selectStartOption('fertig');
    const selEl = document.getElementById('select-fertig-raster');
    if (selEl) {
      selEl.value = window._preloadRasterId;
      onFertigRasterChange();
    }
    goToStep(2);
  }
}

/** Legt die Standard-4-Kriterien an (leer) */
function initDefaultKriterien() {
  STATE.kriterien = [];
  for (let i = 0; i < 4; i++) {
    STATE.kriterien.push(createEmptyCriterion());
  }
  renderCriteria();
}

/** Erstellt ein leeres Kriterium-Objekt */
function createEmptyCriterion() {
  return {
    id: generateId(),
    name: '',
    lk: { s1: '', s2: '', s3: '', s4: '', s5: '', s6: '' },
    su: { s1: '', s2: '', s3: '', s4: '', s5: '', s6: '' },
  };
}

// ============================================================
// SCHRITT 1 – AUSGANGSPUNKT
// ============================================================

/**
 * Wählt den Ausgangspunkt und zeigt Sub-Optionen.
 * @param {'fertig'|'pool'|'neu'} option
 */
function selectStartOption(option) {
  STATE.startOption = option;

  // Karten-Status
  ['fertig', 'pool', 'neu'].forEach(o => {
    const el = document.getElementById('opt-' + o);
    if (el) {
      el.classList.toggle('selected', o === option);
      el.setAttribute('aria-pressed', o === option ? 'true' : 'false');
    }
  });

  // Sub-Panels
  document.querySelectorAll('.start-sub').forEach(s => s.classList.remove('visible'));
  const sub = document.getElementById('sub-' + option);
  if (sub) sub.classList.add('visible');

  // Für "neu" direkt freigeben
  if (option === 'neu') {
    enableStep1Next(true);
  } else {
    enableStep1Next(false);
  }
}

function enableStep1Next(enabled) {
  const btn = document.getElementById('btn-step1-next');
  if (btn) btn.disabled = !enabled;
}

function onFertigRasterChange() {
  const sel = document.getElementById('select-fertig-raster');
  if (!sel || !sel.value) return;
  STATE.selectedRasterId = sel.value;
  enableStep1Next(true);
}

function selectPoolTopic(topicId, btn) {
  STATE.selectedPoolTopic = topicId;
  document.querySelectorAll('.pool-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  enableStep1Next(true);
}

// ============================================================
// SCHRITT NAVIGATION
// ============================================================

/**
 * Navigiert zu einem Wizard-Schritt.
 * @param {number} step
 */
function goToStep(step) {
  if (step === 2 && STATE.startOption === null) return;

  // Ggf. Daten laden wenn von Schritt 1 → 2
  if (step === 2 && STATE.currentStep === 1) {
    applyStartOption();
  }

  // Vorschau aktualisieren wenn → Schritt 3
  if (step === 3) {
    readFormToState();
    renderPreview();
    renderExportButtons();
    updateExportFilename();
  }

  STATE.currentStep = step;

  // Step-Panels
  document.querySelectorAll('.step-panel').forEach((panel, idx) => {
    panel.classList.toggle('active', idx + 1 === step);
  });

  // Sidebar
  for (let i = 1; i <= 3; i++) {
    const item = document.getElementById('sidebar-step-' + i);
    if (!item) continue;
    item.classList.remove('active', 'done');
    if (i === step) item.classList.add('active');
    else if (i < step) item.classList.add('done');
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Wendet den gewählten Ausgangspunkt auf STATE.kriterien an.
 */
function applyStartOption() {
  if (STATE.startOption === 'fertig' && STATE.selectedRasterId) {
    loadRasterIntoBuilder(STATE.selectedRasterId);
  } else if (STATE.startOption === 'pool' && STATE.selectedPoolTopic) {
    loadPoolTopicIntoBuilder(STATE.selectedPoolTopic);
  } else if (STATE.startOption === 'neu') {
    initDefaultKriterien();
  }
}

/**
 * Lädt ein fertiges Raster in den Builder.
 * @param {string} rasterId
 */
function loadRasterIntoBuilder(rasterId) {
  const raster = WB.raster_fertig.find(r => r.id === rasterId);
  if (!raster) return;

  // Metadaten
  const titelInput = document.getElementById('raster-titel');
  if (titelInput) {
    titelInput.value = raster.titel;
    updateCharCount(titelInput);
  }
  STATE.titel = raster.titel;

  // Kriterien
  STATE.kriterien = raster.kriterien.map(k => ({
    id: generateId(),
    name: k.name,
    lk: { ...k.lk, s5: '', s6: '' },
    su: { ...k.su, s5: '', s6: '' },
  }));

  // Hinweis
  const hinweisInput = document.getElementById('raster-hinweis');
  if (hinweisInput) hinweisInput.value = raster.hinweis_lk || '';
  STATE.hinweis = raster.hinweis_lk || '';

  renderCriteria();
}

/**
 * Lädt Pool-Kriterien für ein Thema in den Builder.
 * @param {string} topicId
 */
function loadPoolTopicIntoBuilder(topicId) {
  const poolEntry = WB.kriterien_pool.fachunabhaengig.find(k => k.id === topicId);
  if (!poolEntry) {
    initDefaultKriterien();
    return;
  }

  const jahrgangKey = getJahrgangKey();
  const variant = poolEntry.varianten[jahrgangKey] || poolEntry.varianten['klasse-8-10'];

  STATE.kriterien = [{
    id: generateId(),
    name: poolEntry.name,
    lk: { s1: variant.lk.s1, s2: variant.lk.s2 || '', s3: variant.lk.s3 || '', s4: variant.lk.s4, s5: '', s6: '' },
    su: { s1: variant.su.s1, s2: variant.su.s2 || '', s3: variant.su.s3 || '', s4: variant.su.s4, s5: '', s6: '' },
  }];

  // Weitere leere Kriterien auffüllen auf 4
  while (STATE.kriterien.length < 4) STATE.kriterien.push(createEmptyCriterion());

  const titelInput = document.getElementById('raster-titel');
  if (titelInput) {
    titelInput.value = poolEntry.name;
    updateCharCount(titelInput);
  }
  STATE.titel = poolEntry.name;

  renderCriteria();
}

// ============================================================
// SCHRITT 2 – KONFIGURATION
// ============================================================

function onConfigChange() {
  // Nichts nötig – state wird beim Wechsel zu Schritt 3 gelesen
}

function onJahrgangChange() {
  const sel = document.getElementById('raster-jahrgang');
  const notice = document.getElementById('gs-builder-notice');
  if (sel && notice) {
    notice.style.display = sel.value === 'klasse-3-4' ? 'flex' : 'none';
  }
  onConfigChange();
}

function updateCharCount(input) {
  const counter = document.getElementById('titel-count');
  if (counter) counter.textContent = input.value.length;
}

function updateNiveauLabel() {
  const slider = document.getElementById('niveau-slider');
  const label = document.getElementById('niveau-label');
  if (!slider || !label) return;
  const labels = ['', 'Einfach', 'Standard', 'Anspruchsvoll'];
  label.textContent = labels[slider.value] || 'Standard';
}

function setPerspektive(p) {
  STATE.perspektive = p;
  ['beide', 'lk', 'su'].forEach(v => {
    const btn = document.getElementById('persp-' + v);
    if (btn) {
      btn.classList.toggle('active', v === p);
      btn.setAttribute('aria-pressed', v === p ? 'true' : 'false');
    }
  });

  // Spalten-Sichtbarkeit direkt im DOM aktualisieren (ohne Re-Render)
  document.querySelectorAll('[data-col="lk"]').forEach(el => {
    el.style.display = (p === 'su') ? 'none' : '';
  });
  document.querySelectorAll('[data-col="su"]').forEach(el => {
    el.style.display = (p === 'lk') ? 'none' : '';
  });

  // Bewertungssystem-Bereich: nur bei LK relevant
  const bewertungSection = document.getElementById('bewertung-section');
  if (bewertungSection) bewertungSection.style.display = (p === 'su') ? 'none' : '';
}

// ---- Stufen ----

function changeStufen(delta) {
  const newVal = Math.min(6, Math.max(2, STATE.stufen + delta));
  if (newVal === STATE.stufen) return;
  STATE.stufen = newVal;
  document.getElementById('stufen-value').textContent = newVal;
  updatePunkteConfig();
  renderPunkteDisplay();
  renderStufenLabels();
  renderCriteria();
}

/** Passt die Punkte-Konfiguration an die neue Stufenzahl an. */
function updatePunkteConfig() {
  const n = STATE.stufen;
  // Defaults für verschiedene Stufenzahlen
  const defaults = {
    2: [{ lk: 'Nicht erf\u00fcllt', su: 'Das schaffe ich noch nicht', punkte: '0' }, { lk: 'Erf\u00fcllt', su: 'Das schaffe ich', punkte: '1' }],
    3: [
      { lk: 'Nicht erf\u00fcllt', su: 'Noch nicht', punkte: '0' },
      { lk: 'Teilweise erf\u00fcllt', su: 'Teilweise', punkte: '1\u20132' },
      { lk: 'Erf\u00fcllt', su: 'Gut', punkte: '3' },
    ],
    4: [
      { lk: 'Nicht erf\u00fcllt', su: 'Das kann ich noch nicht sicher', punkte: '0' },
      { lk: 'Teilweise erf\u00fcllt', su: 'Das kann ich teilweise', punkte: '1\u20132' },
      { lk: 'Weitgehend erf\u00fcllt', su: 'Das kann ich schon gut', punkte: '3\u20134' },
      { lk: 'Vollst\u00e4ndig erf\u00fcllt', su: 'Das kann ich sehr sicher', punkte: '5' },
    ],
    5: [
      { lk: 'Nicht erf\u00fcllt', su: 'Noch nicht', punkte: '0' },
      { lk: 'Ans\u00e4tzweise erf\u00fcllt', su: 'Ans\u00e4tzweise', punkte: '1' },
      { lk: 'Teilweise erf\u00fcllt', su: 'Teilweise', punkte: '2\u20133' },
      { lk: 'Weitgehend erf\u00fcllt', su: 'Weitgehend', punkte: '4\u20135' },
      { lk: 'Vollst\u00e4ndig erf\u00fcllt', su: 'Sehr sicher', punkte: '6' },
    ],
    6: [
      { lk: 'Nicht erf\u00fcllt', su: 'Noch nicht', punkte: '0' },
      { lk: 'Ans\u00e4tzweise', su: 'Ans\u00e4tzweise', punkte: '1' },
      { lk: 'Teilweise', su: 'Teilweise', punkte: '2' },
      { lk: 'Gr\u00f6\u00dftenteils', su: 'Gr\u00f6\u00dftenteils', punkte: '3\u20134' },
      { lk: 'Weitgehend', su: 'Gut', punkte: '5' },
      { lk: 'Vollst\u00e4ndig', su: 'Sehr sicher', punkte: '6' },
    ],
  };

  const def = defaults[n] || defaults[4];
  STATE.punkteConfig = def.map(d => ({ label: d.lk, punkte: d.punkte, lkDefault: d.lk, suDefault: d.su }));
  STATE.stufenLabels.lk = def.map(d => d.lk);
  STATE.stufenLabels.su = def.map(d => d.su);
}

function renderPunkteDisplay() {
  const container = document.getElementById('punkte-display');
  const maxEl = document.getElementById('max-punkte');
  if (!container) return;

  container.innerHTML = '';
  let maxP = 0;
  STATE.punkteConfig.forEach((p, i) => {
    const badge = document.createElement('button');
    badge.className = `punkte-badge s${i + 1}`;
    badge.textContent = `S${i + 1}: ${p.punkte} Pkt.`;
    badge.title = 'Klicken zum Bearbeiten';
    badge.setAttribute('aria-label', `Stufe ${i + 1}: ${p.punkte} Punkte – zum Bearbeiten klicken`);
    badge.addEventListener('click', () => openPunkteModal());
    container.appendChild(badge);

    // Maximalpunktzahl berechnen
    const pts = p.punkte.split('\u2013').map(x => parseInt(x, 10)).filter(n => !isNaN(n));
    if (pts.length > 0) maxP = Math.max(maxP, pts[pts.length - 1]);
  });

  if (maxEl) maxEl.textContent = maxP;
}

// ---- Punkte-Modal ----

function openPunkteModal() {
  const grid = document.getElementById('punkte-editor-grid');
  const maxEl = document.getElementById('punkte-modal-max');
  if (!grid) return;

  grid.innerHTML = '';
  STATE.punkteConfig.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'd-flex align-center gap-2';
    row.innerHTML = `
      <span class="stufen-label-badge s${i + 1}">${i + 1}</span>
      <span style="font-size:0.85rem; font-weight:600; flex:1;">${escapeHtml(p.lkDefault)}</span>
      <input type="text" value="${escapeHtml(p.punkte)}" data-idx="${i}"
        style="width:80px; padding:0.35rem 0.5rem; font-size:0.85rem; border:1.5px solid var(--color-border); border-radius:var(--radius);"
        aria-label="Punkte f\u00fcr Stufe ${i + 1}"
        onchange="updatePunkteValue(${i}, this.value)" oninput="updatePunkteValue(${i}, this.value)">
    `;
    grid.appendChild(row);
  });

  updatePunkteModalMax();
  document.getElementById('punkte-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updatePunkteValue(idx, val) {
  STATE.punkteConfig[idx].punkte = val;
  renderPunkteDisplay();
  updatePunkteModalMax();
}

function updatePunkteModalMax() {
  const maxEl = document.getElementById('punkte-modal-max');
  if (!maxEl) return;
  let maxP = 0;
  STATE.punkteConfig.forEach(p => {
    const pts = p.punkte.split('\u2013').map(x => parseInt(x, 10)).filter(n => !isNaN(n));
    if (pts.length > 0) maxP = Math.max(maxP, pts[pts.length - 1]);
  });
  maxEl.textContent = STATE.kriterien.length * maxP;
}

function closePunkteModal() {
  const modal = document.getElementById('punkte-modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  renderPunkteDisplay();
}

// ---- Stufen-Labels ----

function renderStufenLabels() {
  const grid = document.getElementById('stufen-labels-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const colLk = document.createElement('div');
  colLk.className = 'stufen-labels-col';
  colLk.innerHTML = '<label>Lehrkraft-Version</label>';

  const colSu = document.createElement('div');
  colSu.className = 'stufen-labels-col';
  colSu.innerHTML = '<label>Sch\u00fcler:in-Version</label>';

  for (let i = 0; i < STATE.stufen; i++) {
    const lkVal = STATE.stufenLabels.lk[i] || `Stufe ${i + 1}`;
    const suVal = STATE.stufenLabels.su[i] || `Stufe ${i + 1}`;

    colLk.innerHTML += `
      <div class="stufen-label-row">
        <span class="stufen-label-badge s${i + 1}" aria-hidden="true">${i + 1}</span>
        <input type="text" value="${escapeHtml(lkVal)}" data-type="lk" data-idx="${i}"
          style="font-size:0.82rem; padding:0.3rem 0.5rem; border:1.5px solid var(--color-border); border-radius:var(--radius-sm); flex:1;"
          aria-label="LK-Label Stufe ${i + 1}"
          oninput="updateStufenLabel('lk', ${i}, this.value)">
      </div>`;

    colSu.innerHTML += `
      <div class="stufen-label-row">
        <span class="stufen-label-badge s${i + 1}" aria-hidden="true">${i + 1}</span>
        <input type="text" value="${escapeHtml(suVal)}" data-type="su" data-idx="${i}"
          style="font-size:0.82rem; padding:0.3rem 0.5rem; border:1.5px solid var(--color-border); border-radius:var(--radius-sm); flex:1;"
          aria-label="SuS-Label Stufe ${i + 1}"
          oninput="updateStufenLabel('su', ${i}, this.value)">
      </div>`;
  }

  grid.appendChild(colLk);
  grid.appendChild(colSu);
}

function updateStufenLabel(type, idx, val) {
  STATE.stufenLabels[type][idx] = val;
}

// ============================================================
// KRITERIEN
// ============================================================

/** Rendert alle Kriterien im Container */
function renderCriteria() {
  const container = document.getElementById('criteria-container');
  if (!container) return;
  container.innerHTML = '';

  STATE.kriterien.forEach((kriterium, idx) => {
    container.appendChild(createCriterionElement(kriterium, idx));
  });

  updateCriteriaCount();
  updateAddButton();
  initDragDrop();
}

/**
 * Erstellt das DOM-Element für ein Kriterium.
 * @param {Object} kriterium
 * @param {number} idx
 * @returns {HTMLElement}
 */
function createCriterionElement(kriterium, idx) {
  const item = document.createElement('div');
  item.className = 'criterion-item';
  item.dataset.id = kriterium.id;
  item.setAttribute('role', 'listitem');
  item.setAttribute('draggable', 'true');

  const levelRows = buildLevelRowsHTML(kriterium, idx);
  const showSu = STATE.perspektive !== 'lk';
  const showLk = STATE.perspektive !== 'su';

  item.innerHTML = `
    <div class="criterion-header">
      <span class="drag-handle" title="Ziehen zum Verschieben" aria-label="Kriterium verschieben" tabindex="0" role="button">⠿</span>
      <input type="text"
        class="criterion-name-input"
        value="${escapeHtml(kriterium.name)}"
        placeholder="Kriteriumsname eingeben …"
        data-criterion-id="${kriterium.id}"
        aria-label="Name Kriterium ${idx + 1}"
        oninput="updateCriterionName('${kriterium.id}', this.value)">
      <button class="btn-icon" onclick="removeCriterion('${kriterium.id}')"
        aria-label="Kriterium ${idx + 1} entfernen"
        title="Kriterium entfernen">🗑️</button>
    </div>
    <div class="criterion-body">
      ${levelRows}
    </div>
  `;

  // Spalten-Sichtbarkeit basierend auf Perspektive
  if (!showLk) {
    item.querySelectorAll('[data-col="lk"]').forEach(el => el.style.display = 'none');
  }
  if (!showSu) {
    item.querySelectorAll('[data-col="su"]').forEach(el => el.style.display = 'none');
  }

  return item;
}

/**
 * Baut die Level-Zeilen HTML für ein Kriterium.
 * @param {Object} kriterium
 * @param {number} idx
 * @returns {string}
 */
function buildLevelRowsHTML(kriterium, idx) {
  const colors = ['s1', 's2', 's3', 's4', 's5', 's6'];
  let html = '';

  for (let s = 1; s <= STATE.stufen; s++) {
    const sk = 's' + s;
    const lkVal = kriterium.lk[sk] || '';
    const suVal = kriterium.su[sk] || '';
    const lkLabel = STATE.stufenLabels.lk[s - 1] || `Stufe ${s}`;
    const suLabel = STATE.stufenLabels.su[s - 1] || `Stufe ${s}`;
    const colorClass = colors[s - 1];

    html += `
      <div class="level-row">
        <span class="level-label ${colorClass}">Stufe ${s}</span>
        <div class="level-inputs">
          <div class="textarea-wrap" data-col="lk">
            <label class="visually-hidden" for="lk-${kriterium.id}-${sk}">Lehrkraft – ${lkLabel}</label>
            <textarea id="lk-${kriterium.id}-${sk}"
              placeholder="Lehrkraft: ${escapeHtml(lkLabel)} …"
              data-criterion-id="${kriterium.id}"
              data-field="lk" data-stufe="${sk}"
              oninput="updateCriterionText('${kriterium.id}', 'lk', '${sk}', this.value)"
              aria-label="Lehrkraft-Formulierung Stufe ${s}"
              rows="3">${escapeHtml(lkVal)}</textarea>
          </div>
          <div class="textarea-wrap" data-col="su">
            <label class="visually-hidden" for="su-${kriterium.id}-${sk}">Sch\u00fcler:in – ${suLabel}</label>
            <textarea id="su-${kriterium.id}-${sk}"
              placeholder="Sch\u00fcler:in: ${escapeHtml(suLabel)} …"
              data-criterion-id="${kriterium.id}"
              data-field="su" data-stufe="${sk}"
              oninput="updateCriterionText('${kriterium.id}', 'su', '${sk}', this.value)"
              aria-label="Sch\u00fcler:in-Formulierung Stufe ${s}"
              rows="3">${escapeHtml(suVal)}</textarea>
          </div>
        </div>
      </div>`;
  }
  return html;
}

function updateCriterionName(id, val) {
  const k = STATE.kriterien.find(k => k.id === id);
  if (k) k.name = val;
}

function updateCriterionText(id, field, stufe, val) {
  const k = STATE.kriterien.find(k => k.id === id);
  if (k) k[field][stufe] = val;
}

function addCriterion() {
  if (STATE.kriterien.length >= 8) return;
  STATE.kriterien.push(createEmptyCriterion());
  renderCriteria();
}

function removeCriterion(id) {
  if (STATE.kriterien.length <= 1) return;
  STATE.kriterien = STATE.kriterien.filter(k => k.id !== id);
  renderCriteria();
}

function updateCriteriaCount() {
  const n = STATE.kriterien.length;
  const label = n === 1 ? '1 Kriterium' : `${n} Kriterien`;
  ['criteria-count', 'criteria-count-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

function updateAddButton() {
  const btn = document.getElementById('btn-add-criterion');
  if (btn) {
    btn.disabled = STATE.kriterien.length >= 8;
    btn.title = STATE.kriterien.length >= 8 ? 'Maximum 8 Kriterien erreicht' : '';
  }
}

// ============================================================
// DRAG & DROP (Kriterien neu sortieren)
// ============================================================

function initDragDrop() {
  const container = document.getElementById('criteria-container');
  if (!container) return;

  let draggedEl = null;

  container.querySelectorAll('.criterion-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      draggedEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      container.querySelectorAll('.criterion-item').forEach(i => i.classList.remove('drag-over'));
      draggedEl = null;
      syncCriteriaOrderFromDOM();
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (item !== draggedEl) {
        container.querySelectorAll('.criterion-item').forEach(i => i.classList.remove('drag-over'));
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('drop', e => {
      e.preventDefault();
      if (draggedEl && item !== draggedEl) {
        const items = [...container.querySelectorAll('.criterion-item')];
        const dragIdx = items.indexOf(draggedEl);
        const dropIdx = items.indexOf(item);
        if (dragIdx < dropIdx) {
          container.insertBefore(draggedEl, item.nextSibling);
        } else {
          container.insertBefore(draggedEl, item);
        }
      }
    });
  });
}

function syncCriteriaOrderFromDOM() {
  const container = document.getElementById('criteria-container');
  if (!container) return;
  const newOrder = [];
  container.querySelectorAll('.criterion-item').forEach(el => {
    const found = STATE.kriterien.find(k => k.id === el.dataset.id);
    if (found) newOrder.push(found);
  });
  STATE.kriterien = newOrder;
}

// ============================================================
// SCHRITT 3 – VORSCHAU & EXPORT
// ============================================================

/** Liest alle Formular-Inputs in STATE */
function readFormToState() {
  STATE.titel = document.getElementById('raster-titel')?.value || '';
  STATE.fach = document.getElementById('raster-fach')?.value || 'fachunabhaengig';
  STATE.jahrgang = document.getElementById('raster-jahrgang')?.value || 'klasse-8-10';
  STATE.niveau = parseInt(document.getElementById('niveau-slider')?.value || '2', 10);
  STATE.hinweis = document.getElementById('raster-hinweis')?.value || '';
  STATE.ccBy = document.getElementById('cc-checkbox')?.checked ?? true;

  // Kriterien aus DOM synchronisieren
  document.querySelectorAll('.criterion-item').forEach(el => {
    const id = el.dataset.id;
    const k = STATE.kriterien.find(k => k.id === id);
    if (!k) return;

    const nameInput = el.querySelector('.criterion-name-input');
    if (nameInput) k.name = nameInput.value;

    el.querySelectorAll('textarea[data-field]').forEach(ta => {
      const field = ta.dataset.field;
      const stufe = ta.dataset.stufe;
      if (field && stufe) k[field][stufe] = ta.value;
    });
  });
}

/** Rendert die Live-Vorschau in Schritt 3 */
function renderPreview() {
  const output = document.getElementById('preview-output');
  if (!output) return;

  const rasterData = buildCurrentRasterData();
  let html = '';

  if (STATE.previewVersion !== 'su') {
    html += buildRasterTableHTML(rasterData, 'lk');
  }
  if (STATE.previewVersion !== 'lk') {
    if (STATE.previewVersion === 'beide') html += '<hr style="margin: 2rem 0; border-color: var(--color-border);">';
    html += buildRasterTableHTML(rasterData, 'su');
  }

  output.innerHTML = html;
}

function setPreviewVersion(v) {
  STATE.previewVersion = v;
  ['beide', 'lk', 'su'].forEach(val => {
    const btn = document.getElementById('prev-' + val);
    if (btn) {
      btn.classList.toggle('active', val === v);
      btn.setAttribute('aria-pressed', val === v ? 'true' : 'false');
    }
  });
  renderPreview();
}

/** Baut das aktuelle Raster-Objekt aus STATE */
function buildCurrentRasterData() {
  const hinweisText = STATE.ccBy
    ? (STATE.hinweis ? STATE.hinweis + ' | CC BY 4.0 Joscha Falck' : 'CC BY 4.0 Joscha Falck')
    : STATE.hinweis;

  return {
    id: '00',
    slug: sanitizeFilename(STATE.titel),
    titel: STATE.titel || 'Eigenes Raster',
    kompetenzbereich: '',
    kriterien: STATE.kriterien.map(k => ({
      name: k.name || 'Kriterium',
      lk: Object.fromEntries(Array.from({ length: STATE.stufen }, (_, i) => [`s${i + 1}`, k.lk[`s${i + 1}`] || ''])),
      su: Object.fromEntries(Array.from({ length: STATE.stufen }, (_, i) => [`s${i + 1}`, k.su[`s${i + 1}`] || ''])),
    })),
    stufenLabels: STATE.stufenLabels,
    punkteConfig: STATE.punkteConfig,
    stufen: STATE.stufen,
    hinweis_lk: hinweisText,
    hinweis_su: hinweisText,
    perspektive: STATE.perspektive,
  };
}

/** Rendert die Export-Buttons basierend auf der gewählten Perspektive */
function renderExportButtons() {
  const grid = document.getElementById('export-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const showLk = STATE.perspektive !== 'su';
  const showSu = STATE.perspektive !== 'lk';

  if (showLk) {
    grid.innerHTML += `
      <button class="btn btn-secondary" onclick="exportBuilderDocx('lk')">
        ⬇ LK-Version (DOCX)
      </button>
      <button class="btn btn-ghost" onclick="exportBuilderPdf('lk')">
        ⬇ LK-Version (PDF)
      </button>`;
  }
  if (showSu) {
    grid.innerHTML += `
      <button class="btn btn-su" onclick="exportBuilderDocx('su')">
        ⬇ SuS-Version (DOCX)
      </button>
      <button class="btn btn-ghost" onclick="exportBuilderPdf('su')">
        ⬇ SuS-Version (PDF)
      </button>`;
  }
  if (showLk && showSu) {
    grid.innerHTML += `
      <button class="btn btn-primary" onclick="exportBuilderZip()" style="grid-column: span 2;">
        📦 Alle Versionen als ZIP
      </button>`;
  }
}

function updateExportFilename() {
  const input = document.getElementById('export-filename');
  if (input && !input.value) {
    input.value = sanitizeFilename(STATE.titel || 'Eigenes_Raster');
  }
}

function getExportFilename() {
  const input = document.getElementById('export-filename');
  return sanitizeFilename(input?.value || STATE.titel || 'Raster');
}

function exportBuilderDocx(version) {
  const rasterData = buildCurrentRasterData();
  const config = buildDocxConfigFromRaster(rasterData, version);
  const filename = `${getExportFilename()}_${version === 'lk' ? 'Lehrkraft' : 'Schueler'}.docx`;
  generateDocx(config, filename);
}

function exportBuilderPdf(version) {
  const rasterData = buildCurrentRasterData();
  const filename = `${getExportFilename()}_${version === 'lk' ? 'Lehrkraft' : 'Schueler'}.pdf`;
  generatePdf(rasterData, version, filename);
}

async function exportBuilderZip() {
  const rasterData = buildCurrentRasterData();
  const baseName = getExportFilename();
  const zip = new JSZip();

  const versions = [];
  if (STATE.perspektive !== 'su') versions.push('lk');
  if (STATE.perspektive !== 'lk') versions.push('su');

  for (const v of versions) {
    const config = buildDocxConfigFromRaster(rasterData, v);
    try {
      const blob = await generateDocxBlob(config);
      zip.file(`${baseName}_${v === 'lk' ? 'Lehrkraft' : 'Schueler'}.docx`, blob);
    } catch (e) {
      console.error('DOCX Blob Fehler:', e);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  triggerDownload(content, `${baseName}_Raster.zip`);
}

// ============================================================
// JSON IMPORT / EXPORT
// ============================================================

function exportJSON() {
  readFormToState();
  const data = {
    meta: { tool: 'KI-Bewertungsraster-Builder', version: '1.0', erstellt: new Date().toISOString() },
    titel: STATE.titel,
    fach: STATE.fach,
    jahrgang: STATE.jahrgang,
    niveau: STATE.niveau,
    perspektive: STATE.perspektive,
    stufen: STATE.stufen,
    punkteConfig: STATE.punkteConfig,
    stufenLabels: STATE.stufenLabels,
    kriterien: STATE.kriterien,
    hinweis: STATE.hinweis,
    ccBy: STATE.ccBy,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${sanitizeFilename(STATE.titel || 'Raster')}_Konfiguration.json`);
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      applyImportedConfig(data);
    } catch (err) {
      alert('Die JSON-Datei konnte nicht gelesen werden. Bitte pr\u00fcfen Sie das Format.');
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset
}

function applyImportedConfig(data) {
  if (data.titel !== undefined) {
    STATE.titel = data.titel;
    const input = document.getElementById('raster-titel');
    if (input) { input.value = data.titel; updateCharCount(input); }
  }
  if (data.fach) {
    STATE.fach = data.fach;
    const sel = document.getElementById('raster-fach');
    if (sel) sel.value = data.fach;
  }
  if (data.jahrgang) {
    STATE.jahrgang = data.jahrgang;
    const sel = document.getElementById('raster-jahrgang');
    if (sel) sel.value = data.jahrgang;
  }
  if (data.stufen) {
    STATE.stufen = data.stufen;
    const el = document.getElementById('stufen-value');
    if (el) el.textContent = data.stufen;
  }
  if (data.punkteConfig) STATE.punkteConfig = data.punkteConfig;
  if (data.stufenLabels) STATE.stufenLabels = data.stufenLabels;
  if (data.perspektive) setPerspektive(data.perspektive);
  if (data.kriterien) {
    STATE.kriterien = data.kriterien;
    renderCriteria();
  }
  if (data.hinweis !== undefined) {
    STATE.hinweis = data.hinweis;
    const ta = document.getElementById('raster-hinweis');
    if (ta) ta.value = data.hinweis;
  }
  if (data.ccBy !== undefined) {
    STATE.ccBy = data.ccBy;
    const cb = document.getElementById('cc-checkbox');
    if (cb) cb.checked = data.ccBy;
  }

  renderPunkteDisplay();
  renderStufenLabels();
  alert('Konfiguration erfolgreich geladen!');
}

// ============================================================
// RASTER-TABELLE HTML (f\u00fcr Vorschau und Modal)
// ============================================================

/**
 * Baut den HTML-String einer Raster-Tabelle.
 * @param {Object} raster   - Raster-Objekt (fertig oder buildCurrentRasterData())
 * @param {'lk'|'su'} version
 * @returns {string}
 */
function buildRasterTableHTML(raster, version) {
  const isLk = version === 'lk';
  const versionLabel = isLk ? 'Einsch\u00e4tzung der Lehrkraft' : 'Selbsteinsch\u00e4tzung';
  const titleColor = isLk ? 'lk' : 'su';
  const tableClass = isLk ? 'lk' : 'su';

  const stufen = raster.stufen || 4;
  const stufenLabels = raster.stufenLabels || {
    lk: ['Nicht erf\u00fcllt', 'Teilweise erf\u00fcllt', 'Weitgehend erf\u00fcllt', 'Vollst\u00e4ndig erf\u00fcllt'],
    su: ['Das kann ich noch nicht sicher', 'Das kann ich teilweise', 'Das kann ich schon gut', 'Das kann ich sehr sicher'],
  };
  const punkteConfig = raster.punkteConfig || [
    { punkte: '0' }, { punkte: '1\u20132' }, { punkte: '3\u20134' }, { punkte: '5' },
  ];
  const labelArr = isLk ? stufenLabels.lk : stufenLabels.su;

  let html = `
    <div class="raster-preview-wrap">
      <div class="raster-table-title ${titleColor}">
        Bewertungsraster ${escapeHtml(raster.titel)} \u2013 ${versionLabel}
      </div>
      <table class="raster-table ${tableClass}" aria-label="Bewertungsraster ${escapeHtml(raster.titel)}">
        <thead>
          <tr>
            <th class="col-kriterium" scope="col">Kriterium</th>`;

  for (let s = 1; s <= stufen; s++) {
    const label = labelArr[s - 1] || `Stufe ${s}`;
    const pts = isLk && punkteConfig[s - 1] ? ` (${punkteConfig[s - 1].punkte} Pkt.)` : '';
    html += `<th class="col-s${s}" scope="col">${escapeHtml(label)}${pts}</th>`;
  }

  html += `
          </tr>
        </thead>
        <tbody>`;

  raster.kriterien.forEach(k => {
    html += `<tr><td class="col-kriterium">${escapeHtml(k.name || 'Kriterium')}</td>`;
    for (let s = 1; s <= stufen; s++) {
      const text = k[version]?.[`s${s}`] || '';
      html += `<td class="col-s${s}">${escapeHtml(text)}</td>`;
    }
    html += '</tr>';
  });

  html += `</tbody></table>`;

  // Meta-Zeile
  if (isLk) {
    const maxP = punkteConfig.reduce((acc, p) => {
      const pts = String(p.punkte).split('\u2013').map(x => parseInt(x, 10)).filter(n => !isNaN(n));
      return Math.max(acc, pts[pts.length - 1] || 0);
    }, 0);
    const total = raster.kriterien.length * maxP;
    html += `<p class="raster-meta-line">Name: _______________________ &nbsp;&nbsp; Fach: _____________ &nbsp;&nbsp; Datum: _____________ &nbsp;&nbsp; Punkte: _____/${total}</p>`;
  } else {
    html += `<p class="raster-meta-line">Name: _______________________ &nbsp;&nbsp; Klasse: _____________ &nbsp;&nbsp; Datum: _____________</p>`;
  }

  // Hinweis
  const hint = isLk ? (raster.hinweis_lk || '') : (raster.hinweis_su || '');
  if (hint) {
    html += `<p class="raster-hint-line"><strong>Hinweis:</strong> ${escapeHtml(hint)}</p>`;
  }

  html += `</div>`;
  return html;
}

/**
 * Baut die DOCX-Exportkonfiguration aus einem Raster-Objekt.
 * @param {Object} raster
 * @param {'lk'|'su'} version
 * @returns {Object}
 */
function buildDocxConfigFromRaster(raster, version) {
  const isLk = version === 'lk';
  const stufen = raster.stufen || 4;
  const stufenLabels = raster.stufenLabels || {
    lk: ['Nicht erf\u00fcllt', 'Teilweise erf\u00fcllt', 'Weitgehend erf\u00fcllt', 'Vollst\u00e4ndig erf\u00fcllt'],
    su: ['Das kann ich noch nicht sicher', 'Das kann ich teilweise', 'Das kann ich schon gut', 'Das kann ich sehr sicher'],
  };
  const punkteConfig = raster.punkteConfig || [
    { punkte: '0' }, { punkte: '1-2' }, { punkte: '3-4' }, { punkte: '5' },
  ];

  const maxP = punkteConfig.reduce((acc, p) => {
    const pts = String(p.punkte).replace('\u2013', '-').split('-').map(x => parseInt(x, 10)).filter(n => !isNaN(n));
    return Math.max(acc, pts[pts.length - 1] || 0);
  }, 0);
  const total = raster.kriterien.length * maxP;

  return {
    titel: raster.titel,
    version,
    stufen,
    stufenLabels: isLk ? stufenLabels.lk : stufenLabels.su,
    punkteConfig,
    maxPunkte: total,
    kriterien: raster.kriterien.map(k => ({
      name: k.name,
      stufen: Array.from({ length: stufen }, (_, i) => k[version]?.[`s${i + 1}`] || ''),
    })),
    hinweis: isLk ? (raster.hinweis_lk || '') : (raster.hinweis_su || ''),
  };
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function getJahrgangKey() {
  const sel = document.getElementById('raster-jahrgang');
  const val = sel?.value || STATE.jahrgang || 'klasse-8-10';
  if (val === 'uebergreifend') return 'klasse-8-10';
  return val;
}

function getTagClass(kompetenzbereich) {
  const map = {
    'Instrumental': 'tag-instrumental',
    'Analytisch-kritisch': 'tag-analytisch-kritisch',
    'Personell': 'tag-personell',
    'Personell / SRL': 'tag-personell-srl',
    'Integrativ': 'tag-integrativ',
  };
  return map[kompetenzbereich] || 'tag-instrumental';
}

function getTagLabel(kompetenzbereich) {
  const map = {
    'Instrumental': 'Instrumental',
    'Analytisch-kritisch': 'Analytisch-kritisch',
    'Personell': 'Personell',
    'Personell / SRL': 'Personell / SRL',
    'Integrativ': 'Integrativ',
  };
  return map[kompetenzbereich] || kompetenzbereich;
}

/** Escapet HTML-Sonderzeichen */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Bereinigt einen String als Dateiname */
function sanitizeFilename(str) {
  if (!str) return 'Raster';
  return str
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df\-]/g, '')
    .slice(0, 80);
}

/** Generiert eine einfache eindeutige ID */
function generateId() {
  return 'k_' + Math.random().toString(36).slice(2, 9);
}

/** Triggert einen Browser-Download */
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

// ============================================================
// START
// ============================================================
document.addEventListener('DOMContentLoaded', init);
