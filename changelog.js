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
};

async function logChange(dossierId, dossierName, fieldLabel, oldValue, newValue, action) {
  action = action || 'Bewerkt';
  const ov = oldValue == null ? '' : String(oldValue);
  const nv = newValue == null ? '' : String(newValue);
  if (ov === nv) return; // no actual change — skip
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
