# Testing

_Last updated 2026-10-21._

## Automated
`npm run check` is what CI runs on every push and pull request: ESLint (which includes the HTML-injection and eval rules), Prettier check, the tests, and the zip build. Run the parts separately with `npm run lint`, `npm run format:check`, `npm test` and `npm run package`. Node comes from nvm (version in `.nvmrc`).

### Unit tests (`npm test`)
A tiny dependency-free harness (`test/harness.js`) runs the test modules under Node (`test/run.js`) and in a browser (`test/index.html`, served by `npm run preview` at <http://localhost:8765/test/index.html>; the page title becomes `PASS` or `FAIL`). Modules marked `nodeOnly` (manifest and package checks) run only under Node.

| File | Covers |
|---|---|
| `logic.test.js` | date and points parsing; status order (excused, dropped, missing, graded, not graded, not due yet); needs-attention, due-soon (today through 7 days, undated excluded) and below-proficient (NS, DP, CP; not PR, HP or traits) flags; mark tones and meanings including the trailing-dot variants; score and overall text; term names (`Q1`, `Semester 1`, `Term 1`, `Trimester 2 - Progress`); merging every period of a term (primary wins, extras tagged with their own period name, any period names, three or more periods); lone terms; what counts as graded (`95%`, `18/20`, `A-` yes; `See Standards`, `Not Graded` no); periods without data; type list and filter; per-class and overall counts; normalizing a period (data rows only, standards linked by assignment id, `N/A` is no mark); traditional grading (letter overall mark, percent text, points only); the email subject (parts left out when missing) and the `mailto:` link (encoding; rejects lists, extra fields and non-addresses); the Q1 fixtures cover a full schedule and every state listed above, and the Q2 fixture has data in several classes; empty or odd data does not throw |
| `portal.test.js` | ParentVUE path detection in any case; gradebook path; origin pattern for the Portland, Salem-Keizer and Beaverton login URLs; rejection of http, chrome:// and junk; script ids; the popup states (`describePage`) |
| `ui.test.js` | HTML escaping of hostile text, focus wrapping, the stale-response guard |
| `manifest.test.js` | name, version, no static content scripts, no required host access, exact permissions, CSP, icons with the right sizes, injected scripts exist |
| `package.test.js` | the zip's name, `manifest.json` at its top level, every needed file present, no tests, docs or tooling inside |

Fixtures in `test/fixtures/` are made up (student "Alex", school "Example M.S.") and use real response shapes. Never put real student data in the repo.

| Fixture | Holds |
|---|---|
| `q1_grading.json` | A full schedule, periods 1 to 8, with every state the overlay shows: missing, not graded, due soon, due later, due today, undated, excused and dropped work; all standards marks (HP, PR, CP, DP, NS), traits (C, O, S, N) and dotted domain marks (`PR.`, `DP.`); point, percent and letter scores; Formative, Summative and Classwork types; teacher comments, one of them containing HTML in Social Studies (to show it is escaped); overall marks of every tone, a letter-graded class, a class with no assignments or overall mark; teachers with a valid, a missing and an invalid email address; an unlinked standard and an unmarked standard (both must not show) |
| `q1_progress.json` | The same term's Progress period: work that only it has ("Only in Q1 Progress") and an assignment Grading also has, with a different mark (Grading must win) |
| `q2_progress.json` | The next term, early on: four classes with work in a mix of states (graded, missing, not graded, due soon, due later) and four with nothing yet |

The dates in the Q1 fixtures are written around **2026-10-12** (`FIXTURE_TODAY` in `logic.test.js`), so the tests run "as of" that day. The preview page shifts every fixture date by the gap to the real today, so it looks the same whenever you open it.

Every change to a rule in `business-rules.md` needs a test here, written first and watched failing.

### Visual preview
`npm run preview`, then <http://localhost:8765/test/preview.html> mounts the overlay with the fixture data (no extension, no network): layout, themes, filters, Esc and focus. Fixture dates are shifted to the current date on load, so past-due, due-soon and later work all appear. Q1 shows every state; Q2 is a lighter term with work in four classes; Q3 and Q4 are empty. Open it in light and dark (the **Light mode** / **Dark mode** button) after any UI change.

**README screenshots** (`docs/images/overlay-dark.png` and `overlay-light.png`) are captures of this page. Retake them after a visible UI change, with `npm run preview` running and Chrome closed to the profile used (a throwaway one is fine): `chrome --headless=new --hide-scrollbars --user-data-dir=<temp dir> --blink-settings=preferredColorScheme=0 --window-size=1280,976 --virtual-time-budget=8000 --screenshot=docs/images/overlay-dark.png http://localhost:8765/test/preview.html`, and the same with `preferredColorScheme=1` and `overlay-light.png`. (`0` is dark, `1` is light.) Check the images for anything that isn't made-up data.

## Manual: live checklist
The popup, service worker, permission prompt and live data calls need real Chrome. Run this after any change to `manifest.json`, `background.js`, `popup.js`, `content.js` or the endpoints. Reload the extension at `chrome://extensions` first.

Install and permissions

1. Remove any older copy, then **Load unpacked** the `extension` folder (or the unzipped release). The card is named **ParentVUE: Better assignment view**, and Chrome shows **no** site-access warning.
2. On a non-ParentVUE page (for example `https://example.com`) the popup says it only works on ParentVUE pages and offers no button.
3. On the portal (signed in), the popup offers **Enable on <host>**. Allow it: the button appears on the Grade Book **without reloading**.
4. Quit Chrome completely and reopen it. The button still appears with no new prompt (the registration persisted).
5. On `chrome://extensions` click the extension's reload icon, reload the Grade Book: still works (registrations survive an update or reload).
6. Click the icon again, choose **Disable on this site**, reload: the button is gone. Chrome's site-access list for the extension no longer has the site.


Overlay (on the real Grade Book)

7. The overlay opens on the current term with the student's first name in the title; every class shows.
8. Spot-check three assignments against ParentVUE: score, standards marks, due date, status; and each class's missing count.
9. The term picker lists the portal's terms; empty future terms show the empty message; switching terms quickly never shows stale data.
10. The Type dropdown lists the real types; choosing one changes the tiles and chip counts.
11. Filters, search, sort, collapse all, Legend and the theme toggle behave as in `ui-spec.md`; the theme choice is still there after a reload.
12. Below-proficient marks (and any dotted marks) are colored; overall pills match.
13. Tab stays inside the overlay; Esc and ✕ close it, focus returns to the page, and the page works normally.
14. Let the session expire (or sign out in another tab) and press Refresh: the "session expired" message appears.
15. DevTools Console on the page shows no errors from the extension.
16. Email teacher: each class card with a teacher address has an envelope button (tooltip "Email teacher", visible in light and dark). It opens your mail app to that teacher with the subject "Student - Class - Period N" (first name) and doesn't collapse the card.
17. Stale grades: if a grade the portal shows (or another client sees) is missing in the overlay, Refresh won't fix it. Sign out of ParentVUE, sign back in and reopen the overlay; the grade should appear. The overlay header shows this hint in a muted line below the filters.

Other districts

18. Repeat 1 to 17 on another district's portal. Note the period names it uses, whether it grades by standards or by percent, and anything that renders oddly. A district whose pages don't match `/PXP2_*` can't be enabled; record its address and page names.

Record anything that looks wrong with the exact message or a screenshot with student details cropped out.
