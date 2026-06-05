# Power BI — Customer Insights report

A spec for building the customer-facing report in Power BI. All objects are
read-only views the `powerbi_readonly` role can already query.

## Tables to import (Get Data → PostgreSQL → Navigator)
| View | Grain | Use for |
|------|-------|---------|
| `report_visit_summary` | one row per visit | pass/fail/na tallies, trends |
| `report_action_items` | one row per current open fail | open issues list |
| `report_issue_status` | one row per ever-failed check | closure rate (open vs resolved) |
| `report_compliance_monthly` | one row per month | compliance trend |
| `report_tanks` | all tanks | coverage (denominator) |
| `report_wells` | all wells | coverage / well-level slicing |
| `report_answers` | one row per answered item | flexible question-level analysis |
| `report_wide` | one row per well per visit | denormalized detail/export |

Model tip: mark `report_tanks` as a dimension and relate it to the others on
`tank` (or `tank_id`) for cross-filtering. The summary/answers tables can also be
used standalone.

## Measures (DAX)
```DAX
Passes        = SUM(report_visit_summary[passes])
Fails         = SUM(report_visit_summary[fails])
Pass Rate     = DIVIDE([Passes], [Passes] + [Fails])

Open Issues     = COUNTROWS(report_action_items)
Issues Found    = COUNTROWS(report_issue_status)
Issues Resolved = CALCULATE(COUNTROWS(report_issue_status), report_issue_status[status] = "resolved")
Closure Rate    = DIVIDE([Issues Resolved], [Issues Found])

Tanks Total   = DISTINCTCOUNT(report_tanks[tank_id])
Tanks Audited = DISTINCTCOUNT(report_visit_summary[tank])
Coverage %    = DIVIDE([Tanks Audited], [Tanks Total])
Visits        = DISTINCTCOUNT(report_visit_summary[visit_id])
```

## Suggested page layout (one customer page)
- **KPI cards (top row):** `Pass Rate`, `Coverage %`, `Open Issues`, `Closure Rate`.
- **Compliance over time:** line/column chart — axis `report_compliance_monthly[month]`, value `pass_rate`.
- **Open issues by category:** bar chart — axis `report_action_items[item]` or a section
  column, value `Open Issues`. (Add a `section` from `report_answers` if you want the
  category grouping; or slice `item`.)
- **Hotspots by area / product:** two bar charts — axis `report_action_items[area]` /
  `[product]`, value `Open Issues`.
- **Most common failed checks:** bar chart — `report_answers` filtered `is_fail = true`,
  axis `question`, value count.
- **Slicers:** `state`, `area`, `product`, and a date range on `audited_at`.

## Notes
- These views match the in-app **Insights** tab numbers (same definitions).
- "Below target injection rate" needs the `ActiveTargetRate` column loaded (it was
  skipped on import) — ask and it can be added, enabling a target-vs-actual visual.
- Refresh in Power BI after any new audits to update.
