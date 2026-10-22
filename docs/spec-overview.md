# ParentVUE: Better assignment view: System Overview

_Last updated: 2026-10-21 (works on any ParentVUE site; per-site approval; GitHub build; email-teacher button; HTML-injection linting)_

## Goal
Make the ParentVUE gradebook easier for a parent to understand. In one page, show every class's assignments for a term, and call attention to the things a parent should act on: missing work, work that is past due and not graded, work due soon, and standards scored below proficient.

It is a Chrome (and Edge) extension for parents. The grades themselves are never changed or re-interpreted: ParentVUE is the source of truth, and this view only reorganizes and highlights what ParentVUE reports.

## Users and context
- **Users:** parents checking their student's grades, at any school that uses ParentVUE (Edupoint Synergy "PXP2"), in desktop Chrome or Edge.
- **Distribution:** a zip from the GitHub Releases page, unzipped and loaded with **Load unpacked** in developer mode.
- **Grading models:** built around standards-based grading (marks HP, PR, CP, DP, NS and Traits of Learners C, O, S, N) but tolerant of numeric scores and letter or percent overall grades.
- **Browsers:** Chrome or Edge 102 or newer (`minimum_chrome_version`), desktop only.
- **Tested against:** Portland Public Schools (`or-psd-psv.edupoint.com`). Other districts are expected to work but are unverified.

## Scope
In scope:
- A toolbar popup where the parent approves (or removes) the school's ParentVUE site.
- A button on the gradebook page that opens a full-page overlay.
- Data for the selected student, every grading term, loaded on demand from the portal's own endpoints.
- Flagging, filtering, sorting and searching as described in `ui-spec.md`; light and dark themes.
- An envelope button (tooltip "Email teacher", a `mailto:` link) on each class card, with the subject "Student - Class - Period N" (the first name, as in the title). It is a plain link: the extension sends nothing; the parent's own mail app does the rest.
- Lint, tests, packaging and releases on GitHub.

Out of scope:
- Any other data source, and anything the parent has to type in (the view only shows what ParentVUE reports).
- Any outside service. Nothing leaves the browser.
- Editing, submitting or changing anything in ParentVUE. The extension is read-only.
- Mobile browsers (no extensions), Firefox, Safari, and the Chrome Web Store (nothing prevents it later).
- Automatic updates. Parents download a new zip for a new version.
- Replacing or rewriting ParentVUE's own table in place.

## Architecture

```
 Toolbar popup (popup.html/js)            Service worker (background.js)
   "Enable on <host>"  ── permission ──▶    keeps a content-script registration for every approved host
   "Disable on this site"                    (on install, browser start, permission added or removed)
          │                                              │
          ▼                                              ▼
 ParentVUE site the parent approved (any host, e.g. https://<district>.example/PXP2_Gradebook.aspx)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  content.js   acts only on the gradebook page: button, data calls, glue      │
 │    ├─ POST /api/GB/ClientSideData/Transfer  (same origin, the user's session)│
 │    │     pxp.school.classes/get → pxp.term.selector/get → …/getSchool        │
 │    ├─ reads ST.SM_ChildName from the page's own script for the student name  │
 │    ├─ theme saved with chrome.storage.local                                  │
 │    └─ opens ─▶ ui.js   overlay in a shadow root (state, rendering)           │
 │                  └─ uses ─▶ logic.js   pure rules: normalize, merge, flag    │
 │  portal.js    pure: is this a ParentVUE page / the gradebook; origin pattern │
 └──────────────────────────────────────────────────────────────────────────────┘
```

| File | Job | Depends on |
|---|---|---|
| `manifest.json` | Manifest V3. No static content scripts, no required host access; `optional_host_permissions` is `https://*/*` so the parent can approve one site at a time | |
| `background.js` | Module service worker. Registers `portal.js`, `logic.js`, `ui.js`, `content.js` for each approved origin (`persistAcrossSessions`), unregisters removed ones; one sync at a time | `portal.js` |
| `popup.html/js/css` | Shows Enable / Enabled / "only works on ParentVUE pages" for the current tab; requests the permission from the click, then asks the worker to sync and injects the scripts into the open tab | `portal.js` |
| `portal.js` | Pure: `isParentVuePath`, `isGradebookPath`, `originPatternOf`, `scriptIdOf`, `describePage`, `CONTENT_SCRIPT_FILES`. UMD (global `PVPortal` and `module.exports`) | |
| `logic.js` | Pure rules (see `business-rules.md`). Global `PVBetter` | |
| `ui.js` | The overlay and its pure helpers (`esc`, `wrapFocusIndex`, `createLatestGuard`). Global `PVBetterUI`. No networking | `logic.js` (passed in) |
| `content.js` | Recognizes the gradebook page, adds the button, calls the endpoints, caches periods | `portal.js`, `logic.js`, `ui.js` |

### Why this shape
- **Per-site approval.** ParentVUE lives on a different address at each district, so the extension can't list them. Asking for access to all websites at install would be an alarming prompt for a tool that reads grades, so the parent approves their own school's address once instead.
- **Pure logic in its own files.** It is the part that must be right, and it runs unchanged under Node tests and in the browser test page.
- **Overlay, not an in-place rewrite.** ParentVUE's markup is the brittle part. An overlay needs only the data and one place to attach a button.
- **Shadow DOM.** ParentVUE's styles can't leak into the overlay and ours can't leak out.
- **The page's own endpoints, not scraping.** Same data the page shows, including standards per assignment.
- **No bundler or runtime dependencies.** Classic scripts; "Load unpacked" works from `extension/`. Node is only for linting, testing and packaging.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Chrome extension, Manifest V3, loaded unpacked from a release zip | No store review, no server, no cost. Works in Edge too |
| D2 | Full-page overlay opened by a floating button | Independent of ParentVUE's markup. Esc or ✕ returns to the normal page |
| D3 | Use the portal's internal JSON endpoints from the page (same origin, existing session) | Same data as the page, no password or token handling. Tradeoff: undocumented, may change |
| D4 | ParentVUE only; nothing for the parent to type in | Focus on making ParentVUE's own data understandable |
| D5 | The look is the product's own; only the flagging rules are fixed | A browser allows a clearer layout. What gets flagged and why is in `business-rules.md` |
| D6 | Merge each term's Grading and Progress periods by assignment id | They overlap but each can hold assignments the other lacks. Grading wins; the other's extras are tagged |
| D7 | **Per-site approval, first visit only** (2026-10-20): `optional_host_permissions` plus a popup button; scripts registered per approved origin | Works on any district without a code change and without an "all websites" install prompt. The parent approves their own school once |
| D8 | Offer Enable only on pages that look like ParentVUE over https (`/PXP2_*` or `/Home_PXP2.aspx`) | Never request access to an unrelated site. A district with other paths is a bug to report |
| D9 | `content.js` recognizes the gradebook path itself, case-insensitively | The portal writes both `PXP2_GradeBook.aspx` and `PXP2_Gradebook.aspx`, and match patterns are case-sensitive |
| D10 | Terms are named by the portal: `Q1 …` is `Q1`; otherwise a trailing Grading/Progress word is dropped (`Semester 1 Grading` is `Semester 1`; `Term 1` stays) | Other districts don't use Portland's names |
| D11 | Theme: starts from the OS setting; the toggle overrides and is saved with `chrome.storage.local` | Both themes wanted; extension storage instead of the portal's `localStorage` |
| D12 | Search matches assignment names only; a separate Type filter handles Formative/Summative | Searching standards text was noisy |
| D13 | Default sort is by due date, oldest first, with a labelled "Sort by due date" control | "Newest/Oldest first" alone wasn't clear |
| D14 | Domain-level marks with a trailing dot (`PR.`) are treated like the plain mark | Seen in the portal's own legend |
| D15 | Only the mark is colored (green PR/HP, lavender below proficient), on standards and on a class's overall mark | Consistent and less noisy than shading the whole standard |
| D16 | The floating button sits 84px above the bottom | Clears the portal's footer bar |
| D17 | GitHub build: `npm run check` (ESLint, Prettier check, tests, zip) on every push and pull request; tagged releases publish the zip; actions pinned to commit SHAs; MIT license | Repeatable, reviewable releases for parents who download a zip. Public repo so no account is needed to download |
| D18 | Node (via nvm, version in `.nvmrc`) is tooling only | Keeps the shipped extension dependency-free |
| D19 | Each class card has an icon-only envelope button: a plain `mailto:` link to the teacher's address with the subject "Student - Class - Period N", using the first name from `ST.SM_ChildName` (2026-10-21) | Lets a parent write to a teacher about a specific class without the extension sending anything. The page's full-name heading was left unused to keep one name source. A plain link, not a webmail link, to stay simple |
| D20 | ESLint blocks unescaped HTML sinks (`eslint-plugin-no-unsanitized`, `esc` as the approved escaper) and eval-style code (2026-10-21) | Portal text is untrusted and the overlay runs on a page with the parent's signed-in session. A new unescaped `innerHTML` use now fails lint until reviewed |

## Privacy and safety
- Install-time permissions: none for sites. Per site, only after the parent clicks Enable and confirms Chrome's prompt, for exactly that site.
- Calls only the approved ParentVUE site, with the user's existing session cookies. It never reads, stores or sends a password.
- Stores nothing except the theme choice. Closing the overlay discards the data. No analytics.
- Teacher comments and assignment text are inserted escaped (`esc` in `ui.js`), never as HTML, and are treated as data, not instructions. ESLint enforces this: `eslint-plugin-no-unsanitized` (with `esc` as the approved escaper) fails any new `innerHTML`-style assignment until it is escaped or reviewed and annotated, and `no-eval`, `no-implied-eval`, `no-new-func` and `no-script-url` are on.
- The envelope button is built only when the portal's teacher address is a single plain address (`logic.mailtoHref`), so a crafted value can't add recipients or fields.
- Real student data must not be committed: the fixtures in `test/fixtures/` are made up, and any capture from a live portal belongs outside the repo (or in the ignored `live-captures/`).

## Roadmap
No additional features currently planned at this time.

## Known limitations
- **Stale grades in a long session.** ParentVUE can keep serving an older copy of the gradebook to a long-lived session (seen 2026-10-21; cause unconfirmed, see `parentvue-api-notes.md`). Refresh doesn't clear it; signing out and back in does. The overlay header says so.
- Only Portland has been checked; other districts are unverified.

## Open items
- Confirm the three data calls and the type list against other districts' real data (types other than Formative and Summative, such as Classwork).
- District mark-scale definitions beyond the portal legend (how marks combine into the overall grade).
- Whether domain-level marks (`PR.`) ever appear on assignments.
- Behavior with multiple students on one account.
- Whether to publish to the Chrome Web Store later.
