# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack & Deployment

Plain HTML/CSS/JS — no build step, no package manager, no bundler. Open any `.html` file directly in a browser (or via Vercel live preview) to run it. Deployed as a static site on **Vercel** (`vercel.json` sets security headers including CSP).

Backend is **Supabase JS v2** (loaded from CDN, pinned at `2.107.0`). Credentials live in `config.js` (loaded by every page before the Supabase SDK script tag).

## File Map

| File | Purpose |
|------|---------|
| `config.js` | Supabase URL + anon key — included first by every page |
| `style.css` | Global styles, design tokens, shared components |
| `changelog.js` | Shared `logChange()` utility — included by every page, requires `db` and `window._clUser` |
| `app.js` | Kanban board logic (loaded only by `index.html`) |
| `index.html` | Kanban board — main dossier view |
| `statusoverzicht.html` | List/table view of all dossiers |
| `info.html` | Dossier detail — two tabs: Klantgegevens and Klantstatus |
| `toevoegingen.html` | Legal aid (toevoegingen) per dossier |
| `rvr.html` | RvR tariff tables — eigen bijdragen (Hoog/Laag) + griffiekosten, per validity period |
| `mo_bedragen.html` | Mediator agreement amounts per validity period |
| `facturen.html` | Invoices — list + create/edit modal |
| `hypotheeklead.html` | Mortgage referral leads |
| `agenda.html` | Calendar / appointments |
| `changelog.html` | Audit log viewer |

## Central Data Model

The `dossiers` table is the core entity. Key columns:

- **`info_data`** — stored as **TEXT** (not jsonb). Contains a JSON object with nested keys:
  - `_klant` — client details: `naam_a`, `naam_b`, `relatie`, `kinderen`, `bedrijf` (`'Nee'`/`'ZZP'`/`'BV'`), `toevoeging_a/b`, `eigen_bijdrage_a/b`, etc.
  - `_dienstverlening` — service info: `type` (`'Scheiding'`/`'Herziening OP'`/etc.), `rechtbank` (`'Ja'`/`'Nee'`), etc.
  - `_nvt` — boolean flag that marks a dossier as not applicable for completeness checks
  - All other keys — document checklist items stored as `{ b: 0|1, a: 0|1 }` (benodigd/aanwezig)
- **`toevoeging_a/b`** — `1` = has legal aid, `0` = none
- **`bevestigd_a/b`** — date legal aid was confirmed
- **`eigen_bijdrage_a/b`** — `'Hoog'` or `'Laag'`
- **`kanban_column`** — current phase (`fase1`, `controle`, `concepten`, `getekend`, `advocaat`, `rechtbank`, `gemeente`, `afronding`, `afgerond`)

SQL queries on `info_data` must cast explicitly: `info_data::jsonb -> '_klant' ->> 'bedrijf'`

Period-keyed tables (`rvr`, `eigen_bijdragen`, `griffiekosten`, `mo_bedragen`) use `geldig_van` / `geldig_tot` (ISO date columns). Period keys in JS are the string `"geldig_van|geldig_tot"`.

## Auth Pattern

Every page runs this at startup:
```js
const { data: { session } } = await db.auth.getSession();
if (!session) { window.location.href = 'index.html'; return; }
window._clUser = session.user.email;   // required by changelog.js
```

## Critical CSS Gotchas

**`td input, td select { display: none; }`** — `style.css` hides all inputs and selects inside table cells (they are shown only inside `.editing-cell`). Any input rendered inside a `<td>` outside that pattern needs an explicit override, e.g.:
```css
.my-input { display: inline-block; min-height: unset; }
```

`sizeFlexColumns(indices)` in `toevoegingen.html` measures column widths and writes inline `width` styles to `<th>` elements — exclude any column that has a fixed CSS width from the indices array or it will be overridden.

## Number & Date Formatting

```js
// Currency display
new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

// Plain 2-decimal
new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

// Date display
new Date(v).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
```

Parse user-typed Dutch numbers: `parseFloat(str.replace(',', '.'))`.

## Changelog

Every user-initiated DB write should call:
```js
await logChange(dossierId, dossierName, fieldLabel, oldValue, newValue);
// or for creates/deletes:
await logChange(dossierId, dossierName, fieldLabel, oldValue, newValue, 'Aangemaakt');
```

`FIELD_LABELS` in `changelog.js` maps DB column names to Dutch display labels.

## Facturen Modal Architecture

`facturen.html` has a combined new/edit modal (`#nieuwModal`) with two tab views:

- **Details tab** (`#nw-view-main`) — dossier selector, MO period, Diensten table, Toevoegingen, invoice fields
- **Facturen tab** (`#nw-view-facturen`) — empty, for future content

Key state variables: `nwEditId` (null = new, id = editing), `nwMoRows`, `nwToevRows`, `nwAdvocaatBedrag`, `nwGriffekosten`, `nwEbHoog/Laag`.

`nwMoRows` excludes the "Advocaatkosten" row (stored separately as `nwAdvocaatBedrag`). Rows are ordered by `MO_ORDER` constant. When `dienst.rechtbank === 'Ja'`, checked rows in `RECHTBANK_ROWS` auto-fill `advocaat = nwAdvocaatBedrag` and `griffie = nwGriffekosten`.

Existing facturen are opened for editing by clicking any cell except the dossier name (`col-klant`) and the opmerkingen cell (`opm-td`). On save, an `UPDATE` is used if `nwEditId` is set, otherwise `INSERT`.

## Git

Never push automatically. Only push when the user explicitly asks.
