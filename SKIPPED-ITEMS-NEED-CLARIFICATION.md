# Skipped cahier items — need clarification

Cahier: *Cahier de modifications, Page Enseignant v1.0 — 13 octobre 2026*.
Items below were skipped because their meaning is ambiguous.
**UPDATE 2026-10-20:** items 1, 2, 3, 5, 6 were implemented by dahousan in MR !1
(« Consultation et coordination », branch `consultation-coordination`, merged into
`main` as `34de539` — see `CHANGES-MADE-BY-nmetal05.md` §23). Resolution notes are
kept under each item. Only item 4 remains (partially resolved).

## 1. (SKIPPED 2026-10-15 → RESOLVED 2026-10-20 via MR !1) Zone AE 1-3 — Champ « Support NTIC »

- Cahier: `[À ajouter] Champ « Support NTIC »`. No type, no options given.
- Current state: AE1-3 already has « Type de support » dropdown
  (Diaporama / Didacticiel / Nouveau TP / Page web ou homepage), wired end-to-end
  (`routes.py:1518`, `modals.js` BASE_FIELDS `ae1-3`).
- Dormant columns exist, never wired: `ae1_3_descriptions`, `ae1_3_contextes`,
  `ae1_3_cibles` (`shema.sql`, added in `1d423b7`). Unknown what they were meant for.
- Questions:
  - What is « Support NTIC » — free text or dropdown? If dropdown, which options?
  - How does it differ from the existing « Type de support »?
  - If new column: proposed name `ae1_3_support_ntic` (TEXT). Confirm.
- **Resolution (MR !1, dahousan):** new `ae1_3_support_ntic` TEXT column (the name
  proposed above), free text, added end-to-end: modal (both generations),
  teacher table, save/load, commission view, consulter view, annexe PDF. Column
  created by `app.py` auto-migration on first startup (no migrations/*.sql file).

## 2. (SKIPPED 2026-10-15 → RESOLVED 2026-10-20 via MR !1) Zone AE 2-1 — Encadrement pédagogique (whole block)
Cahier asks 4 things:

1. `[À ajouter] « Type encadrante » en tant que bouton (et non plus un simple label).`
   - Current: table cell renders `type_encadrement` as hidden input + text label
     (`main.js:419`: « Encadrement de PFE » / « Cours, TD et/ou TP »).
   - Unclear: what does the button DO? Toggle between the two types? Open a
     choice dialog? Just visual styling?
2. `Liste déroulante du type : Cours / TD / TP.`
   - Current `type` field means « Type de la Licence » (LF / LP / LE) — different values.
     So this looks like a NEW field. Unclear: new DB column? Proposed
     `ae2_1_nature` (VARCHAR). Confirm name + required or optional.
3. `[À ajouter] Champ texte « Intitulé du module ».`
   - Current has `modules` (« Module ou élément de module », select Module/Élément).
     The new field is the module NAME. Unclear: new DB column? Proposed
     `ae2_1_intitule_module` (TEXT). Confirm.
4. `Remplacer « Copie de la page de garde (titre de l'input) » par
   « Copie de la page de garde cachetée ».`
   - Straightforward rename; blocked only because the whole block was skipped.
   - Note: enhanced `schemaFor` ae2-2 file label already says « cachetée »; check which
     exact input title the cahier refers to before renaming.
- **Resolution (MR !1, dahousan):** all 4 done.
  1. « Type encadrante » = two toggle buttons (Cours/TD/TP vs PFE) driving the
     conditional sub-fields, replacing the radio inputs in the ae2-1 modal;
     displayed as « Type encadrante » everywhere.
  2. New select field « Cours / TD / TP » reusing the existing `cours_td_tp`
     column (values now constrained to Cours, TD, TP).
  3. New field « Intitulé du module » wired to the proposed `ae2_1_intitule_module`
     TEXT column end-to-end (migration `add_intitule_module_to_ae2_1.sql` +
     `app.py` auto-migration + shema.sql; live dev DB gets it on next startup).
  4. Rename to « Copie de la page de garde cachetée » (modal + tables + annexe +
     commission).

## 3. (SKIPPED 2026-10-15 → RESOLVED 2026-10-20 via MR !1) Zone AE 2-3 — Type de la formation / Type d'activité

- Cahier: replace « Type de la formation dispensée (liste) » with free text, AND in
  « Type d'activité » add option « Autre » + free text. The two bullets conflict.
- Current state: « Type de formation dispensée » dropdown
  (Séminaire / Formation / Sortie de terrain / Autre) — `modals.js` BASE_FIELDS
  `ae2-3`, stable copy, validation. `Autre` option already exists but selects
  nothing (no conditional free-text). No field literally named « Type d'activité »
  in AE2-3.
- Questions:
  - Keep dropdown + reveal free-text when Autre is chosen (recommended: clean data,
    satisfies both bullets), or pure free text (literal bullet 1)?
  - If conditional text: new DB column? Proposed `ae2_3_type_autre` (TEXT).
- **Resolution (MR !1, dahousan):** literal bullet 1 chosen — the dropdown is now
  pure free text (no Autre option, no new column). Reuses existing `types` column.

## 4. (SKIPPED 2026-10-15, PARTIAL 2026-10-20 via MR !1) Ensemble des tableaux — prévisualisation au survol
- Cahier: hover/tooltip content preview on ALL teacher-page tables.
- Current state: table inputs render full values (`width:100%`, no ellipsis —
  `Style_enseignant.css:369`), so there is little truncated content to preview;
  only `.file-link` uses ellipsis (`Style_enseignant.css:913`).
- **Partial implementation (MR !1, dahousan):** a rich hover preview exists (field
  grid + PDF first page rendered via vendored Mozilla pdf.js, plus image preview
  and file links) — but on rows of the page **Consultation du dossier**
  (`consulter_dossier.html`), NOT on the tableaux of the page Enseignant as the
  cahier literally says ("Sur tous les tableaux de la page Enseignant").
- REMAINING QUESTION: implement the same preview on the teacher-page tables too,
  or accept the consultation-page interpretation? Awaiting direction.

## 5. (SKIPPED 2026-10-15 → RESOLVED 2026-10-20 via MR !1) Workflow — Bouton « Réassigner » / Statut

- Cahier: remove the dedicated « Réassigner » column and make the whole row
  clickable (event trigger) to open the page the old button led to.
- « Statut » must show either « Vu / Avis donné » or « En cours ».
- On hover over « Réassigner », show to whom the task was assigned.
- Not yet scoped in code (commission/coordinateur views not investigated).
- Questions:
  - Which view(s): coordinateur dashboard, commission, both?
  - What does the current Réassigner button open today?
  - Where is assignment + Vu/Avis state stored (`assignations_commission` table)?
- **Resolution (MR !1, dahousan) — on the coordinateur page:**
  - The dedicated « Voir l'avis » column was removed (8 → 7 columns); the whole
    row is clickable and opens the corresponding « Consultation du dossier » page
    (buttons use `event.stopPropagation()` and keep working).
  - Statut column now shows « Vu / Avis donné » (statut évalué) or « En cours »
    (statut soumis).
  - Hovering the Réassigner button shows a tooltip « Assigné à {nom prénom} »
    (joined from `assignations_commission` via users table).

## 6. (SKIPPED 2026-10-15 → RESOLVED 2026-10-20 via MR !1) AR 4-3 — « Coordinateur / Grade » radios (cahier error)

- Cahier: show only MC, MCH, PES horizontally (radio buttons), remove the dropdown.
- No « Coordinateur / Grade » field exists anywhere in the codebase (teacher,
  commission, dossier views, DB) — confirmed with nmetal05 as a cahier mistake.
- The « Nature de l'activité » free-text part of the same AR 4-3 block WAS
  implemented (`ar4_3_nature_activite`). Only this radio sub-item is skipped.
- **Resolution (MR !1, dahousan — reinterpretation that fits the cahier text):**
  the « Coordinateur / Grade » refers to the department of coordination page
  filter, not a form field. The grades dropdown on the coordinateur page was
  replaced by three horizontal buttons MC / MCH / PES (server-side family filter
  `grade LIKE 'MC %'` / `'MCH %'` / `'PES %'`, matching grades stored as
  « MCH B », etc.). Dropdown removed.
