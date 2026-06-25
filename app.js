
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// URL van de Documentscreening-app (voor "Screen convenant"-knop in Concepten-kolom)
const DOCUMENTSCREENING_URL = 'https://documentscreening-alenders-progs-projects.vercel.app';

// ── INFO COMPLETENESS ──
const INFO_KEYS = ['leg_ouders_p1','leg_ouders_p2','leg_kinderen','huwelijkse_vw','testament','werkgever_p1','werkgever_p2','loonstroken_p1','loonstroken_p2','jaaropgave_p1','jaaropgave_p2','belasting_p1','belasting_p2','waarde_autos','pensioen_p1','pensioen_p2','saldi','saldo_polis','lijfrente','kapitaalverz','schulden','schenkingen','notarisakte','hypotheekgegevens','hypotheekakte','woz','jaaropgave_hyp','jaarcijfers_p1','jaarcijfers_p2'];

function isInfoComplete(infoDataStr) {
  if (!infoDataStr) return false;
  try {
    const data = JSON.parse(infoDataStr);
    if (data._nvt) return true;
    return INFO_KEYS.every(key => {
      const d = data[key] || { b: 1, a: 0 };
      return d.b !== 1 || d.a === 1;
    });
  } catch (e) { return false; }
}

// ── COLUMNS ──
const COLUMNS = [
  { id: 'fase1',     label: 'Klanten 1e fase',   color: '#F7931E' },
  { id: 'controle',  label: 'Controle Advocaat',  color: '#2D6AA0' },
  { id: 'concepten', label: 'Klanten concepten',  color: '#C47A1A' },
  { id: 'getekend',  label: 'Getekend',           color: '#3E6E3E' },
  { id: 'advocaat',  label: 'Advocaat',           color: '#6D4A9C' },
  { id: 'rechtbank', label: 'Rechtbank',          color: '#B83518' },
  { id: 'gemeente',  label: 'Gemeente',           color: '#7A4E1E' },
  { id: 'afronding', label: 'Afronding',          color: '#1E7A52' },
  { id: 'afgerond',  label: 'Afgerond',           color: '#5A7A6A' },
];

// Fields per column. type: 'date' | 'yn' | 'info_btn' | 'docs_btn'
// Note: 'afspraak' is the DB field for "Concepten verstuurd"
const COLUMN_FIELDS = {
  fase1: {
    fields: [
      { key: 'bevestigd', type: 'toevoeging_info_btn' },
      { label: 'Klant gemaild',  key: 'gemaild',         type: 'yn'   },
      { label: 'Actie voor',     key: 'actie_voor',       type: 'date' },
    ],
    hasOpm: true,
  },
  concepten: {
    fields: [
      { label: 'Concepten verstuurd', key: 'afspraak',            type: 'date' },
      { label: 'Reactie ontvangen',   key: 'reactie_ontvangen',   type: 'date' },
      { label: 'Concepten akkoord',   key: 'concepten_akkoord',   type: 'date' },
    ],
    hasOpm: true,
  },
  controle: {
    fields: [
      { label: 'Ter controle', key: 'ter_controle', type: 'date' },
      { label: 'Antwoord',     key: 'antwoord',     type: 'date' },
      { label: 'Verwerkt', key: 'naar_klanten', type: 'date' },
    ],
    hasOpm: true,
  },
  getekend: {
    fields: [
      {                                                      type: 'docs_btn' },
      { label: 'Klanten getekend', key: 'akkoord_klanten', type: 'date' },
      { label: 'Verstuurd Advocaat', key: 'docs_verstuurd',  type: 'date' },
    ],
    hasOpm: true,
  },
  advocaat: {
    fields: [
      { label: 'Belafspraak', key: 'belafspraak', type: 'date' },
      { label: 'Rechtbank',   key: 'rechtbank',   type: 'date' },
    ],
    hasOpm: true,
  },
  rechtbank: {
    fields: [
      { label: 'Beschikking',       key: 'beschikking',       type: 'date' },
      { label: 'Verstuurd klanten', key: 'verstuurd_klanten', type: 'date' },
      { label: 'Akkoord klanten',   key: 'akkoord_klanter',   type: 'date' },
    ],
    hasOpm: true,
  },
  gemeente: {
    fields: [
      { label: 'Verstuurd gemeente',     key: 'verstuurd_gemeente',    type: 'date' },
      { label: 'Inschrijving ontvangen', key: 'inschrijving_ontvangen', type: 'date' },
    ],
    hasOpm: true,
  },
  afronding: {
    fields: [
      { label: 'Ingelicht en beeindigd', key: 'beeindigd',              type: 'date'     },
      { label: 'Vergoeding aangevraagd', key: 'vergoeding_aangevraagd', type: 'date'     },
      { label: 'Vergoeding ontvangen',   key: 'vergoeding_ontvangen',   type: 'date'     },
      { label: 'ZOZA afgerond',          key: 'zoza_afgerond',          type: 'date'     },
      { label: 'Hyp.fee ontvangen',                                      type: 'computed', compute: computeHypFee, alarmCheck: isHypFeeOverdue },
    ],
    hasOpm: true,
  },
  afgerond: {
    fields: [
      { label: 'Ingelicht en beeindigd', key: 'beeindigd',              type: 'date'     },
      { label: 'Vergoeding aangevraagd', key: 'vergoeding_aangevraagd', type: 'date'     },
      { label: 'Vergoeding ontvangen',   key: 'vergoeding_ontvangen',   type: 'date'     },
      { label: 'ZOZA afgerond',          key: 'zoza_afgerond',          type: 'date'     },
      { label: 'Hyp.fee ontvangen',                                      type: 'computed', compute: computeHypFee, alarmCheck: isHypFeeOverdue },
    ],
    hasOpm: true,
  },
};

const MAX_FIELDS = 5; // pad all cards to this many field rows for uniform height

let rows = [], alarmSettings = {}, currentFilter = 'all';
let dragRowId = null;
let lastEditorMap = {};      // dossier_id → user_email
let lastChangedAtMap = {};   // dossier_id → ISO timestamp of last change
let currentEditorFilter = null;
let viewMode = 'fase'; // 'fase' | 'alles'
let activeFase = null;  // active phase in alles mode

// ── VALUE HELPERS ──
function hasValue(v) { return !!v && v !== 'n.v.t.'; }

function formatDate(val) {
  if (!val) return '—';
  if (val === 'n.v.t.') return 'n.v.t.';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function isOverdue(val) {
  if (!val || val === 'n.v.t.') return false;
  const d = new Date(val);
  if (isNaN(d)) return false;
  return d < new Date();
}

// ── COLUMN PLACEMENT ──
function isRechtbankNee(row) {
  if (row._rneeCache !== undefined) return row._rneeCache;
  try {
    const info = typeof row.info_data === 'string' ? JSON.parse(row.info_data) : (row.info_data || {});
    row._rneeCache = !!(info && info._dienstverlening && info._dienstverlening.rechtbank === 'Nee');
  } catch (e) { row._rneeCache = false; }
  return row._rneeCache;
}

function getInitialColumn(row) {
  const rnee = isRechtbankNee(row);
  if (hasValue(row.zoza_afgerond) || hasValue(row.vergoeding_ontvangen) ||
      hasValue(row.vergoeding_aangevraagd) || hasValue(row.beeindigd))            return 'afronding';
  if (hasValue(row.inschrijving_ontvangen))                                       return 'afronding';
  if (!rnee && hasValue(row.verstuurd_gemeente))                                  return 'gemeente';
  if (!rnee && hasValue(row.akkoord_klanter))                                     return 'gemeente';
  if (!rnee && (hasValue(row.verstuurd_klanten) || hasValue(row.beschikking)))    return 'rechtbank';
  if (!rnee && hasValue(row.rechtbank))                                           return 'rechtbank';
  if (!rnee && hasValue(row.docs_verstuurd))                                      return 'advocaat';
  if (!rnee && hasValue(row.belafspraak))                                         return 'getekend';
  if (hasValue(row.akkoord_klanten))                                              return rnee ? 'afronding' : 'getekend';
  if (hasValue(row.concepten_akkoord))                                            return 'getekend';
  if (hasValue(row.reactie_ontvangen))                                            return 'concepten';
  if (hasValue(row.naar_klanten))                                                 return 'concepten';
  if (!rnee && (hasValue(row.antwoord) || hasValue(row.ter_controle)))            return 'controle';
  if (hasValue(row.afspraak))                                                     return 'concepten';
  if (hasValue(row.eerste_concept))                                               return rnee ? 'concepten' : 'controle';
  return 'fase1';
}

function getColumn(row) {
  if (hasValue(row.zoza_afgerond) && computeHypFee(row) !== null) return 'afgerond';
  return getInitialColumn(row);
  // Manual drag-and-drop override disabled — re-enable the lines below to restore it:
  // if (isRechtbankNee(row)) return getInitialColumn(row);
  // return row.kanban_column || getInitialColumn(row);
}

// ── ALARM CHECKS ──
function isActieVoorOverdue(row) {
  const v = row.actie_voor;
  if (!v || v === 'n.v.t.') return false;
  return new Date(v) < new Date();
}

function isBevestigdOverdue(row) {
  const days = parseInt(alarmSettings.reactie_docs_teurlings) || 14;
  function personOverdue(suffix) {
    if (row['bevestigd' + suffix]) return false;
    const a = row['aangevraagd' + suffix];
    if (!a || a === 'n.v.t.') return false;
    const d = new Date(a);
    d.setDate(d.getDate() + days);
    return d < new Date();
  }
  if (row.toevoeging_a === 1 && personOverdue('_a')) return true;
  if (row.toevoeging_b === 1 && personOverdue('_b')) return true;
  return false;
}

function isTerControleOverdue(row) {
  if (row.ter_controle) return false;
  return !!(row.eerste_concept && row.eerste_concept !== 'n.v.t.');
}

function isVergoedingAangevraagdOverdue(row) {
  if (row.vergoeding_aangevraagd) return false;
  const col = getColumn(row);
  return col === 'gemeente' || col === 'afronding';
}

function isVergoedingOntvangenOverdue(row) {
  if (row.vergoeding_ontvangen) return false;
  const aangevraagd = row.vergoeding_aangevraagd;
  if (!aangevraagd || aangevraagd === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_vergoeding_rvr) || 0;
  if (!days) return false;
  const deadline = new Date(aangevraagd);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isReactieOverdue(row) {
  if (row.reactie_ontvangen) return false;
  const afspraak = row.afspraak;
  if (!afspraak || afspraak === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_klanten_concepten) || 0;
  if (!days) return false;
  const deadline = new Date(afspraak);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isConceptenAkkoordOverdue(row) {
  if (row.concepten_akkoord) return false;
  const reactie = row.reactie_ontvangen;
  if (!reactie || reactie === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_klanten_concepten) || 0;
  if (!days) return false;
  const deadline = new Date(reactie);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isAntwoordOverdue(row) {
  if (row.antwoord) return false;
  const terControle = row.ter_controle;
  if (!terControle || terControle === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_teurlings_concepten) || 0;
  if (!days) return false;
  const deadline = new Date(terControle);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isNaarKlantenOverdue(row) {
  if (row.naar_klanten) return false;
  return !!(row.antwoord && row.antwoord !== 'n.v.t.');
}

function isAkkoordKlantenOverdue(row) {
  if (row.akkoord_klanten) return false;
  return !!row.concepten_akkoord;
}

function isDocsVerstuurdOverdue(row) {
  if (row.docs_verstuurd) return false;
  return !!(row.akkoord_klanten && row.akkoord_klanten !== 'n.v.t.');
}

function isBelafspraakOverdue(row) {
  if (row.belafspraak) return false;
  return !!(row.docs_verstuurd && row.docs_verstuurd !== 'n.v.t.');
}

function isRechtbankOverdue(row) {
  if (row.rechtbank) return false;
  const belafspraak = row.belafspraak;
  if (!belafspraak || belafspraak === 'n.v.t.') return false;
  return new Date(belafspraak) < new Date();
}

function isBeschikkingOverdue(row) {
  if (row.beschikking) return false;
  const rechtbank = row.rechtbank;
  if (!rechtbank || rechtbank === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_beschikking) || 0;
  if (!days) return false;
  const deadline = new Date(rechtbank);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isVerstuurKlantenOverdue(row) {
  if (row.verstuurd_klanten) return false;
  return !!(row.beschikking && row.beschikking !== 'n.v.t.');
}

function isAkkoordKlanterOverdue(row) {
  if (row.akkoord_klanter) return false;
  const verstuurd = row.verstuurd_klanten;
  if (!verstuurd || verstuurd === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_akkoord_beschikking) || 0;
  if (!days) return false;
  const deadline = new Date(verstuurd);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isVerstuurGemeenteOverdue(row) {
  if (row.verstuurd_gemeente) return false;
  return !!(row.akkoord_klanter && row.akkoord_klanter !== 'n.v.t.');
}

function isInschrijvingOverdue(row) {
  if (row.inschrijving_ontvangen) return false;
  const verstuurd = row.verstuurd_gemeente;
  if (!verstuurd || verstuurd === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.reactie_inschrijving_gemeente) || 0;
  if (!days) return false;
  const deadline = new Date(verstuurd);
  deadline.setDate(deadline.getDate() + days);
  return deadline < new Date();
}

function isBeeindigdOverdue(row) {
  if (row.beeindigd) return false;
  if (row.inschrijving_ontvangen && row.inschrijving_ontvangen !== 'n.v.t.') return true;
  return isRechtbankNee(row) && !!(row.akkoord_klanten && row.akkoord_klanten !== 'n.v.t.');
}

function isZozaOverdue(row) {
  if (row.zoza_afgerond) return false;
  return !!(row.beeindigd && row.beeindigd !== 'n.v.t.' && row.vergoeding_ontvangen);
}

function isHypFeeOverdue(row) {
  return !computeHypFee(row) && hasValue(row.beeindigd);
}

function isGeneralOverdue(row, key, prevKey) {
  if (row[key]) return false;
  return !!row[prevKey];
}

function isAfspraakOverdue(row) {
  if (row.afspraak) return false;
  if (row.naar_klanten && row.naar_klanten !== 'n.v.t.') return true;
  if (row.naar_klanten === 'n.v.t.') return !!row.eerste_concept;
  return false;
}

function isPensioenverklaringOverdue(row) {
  try {
    const data = JSON.parse(row.info_data || '{}');
    if (data._nvt) return false;
    const p = data.pensioenverklaring || { b: 1, a: 0 };
    if (p.b !== 1 || p.a === 1) return false;
    const days = parseInt(alarmSettings.pensioenverklaring_termijn) || 0;
    if (!days) return false;
    const b = row.beschikking;
    if (!b || b === 'n.v.t.') return false;
    const d = new Date(b); d.setDate(d.getDate() + days); return d < new Date();
  } catch(e) { return false; }
}
function isRechtbankAllNvt(row) {
  try {
    const data = JSON.parse(row.info_data || '{}');
    if (data._nvt) return true;
    return ['huwelijksakte','kindverklaringen','geboorteaktes','pensioenverklaring'].every(k => { const d = data[k]; return d && d.b === 0 && d.a === 0; });
  } catch(e) { return false; }
}
function isDocsUrgent(row) {
  if (row.docs_compleet === 'ja' || isRechtbankAllNvt(row)) return false;
  return !!(row.akkoord_klanten && row.akkoord_klanten !== 'n.v.t.') || isPensioenverklaringOverdue(row);
}

function isInfoUrgent(row) {
  if (isInfoComplete(row.info_data)) return false;
  const datum = row.datum_afspraak; if (!datum || datum === 'n.v.t.') return false;
  const days = parseInt(alarmSettings.info_voor_afspraak) || 0; if (!days) return false;
  const deadline = new Date(datum); deadline.setDate(deadline.getDate() - days); return deadline < new Date();
}

function countAlarms(row) {
  let count = 0;
  if (row.gemaild === 'nee')                count++;
  if (isActieVoorOverdue(row))              count++;
  if (isBevestigdOverdue(row))              count++;
  if (isTerControleOverdue(row))            count++;
  if (isVergoedingAangevraagdOverdue(row))  count++;
  if (isVergoedingOntvangenOverdue(row))    count++;
  if (isReactieOverdue(row))                count++;
  if (isConceptenAkkoordOverdue(row))       count++;
  if (isAntwoordOverdue(row))               count++;
  if (isNaarKlantenOverdue(row))            count++;
  if (isAkkoordKlantenOverdue(row))         count++;


  if (isAfspraakOverdue(row))                                count++;
  if (isDocsVerstuurdOverdue(row))          count++;
  if (isBelafspraakOverdue(row))            count++;
  if (isRechtbankOverdue(row))              count++;
  if (isBeschikkingOverdue(row))            count++;
  if (isVerstuurKlantenOverdue(row))        count++;
  if (isAkkoordKlanterOverdue(row))         count++;
  if (isVerstuurGemeenteOverdue(row))       count++;
  if (isInschrijvingOverdue(row))           count++;
  if (isBeeindigdOverdue(row))              count++;
  if (isZozaOverdue(row))                   count++;
  if (isHypFeeOverdue(row))                 count++;
  if (isDocsUrgent(row))                    count++;
  return count;
}

const FIELD_ALARM_CHECKS = {
  gemaild:                r => r.gemaild === 'nee',
  bevestigd:              r => isBevestigdOverdue(r),
  actie_voor:             r => isActieVoorOverdue(r),
  reactie_ontvangen:      r => isReactieOverdue(r),
  concepten_akkoord:      r => isConceptenAkkoordOverdue(r),
  ter_controle:           r => isTerControleOverdue(r),
  antwoord:               r => isAntwoordOverdue(r),
  naar_klanten:           r => isNaarKlantenOverdue(r),
  akkoord_klanten:        r => isAkkoordKlantenOverdue(r),
  docs_verstuurd:         r => isDocsVerstuurdOverdue(r),
  belafspraak:            r => isBelafspraakOverdue(r),
  rechtbank:              r => isRechtbankOverdue(r),
  beschikking:            r => isBeschikkingOverdue(r),
  verstuurd_klanten:      r => isVerstuurKlantenOverdue(r),
  akkoord_klanter:        r => isAkkoordKlanterOverdue(r),
  verstuurd_gemeente:     r => isVerstuurGemeenteOverdue(r),
  inschrijving_ontvangen: r => isInschrijvingOverdue(r),
  beeindigd:              r => isBeeindigdOverdue(r),
  vergoeding_aangevraagd: r => isVergoedingAangevraagdOverdue(r),
  vergoeding_ontvangen:   r => isVergoedingOntvangenOverdue(r),
  zoza_afgerond:          r => isZozaOverdue(r),


  afspraak:               r => isAfspraakOverdue(r),
};

// ── SORT ──
let globalSort = 'alarm';

function sortColRows(colRows, colId) {
  const sort = globalSort;
  const firstDateKey = (COLUMN_FIELDS[colId]?.fields || []).find(f => f?.type === 'date')?.key;
  return [...colRows].sort((a, b) => {
    if (sort === 'naam') return (a.klant || '').localeCompare(b.klant || '', 'nl');
    if (sort === 'datum' && firstDateKey) {
      const ta = a[firstDateKey] && a[firstDateKey] !== 'n.v.t.' ? new Date(a[firstDateKey]).getTime() : Infinity;
      const tb = b[firstDateKey] && b[firstDateKey] !== 'n.v.t.' ? new Date(b[firstDateKey]).getTime() : Infinity;
      return ta - tb;
    }
    if (sort === 'gewijzigd') {
      const ta = lastChangedAtMap[a.id] ? new Date(lastChangedAtMap[a.id]).getTime() : 0;
      const tb = lastChangedAtMap[b.id] ? new Date(lastChangedAtMap[b.id]).getTime() : 0;
      return tb - ta; // most recently changed first
    }
    if (a.flagged !== b.flagged) return (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0);
    const ac = countAlarms(a), bc = countAlarms(b);
    if (ac !== bc) return bc - ac;
    return (a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0);
  });
}

// ── RENDER BOARD ──
function renderBoard() {
  if (viewMode === 'alles') { renderBoardAlles(); return; }
  const board = document.getElementById('kanbanBoard');
  board.classList.remove('board-alles');
  board.innerHTML = '';

  COLUMNS.forEach(col => {
    const colRows = sortColRows(rows.filter(r => getColumn(r) === col.id), col.id);

    const colEl = document.createElement('div');
    colEl.className = 'kanban-col' + (col.id === 'fase1' ? ' kanban-col-wide' : '');

    const header = document.createElement('div');
    header.className = 'kanban-col-header';
    header.style.background = col.color;

    const title = document.createElement('h2');
    title.textContent = col.label;

    const countBadge = document.createElement('span');
    countBadge.className = 'kanban-col-count';
    countBadge.textContent = colRows.length;

    header.appendChild(title);
    header.appendChild(countBadge);
    colEl.appendChild(header);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'kanban-cards';
    cardsWrap.dataset.colId = col.id;

    cardsWrap.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cardsWrap.classList.add('drag-over');
    });
    cardsWrap.addEventListener('dragleave', e => {
      if (!cardsWrap.contains(e.relatedTarget)) cardsWrap.classList.remove('drag-over');
    });
    cardsWrap.addEventListener('drop', async e => {
      e.preventDefault();
      cardsWrap.classList.remove('drag-over');
      // Manual phase move disabled — remove the block comment below to re-enable:
      /*
      if (!dragRowId) return;
      const row = rows.find(r => r.id === dragRowId);
      if (!row || getColumn(row) === col.id) return;
      const oldCol = getColumn(row);
      row.kanban_column = col.id;
      logChange(row.id, row.klant, 'Fase', COLUMN_LABELS[oldCol] || oldCol, COLUMN_LABELS[col.id] || col.id, 'Verplaatst');
      renderBoard();
      await db.from('dossiers').update({ kanban_column: col.id }).eq('id', row.id);
      */
    });

    if (colRows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kanban-empty';
      empty.textContent = 'Geen dossiers';
      cardsWrap.appendChild(empty);
    } else {
      colRows.forEach(row => cardsWrap.appendChild(renderCard(row, col)));
    }

    colEl.appendChild(cardsWrap);
    board.appendChild(colEl);
  });
  // Re-apply active filters so sort changes don't lose filter state
  const q = document.getElementById('searchInput')?.value || '';
  filterCards(q, true); // skipScroll — don't reset scroll position on re-render
  requestAnimationFrame(() => {
    syncKanbanScroll();
    equalizeCardHeights();
  });
}

// ── RENDER BOARD — ALLE FASEN (two-panel) ──
function renderBoardAlles() {
  if (!activeFase) activeFase = COLUMNS[0].id;
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = '';
  board.classList.add('board-alles');

  const layout = document.createElement('div');
  layout.className = 'fase-layout';

  // ── Sidebar: clickable phase list ──
  const sidebar = document.createElement('div');
  sidebar.className = 'fase-sidebar';

  COLUMNS.forEach(col => {
    const colCount = rows.filter(r => getColumn(r) === col.id).length;
    const item = document.createElement('div');
    item.className = 'fase-sidebar-item' + (col.id === activeFase ? ' active' : '');
    item.dataset.faseId = col.id;
    item.style.setProperty('--fase-clr', col.color);
    item.onclick = () => setActiveFase(col.id);

    const label = document.createElement('span');
    label.className = 'fase-sidebar-label';
    label.textContent = col.label;

    const count = document.createElement('span');
    count.className = 'kanban-col-count fase-sidebar-count';
    count.textContent = colCount;

    item.appendChild(label);
    item.appendChild(count);
    sidebar.appendChild(item);
  });

  // ── Content: header + cards of active phase ──
  const content = document.createElement('div');
  content.className = 'fase-content';

  const activeCol = COLUMNS.find(c => c.id === activeFase) || COLUMNS[0];
  const colRows = sortColRows(rows.filter(r => getColumn(r) === activeCol.id), activeCol.id);

  const header = document.createElement('div');
  header.className = 'kanban-col-header fase-content-header';
  header.style.background = activeCol.color;
  const title = document.createElement('h2');
  title.textContent = activeCol.label;
  const countBadge = document.createElement('span');
  countBadge.className = 'kanban-col-count';
  countBadge.id = 'faseBadge';
  countBadge.textContent = colRows.length;
  header.appendChild(title);
  header.appendChild(countBadge);
  content.appendChild(header);

  const cardsWrap = document.createElement('div');
  cardsWrap.className = 'kanban-cards fase-content-cards';
  cardsWrap.dataset.colId = activeCol.id;

  if (colRows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'kanban-empty';
    empty.textContent = 'Geen dossiers';
    cardsWrap.appendChild(empty);
  } else {
    colRows.forEach(row => cardsWrap.appendChild(renderCard(row, activeCol)));
  }
  content.appendChild(cardsWrap);

  layout.appendChild(sidebar);
  layout.appendChild(content);
  board.appendChild(layout);

  const q = document.getElementById('searchInput')?.value || '';
  filterCards(q, true);
  requestAnimationFrame(() => { syncKanbanScroll(); equalizeCardHeights(); });
}

function setActiveFase(id) {
  activeFase = id;
  renderBoardAlles();
}

function getPhaseMatchCount(colId, q) {
  return rows.filter(r => {
    if (getColumn(r) !== colId) return false;
    const matchSearch = !q || (r.klant || '').toLowerCase().includes(q);
    const matchFilter = currentFilter !== 'alarm' || countAlarms(r) > 0;
    const matchEditor = !currentEditorFilter || lastEditorMap[r.id] === currentEditorFilter;
    return matchSearch && matchFilter && matchEditor;
  }).length;
}

function equalizeCardHeights() {
  document.querySelectorAll('.kanban-cards').forEach(col => {
    const cards = [...col.querySelectorAll('.card')];
    if (cards.length < 2) return;
    cards.forEach(c => c.style.minHeight = ''); // reset to measure natural height
    const max = Math.max(...cards.map(c => c.offsetHeight));
    cards.forEach(c => c.style.minHeight = max + 'px');
  });
}

function syncKanbanScroll() {
  const board = document.getElementById('kanbanBoard');
  const track = document.getElementById('kanbanScrollTrack');
  const slider = document.getElementById('kanbanScroller');
  if (!board || !track || !slider) return;
  const max = board.scrollWidth - board.clientWidth;
  track.style.display = max > 10 ? 'block' : 'none';
  slider.max = max;
  slider.value = board.scrollLeft;
}

// ── RENDER CARD ──
function renderCard(row, col) {
  const alarmCount = countAlarms(row);
  const card = document.createElement('div');
  card.className = 'card' + (row.zoza_afgerond && row.zoza_afgerond !== 'n.v.t.' ? ' card-done' : '');
  card.dataset.cardId = row.id;
  card.dataset.klant = (row.klant || '').toLowerCase();
  card.dataset.hasAlarm = alarmCount > 0 ? '1' : '0';
  card.dataset.lastEditor   = lastEditorMap[row.id]    || '';
  card.dataset.lastChangedAt = lastChangedAtMap[row.id] || '';
  card.draggable = true;

  card.addEventListener('dragstart', e => {
    dragRowId = row.id;
    setTimeout(() => card.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    dragRowId = null;
  });

  // Colored top border — flush at very top of card
  const topBorder = document.createElement('div');
  topBorder.className = 'card-top-border';
  topBorder.style.background = col.color;
  card.appendChild(topBorder);

  // Tinted name area
  const topArea = document.createElement('div');
  topArea.className = 'card-top-area';
  topArea.style.background = col.color + '18';
  card.appendChild(topArea);

  const body = document.createElement('div');
  body.className = 'card-body';

  // ── Header: name + alarm badge + flag button ──
  const headerRow = document.createElement('div');
  headerRow.className = 'card-header';

  const name = document.createElement('div');
  name.className = 'card-name';
  const klant = row.klant || '(Naamloos)';
  const dashIdx = klant.indexOf(' - ');
  if (dashIdx !== -1) {
    name.textContent = klant.slice(0, dashIdx);
    const second = document.createElement('span');
    second.className = 'card-name-second';
    second.textContent = klant.slice(dashIdx + 3);
    name.appendChild(second);
  } else {
    name.textContent = klant;
  }

  const badges = document.createElement('div');
  badges.className = 'card-badges';

  // Flag triangle — always visible; gray = inactive, red = flagged
  const badge = document.createElement('span');
  badge.className = 'alarm-badge';
  badge.style.cursor = 'pointer';
  function renderBadge(flagged) {
    badge.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="pointer-events:none"><path d="M9 2L16.5 15.5H1.5L9 2Z" fill="${flagged ? 'currentColor' : 'none'}" fill-opacity="${flagged ? '0.15' : '0'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><rect x="8.25" y="6" width="1.5" height="5" rx="0.75" fill="currentColor"/><circle cx="9" cy="13" r="0.85" fill="currentColor"/></svg>`;
    badge.classList.toggle('flagged', flagged);
    badge.title = flagged ? 'Markering verwijderen' : 'Markeren';
  }
  renderBadge(row.flagged);
  badge.addEventListener('click', e => { e.stopPropagation(); toggleFlag(row, renderBadge); });
  badges.appendChild(badge);

  headerRow.appendChild(name);
  headerRow.appendChild(badges);
  topArea.appendChild(headerRow);

  // ── Column-specific field rows ──
  const colDef = COLUMN_FIELDS[col.id] || { fields: [], hasOpm: false };
  const padded = colDef.fields.slice();

  const fieldsWrap = document.createElement('div');
  fieldsWrap.className = 'card-fields';

  padded.forEach(field => {
    const fieldRow = document.createElement('div');
    fieldRow.className = 'card-field-row';

    if (!field) {
      fieldRow.style.visibility = 'hidden';
      fieldRow.appendChild(document.createElement('span'));
      fieldsWrap.appendChild(fieldRow);
      return;
    }

    if (field.type === 'computed') {
      const val = field.compute(row);
      if (field.alarmCheck && field.alarmCheck(row)) fieldRow.classList.add('alarm');
      const lbl = document.createElement('span');
      lbl.className = 'card-field-label';
      lbl.textContent = field.label;
      const valEl = document.createElement('span');
      valEl.className = 'card-field-val' + (!val ? ' empty' : '');
      valEl.textContent = formatDate(val);
      fieldRow.appendChild(lbl);
      fieldRow.appendChild(valEl);

    } else if (field.type === 'date') {
      const val = row[field.key];
      if (FIELD_ALARM_CHECKS[field.key] && FIELD_ALARM_CHECKS[field.key](row)) fieldRow.classList.add('alarm');

      const lbl = document.createElement('span');
      lbl.className = 'card-field-label';
      lbl.textContent = field.label;

      const valEl = document.createElement('span');
      valEl.className = 'card-field-val' + (!val ? ' empty' : '');
      valEl.textContent = formatDate(val);

      fieldRow.appendChild(lbl);
      fieldRow.appendChild(valEl);

    } else if (field.type === 'yn') {
      const val = row[field.key];
      if (FIELD_ALARM_CHECKS[field.key] && FIELD_ALARM_CHECKS[field.key](row)) fieldRow.classList.add('alarm');

      const lbl = document.createElement('span');
      lbl.className = 'card-field-label';
      lbl.textContent = field.label;

      const valEl = document.createElement('span');
      valEl.className = 'card-field-val' + (val === 'ja' ? ' ja' : val === 'nee' ? ' nee' : ' empty');
      valEl.textContent = val || '—';

      fieldRow.appendChild(lbl);
      fieldRow.appendChild(valEl);

    } else if (field.type === 'info_btn') {
      fieldRow.className = 'card-field-row card-field-btn-row';
      const complete = isInfoComplete(row.info_data);
      const btn = document.createElement('a');
      btn.className = 'card-status-btn' + (complete ? ' complete' : '');
      btn.textContent = complete ? '✓ Info' : 'Info';
      btn.href = `info.html?id=${row.id}`;
      btn.addEventListener('click', e => e.stopPropagation());
      fieldRow.appendChild(btn);

    } else if (field.type === 'docs_btn') {
      fieldRow.className = 'card-field-row card-field-btn-row';
      if (isRechtbankAllNvt(row)) {
        fieldRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;font-size:0.78rem;';
        const lbl = document.createElement('span');
        lbl.className = 'card-field-label';
        lbl.textContent = 'Aktes';
        const val = document.createElement('span');
        val.style.cssText = 'color:var(--grey);font-style:italic;font-size:0.78rem;font-weight:600;';
        val.textContent = 'n.v.t.';
        fieldRow.appendChild(lbl);
        fieldRow.appendChild(val);
      } else {
        const complete = row.docs_compleet === 'ja';
        const urgent = !complete && isDocsUrgent(row);
        const link = document.createElement('a');
        link.className = 'card-status-btn' + (complete ? ' complete' : urgent ? ' urgent' : '');
        link.style.cssText = 'flex:1;min-width:0;text-align:center;';
        link.textContent = complete ? '✓ Aktes' : 'Aktes';
        link.href = `info.html?id=${row.id}`;
        link.addEventListener('click', e => e.stopPropagation());
        fieldRow.appendChild(link);
      }

    } else if (field.type === 'toevoeging_info_btn') {
      fieldRow.className = 'card-field-row card-field-btn-row';

      const infoComplete = isInfoComplete(row.info_data);
      const infoUrgent  = isInfoUrgent(row);
      const infoBtn = document.createElement('a');
      infoBtn.className = 'card-status-btn card-status-btn-sm' + (infoComplete ? ' complete' : infoUrgent ? ' urgent' : '');
      infoBtn.textContent = infoComplete ? '✓ Info' : 'Info';
      infoBtn.href = `info.html?id=${row.id}`;
      infoBtn.addEventListener('click', e => e.stopPropagation());
      fieldRow.appendChild(infoBtn);

      const nvt   = (row.toevoeging_a ?? 0) === 0 && (row.toevoeging_b ?? 0) === 0;
      if (!nvt) {
        const alarm = isBevestigdOverdue(row);
        const done  = (row.toevoeging_a !== 1 || hasValue(row.bevestigd_a)) &&
                      (row.toevoeging_b !== 1 || hasValue(row.bevestigd_b));
        const toevBtn = document.createElement('a');
        toevBtn.className = 'card-status-btn' + (done ? ' complete' : alarm ? ' urgent' : '');
        toevBtn.textContent = done ? '✓ Toevoegingen' : 'Toevoegingen';
        toevBtn.href = `toevoegingen.html?id=${row.id}`;
        toevBtn.addEventListener('click', e => e.stopPropagation());
        fieldRow.appendChild(toevBtn);
      }
    }

    fieldsWrap.appendChild(fieldRow);
  });

  body.appendChild(fieldsWrap);

  // ── Screen convenant knop (alleen in Concepten-kolom) ──
  if (col.id === 'concepten') {
    const screenBtn = document.createElement('a');
    screenBtn.className = 'screen-conv-btn';
    screenBtn.href = `${DOCUMENTSCREENING_URL}?naam=${encodeURIComponent(row.klant || '')}`;
    screenBtn.target = '_blank';
    screenBtn.rel    = 'noopener noreferrer';
    screenBtn.textContent = '📄 Screen document →';
    screenBtn.addEventListener('click', e => e.stopPropagation());
    body.appendChild(screenBtn);
  }

  // ── Opmerkingen (always rendered; invisible for columns without it) ──
  const opmText = row.opmerkingen && row.opmerkingen.trim();
  const opm = document.createElement('div');
  opm.className = 'card-opm'
    + (!colDef.hasOpm ? ' card-opm-hidden' : '')
    + (!opmText ? ' card-opm-empty' : '');
  opm.textContent = opmText || '';
  body.appendChild(opm);

  card.appendChild(body);

  topArea.addEventListener('click', () => {
    if (row.id) window.location.href = `info.html?id=${row.id}&tab=klantgegevens`;
  });
  body.addEventListener('click', () => {
    if (row.id) window.location.href = `info.html?id=${row.id}&tab=klantstatus`;
  });

  if (opmText && colDef.hasOpm) {
    let hoverTimer = null;
    card.addEventListener('mouseenter', () => {
      hoverTimer = setTimeout(() => card.classList.add('expanded'), 500);
    });
    card.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      card.classList.remove('expanded');
    });
  }

  return card;
}

// ── SEARCH / ALARM FILTER ──
function setSort(val) {
  globalSort = val;
  renderBoard();
}

function setFilter(type, btn) {
  if (currentFilter === type) { currentFilter = 'all'; btn.classList.remove('active'); }
  else { currentFilter = type; document.querySelectorAll('.filter-tag:not(#viewModeBtn)').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  // Keep editor filter intact — reflect combined state
  updateEditorSelectStyle();
  filterCards(document.getElementById('searchInput').value);
}

function toggleViewMode(btn) {
  viewMode = viewMode === 'fase' ? 'alles' : 'fase';
  btn.textContent = viewMode === 'alles' ? 'alle fasen' : 'per fase';
  btn.classList.toggle('active', viewMode === 'alles');
  if (viewMode === 'alles' && !activeFase) activeFase = COLUMNS[0].id;
  renderBoard();
}

function setEditorFilter(email) {
  currentEditorFilter = email || null;
  updateEditorSelectStyle();
  filterCards(document.getElementById('searchInput').value);
}

function updateEditorSelectStyle() {
  const sel = document.getElementById('editorFilterSelect');
  if (!sel) return;
  sel.classList.toggle('filter-tag-active', !!currentEditorFilter);
}

async function loadLastEditors() {
  const { data } = await db
    .from('changelog')
    .select('dossier_id, user_email, created_at')
    .not('user_email', 'is', null)
    .neq('user_email', '')
    .order('created_at', { ascending: false })
    .limit(2000);

  lastEditorMap    = {};
  lastChangedAtMap = {};
  const seen = new Set();
  (data || []).forEach(row => {
    if (!seen.has(row.dossier_id) && row.dossier_id && row.user_email) {
      lastEditorMap[row.dossier_id]    = row.user_email;
      lastChangedAtMap[row.dossier_id] = row.created_at;
      seen.add(row.dossier_id);
    }
  });

  // Populate dropdown with unique editors
  const allEditors = [...new Set(Object.values(lastEditorMap))].sort();
  const sel = document.getElementById('editorFilterSelect');
  if (sel) {
    const current = sel.value; // preserve selection
    sel.innerHTML = '<option value="">Laast gewijzigd: allen</option>';
    allEditors.forEach(email => {
      const opt = document.createElement('option');
      opt.value = email;
      opt.textContent = email.split('@')[0];
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  // Update data attributes on already-rendered cards
  document.querySelectorAll('.card[data-card-id]').forEach(card => {
    const id = card.dataset.cardId;
    card.dataset.lastEditor    = lastEditorMap[id]    || '';
    card.dataset.lastChangedAt = lastChangedAtMap[id] || '';
  });

  // Re-apply current sort/filter in case 'gewijzigd' is active
  if (globalSort === 'gewijzigd') renderBoard();
  if (currentEditorFilter) filterCards(document.getElementById('searchInput')?.value || '');
}

function filterCards(query, skipScroll) {
  sessionStorage.setItem('kanbanSearch', query || '');
  const q = (query || '').trim().toLowerCase();
  COLUMNS.forEach(col => {
    const cardsWrap = document.querySelector(`[data-col-id="${col.id}"]`);
    if (!cardsWrap) return;

    const cards = cardsWrap.querySelectorAll('.card');
    let visible = 0;
    cards.forEach(card => {
      const matchSearch = !q || (card.dataset.klant || '').includes(q);
      const matchFilter = currentFilter !== 'alarm' || card.dataset.hasAlarm === '1';
      const matchEditor = !currentEditorFilter || card.dataset.lastEditor === currentEditorFilter;
      const match = matchSearch && matchFilter && matchEditor;
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    let emptyEl = cardsWrap.querySelector('.kanban-empty');
    if (visible === 0 && cards.length > 0) {
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'kanban-empty';
        cardsWrap.appendChild(emptyEl);
      }
      emptyEl.textContent = q ? 'Geen resultaten' : 'Geen dossiers';
      emptyEl.style.display = '';
    } else if (emptyEl) {
      emptyEl.style.display = visible === 0 ? '' : 'none';
    }

    const hdr = cardsWrap.previousElementSibling;
    if (hdr) {
      const badge = hdr.querySelector('.kanban-col-count');
      if (badge) badge.textContent = visible;
    }
  });

  // Highlight sidebar phases with matches when in alles mode
  if (viewMode === 'alles') {
    const searching = q.length > 0 || currentFilter !== 'all' || !!currentEditorFilter;
    document.querySelectorAll('.fase-sidebar-item').forEach(item => {
      const colId = item.dataset.faseId;
      if (!colId) return;
      const matchCount = getPhaseMatchCount(colId, q);
      const countEl = item.querySelector('.fase-sidebar-count');
      if (countEl) countEl.textContent = searching ? matchCount : rows.filter(r => getColumn(r) === colId).length;
      item.classList.toggle('has-results', searching && matchCount > 0);
      item.classList.toggle('no-results', searching && matchCount === 0);
    });
  }

  if (!skipScroll) { if (q) scrollToSearchResults(); else scrollBoardTo(0); }
}

function scrollToSearchResults() {
  requestAnimationFrame(() => {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    const colEls = [...board.querySelectorAll('.kanban-col')];
    const visibleCols = colEls.filter(col =>
      [...col.querySelectorAll('.card')].some(c => c.style.display !== 'none')
    );
    if (visibleCols.length === 0) return;

    const boardRect    = board.getBoundingClientRect();
    const scrollLeft   = board.scrollLeft;
    const clientWidth  = board.clientWidth;
    const pad          = 28; // matches kanban-wrapper side padding

    const leftRect  = visibleCols[0].getBoundingClientRect();
    const rightRect = visibleCols[visibleCols.length - 1].getBoundingClientRect();

    // Positions in scroll-space
    const leftEdge  = leftRect.left  - boardRect.left + scrollLeft;
    const rightEdge = rightRect.right - boardRect.left + scrollLeft;

    // Ideal: align rightmost result to right edge (with padding)
    const desiredScroll = rightEdge + pad - clientWidth;

    // Clamp: leftmost result must stay on-screen (with padding)
    const maxScroll = leftEdge - pad;

    const finalScroll = Math.max(0, Math.min(desiredScroll, maxScroll));
    scrollBoardTo(finalScroll);
  });
}

function scrollBoardTo(target) {
  const board  = document.getElementById('kanbanBoard');
  const slider = document.getElementById('kanbanScroller');
  if (!board) return;
  board.scrollTo({ left: target, behavior: 'smooth' });
  // Keep the range slider in sync after the animation finishes
  setTimeout(syncKanbanScroll, 350);
}

// ── FLAG ──
async function toggleFlag(row, updateBadge) {
  row.flagged = !row.flagged;
  updateBadge(row.flagged);
  const { error } = await db.from('dossiers').update({ flagged: row.flagged }).eq('id', row.id);
  if (error) {
    row.flagged = !row.flagged;
    updateBadge(row.flagged);
    showToast('Opslaan mislukt');
  }
}

// ── DATA ──
async function loadRows() {
  const { data, error } = await db.from('dossiers').select('*').order('created_at', { ascending: true });
  if (error) { showToast('Fout bij laden: ' + error.message); return; }
  rows = data || [];
  renderBoard();
}

function subscribeToChanges() {
  db.channel('dossiers-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dossiers' }, payload => {
      if (payload.eventType === 'INSERT') {
        if (!rows.find(r => r.id === payload.new.id)) {
          rows.push(payload.new);
          renderBoard();
        }
      } else if (payload.eventType === 'UPDATE') {
        const idx = rows.findIndex(r => r.id === payload.new.id);
        if (idx !== -1) { rows[idx] = payload.new; renderBoard(); }
      } else if (payload.eventType === 'DELETE') {
        const idx = rows.findIndex(r => r.id === payload.old.id);
        if (idx !== -1) { rows.splice(idx, 1); renderBoard(); }
      }
    })
    .subscribe();
}

async function addRow() {
  document.getElementById('loadingOverlay').style.display = 'flex';
  const { data, error } = await db.from('dossiers').insert({ klant: '' }).select().single();
  if (error || !data) {
    document.getElementById('loadingOverlay').style.display = 'none';
    showToast('Aanmaken mislukt');
    return;
  }
  logChange(data.id, '', 'Dossier', '', 'Nieuw dossier aangemaakt', 'Aangemaakt');
  window.location.href = `info.html?id=${data.id}`;
}

// ── AUTH ──
async function signIn() {
  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const btn      = document.getElementById('loginBtn');
  if (!email || !password) { showLoginMsg('Vul e-mailadres en wachtwoord in.', true); return; }
  btn.disabled = true; btn.textContent = 'Inloggen...';
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = 'Inloggen';
  if (error) showLoginMsg('Onjuiste gegevens.', true);
  else await enterApp(data.user);
}

function showLoginMsg(text, isError) {
  const msg = document.getElementById('loginMsg');
  msg.textContent = text;
  msg.className = 'login-msg' + (isError ? ' error' : '');
}

async function signOut() {
  await db.auth.signOut();
  location.reload();
}

function showLogin() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

async function enterApp(user) {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('userEmail').textContent = user.email;
  window._clUser = user.email;

  alarmSettings = JSON.parse(localStorage.getItem('alarmsettings') || '{}');
  try {
    const { data: alarmData } = await db.from('alarmsettings').select('settings').eq('id', 'main').maybeSingle();
    if (alarmData && alarmData.settings) {
      alarmSettings = alarmData.settings;
      localStorage.setItem('alarmsettings', JSON.stringify(alarmData.settings));
    }
    const loadTimeout = new Promise(resolve => setTimeout(resolve, 8000));
    await Promise.race([loadRows(), loadTimeout]);
    loadLastEditors(); // enrich cards with last-editor data (fire and forget)
    subscribeToChanges();
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    initKanbanScroll();
    const savedSearch = sessionStorage.getItem('sharedSearch');
    if (savedSearch) {
      const searchEl = document.getElementById('searchInput');
      searchEl.value = savedSearch;
      document.getElementById('searchClear').style.display = 'flex';
      filterCards(savedSearch);
    }
  }
}

function initKanbanScroll() {
  const board  = document.getElementById('kanbanBoard');
  const slider = document.getElementById('kanbanScroller');
  if (!board || !slider) return;
  slider.addEventListener('input', () => { board.scrollLeft = parseInt(slider.value); });
  board.addEventListener('scroll', () => { slider.value = board.scrollLeft; });
  window.addEventListener('resize', syncKanbanScroll);
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── PASSWORD RESET ──
function showPasswordReset() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('resetScreen').style.display = 'flex';
}

async function submitPasswordReset() {
  const p1  = document.getElementById('newPasswordInput').value;
  const p2  = document.getElementById('confirmPasswordInput').value;
  const msg = document.getElementById('resetMsg');
  msg.style.color = '';
  if (!p1 || p1.length < 6) { msg.textContent = 'Wachtwoord moet minimaal 6 tekens zijn.'; return; }
  if (p1 !== p2)             { msg.textContent = 'Wachtwoorden komen niet overeen.'; return; }
  msg.textContent = '';
  const { error } = await db.auth.updateUser({ password: p1 });
  if (error) { msg.textContent = 'Fout: ' + error.message; return; }
  msg.style.color = 'green';
  msg.textContent = 'Wachtwoord gewijzigd! Je wordt ingelogd…';
  setTimeout(async () => {
    const { data: { session } } = await db.auth.getSession();
    if (session) await enterApp(session.user);
  }, 1500);
}

// ── INIT ──
async function init() {
  // Capture recovery flag immediately — Supabase SDK clears the hash before async code runs
  const isRecovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';

  // Register listener FIRST so PASSWORD_RECOVERY isn't missed while getSession() is awaited
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showPasswordReset();
    } else if (event === 'SIGNED_IN' && session
        && document.getElementById('appScreen').style.display  === 'none'
        && document.getElementById('resetScreen').style.display === 'none') {
      await enterApp(session.user);
    }
  });

  if (isRecovery) { showPasswordReset(); return; }

  const timeout = new Promise((_, reject) => setTimeout(() => reject(), 5000));
  try {
    const { data: { session } } = await Promise.race([db.auth.getSession(), timeout]);
    if (session) {
      await enterApp(session.user);
    } else {
      showLogin();
    }
  } catch (e) {
    showLogin();
  }
}

document.getElementById('emailInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('passwordInput').focus(); });
document.getElementById('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });

window.addEventListener('pageshow', e => {
  if (e.persisted && document.getElementById('loadingOverlay').style.display !== 'none') {
    window.location.reload();
  }
});

init();
