# ParentVUE API notes (as used by this extension)

_Reverse-engineered from the live portal (2026-10-17) and confirmed against this extension. These are internal endpoints used by the web UI, not a public API, so they may change. The extension reads them from the page with the signed-in user's own session._

- **Portals:** every school that runs ParentVUE (Edupoint Synergy "PXP2") has its own address, for example `https://or-psd-psv.edupoint.com` (Portland Public Schools, the one these notes were mapped on and the only one tested). Login pages are `/PXP2_Login_Parent.aspx` or `/PXP2_Login.aspx`; signed-in pages include `/Home_PXP2.aspx` and the gradebook. The endpoints below are assumed to be the same everywhere; only Portland has been checked.
- **Gradebook page:** `/PXP2_Gradebook.aspx?AGU=0&studentGU=...&gradePeriodGU=...`. The path appears as both `PXP2_GradeBook.aspx` and `PXP2_Gradebook.aspx`; match it case-insensitively. `AGU` is the student index; the selected student is held in the session.
- **Student name:** the page's own script sets `ST.SM_ChildName = '<first name>'`. The extension reads it from `document.scripts`. The page's print-only heading `h1.hide-for-screen` holds the full name (checked 2026-10-21), but the extension doesn't use it; the title and the email subject both use the first name. `TeacherEmail` on each class row is the address for the envelope (email teacher) button.
- **Session:** about 100 minutes server-side (`PXP.SessionTimeout`), and `ST.SessionLength = 20` suggests a 20-minute idle limit. An expired session redirects to a login URL, which the extension reports as "session expired".
- **Stale grades in a long-lived session (observed 2026-10-21, cause unconfirmed):** a standards mark entered at 11:55 was missing from the extension's data at 15:29 while a fresh login (a separate client) already had it. Signing out and back in fixed it. Refresh re-sends the same calls on the same session, so it doesn't help. The server probably keeps a per-session copy of the gradebook, but this hasn't been verified; a muted line in the overlay header tells the user to sign in again.
- **Grading model:** standards-based; each assignment is scored against one or more standards.

## Calls
All are `POST /api/GB/ClientSideData/Transfer?action=<FriendlyName>-<Method>` with `Content-Type: application/json; charset=utf-8` and body

```json
{"FriendlyName": "<FriendlyName>", "Method": "<Method>", "Parameters": "<JSON-encoded string>"}
```

`Parameters` is a JSON **string** (the JSON of the parameter object, stringified).

### 1. Default gradebook: `pxp.school.classes` / `get`
Parameters: `{}`. Returns `{"SchoolGradingGroups":[{"SchoolId","OrgYearGU","GradingPeriodGroup","SchoolInfo":{"SchoolName",...}}], ...}`. The extension uses it for `SchoolId`, `OrgYearGU` and `GradingPeriodGroup`.

### 2. Grading periods: `pxp.term.selector` / `get`
Parameters: `{"termData":{"SchoolId":<id>,"OrgYearGu":"<OrgYearGU>","GradingPeriodGroup":"Regular"}}`. (`{}` returns HTTP 500: "Method get doesn't exist… With 0 parameter(s)".)

```json
{"GradingPeriods":[{"PeriodName":"Q1 Progress","GradingPeriodGU":"...","GradingPeriodGroup":"Regular"}, ...],
 "GradingPeriodGU":"...","GradingPeriodDescription":"Q1 Grading"}
```

For 2026-27 in Portland: Q1 Progress, Q1 Grading, Q2 Progress, Q2 Grading, Q3 Progress, Q3 Grading, Q4 Progress, Q4 Grading. `GradingPeriodDescription` names the current period and picks the term shown on open. Other districts may name periods differently (see `business-rules.md`).

### 3. A period's gradebook: `pxp.school.classes` / `getSchool`
```json
{"args":{"SchoolId":<id>,"OrgYearGu":"<OrgYearGU>","GradingPeriodGroup":"Regular","GradingPeriodGU":"<period GUID>",
         "schoolGradingGroup":{"SchoolId":<id>,"OrgYearGU":"<OrgYearGU>","GradingPeriodGroup":"Regular","GradingPeriodGU":null}}}
```
The key is `OrgYearGu` in `args` but `OrgYearGU` in `schoolGradingGroup`. Returns `{"SchoolInfo":{"SchoolName":..., "SchoolClasses":[...]}}`. Future periods return their classes with no assignments and an overall mark of `N/A`.

App-level errors come back as HTTP 500 with a JSON string body ("Method X doesn't exist on object Y. With N parameter(s).").

## `SchoolInfo.SchoolClasses[]`
Each class appears **twice**: a header row (`MarkPeriod` null) and a data row. Keep the rows with `MarkPeriod` set.

| Field | Meaning |
|---|---|
| `CourseTitle`, `SectionTitle` | "Language Arts 7", "1: Language Arts 7" |
| `Period`, `Room`, `Teacher`, `TeacherEmail` | |
| `MarkPeriod` | "Q1 Grading" |
| `PointsColumn` | overall class mark (PR, NS, N/A, ...) |
| `PercentageColumn` | numeric score on the 4-point scale ("3.0"), or null |
| `MissingAssignmentsColumn` | "0 Missing Assignments" |
| `CourseID` | join key across periods |
| `Assignments[]`, `Standards[]` | see below |

### `Assignments[]`
`GradebookID` (join key), `Measure` (name), `MeasureDescription`, `MeasureType` (Formative / Summative / Classwork), `DateAssigned`, `DateDue`, `ScoreDisplay` ("See Standards" / "5 out of 10.0000" / "Not Graded"), `Points`, `PointsPossible`, `IsGradebookMissingMark`, `Excused`, `Dropped`, `Notes`, `GradeBookComment`, `ScoreDate`, `IsForGrading`.

`Points` is not reliable for "has a score" (0 appears on ungraded work); the extension reads points from `ScoreDisplay`.

### `Standards[]`
`Code` ("7.LA.RI.01"), `Description`, `Date`, `Mark` ("CP"), `CalcValue`, `Assignment` `{Id, Text}`.

**Per-assignment grade:** the standards where `Standards[].Assignment.Id == Assignments[].GradebookID`.

## Marks
From the portal's own legend: standards HP, PR, CP, DP, NS; domain-level standards also show dotted variants (`HP.`, `PR.`, `CP.`, `DP.`); Traits of Learners C, O, S, N. See `business-rules.md`.

## Authentication note
The extension never logs in. It only works while the user is signed in, and uses same-origin `fetch` so the browser attaches the session cookie. No token, header or credential is created or stored.
