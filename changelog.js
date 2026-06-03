// ── CHANGELOG SHARED UTILITY ──
// Included by all pages. Requires: db (Supabase client) defined by host page.
// Each page sets window._clUser = user.email after login.

const FIELD_LABELS = {
  // Klantstatus fields
  gemaild:                'Klant gemaild',
  factuur_betaald:        'Factuur betaald',
  datum_afspraak:         'Datum afspraak',
  actie_voor:             'Actie voor',
  eerste_concept:         '1e concept',
  ter_controle:           'Ter controle',
  antwoord:               'Antwoord',
  naar_klanten:           'Verwerkt',
  afspraak:               'Concepten verstuurd',
  reactie_ontvangen:      'Reactie ontvangen',
  concepten_akkoord:      'Concepten akkoord',
  akkoord_klanten:        'Klanten getekend',
  docs_compleet:          'Aktes compleet',
  docs_verstuurd:         'Verstuurd Advocaat',
  belafspraak:            'Belafspraak',
  rechtbank:              'Rechtbank (datum)',
  beschikking:            'Beschikking',
  verstuurd_klanten:      'Verstuurd klanten',
  akkoord_klanter:        'Akkoord klanten',
  verstuurd_gemeente:     'Verstuurd gemeente',
  inschrijving_ontvangen: 'Inschrijving ontvangen',
  beeindigd:              'Ingelicht en beeindigd',
  vergoeding_aangevraagd: 'Vergoeding aangevraagd',
  vergoeding_ontvangen:   'Vergoeding ontvangen',
  zoza_afgerond:          'ZOZA afgerond',
  opmerkingen:            'Opmerkingen',
  // Dossier meta
  klant:                  'Klantnaam',
  kanban_column:          'Fase',
  // Toevoeging fields
  toevoeging_a:           'Toevoeging persoon A',
  toevoeging_b:           'Toevoeging persoon B',
  bevestigd_a:            'Bevestigd toevoeging A',
  bevestigd_b:            'Bevestigd toevoeging B',
  aangevraagd_a:          'Aangevraagd toevoeging A',
  aangevraagd_b:          'Aangevraagd toevoeging B',
  hypotheek_a:            'Hypotheek lead persoon A',
  hypotheek_b:            'Hypotheek lead persoon B',
  hyp_factuur_betaald_a:  'Hyp.fee ontvangen A',
  hyp_factuur_betaald_b:  'Hyp.fee ontvangen B',
};

const COLUMN_LABELS = {
  fase1:     'Klanten 1e fase',
  controle:  'Controle Advocaat',
  concepten: 'Klanten concepten',
  getekend:  'Getekend',
  advocaat:  'Advocaat',
  rechtbank: 'Rechtbank',
  gemeente:  'Gemeente',
  afronding: 'Afronding',
  afgerond:  'Afgerond',
};

// ── HYPOTHEEK FEE COMPUTED VALUE ──
// Returns the single "Hyp.fee ontvangen" value derived from both lead persons.
function computeHypFee(row) {
  const hasA = row.hypotheek_a === 1;
  const hasB = row.hypotheek_b === 1;
  if (!hasA && !hasB) return 'n.v.t.';
  if (hasA && !hasB) return row.hyp_factuur_betaald_a || null;
  if (!hasA && hasB) return row.hyp_factuur_betaald_b || null;
  // Both have a lead
  const vA = row.hyp_factuur_betaald_a, vB = row.hyp_factuur_betaald_b;
  if (vA === 'n.v.t.' && vB === 'n.v.t.') return 'n.v.t.';
  // Ignore n.v.t. entries; if any remaining candidate has no date → no date
  const candidates = [vA, vB].filter(v => v !== 'n.v.t.');
  return candidates.every(v => v) ? candidates.slice().sort().reverse()[0] : null;
}

async function logChange(dossierId, dossierName, fieldLabel, oldValue, newValue, action) {
  action = action || 'Bewerkt';
  const ov = oldValue == null ? '' : String(oldValue);
  const nv = newValue == null ? '' : String(newValue);
  if (action === 'Bewerkt' && ov === nv) return; // no actual change — skip edits only
  try {
    await db.from('changelog').insert({
      dossier_id:   dossierId   || null,
      dossier_name: dossierName || '',
      field_label:  fieldLabel  || '',
      old_value:    ov,
      new_value:    nv,
      user_email:   window._clUser || '',
      action,
    });
  } catch (e) { /* silently ignore — never break normal app flow */ }
}
