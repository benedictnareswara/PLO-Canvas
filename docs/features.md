# Features and roles

## Gradebook (lecturers)

A spreadsheet grid on desktop and tablets, a one-assessment-at-a-time grader on phones. Both edit the same unsaved state and have the same Save bar; leaving with unsaved changes asks first. Saves send only the changed cells, each with the value it replaces: if someone else changed a cell in the meantime, nothing is written and the conflicting cells are offered as "Use theirs / Keep mine". Course grades update as you type (shown in italics until saved).

| Key | In the grid |
|---|---|
| Arrows, Home/End, Ctrl/⌘+Home/End, Page Up/Down | Move the cell cursor |
| Tab / Shift+Tab | Move along the row (leaves the grid at the edge) |
| Type a digit, Enter or F2 | Edit the cell (`85.5` and `85,5` both work) |
| Enter / Tab while editing | Save the cell and move down / right |
| Esc | Cancel the edit |
| Delete / Backspace | Clear the cell |
| Ctrl/⌘+V | Paste a block copied from Excel, Google Sheets or Numbers |
| Ctrl/⌘+Z | Undo the last edit or paste |
| Ctrl/⌘+S | Save all changes |
| Alt/⌥+H (or right-click) | History of the cell |

## Everywhere

Ctrl/⌘+K opens the command palette: pages, recent items, and students and classes you're allowed to open. Theme (System / Light / Dark) and language (English / Bahasa Indonesia) live under the account menu → Preferences; the language is saved to your account and also offered on the sign-in page.

## Audit trail

Every grade, assessment and target change, and every Canvas import, is recorded with old → new values, who and when, in the same database transaction as the change. Each class has a read-only **History** tab; Heads and Admins can read it but nobody can edit or revert it.

## Exports and reports

Gradebooks, class attainment, student lists, cohort comparisons and admin lists export to CSV (UTF-8 with BOM, safe against spreadsheet formula injection) or Excel. Print-ready A4 reports (student PLO transcript, class report, cohort report) open from the class page, student profiles and the head dashboards; use the browser's **Save as PDF** for a file.

## Department analytics (Heads)

One filter bar per page, kept in the URL so a view can be shared: period, a clearly labelled what-if threshold, and cohorts to compare. Heatmapped matrices with the numbers written in, drill-downs that open under their row, and a one-PLO-at-a-time view on phones.

## Administration

Searchable, sortable, paginated lists with export; validated forms with an error summary; deletes that first say what depends on the record; bulk Academic Advisor assignment; a setup checklist on the overview.

## Accessibility and quality

Built to WCAG 2.2 AA: keyboard operation throughout (grid pattern for the gradebook, roving-focus tabs, menus and dialogs with focus return), visible focus never hidden behind sticky bars, at-risk states never shown by colour alone, 44 px touch targets for form fields, reduced-motion support, and contrast of every colour token checked by a test in both themes.

## Roles and access control

Enforcement happens at three levels:
1. **Proxy** (`src/proxy.ts`): an optimistic cookie check that redirects to the user's home.
2. **Pages** (`requirePageUser`).
3. **Every API route** (`requireApiUser`, `canAccessOffering`, `canViewStudent` in [`src/lib/auth/rbac.ts`](../src/lib/auth/rbac.ts)). Roles are re-read from MongoDB on each request, so role changes apply immediately, and a session whose account was deactivated or deleted is ended on the next page load.

Search applies the same rules inside the database query ([`src/lib/search/scope.ts`](../src/lib/search/scope.ts)), so records you can't open are never fetched. Print reports use the same checks as the matching screens.

| Capability | Superadmin | Faculty Head | Lecturer | Student |
|---|---|---|---|---|
| Faculties, departments, curricula, PLOs, courses, offerings, users, advisors | ✅ | | | |
| Department analytics, cohort radar, at-risk engine, course matrix | | ✅ (read-only, own department) | | |
| View any class in the department | | ✅ read-only | own classes | |
| Review and edit the PLO weights of a department class (FR-26, UC-08; logged, attainment recalculated) | ✅ | ✅ department classes | own classes | |
| Edit assessments, grades, threshold, Canvas import | ✅ (API) | own classes only | own classes | |
| Read a class's change history | ✅ | department classes | own classes | |
| Search (command palette) | everything | department students and classes, advisees | advisees, own classes | |
| My Advisees + advisee profiles | | if assigned | if assigned | |
| Own dashboard and spider chart | | | | ✅ |
