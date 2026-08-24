# Runbook — Updating the tank / well list (without losing audit data)

When the field asset config changes (tanks merged, split, added, retired, or
re-producted), follow this **additive, non-destructive** process. The golden
rule: **never delete or repoint a `tanks` / `wells` row that could have audit
history — only add new rows and flip `active`.**

## The 3 source files to provide

All three are ChampionX "assetsConfig" exports. Provide whichever have changed;
the injection-point file (#2) is the most important because it carries the
tank→well relationships.

| # | File (name pattern) | Key sheet → columns | Gives us |
|---|---|---|---|
| 1 | `assetsConfig_Mandatory_Template_*.xlsm` | `Template` → `Tank Name`, `Name Input`, `Location`, `Product`, `Status` | Tank master: attributes + active/inactive status |
| 2 | `assetsConfig_Mandatory_*.xlsx` | `Template` → `Tank Name`, **`Served Asset`**, `Injection Point Status` | **Tank ↔ well map** (which wells each tank serves) + status |
| 3 | `assetsConfig_Mandatory_Template_*_1.xlsm` | `Template` → `Name`, `API/UWI Number`, `Status`, `Location` | Well master (validates new well names / IDs) |

## Data model reminders (why the process works)

- A **tank** row = tank **+ product**, so each physical skid appears once per
  product. Label format: `NAME - PRODUCT` (e.g. `PAGE 5H & 6H - AFMR00283A`).
- **Match key** between a spreadsheet row and a live tank = the full `Tank Name`
  (= live `tanks.label`), scoped to the account.
- **Wells are per-tank rows** — the same well name is duplicated under each
  product-tank. So wells for a new tank are always inserted fresh.
- Audit data lives in `visits` (→ `tank_id`) and `well_checks` (→ `well_id`).
  These are **never** touched by this process.
- The app hides tanks with `active = false` from the picker but keeps them
  loaded, so their history stays viewable (via the "Show archived" checkbox).

## Procedure

1. **Back up first.** Export all `visits` + `well_checks` (+ `tanks`/`wells`/
   `accounts` for ID resolution) to a dated folder, e.g.
   `Downloads/0V118_Audit_Data_PreFix`, with checksums. Never skip this.
2. **Diff** the new files against the live DB (read-only, via the Supabase REST
   API + publishable key — the claude.ai Supabase MCP has no access to this
   project). Bucket into: added / removed / attribute-changed, and **flag any
   removed/retired tank that has visits** (history to preserve).
3. **Build an additive migration** (transaction + idempotent, like
   `migration_01_merge_tanks.sql`):
   - `alter table tanks add column if not exists active boolean default true` (already exists after the first run).
   - INSERT new tanks (per product) `where not exists`.
   - INSERT their wells (`asset_type = 'Well'`, or `'Generic'` for pads) `where not exists`.
   - `update tanks set active = false` for retired tanks — **by id**, never delete.
   - End with verification SELECTs (new tanks have wells; retired tanks show
     `active=false` **with visit counts intact**) before `commit`.
   - **Watch for label collisions:** a "new" tank whose label already exists is
     skipped by the insert — do NOT also put it in the deactivate list, or you'll
     hide a go-forward tank (this bit us once with `FOUR BUCKS NORTH 8H & 11H`).
   - Cast text→uuid where comparing `account_id` (`v.account_id::uuid`).
4. **Run the SQL** in the Supabase SQL Editor (admin role bypasses RLS; the app's
   publishable key cannot write). Review the verification output, then commit.
   Keep a matching ROLLBACK script that only deletes the **truly-new** tanks.
5. **Re-verify** read-only against the live DB: active/hidden counts reconcile,
   visit count unchanged, audited tanks preserved.
6. **App:** usually **no change needed** — the `active` filter already ships.
   Only touch the app for new questions/behavior, via branch → PR.
7. **Deploy note:** GitHub Pages does **not** auto-build on merge for this repo.
   If the app changed, trigger it manually:
   `gh api -X POST repos/CHX-0V134/Custom-Field-Audit/pages/builds`.
   Users pick up catalog changes on their next **online** reload (offline-cache-first).
