# Changes for the signed proposal (12 Nov 2026)

The collections and fields in the proposal's database design (§5.3, Figure 32) are unchanged. Only
range checks were added to the models.

## From the proposal

| Change | Proposal | Files |
|---|---|---|
| Engine uses **effective weight = share of course grade × PLO weight**. Andi's COMP1401 example now gives PLO 1 = 72.5%, PLO 6 = 75.0% (before: 74.3% / 73.2%). Tested in `tests/engine.test.ts`. | §1.3 steps 2–3, O2 | `src/lib/obe/engine.ts`, `AssessmentsTab.tsx` |
| An assessment's **PLO weights must total 100%** in the API, the assessment dialog and the import. | FR-08, UC-05 5a, UC-07 3a | `validators.ts`, `AssessmentDialog.tsx` |
| **Faculty head reviews and edits PLO weights** of any class in their department. Only the weights can change; title, max points and share stay with the lecturer. Each edit is recorded in the class history and attainment is recalculated. | FR-26, UC-08 | `rbac.ts` (`"mapping"` access), `assessments/[aid]/route.ts`, offering page, `AssessmentsTab.tsx`, `AssessmentDialog.tsx` |
| **Student accounts need a NIM, entry year and curriculum**; an advisor must be a lecturer. | UC-01 steps 2 and 5 | `validators.ts`, `resources.ts`, `AdminViews.tsx` |
| **A new class takes the curriculum's default target** when none is given; only lecturers can be assigned. | UC-02 step 4 | `resources.ts`, `AdminViews.tsx` |
| **Deactivated curricula aren't offered for new classes.** | UC-03 7a | `resources.ts` |
| **PLO numbers are 1–10.** | §5.3, Figure 19 | `ranges.ts`, `validators.ts`, model |
| Assessments can only map to PLOs of the class's curriculum (manual create/edit, as the import already did). | UC-05 | `src/lib/obe/plo-scope.ts`, assessment routes |
| Seed data scaled to 100% per assessment. **Re-run `npm run seed`** and re-check the README's at-risk cases. | FR-08 | `scripts/seed.ts` |
| The dialog and matrix text explain the two weights (share vs PLO weight). | tester's "most confusing thing" | `messages/*.json` |

## No negative numbers, with ranges enforced

One table of limits, `src/lib/ranges.ts`, is used by the forms, the zod validators and the Mongoose models:

| Value | Range |
|---|---|
| PLO weight, share of grade, target / threshold | 0–100 % |
| Max points | above 0, up to 100,000 |
| Score | 0 to 150% of max points (above max shows a warning) |
| Curriculum year, class academic year, entry year | 1990–2100, whole numbers |
| SKS / total SKS | 0–24 / 0–400, whole numbers |
| Semester | 1–14, whole numbers |
| PLO number | 1–10, whole numbers |

- `NumberInput` drops a minus sign as it is typed or pasted. With `max`, it brings larger values down to the max (percent fields).
- The gradebook cell editor also drops minus signs. A pasted negative is still marked invalid and can't be saved.
- Admin forms show "must be from X to Y" errors.
- Negative cells in a Canvas file are skipped and reported as a warning.

## Bugs from the test log

| # | Bug | Status |
|---|---|---|
| 1 | Missing work isn't counted as zero | **Fixed, without changing the rule.** Only graded work counts (§1.3 step 3), so in-progress courses still aren't penalized. A new **Gradebook → Count blanks as 0** action fills an assessment's blanks with 0 as unsaved edits; saving logs each one. On phones it's a button under the assessment picker. |
| 2 | EX keeps an old grade | **Fixed.** The parser keeps EX apart from blanks. The dry run counts EX cells whose student already has a grade, and the lecturer can tick *Remove these grades*; each removal is logged as `grade.clear`. Default behaviour is unchanged, so NFR-03 holds. |
| 3 | Scores above max are accepted | **Fixed.** The import now refuses scores above 150% of max, as the grid and API already did. The grid, phone grader and dry run warn about scores above 100% of max. The engine already caps a score at 100%, so attainment can't exceed 100%. Max points must be above 0. |
| 4 | Re-import can undo the head's fixes | **Fixed.** The wizard pre-fills stored weights. The dry run lists existing assessments whose PLO weights, share or max points would change, and the import logs those changes. |
| 5 | Manual columns get duplicated | **Fixed.** A hand-made column with the same title is adopted, and the wizard marks it "updates existing". |
| 6 | Stale results after curriculum edits | **Fixed.** Course edits already recalculated; PLO edits now recalculate every class that uses the PLO. |
| 8 | Deleting a class deletes its history | Not a bug: audit events are kept when a class is deleted. |
| 9 | Assessments can map to PLOs the course doesn't support | **Flagged.** The Assessments tab marks such PLOs and lists the course's PLOs for the head's review (UC-08). |
| 12 | Matching by email | Already falls back to SIS User ID (NIM). |
| 13 | Blank advisor removes advisors in bulk | Works as UC-04 3a specifies, and removal is an explicit "— Remove advisor —" choice in the dialog. |
| 7, 10 | Curriculum changes aren't logged; SKS ignores PLO coverage | **Not changed.** Logging needs a new audit scope (a database change), and coverage weighting would change the agreed formula. Raise with Dr. Panji. |
| 11 | Import needs a replica set | The Docker setup starts one; a standalone server falls back and the result screen says so. |

## Tests

- `tests/engine.test.ts` adds the proposal's worked example: 72.5 / 75.0 / 70.6 / 68.5.
- `tests/validators.test.ts` is new: ranges, 100% weights, UC-01 student fields and the optional class target.
- `tests/ranges-and-blanks.test.ts` is new: negatives, clamping and "count blanks as 0".
- `tests/canvas-parse.test.ts` adds EX tracking and the negative-score warning.

Run `npm run typecheck && npm run lint && npm test` before merging (NFR-08).
