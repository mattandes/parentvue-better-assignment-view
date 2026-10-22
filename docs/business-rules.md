# Business rules

_These are the rules for what the view flags and why. They live in `extension/logic.js` and are covered by `test/logic.test.js`. Last updated 2026-10-21._

These rules are this project's own: the extension is self-contained. They are kept deliberately simple so a parent can predict what will be flagged. Anything not in this list is shown but not highlighted.

## Which rows are classes
ParentVUE returns every class twice per grading period: a header row (`MarkPeriod` is null) and a data row. Keep the rows where `MarkPeriod` is set. If none are set, fall back to one row per `CourseID`, preferring the one with more assignments. Classes are shown in period order (period number, then title).

## Grading periods and terms
- Periods are named by the portal. Portland uses `Q1 Progress` and `Q1 Grading`. The **term** is the leading `Qn` when there is one (`Q1`); otherwise a trailing `Grading` or `Progress` word (and an optional `-` or `:`) is dropped and the rest is the term (`Semester 1 Grading` and `Semester 1 Progress` are `Semester 1`; `Term 1` is `Term 1`). Other names work as long as the portal lists them as grading periods.
- Each term can have a **Grading** period and a **Progress** period. They overlap, but each can hold assignments the other lacks. A term with only one period just uses it.
- For a term: the period whose name contains "Grading" (any letter case), else the first one, is primary. Every other period in the term is merged into it, however many there are. Its assignments win when both have the same assignment id. Assignments only in another period of the term are added and tagged with that period's own name ("Only in Q1 Progress"). A class that exists only in another period is included whole.
- A period with no assignments and no overall mark counts as "no data" and is skipped. A term with no data shows "No classes or assignments in <term> yet". The picker lists the distinct terms in the order the portal lists them.

## Assignments
Per assignment (from `Assignments[]`): id (`GradebookID`), name (`Measure`), type (`MeasureType`: Formative, Summative, Classwork, ...), due date (`DateDue`), score text (`ScoreDisplay`), points, missing flag (`IsGradebookMissingMark`), excused, dropped, teacher comment (`GradeBookComment`).

**Standards link to an assignment** when `Standards[].Assignment.Id` equals the assignment's `GradebookID`. One assignment can have several standards. Standards that link to no assignment are ignored. Standards without a mark are not shown.

Dates: `2026-09-11T17:26:08` and `9/16/2026` both become `2026-09-11`. An empty value or `0001-01-01...` means no date.

**Points** are read from the score text: `5 out of 10.0000` is 5 of 10. Anything else (`See Standards`, `Not Graded`) has no points.

## Graded
An assignment is **graded** when it has a numeric score, at least one standards mark, or a score the portal shows as a number, percent or letter grade (`95%`, `18/20`, `A-`). Placeholders (`See Standards`, `Not Graded`, an empty display) are not scores. (`Points: 0` in the raw data does not count; the portal sets it on ungraded work.) This is the rule most likely to differ at a district that grades with percentages or letters, and has only been checked against Portland's data.

## Status
Decided in this order; the first match wins:

| Status | When |
|---|---|
| Excused | the portal's excused flag |
| Dropped | the portal's dropped flag |
| Missing | the portal's missing flag |
| Graded | graded (see above) |
| Not graded | not graded and due **before** today |
| Not due yet | not graded and due today or later, or no due date |

"Today" is the browser's local date. There is no way to tell whether a student turned work in, so past-due ungraded work is just Not graded.

## Highlights
| Highlight | Rule |
|---|---|
| **Needs attention** (red) | status is Missing or Not graded |
| **Due soon** (amber) | status is Not due yet and the due date is today through 7 days out (`SOON_DAYS`) |
| **Below proficient** (lavender mark) | a standards mark of NS, DP or CP (`BELOW_PR_MARKS`) |
| Proficient (green mark) | PR or HP |

Excused and Dropped work is never highlighted. A graded assignment is never red or amber, but can still have below-proficient marks.
Trait marks (C, O, S, N) are not flagged. A trailing dot (`PR.`, `DP.`, as on domain-level standards in the portal legend) is ignored when classifying and when looking up the meaning.

## Mark legend (from the portal)
| Mark | Meaning |
|---|---|
| HP | Highly Proficient |
| PR | Proficient |
| CP | Close to Proficient |
| DP | Developing Proficiency |
| NS | Not Scored |
| C / O / S / N | Traits of Learners: Consistently / Often / Sometimes / Not Yet |

NS ("Not Scored") is treated as below proficient. The district's rules for how marks combine into the overall mark are not documented here (open item).

## Per-class numbers
- **Overall:** the class mark (`PointsColumn`, for example `PR`) and its 4-point score (`PercentageColumn`, for example `3.0`), shown as `PR (3)`. `N/A` is treated as no mark. The pill uses the same color tone as marks.
- **Counts** on each class card and the summary tiles: Missing, Not graded (past due), Due soon, Below proficient (assignments with at least one below-proficient mark), Total. All counts follow the Type filter.

## Filters (view-only; they never change the rules above)
- **Type:** All types, or one `MeasureType`. Options are the types present in the data.
- **Chips:** All, Needs attention, Due soon, Below proficient. Counts on the chips respect the Type filter.
- **Search:** case-insensitive substring of the assignment name.
- **Sort:** by due date, oldest first (default) or newest first; undated work sorts last when oldest-first.
