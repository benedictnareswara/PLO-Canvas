# Canvas CSV import

How to test importing a Canvas gradebook export, using the sample files in [`samples/`](../samples). Start from freshly seeded data (`npm run seed`).

A ready-made export is in **[`samples/canvas-gradebook-sample.csv`](../samples/canvas-gradebook-sample.csv)**:

```csv
Student,ID,SIS User ID,SIS Login ID,Section,Project Proposal (50101),Literature Review (50102),Progress Presentation (50103),Supervisor Logbook (50104),Current Score,Unposted Current Score,Final Score,Unposted Final Score
    Points Possible,,,,,20.00,100.00,50.00,10.00,(read only),(read only),(read only),(read only)
"Wijaya, Andi",48101,2023001,student1@sampoerna.ac.id,COMP4334 Final Year Project 1 - A,18.5,88,44,9,88.6,88.6,88.6,88.6
"Lestari, Bunga",48102,2023002,student2,COMP4334 Final Year Project 1 - A,15,71,36,7,72.4,72.4,72.4,72.4
"Pratama, Citra",48103,2023003,,COMP4334 Final Year Project 1 - A,12,58,EX,6,59.2,59.2,59.2,59.2
"Nugroho, Fajar",48199,2023099,fajar.nugroho@sampoerna.ac.id,COMP4334 Final Year Project 1 - A,16,75,40,8,77.3,77.3,77.3,77.3
"Student, Test",48000,,,COMP4334 Final Year Project 1 - A,0,0,0,0,0,0,0,0
```

The sample covers every matching path:
- student1 matches by full email.
- student2 matches by a bare login, which expands to `@sampoerna.ac.id`.
- student3 has no login, so it falls back to the **SIS User ID** (NIM), and has an **EX** (excused) cell.
- One student doesn't exist in the registry.
- The Canvas **Test Student** row and the computed score columns are skipped.

## Walkthrough
1. Sign in as `lecturer1@sampoerna.ac.id`. Open **My Classes → COMP4334 · Final Year Project 1 (2026/2027 Odd)** and click **Import Canvas CSV**.
2. **Upload** the sample file. The wizard reports 4 assignment columns and 4 student rows. The "Points Possible" row supplies max points.
3. **Map to PLOs**: tick the columns to import. For each one, use the PLO dropdown and enter weights that total 100%. For example:
   - Project Proposal → PLO 5 = 60, PLO 10 = 40
   - Literature Review → PLO 5 = 100
   - Progress Presentation → PLO 10 = 100
   - Supervisor Logbook → PLO 5 = 100

   COMP4334 supports PLO 5 and PLO 10 in curriculum Table 7, so the picker lists those first.

   You can also set each column's share of the course grade.
4. **Review** is a server-side dry run. It shows 3 matched and enrolled students and 1 unmatched row (skipped), plus which assessments will be created or updated. Matched students who aren't enrolled can optionally be enrolled here.
5. **Confirm**. Assessments are upserted by `(offering, Canvas ID)` and grades are bulk-upserted, all in **one MongoDB transaction**. The class's PLO attainment is then recalculated: 11 grades are written and 1 excused cell is skipped.
6. Check the **Class Radar** tab, then sign in as `student1` and look at the updated cumulative spider chart (Year 4 / Semester 7 filter).

## More test files
Both files match the seeded data. Their scores are made up.

| File | Sign in as → class | What it tests |
|---|---|---|
| [`samples/canvas-COMP4334-fyp1-class-of-2023.csv`](../samples/canvas-COMP4334-fyp1-class-of-2023.csv) | `lecturer1` → **COMP4334 (2026/2027 Odd)** | A full class: the 8 students of cohort 2023 and 5 assignments. Includes an EX cell, a blank (not graded yet), a `-`, a score above max (21/20, accepted as extra credit, flagged in the dry run), 1 unmatched student and the Canvas Test Student. |
| [`samples/canvas-COMP2424-reimport-edge-cases.csv`](../samples/canvas-COMP2424-reimport-edge-cases.csv) | `lecturer1` → **COMP2424 (2026/2027 Odd)**, cohort 2025 | **Re-import onto hand-made columns:** the four seeded assessments have the same titles, so they are updated, not duplicated, and the dry run lists any PLO-weight or share changes. Also covers: an **EX** cell where a grade already exists (offers *Remove these grades*); a **negative** cell (skipped, with a warning); a score **above max** (118/100); a `-` cell; a blank UAS column; a student from another cohort who isn't enrolled (offers *Enrol*); 1 unmatched row; and a new column ("Coding Challenge") to create. |

Importing the same file again **updates** the existing assessments instead of duplicating them; a column you created by hand with the same title is adopted rather than duplicated. Blank, `-` and `EX` cells never overwrite existing grades.

The dry run also lists:
- **Existing assessments whose PLO weights, share or max points the file would change**, so a re-import doesn't silently undo a faculty head's correction. Each change is recorded in the class history.
- **Scores above the max points.** Up to 150% is accepted as extra credit; anything higher stops the import.
- **EX cells for students who already have a grade here.** The grade is kept by default (NFR-03). Tick *Remove these grades* to drop them, so excused work isn't counted. Each removal is recorded as a cleared grade.

**Exporting from Canvas:** Course → Grades → Actions/Export → *Export Entire Gradebook*.
