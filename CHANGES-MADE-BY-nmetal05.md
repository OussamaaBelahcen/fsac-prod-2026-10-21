# Changes made by nmetal05

Accountability log for work done on this repo starting from `version_19` (`10aa7c4`).
Author: nmetal05 (Nizar Sahl — <nmetal05@gmail.com>)
Maintainer of original code: Oussama Belahcen

Ordered by the time changes were made (all 2026-10-15). Dev-only items are marked
and intentionally NOT committed.

## 1. Remotes / repos (morning)

- `origin` (Oussama personal repo): no access from this account, kept for reference.
- `cme` → `projet-fsac-cme/fsac-new-start` (created): push blocked, needs a
  Maintainer to push the initial commit (Developer cannot push to a protected empty repo).
- `mine` → `nmetal05/fsac-new-start` (created): working remote, this work is pushed here.

## 2. Dev environment boot

- Started Docker Desktop, `docker compose up --build`.
- `.env` (gitignored, NOT committed): `MYSQL_HOST=localhost→db`, `PORT=5001→5000`
  (matches `docker-compose.yml:30`).
- Discovered the running `fsac_web`/`fsac_mysql` pair belonged to other code
  (`Documents\FSAC\projet-fsac-cmepro`, image from May); stopped/removed those
  containers (volumes kept) and started ours from this folder.

## 3. Fix: entrypoint bcrypt API (committed as `26e036f`)

- `entrypoint.sh`: `bcrypt.generate_password_hash(...)` (Flask-Bcrypt API) crashed the
  container in a restart loop because the image installs py-`bcrypt`.
  Replaced with `bcrypt.hashpw(...).decode('utf-8')`, same as `seed_superadmin.py:19`.
- Without this fix `docker compose up` never served the app.

## 4. Dev DB test accounts + teacher period (NOT committed, dev database only)

- Created (password `Test1234!`, dev only):
  `enseignant@fsac.ma` (ENSEIGNANT + profile row), `membrecommission@fsac.ma`
  (COMMISSION), `coordinateur@fsac.ma` (COORDINATEUR).
  Existing: `admin@fsac.com` / `admin123` (SUPERADMIN).
- Set test teacher period `2022-01-01 → 2026-12-31` (was NULL, which triggered the
  « Période d'avancement non définie » warning and emptied date constraints).

## 5. HTTP for dev (NOT committed, local machine only)

- Browser wouldn't offer password save over self-signed HTTPS, so:
  `app.py` gained a `DISABLE_SSL` toggle (defaults off, prod unaffected) and `.env`
  (gitignored) sets `DISABLE_SSL=true`.
- Standing rule: never commit the `app.py` SSL change. Revert before any prod deploy.

## 6. Hygiene: ignore local cahier de charge (committed as `e30041a`)

- `.gitignore`: added `cahier_de_charge.pdf` / `cahier-de-charge.pdf`.
- Standing rule: the cahier de charge is working material, never tracked.

## 7. Unlock Grade / PPR / Téléphone on teacher page (in `2d7e038`)

- `templates/enseignant.html`: removed frontend-only `readonly` / `pointer-events:none`
  locks on Grade, PPR, Téléphone.
- Why safe: `save_step1` (`routes.py:939-977`) already accepts and saves these fields;
  the lock was UX policy (admin-owned identity), not enforcement.
- Still locked on purpose: Nom, Prénom, Email, Établissement.

## 8. Cahier v1.0 item 1: AE1-2 « Type de polycopié » (in `2d7e038`)

- New required dropdown in the AE1-2 modal: Cours Magistral (CM) / TD / TP.
- `static/js/enseignant/modals.js`: live schema (`BASE_FIELDS['ae1-2']`), legacy modal
  HTML, legacy schema copy, `ae1-2` validation.
- `static/js/enseignant/main.js`: table row render + save collector.
- `static/js/enseignant/step4.js`: save collector.
- `templates/enseignant.html`: table header column.
- `static/js/Script_Commission.js`: commission modal column (`ae1_2_types`).
- `templates/pdf/annexe_i.html`: Type column (7 cols total, within the ≤8-col split rule).
- `routes.py`: save (`ae1_2_types`) + step4 load map (`types`).
- `migrations/add_type_polycopie_to_ae1_2.sql`: for pre-existing DBs created before the
  column existed (fresh installs already have `ae1_2_types` via `shema.sql:207`).
- Verified: `py_compile` OK, `node --check` OK on all touched JS, live dev roundtrip OK.

## 9. Cahier v1.0 item AE 2-2: file label, Département d'attache, module title (in next commit)

- File input title → « Copie de la page de garde cachetée » (live requirements modal,
  legacy modal, teacher table header, commission).
- New required text « Département d'attache » (modal + validation + collect, table,
  save/load, commission, PDF; new `ae2_2_departements` col in `shema.sql` + migration
  + applied to live dev DB).
- « Cours » label → « l'intitulé du module » (modal, table, commission, PDF — DB key
  `ae2_2_intitules` unchanged).
- PDF AE2-2 table now 10 cols (AE2-1 precedent is also 10).
- Verified: `py_compile` OK, `node --check` OK, live dev roundtrip OK.

## 10. Cahier v1.0 item AE 3-5: file label → Présidence only (own commit)

- « Attestation du Décanat ou de la Présidence de l'Université » →
  « Attestation de la Présidence de l'Université » (live schema, legacy schema copy,
  teacher table header, commission). AE2-3 keeps the old wording (different zone).
- Label-only change, no DB impact. PDF keeps generic « Fichier ».

## 11. Cahier v1.0 item AE 3-3: Période label + file label (own commit)

- « Période de la responsabilité » → « Période » (live schema, legacy schema copy,
  legacy modal, teacher table header, commission, dossier view, PDF).
- File label → « Attestation du chef de département / responsable du master »
  (live schema, legacy schema copy, teacher table header, commission, dossier view).
- Shared generic AE3 builder + other zones untouched. Label-only, no DB impact.

## 12. Cahier v1.0 item AE 3-2: wire Période field (own commit)
- `ae3_2_periodes` existed in DB but was dropped everywhere; now wired end-to-end:
  live schema, legacy schema copy, legacy modal + validation, generic row
  renderer + collector (`main.js` both maps), save/load maps (`routes.py`),
  teacher table header, commission, dossier view, PDF (4 cols).
- Column already in `shema.sql`; no migration needed. Label-only + wiring, no new column.

## 13. Cahier v1.0 item AR 1-1: Année de publication + reference format (own commit)

- New `ar1_1_anneePublication` column (`shema.sql` + migration + applied to live dev
  DB), year dropdown (SINGLE_YEARS) in the live modal, save/load configs.
- « Référence: Auteur — Titre — Journal — DOI » implemented as input guidance in
  the reference label (NOT 4 separate fields — those were deliberately dropped by
  `cleanup_unused_columns.sql`).
- Commission + PDF (5 cols) show the year. Legacy stale modal untouched.
- Verified: `py_compile` OK, `node --check` OK, `login:200`.

## 15. Cahier v1.0 item AR 1-3: Maison d’éditions (own commit)

- New `ar1_3_maisonEditions` column (`shema.sql` + migration + applied to live dev
  DB), text field in the live modal (after Auteurs), save/load configs.
- Commission, dossier view, PDF (7 cols). Stale legacy modal (dead dropped-column
  fields) untouched.
- Verified: `py_compile` OK, `node --check` OK, `login:200`.

## 14. Cahier v1.0 item AR 1-2: reference label rename (own commit)
- « Références de la publication ou communication » → « Référence du proceeding ou
  titre de la communication » (live schema, legacy modal, commission, dossier view,
  PDF). Label-only, no DB impact.

## 22. Cahier v1.0 item AR 4-3: Nature free text (own commit, grade part = cahier error)

- New `ar4_3_nature_activite` text (`shema.sql` + migration + live dev DB), wired
  end-to-end (live modal, save/load, commission, dossier view, PDF 4 cols).
- « Coordinateur / Grade » radio conversion NOT done: no such field exists anywhere;
  confirmed with requester as cahier mistake.
- Verified: `py_compile` OK, `node --check` OK, Jinja parse OK, `login:200`.

## 21. Cahier v1.0 item AR 4-2: Nature dropdown (own commit)

- « Nature de l'activité » free text → dropdown (Expertise socio-culturelle /
  Contrat extra-universitaire / Responsable d'association scientifique ou
  culturelle / Responsable de club scientifique), live schema + legacy modal.
- DB column is free TEXT, no migration; old free-text rows display as-is.
- Verified: `node --check` OK, `login:200`.

## 20. Cahier v1.0 item AR 4-1: title rename, drop Portée, add Rôle (own commit)

- Titre label → « Titre de la manifestation ou animation » (live schema, commission;
  legacy modal already had its own titre field).
- Portée removed from modal/save/load/views (DB column KEPT to preserve existing
  data — no destructive migration).
- New `ar4_1_role` text (`shema.sql` + migration + live dev DB), wired end-to-end
  (modal, save/load, commission, dossier view, PDF 5 cols).
- Verified: `py_compile` OK, `node --check` OK, Jinja parse OK, `login:200`.

## 19. Fix: optional schema fields were still enforced (own commit)

- Root cause of the AR3-3 attestation report: the shared renderer hardcoded `*` +
  `required` on every input and `validateModal` validated every field, ignoring
  `required: false`.
- `fieldHtml` now honors the flag (marker + attribute); `validateModal` accepts
  empty optionals but still checks filled ones (size/PDF/length).
- AR3-3 contrat set `required: true` (stays required); attestation stays optional.
  Same fix benefits AR1-4 citation + AE2-1/AE2-2 file toggles.

## 18. Cahier v1.0 item AR 3-3: Période rename + optional attestation (own commit)

- « Durée du contrat » → « Période » (live schema, legacy modal, commission,
  dossier view, PDF). Label-only, DB key unchanged.
- Attestation du responsable already optional in the live schema path; removed the
  leftover enforcement in the legacy validator + the `*` marker (contrat stays
  required).

## 17. Cahier v1.0 item AR 2-1: direction dropdown options (own commit)

- Options Direction / Codirection → Direction avec codirection / Direction /
  Co-directeur (live schema + legacy copy). DB column is free TEXT, no migration.
  Old stored « Codirection » values display as-is.
- Verified: `node --check` OK.

## 16. Cahier v1.0 item AR 1-4: citation field + Année de publication (own commit)

- « Lien (URL) de la référence » → text field « Auteur — Titre — Journal — Année »
  (same DB column `ar1_4_publication_url`, now free text, optional as before).
  Old URL rows still render as links (PDF links only if `http`, commission now plain
  text instead of forced href).
- New `ar1_4_anneePublication` column (year dropdown, save/load, commission, PDF 6
  cols, migration + live dev DB).
- Verified: `py_compile` OK, `node --check` OK, Jinja parse OK, `login:200`.

## 23. 2026-10-20: merged teammate MR !1 by dahousan (merge commit `34de539`)

- MR !1 « Consultation et coordination : aperçu, avis et filtres de grade »
  (author: dahousan/Nourdine Dahou, Developer on nmetal05/fsac-new-start;
  branch `consultation-coordination`, 1 commit `9c5495c`, 17 files, +845/−192).
  Merged by nmetal05 after full review.
- Implements cahier items previously logged as skipped (see
  `SKIPPED-ITEMS-NEED-CLARIFICATION.md` for per-item notes):
  AE1-3 Support NTIC (new `ae1_3_support_ntic` TEXT, via `app.py` auto-migration +
  shema.sql), AE2-1 block (Type encadrante buttons, Cours/TD/TP select reusing
  `cours_td_tp`, new `ae2_1_intitule_module` TEXT via migration
  `add_intitule_module_to_ae2_1.sql`, cachetée rename), AE2-3 type dropdown →
  free text, workflow Réassigner/Statut on coordinateur page (dedicated column
  removed, row click, « Vu / Avis donné » vs « En cours », hover tooltip with
  assignee), AR4-3 « Coordinateur / Grade » reinterpretated as coordinator-page
  grade filter with horizontal MC/MCH/PES buttons (LIKE 'MC %' family match).
- Partial/extra scope (not in cahier, accepted):
  - Hover preview (field grid + PDF first page via vendored Mozilla pdf.js
    `static/vendor/pdfjs/`, Apache-licensed) is on rows of the Consulter page,
    not the Enseignant page — cahier item 4 stays PARTIAL, pending direction.
  - « Note générale /100 » entered by commission (uses existing `dossiers.note`
    column, validated 0–100 client + server), shown to teacher when evaluated.
  - AE/AR point badges removed from the teacher view.
  - Sidebar collapse toggle with localStorage persistence in base/header.
- Review checks: `app.py` touch limited to auto-migration (dev-only DISABLE_SSL
  toggle NOT committed), no `static/images` churn, `node --check` ×4 OK,
  `py_compile` routes+app OK, 6 templates Jinja-parse OK, table colspans
  consistent, save/load/commission/consulter/annexe plumbing complete both ways.
- Post-merge: source branch removed; local dev-only `app.py` toggle re-applied
  on top (stash/pop, uncommitted); docs updated (this file +
  `SKIPPED-ITEMS-NEED-CLARIFICATION.md`). Dev DB gains the two new columns
  automatically on next `docker compose up`.

## 24. Fix 2026-10-20/21: MySQL 1265 on evaluation — ENUM encoding (own commit)

- Symptom (found during live review, dossier 1): commission member submitting
  an evaluation always got « Erreur serveur » (HTTP 500) on
  `POST /api/evaluer-dossier/<id>`. Root cause found via temporary flushed
  traceback in the route's except (then reverted): `MySQLdb.DataError (1265,
  Data truncated for column 'statut')` on `UPDATE dossiers SET statut='évalué'`.
- Root cause: the dev DB was seeded through a latin1-default mysql client on a
  latin1-default MySQL 5.7 (`docker-entrypoint-initdb.d/init.sql`), so the UTF-8
  accents in ENUM definitions were stored double-encoded:
  `dossiers.statut = enum(...,'Ã©valuÃ©','validÃ©','rejetÃ©')` and
  `import_logs.statut = enum('succÃ¨s','partiel','Ã©chec')`. The app connection is
  utf8, sends proper `évalué`, which matches NO member → strict mode refuses the
  write. Latent since seeding; surfaced the first time an evaluation was actually
  submitted. Not caused by MR !1.
- Fix (own commit):
  - `shema.sql`: `SET NAMES utf8mb4;` right after the header (before
    `CREATE DATABASE`) so future seeds through the mysql-container entrypoint or
    any client decode accents correctly.
  - `migrations/fix_enum_encoding.sql`: repair for existing DBs — per affected
    column: enum→varchar, rows re-normalized via
    `CONVERT(CONVERT(CONVERT(col USING latin1) USING binary) USING utf8mb4)` with
    a `HEX(...) LIKE 'C383%'` predicate (encoding-proof), then enum restored with
    correct literals. MUST be run with `--default-character-set=utf8mb4`.
  - `deploy_guide.md`: new « Base de données : exécution des scripts SQL »
    section documenting the charset requirement + the repair migration.
- Dev DB repaired live (dossiers.statut and import_logs.statut now store proper
  accents; data rows were all ASCII so 0 rows needed re-encoding). End-to-end
  verification: fresh `SHOW CREATE TABLE` shows correct definitions; the
  failing `UPDATE dossiers SET statut='évalué'` now matches the enum.
- Prod zip note: `fsac-prod-2026-10-20.zip` was built BEFORE this fix — rebuild
  it from the commit containing item 24 before sending.

## 25. Cahier item (outils qualité): API Explorer — OpenAPI/Swagger sur la page admin (own commit)
- Demande: « so we can test all the apis and see if anythings not working correctly,
  keep this at admin page with ability to execute all of those things with proper
  documentation for each api ».
- Approche sans dépendance pip (même pattern que pdf.js vendored): Swagger UI 5.17.14
  vendored dans `static/vendor/swagger-ui/` (`swagger-ui.css`, `swagger-ui-bundle.js`,
  `oauth2-redirect.html`).
- `swagger_doc.py` (nouveau):
  - spec OpenAPI 3.0.3 générée À LA VOLÉE par introspection de `app.url_map`
    (52 paths / 54 opérations — toute nouvelle route apparaît automatiquement);
    `/static` et les 2 routes swagger elles-mêmes exclues du spec.
  - documentation française curatée par endpoint dans `DOCS` (résumé, description,
    rôle requis, exemples de corps JSON/form/multipart, paramètres d'URL) —
    construite à partir de l'inventaire `routes_scan.txt` (52 routes,
    args/rôles/fichiers/champs).
  - tags: Public / Enseignant / Commission / Coordinateur / Admin / Dossiers /
    Notifications.
- Routes (SUPERADMIN uniquement, session cookie `cookieAuth`):
  - `GET /api/openapi.json` — la spec.
  - `GET /api-explorer` — la page Swagger UI (essayer chaque endpoint « Try it out »;
    le cookie de session part automatiquement, un 403 sur un endpoint d'un autre
    rôle est attendu et documenté).
- `templates/swagger_ui.html` (nouveau): hôte Swagger UI (bloc extra_js,
  `withCredentials: true`, note d'usage française).
- `templates/superadmin.html`: nouvelle carte « API Explorer (Swagger / OpenAPI) »
  sous la rangée de statistiques.
- `routes.py`: hookup en bas de fichier
  `register_swagger(app, login_required, role_required)` (après toutes les routes).
- Vérifié: spec = JSON valide (52 paths), page explorer 200 avec SwaggerUIBundle,
  guest + rôle non-SUPERADMIN → 302 (protection). `py_compile` OK.
- Note dev: le mot de passe du compte SUPERADMIN de la DB dev avait dérivé du
  `.env` — resynchronisé sur `ADMIN_PASSWORD` (admin123), aucune modif code.
- Zip prod `fsac-prod-2026-10-21.zip` régénéré (inclut le feature, reste untracked).
