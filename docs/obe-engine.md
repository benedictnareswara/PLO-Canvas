# OBE calculation engine

All formulas live in [`src/lib/obe/engine.ts`](../src/lib/obe/engine.ts). They are pure functions covered by unit tests in [`tests/engine.test.ts`](../tests/engine.test.ts).

| # | Quantity | Formula |
|---|---|---|
| 1 | Assessment score | `ScorePct_a = Score / MaxPoints × 100` |
| 2 | Course PLO attainment | `e_a,k = share_a × PLOweight_a,k`, then `PLO_c,k = Σ_a (e_a,k × ScorePct_a) / Σ_a e_a,k` (graded assessments only) |
| 3 | Cumulative PLO (SKS-weighted) | `Σ_c (PLO_c,k × SKS_c) / Σ_c SKS_c`. Only courses that produced a value for PLO k count in the denominator |
| 4 | Cohort aggregate | `mean_i( Cumulative PLO_i,k )`, over students who have evidence for k |
| 5 | At-risk | `PLO_k < threshold` (default 70%). Course level uses the class threshold set by the lecturer; cumulative and cohort level use the curriculum target |

**Weight convention (matches the signed proposal, §1.3).** Each assessment has a *share of the course grade* (`gradeWeight`) and a *PLO split* that must total 100% (e.g. `60% PLO 4 / 40% PLO 7`; the API and the dialog both refuse anything else). The effective weight is `share × PLO weight`, and the engine averages over the **graded** assessments mapped to each PLO, so in-progress courses aren't penalized. If a course has no shares at all, every assessment counts with share 1. The **Assessments** tab shows the resulting effective weight matrix, with each column summing to 100%. Worked example (COMP1401, Andi): PLO 1 = 72.5%, PLO 6 = 75.0%, as in the proposal.

**Semester progression.** A student's semester for an offering is `(academicYear − cohortYear) × 2 + (odd ? 1 : 2)`. The radar filters (*Cumulative*, *Year 1–4*, *Semester n*) re-run formula 3 on the matching subset.

**Materialization.** `recomputeOffering()` ([`src/lib/obe/recompute.ts`](../src/lib/obe/recompute.ts)) rewrites the `courseattainments` rows (PLO_c,k per student) after any change to grades, assessments, rosters, courses or users. Dashboards then aggregate from those rows.
