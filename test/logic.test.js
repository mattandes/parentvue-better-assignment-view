/*
 * Unit tests for logic.js. Run with `npm test` (Node) or open /test/index.html via `npm run preview`.
 * Fixtures are the committed, made-up ones in test/fixtures/.
 */
(function (root) {
  const { eq } = typeof module === "object" ? require("./harness.js") : root.PVHarness;

  // The date the Q1 fixtures are written around; test/preview.html shifts the fixture dates from here to today.
  const FIXTURE_TODAY = "2026-10-12";

  const asg = (over) => ({
    id: 1,
    name: "A",
    type: "Formative",
    dateDue: "2026-09-20",
    scoreDisplay: "See Standards",
    points: null,
    pointsPossible: null,
    isGraded: false,
    missing: false,
    excused: false,
    dropped: false,
    teacherComment: null,
    standards: [],
    ...over,
  });
  const std = (code, mark) => ({ code, mark, description: "" });
  const cls = (id, title, assignments, period = "1") => ({
    courseId: id,
    title,
    period,
    teacher: "T",
    overallMark: "PR",
    overallScore: 3,
    assignments,
  });

  const tests = [
    [
      "parseDate handles ISO, US dates, sentinels",
      ({ L }) => {
        eq(L.parseDate("2026-09-11T17:26:08"), "2026-09-11");
        eq(L.parseDate("9/6/2026"), "2026-09-06");
        eq(L.parseDate("0001-01-01T00:00:00"), null);
        eq(L.parseDate(""), null);
        eq(L.parseDate(null), null);
      },
    ],
    [
      "parsePoints",
      ({ L }) => {
        eq(L.parsePoints("5 out of 10.0000"), [5, 10]);
        eq(L.parsePoints("See Standards"), [null, null]);
      },
    ],
    [
      "daysBetween",
      ({ L }) => {
        eq(L.daysBetween("2026-09-14", "2026-09-21"), 7);
        eq(L.daysBetween("2026-09-14", "2026-09-11"), -3);
        eq(L.daysBetween("2026-10-30", "2026-11-02"), 3);
      },
    ],
    [
      "status precedence: excused > dropped > missing > graded > past due > not due",
      ({ L }) => {
        const t = "2026-09-14";
        eq(L.statusOf(asg({ excused: true, missing: true }), t), "Excused");
        eq(L.statusOf(asg({ dropped: true, missing: true }), t), "Dropped");
        eq(L.statusOf(asg({ missing: true, isGraded: true }), t), "Missing");
        eq(L.statusOf(asg({ isGraded: true, dateDue: "2026-09-01" }), t), "Graded");
        eq(L.statusOf(asg({ dateDue: "2026-09-13" }), t), "Not graded");
        eq(L.statusOf(asg({ dateDue: "2026-09-14" }), t), "Not due yet");
        eq(L.statusOf(asg({ dateDue: null }), t), "Not due yet");
      },
    ],
    [
      "flags: attention for missing and past-due ungraded",
      ({ L }) => {
        const t = "2026-09-14";
        eq(L.assess(asg({ missing: true }), t).attention, true);
        eq(L.assess(asg({ dateDue: "2026-09-10" }), t).attention, true);
        eq(L.assess(asg({ isGraded: true, dateDue: "2026-09-10", standards: [std("S1", "PR")] }), t).attention, false);
        eq(L.assess(asg({ excused: true, dateDue: "2026-09-10" }), t).attention, false);
      },
    ],
    [
      "flags: due soon is ungraded work due today through 7 days out",
      ({ L }) => {
        const t = "2026-09-14";
        eq(L.assess(asg({ dateDue: "2026-09-14" }), t).dueSoon, true);
        eq(L.assess(asg({ dateDue: "2026-09-21" }), t).dueSoon, true);
        eq(L.assess(asg({ dateDue: "2026-09-22" }), t).dueSoon, false);
        eq(L.assess(asg({ dateDue: null }), t).dueSoon, false);
        eq(L.assess(asg({ dateDue: "2026-09-16", isGraded: true, standards: [std("S1", "HP")] }), t).dueSoon, false);
      },
    ],
    [
      "flags: below proficient is NS, DP or CP only; trait marks and PR/HP are not flagged",
      ({ L }) => {
        const t = "2026-09-14";
        for (const m of ["NS", "DP", "CP"])
          eq(L.assess(asg({ isGraded: true, standards: [std("S1", m)] }), t).belowPr, true, m);
        for (const m of ["PR", "HP", "C", "S", "O"])
          eq(L.assess(asg({ isGraded: true, standards: [std("S1", m)] }), t).belowPr, false, m);
        eq(L.assess(asg({ isGraded: true, standards: [std("S1", "PR"), std("S2", "DP")] }), t).belowPrCodes, ["S2"]);
      },
    ],
    [
      "markTone colors marks; a trailing dot (domain marks) counts as the plain mark",
      ({ L }) => {
        for (const m of ["HP", "PR", "PR."]) eq(L.markTone(m), "good", m);
        for (const m of ["CP", "DP", "NS", "CP.", "ns"]) eq(L.markTone(m), "low", m);
        for (const m of ["C", "O", "S", "N", "", null]) eq(L.markTone(m), "", String(m));
        eq(L.markMeaning("DP."), "Developing Proficiency");
        eq(L.markMeaning("N"), "Not Yet");
        eq(L.assess(asg({ isGraded: true, standards: [std("D1", "DP.")] }), "2026-09-14").belowPr, true);
      },
    ],
    [
      "scoreText: numeric scores only, placeholders blank",
      ({ L }) => {
        eq(L.scoreText(asg({ points: 5, pointsPossible: 10 })), "5/10");
        eq(L.scoreText(asg({ scoreDisplay: "See Standards" })), "");
        eq(L.scoreText(asg({ scoreDisplay: "Not Graded" })), "");
      },
    ],
    [
      "overallText",
      ({ L }) => {
        eq(L.overallText({ overallMark: "PR", overallScore: 3 }), "PR (3)");
        eq(L.overallText({ overallMark: null, overallScore: null }), "");
      },
    ],
    [
      "termOf: quarters, other term names, and Grading/Progress suffixes",
      ({ L }) => {
        eq(L.termOf("Q1 Grading"), "Q1");
        eq(L.termOf("q3 Progress"), "Q3");
        eq(L.termOf("Semester 1 Grading"), "Semester 1");
        eq(L.termOf("Semester 1 Progress"), "Semester 1");
        eq(L.termOf("Term 1"), "Term 1");
        eq(L.termOf("Trimester 2 - Progress"), "Trimester 2");
        eq(L.termOf(""), null);
        eq(L.termOf(null), null);
      },
    ],
    [
      "termClasses merges Grading with Progress; primary wins, extras are tagged",
      ({ L }) => {
        const grading = {
          name: "Q1 Grading",
          hasData: true,
          classes: [cls(1, "Math", [asg({ id: 10, name: "G" })], "2")],
        };
        const progress = {
          name: "Q1 Progress",
          hasData: true,
          classes: [
            cls(1, "Math", [asg({ id: 10, name: "stale" }), asg({ id: 11, name: "P only" })], "2"),
            cls(2, "Art", [asg({ id: 20 })], "1"),
          ],
        };
        const out = L.termClasses([progress, grading], "Q1");
        eq(
          out.map((c) => c.title),
          ["Art", "Math"],
          "period order",
        );
        const math = out.find((c) => c.title === "Math");
        eq(
          math.assignments.map((a) => a.name),
          ["G", "P only"],
        );
        eq(
          math.assignments.map((a) => a.onlyIn || null),
          [null, "Q1 Progress"],
        );
        eq(out.find((c) => c.title === "Art").assignments[0].onlyIn, "Q1 Progress");
      },
    ],
    [
      "termClasses pairs other term names the same way",
      ({ L }) => {
        const g = { name: "Semester 1 Grading", hasData: true, classes: [cls(1, "Math", [asg({ id: 1, name: "G" })])] };
        const p = {
          name: "Semester 1 Progress",
          hasData: true,
          classes: [cls(1, "Math", [asg({ id: 2, name: "P" })])],
        };
        const out = L.termClasses([p, g], "Semester 1");
        eq(
          out[0].assignments.map((a) => a.name),
          ["G", "P"],
        );
        eq(out[0].assignments[1].onlyIn, "Semester 1 Progress");
      },
    ],
    [
      "termClasses returns a lone term untouched",
      ({ L }) => {
        const only = { name: "Term 1", hasData: true, classes: [cls(1, "Math", [asg({ id: 1 })])] };
        const out = L.termClasses([only], "Term 1");
        eq(out.length, 1);
        eq(out[0].assignments[0].onlyIn, undefined);
      },
    ],
    [
      "termClasses ignores periods without data and other terms",
      ({ L }) => {
        const p = [
          { name: "Q2 Grading", hasData: false, classes: [] },
          { name: "Q1 Grading", hasData: true, classes: [cls(1, "Math", [])] },
        ];
        eq(L.termClasses(p, "Q2"), []);
        eq(L.termClasses(p, "Q1").length, 1);
        eq(L.termClasses(p, "Nope"), []);
        eq(L.termClasses([], "Q1"), []);
      },
    ],
    [
      "traditional grading: letter overall mark, percent text and points-only work",
      ({ L }) => {
        const c = L.normalizeClass({
          CourseTitle: "Math",
          PointsColumn: "A-",
          PercentageColumn: "92.5%",
          Assignments: [{ GradebookID: 1, Measure: "HW", ScoreDisplay: "18 out of 20" }],
        });
        eq(c.overallMark, "A-");
        eq(c.overallScore, 92.5);
        eq(L.overallText(c), "A- (92.5)");
        eq(L.markTone("A-"), "");
        eq(c.assignments[0].isGraded, true);
        eq(L.scoreText(c.assignments[0]), "18/20");
      },
    ],
    [
      "termClasses keeps every period of a term, whatever the periods are called",
      ({ L }) => {
        const period = (name, ...ids) => ({
          name,
          hasData: true,
          classes: [
            cls(
              1,
              "Math",
              ids.map((id) => asg({ id, name: "A" + id })),
            ),
          ],
        });
        const names = (out) => out[0].assignments.map((a) => a.name);
        const tags = (out) => out[0].assignments.map((a) => a.onlyIn || null);

        // no period called Grading: nothing is dropped, extras carry the name of the period they came from
        let out = L.termClasses([period("Q1 Progress", 1), period("Q1", 1, 2)], "Q1");
        eq(names(out), ["A1", "A2"]);
        eq(tags(out), [null, "Q1"]);

        // three periods in one term
        out = L.termClasses([period("Q1 Grading", 1), period("Q1 Progress", 2), period("Q1 Midterm", 3)], "Q1");
        eq(names(out), ["A1", "A2", "A3"]);
        eq(tags(out), [null, "Q1 Progress", "Q1 Midterm"]);

        // the Grading period is primary whatever its letter case or position
        out = L.termClasses([period("Trimester 1 Progress", 1, 2), period("Trimester 1 GRADING", 1)], "Trimester 1");
        eq(names(out), ["A1", "A2"]);
        eq(tags(out), [null, "Trimester 1 Progress"]);
      },
    ],
    [
      "isGraded: a score the portal shows as a number, percent or letter counts as graded",
      ({ L }) => {
        const graded = (display) =>
          L.normalizeClass({ Assignments: [{ GradebookID: 1, Measure: "x", ScoreDisplay: display }] }).assignments[0]
            .isGraded;
        for (const shown of ["18 out of 20", "18/20", "95%", "95.00", "A", "B+", "A-"]) eq(graded(shown), true, shown);
        for (const shown of ["See Standards", "Not Graded", "Not Due", "", "   "]) eq(graded(shown), false, shown);
        const a = L.normalizeClass({
          Assignments: [{ GradebookID: 1, Measure: "x", DateDue: "2026-09-01", ScoreDisplay: "95%" }],
        }).assignments[0];
        eq(L.statusOf(a, "2026-10-01"), "Graded");
        eq(L.scoreText(a), "95%");
      },
    ],
    [
      "odd or empty data does not throw",
      ({ L }) => {
        const empty = L.normalizeClass({});
        eq(empty.title, "");
        eq(empty.assignments, []);
        eq(L.normalizeClass({ Assignments: null, Standards: null }).assignments, []);
        eq(L.normalizePeriod({ PeriodName: "X" }, {}).hasData, false);
        eq(L.normalizePeriod({ PeriodName: "X" }, null).classes, []);
      },
    ],
    [
      "assignmentTypes and filterByType",
      ({ L }) => {
        const classes = [
          cls(1, "Math", [
            asg({ id: 1, type: "Summative" }),
            asg({ id: 2, type: "Formative" }),
            asg({ id: 3, type: "" }),
          ]),
          cls(2, "Art", [asg({ id: 4, type: "Formative" })]),
        ];
        eq(L.assignmentTypes(classes), ["Formative", "Summative"]);
        eq(L.filterByType(classes, "all"), classes);
        const f = L.filterByType(classes, "Formative");
        eq(
          f.map((c) => c.assignments.map((a) => a.id)),
          [[2], [4]],
        );
        eq(f.length, 2, "classes stay even when emptied");
      },
    ],
    [
      "annotate and totals count flags per class",
      ({ L }) => {
        const t = "2026-09-14";
        const classes = L.annotate(
          [
            cls(1, "Math", [
              asg({ id: 1, missing: true }),
              asg({ id: 2, dateDue: "2026-09-10" }),
              asg({ id: 3, dateDue: "2026-09-15" }),
              asg({ id: 4, isGraded: true, dateDue: "2026-09-01", standards: [std("S1", "NS")] }),
            ]),
          ],
          t,
        );
        eq(classes[0].counts, { total: 4, missing: 1, notGraded: 1, dueSoon: 1, belowPr: 1 });
        eq(L.totals(classes), { total: 4, missing: 1, notGraded: 1, dueSoon: 1, belowPr: 1 });
      },
    ],
    [
      "normalizePeriod on the Q1 Grading fixture",
      ({ L, F }) => {
        const p = L.normalizePeriod({ PeriodName: "Q1 Grading", GradingPeriodGU: "x" }, F.q1_grading);
        eq(p.hasData, true);
        if (!p.classes.length) throw new Error("no classes");
        for (const c of p.classes) {
          eq(
            c.assignments.every((a) => a.id !== undefined),
            true,
            "ids",
          );
          // An assignment is graded exactly when it has a point score, a standards mark, or a score shown as a number or letter.
          const shown = (a) => /\d/.test(a.scoreDisplay) || /^[A-F][+-]?$/i.test(a.scoreDisplay.trim());
          for (const a of c.assignments)
            eq(a.isGraded, a.points !== null || a.standards.some((s) => s.mark) || shown(a), a.name);
        }
        const periods = p.classes.map((c) => Number(c.period));
        eq(
          periods,
          [...periods].sort((x, y) => x - y),
          "period order",
        );
      },
    ],
    [
      "the Q1 fixtures hold a full schedule and every state the overlay shows (as of FIXTURE_TODAY)",
      ({ L, F }) => {
        const grading = L.normalizePeriod({ PeriodName: "Q1 Grading" }, F.q1_grading);
        const progress = L.normalizePeriod({ PeriodName: "Q1 Progress" }, F.q1_progress);
        const classes = L.annotate(L.termClasses([grading, progress], "Q1"), FIXTURE_TODAY);
        const all = classes.flatMap((c) => c.assignments);
        const has = (cond, msg) => eq(!!cond, true, msg);

        eq(
          classes.map((c) => c.period),
          ["1", "2", "3", "4", "5", "6", "7", "8"],
          "a full schedule, periods 1 to 8",
        );
        const statuses = new Set(all.map((a) => a.view.status));
        for (const s of ["Graded", "Missing", "Not graded", "Not due yet", "Excused", "Dropped"])
          has(statuses.has(s), `status ${s}`);
        has(
          all.some((a) => a.view.dueSoon),
          "due soon",
        );
        has(
          all.some((a) => a.view.status === "Not due yet" && !a.view.dueSoon),
          "due later than a week",
        );
        has(
          all.some((a) => !a.dateDue),
          "an undated assignment",
        );
        has(
          all.some((a) => a.view.belowPr),
          "below proficient",
        );
        has(
          all.some((a) => a.teacherComment),
          "a teacher comment",
        );
        has(
          all.some((a) => a.onlyIn),
          "work only in the other period",
        );
        has(
          all.some((a) => a.points !== null),
          "a point score",
        );
        has(
          all.some((a) => a.points === null && /\d/.test(a.scoreDisplay)),
          "a percent or letter score",
        );
        for (const t of ["Formative", "Summative", "Classwork"])
          has(
            all.some((a) => a.type === t),
            `type ${t}`,
          );
        const marks = new Set(all.flatMap((a) => a.standards.map((s) => s.mark)));
        for (const m of ["HP", "PR", "CP", "DP", "NS", "C", "O", "S", "N", "PR.", "DP."])
          has(marks.has(m), `mark ${m}`);
        has(
          classes.some((c) => c.assignments.length === 0),
          "a class with no assignments yet",
        );
        has(
          classes.some((c) => c.overallMark === null),
          "a class with no overall mark",
        );
        has(
          classes.some((c) => c.overallMark && !L.markTone(c.overallMark) && c.overallScore !== null),
          "a letter-graded class",
        );
        for (const tone of ["good", "low"])
          has(
            classes.some((c) => L.markTone(c.overallMark) === tone),
            `overall tone ${tone}`,
          );
        const links = classes.map((c) => L.mailtoHref(c.teacherEmail, "S"));
        has(links.filter(Boolean).length >= 5, "most classes can be emailed");
        has(
          classes.some((c) => !c.teacherEmail),
          "a class with no teacher address",
        );
        has(
          classes.some((c) => c.teacherEmail && !L.mailtoHref(c.teacherEmail, "S")),
          "a class whose address isn't a plain address",
        );
        for (const p of [grading, progress]) {
          const ids = p.classes.flatMap((c) => c.assignments.map((a) => a.id));
          eq(new Set(ids).size, ids.length, `${p.name}: assignment ids are unique`);
        }
        // Standards that link to no assignment are dropped, not shown.
        const rawStandards = F.q1_grading.SchoolInfo.SchoolClasses.flatMap((c) => c.Standards || []);
        const rawIds = new Set(
          F.q1_grading.SchoolInfo.SchoolClasses.flatMap((c) => (c.Assignments || []).map((a) => a.GradebookID)),
        );
        has(
          rawStandards.some((s) => !rawIds.has((s.Assignment || {}).Id)),
          "an unlinked standard in the raw data",
        );
        has(
          rawStandards.some((s) => !s.Mark),
          "an unmarked standard in the raw data",
        );
      },
    ],
    [
      "the Q2 fixture has data to show: several classes with work in a mix of states",
      ({ L, F }) => {
        const p = L.normalizePeriod({ PeriodName: "Q2 Progress" }, F.q2_progress);
        eq(p.hasData, true, "Q2 has data");
        const classes = L.annotate(L.termClasses([p], "Q2"), FIXTURE_TODAY);
        eq(classes.length, 8, "the full schedule");
        eq(classes.filter((c) => c.assignments.length).length >= 4, true, "at least four classes have work");
        const all = classes.flatMap((c) => c.assignments);
        const statuses = new Set(all.map((a) => a.view.status));
        for (const s of ["Graded", "Missing", "Not graded", "Not due yet"]) eq(statuses.has(s), true, `status ${s}`);
        eq(
          all.some((a) => a.view.dueSoon),
          true,
          "due soon",
        );
      },
    ],
    [
      "normalizePeriod keeps only data rows (MarkPeriod set) and links standards by assignment id",
      ({ L }) => {
        const raw = {
          SchoolInfo: {
            SchoolClasses: [
              { CourseTitle: "Math", MarkPeriod: null, Assignments: [], Standards: [] },
              {
                CourseTitle: "Math",
                MarkPeriod: "Q1 Grading",
                Period: "2",
                CourseID: 5,
                PointsColumn: "N/A",
                PercentageColumn: "",
                Assignments: [
                  {
                    GradebookID: 7,
                    Measure: "Quiz",
                    MeasureType: "Summative",
                    DateDue: "2026-09-02T10:00:00",
                    ScoreDisplay: "See Standards",
                  },
                ],
                Standards: [
                  { Code: "M.1", Mark: "DP", Assignment: { Id: 7 } },
                  { Code: "M.2", Mark: "PR", Assignment: { Id: 999 } },
                ],
              },
            ],
          },
        };
        const p = L.normalizePeriod({ PeriodName: "Q1 Grading" }, raw);
        eq(p.classes.length, 1);
        eq(p.classes[0].overallMark, null, "N/A is no mark");
        eq(
          p.classes[0].assignments[0].standards.map((s) => s.code),
          ["M.1"],
        );
        eq(p.classes[0].assignments[0].isGraded, true);
      },
    ],
    [
      "emailSubject is 'Student - Class - Period N' and leaves out what is missing",
      ({ L }) => {
        eq(L.emailSubject("Alex", "Health 7", "2"), "Alex - Health 7 - Period 2");
        eq(L.emailSubject("Alex", "Health 7", null), "Alex - Health 7");
        eq(L.emailSubject(null, "Health 7", "2"), "Health 7 - Period 2");
        eq(L.emailSubject("  Alex  ", " Health 7 ", " 2 "), "Alex - Health 7 - Period 2");
      },
    ],
    [
      "mailtoHref encodes the subject and refuses anything that is not a plain address",
      ({ L }) => {
        eq(
          L.mailtoHref("sokafor@example.org", "Alex - Health 7 & Art - Period 2"),
          "mailto:sokafor@example.org?subject=Alex%20-%20Health%207%20%26%20Art%20-%20Period%202",
        );
        eq(L.mailtoHref(" sokafor@example.org ", "S"), "mailto:sokafor@example.org?subject=S");
        eq(L.mailtoHref(null, "S"), "");
        eq(L.mailtoHref("", "S"), "");
        eq(L.mailtoHref("a@example.org?bcc=b@example.org", "S"), "", "extra fields are not allowed");
        eq(L.mailtoHref("a@example.org,b@example.org", "S"), "", "one recipient only");
        eq(L.mailtoHref("not an address", "S"), "");
        // eslint-disable-next-line no-script-url -- the hostile input this test feeds in
        eq(L.mailtoHref("javascript:alert(1)", "S"), "");
      },
    ],
  ];

  const api = { tests };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.PVTestModules = root.PVTestModules || []).push(api);
})(typeof globalThis !== "undefined" ? globalThis : this);
