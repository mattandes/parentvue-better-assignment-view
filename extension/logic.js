/*
 * Pure logic: raw ParentVUE gradebook JSON -> classes and assignments with flags.
 * No DOM, no network, so it is unit-tested (test/).
 *
 * The rules (what counts as graded, missing, past due, due soon, below proficient, and how a term's
 * Grading and Progress periods merge) are documented in docs/business-rules.md. ParentVUE data only:
 * there is no way to tell whether a student turned work in, so ungraded past-due work is just "Not graded".
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PVBetter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Academic marks below proficient (PR). Learner-trait marks (C, S, O) are not flagged.
  const BELOW_PR_MARKS = ["NS", "DP", "CP"];
  const SOON_DAYS = 7;
  // The portal's own legend (shown under its Standards view).
  const MARK_LEGEND = {
    standards: [
      ["HP", "Highly Proficient"],
      ["PR", "Proficient"],
      ["CP", "Close to Proficient"],
      ["DP", "Developing Proficiency"],
      ["NS", "Not Scored"],
    ],
    traits: [
      ["C", "Consistently"],
      ["O", "Often"],
      ["S", "Sometimes"],
      ["N", "Not Yet"],
    ],
  };

  /** Domain-level marks are shown with a trailing dot (`PR.`); treat them like the plain mark. */
  const markKey = (mark) =>
    String(mark || "")
      .trim()
      .replace(/\.$/, "")
      .toUpperCase();

  /** 'good' (HP, PR), 'low' (below proficient) or '' (traits, unknown). */
  function markTone(mark) {
    const k = markKey(mark);
    if (BELOW_PR_MARKS.includes(k)) return "low";
    return k === "HP" || k === "PR" ? "good" : "";
  }

  function markMeaning(mark) {
    const k = markKey(mark);
    const hit = [...MARK_LEGEND.standards, ...MARK_LEGEND.traits].find(([m]) => m === k);
    return hit ? hit[1] : "";
  }
  const EMPTY_MARKS = ["", "N/A", "NA"];

  // -- scalars ---------------------------------------------------------------

  /** '2026-09-11T17:26:08' or '9/16/2026' -> '2026-09-11'. Empty and the 0001-01-01 sentinel -> null. */
  function parseDate(value) {
    if (!value || typeof value !== "string") return null;
    const s = value.trim();
    if (s.startsWith("0001-01-01")) return null;
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return null;
  }

  function parseFloatOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(String(value).replace(/%\s*$/, ""));
    return Number.isFinite(n) ? n : null;
  }

  /** A score as districts show it: a number, a percent or points ("95%", "18/20"), or a letter grade ("B+"). */
  function looksLikeScore(display) {
    return /\d/.test(display) || /^[A-F][+-]?$/i.test(display.trim());
  }

  function cleanMark(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    return EMPTY_MARKS.includes(s) ? null : s;
  }

  function optText(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    return s || null;
  }

  function parsePoints(scoreDisplay) {
    if (typeof scoreDisplay !== "string") return [null, null];
    const m = /^\s*(-?\d+(?:\.\d+)?)\s+out of\s+(\d+(?:\.\d+)?)\s*$/i.exec(scoreDisplay);
    return m ? [Number(m[1]), Number(m[2])] : [null, null];
  }

  function todayIso(now) {
    const d = now || new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** Whole days from `from` to `to` (both 'YYYY-MM-DD'); negative when `to` is earlier. */
  function daysBetween(from, to) {
    const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    return Math.round((ms(to) - ms(from)) / 86400000);
  }

  // -- normalize (raw -> classes) -----------------------------------------------

  function normalizeStandard(raw) {
    return {
      code: String(raw.Code ?? ""),
      mark: cleanMark(raw.Mark),
      value: parseFloatOrNull(raw.CalcValue),
      date: parseDate(raw.Date),
      description: String(raw.Description ?? ""),
    };
  }

  const standardSortKey = (s) => `${s.date || "9999-99-99"}|${s.code}`;

  function normalizeAssignment(raw, standards) {
    const scoreDisplay = String(raw.ScoreDisplay ?? "");
    const [points, possible] = parsePoints(scoreDisplay);
    standards = [...standards].sort((a, b) => standardSortKey(a).localeCompare(standardSortKey(b)));
    return {
      id: raw.GradebookID,
      name: String(raw.Measure ?? ""),
      description: String(raw.MeasureDescription ?? ""),
      type: String(raw.MeasureType ?? ""),
      dateAssigned: parseDate(raw.DateAssigned),
      dateDue: parseDate(raw.DateDue),
      scoreDisplay,
      points,
      pointsPossible: possible,
      isGraded: points !== null || standards.some((s) => s.mark) || looksLikeScore(scoreDisplay),
      missing: !!raw.IsGradebookMissingMark,
      excused: !!raw.Excused,
      dropped: !!raw.Dropped,
      notes: String(raw.Notes ?? ""),
      teacherComment: optText(raw.GradeBookComment),
      standards,
    };
  }

  // -- email the teacher -----------------------------------------------------------

  /** 'Student - Class - Period N'; whatever is missing is left out. */
  function emailSubject(studentName, classTitle, period) {
    const p = optText(period);
    return [optText(studentName), optText(classTitle), p ? `Period ${p}` : null].filter(Boolean).join(" - ");
  }

  /** A mailto: link to one plain address, or '' when the portal's value isn't one (no extra fields, no lists). */
  function mailtoHref(email, subject) {
    const to = optText(email);
    if (!to || !/^[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(to)) return "";
    return `mailto:${to}?subject=${encodeURIComponent(subject)}`;
  }

  const dueSort = (a, b) =>
    (a.dateDue || "9999-99-99").localeCompare(b.dateDue || "9999-99-99") || a.name.localeCompare(b.name);

  function normalizeClass(raw) {
    const title = String(raw.CourseTitle || raw.SectionTitle || "");
    const ids = new Set((raw.Assignments || []).map((a) => a.GradebookID));
    const byAssignment = new Map();
    for (const s of raw.Standards || []) {
      const aid = (s.Assignment || {}).Id;
      if (aid !== null && aid !== undefined && ids.has(aid)) {
        if (!byAssignment.has(aid)) byAssignment.set(aid, []);
        byAssignment.get(aid).push(normalizeStandard(s));
      }
    }
    const assignments = (raw.Assignments || [])
      .map((a) => normalizeAssignment(a, byAssignment.get(a.GradebookID) || []))
      .sort(dueSort);
    const m = /(\d+)\s+Missing/i.exec(String(raw.MissingAssignmentsColumn || ""));
    return {
      courseId: raw.CourseID,
      title,
      period: optText(raw.Period),
      room: optText(raw.Room),
      teacher: optText(raw.Teacher),
      teacherEmail: optText(raw.TeacherEmail),
      overallMark: cleanMark(raw.PointsColumn),
      overallScore: parseFloatOrNull(raw.PercentageColumn),
      missingCount: m ? Number(m[1]) : null,
      assignments,
    };
  }

  /** Each class appears as a header row (MarkPeriod null) and a data row. Keep the data rows. */
  function selectClassRows(rows) {
    const data = rows.filter((c) => c.MarkPeriod);
    if (data.length || !rows.length) return data;
    const best = new Map();
    for (const c of rows) {
      const key = c.CourseID || c.SectionTitle;
      if (!best.has(key) || (c.Assignments || []).length > (best.get(key).Assignments || []).length) best.set(key, c);
    }
    return [...best.values()];
  }

  /** getSchool returns {SchoolInfo}; get returns {SchoolGradingGroups:[{SchoolInfo}]}. */
  function schoolInfoOf(rawPeriod) {
    if (rawPeriod && rawPeriod.SchoolInfo) return rawPeriod.SchoolInfo;
    const groups = (rawPeriod && rawPeriod.SchoolGradingGroups) || [];
    return (groups[0] && groups[0].SchoolInfo) || {};
  }

  function periodSort(p) {
    const n = /^\d+$/.test(p || "") ? Number(p) : 99;
    return n;
  }

  function normalizePeriod(meta, rawPeriod) {
    const classes = selectClassRows(schoolInfoOf(rawPeriod).SchoolClasses || []).map(normalizeClass);
    classes.sort((a, b) => periodSort(a.period) - periodSort(b.period) || a.title.localeCompare(b.title));
    return {
      name: String(meta.PeriodName ?? ""),
      gu: meta.GradingPeriodGU,
      hasData: classes.some((c) => c.assignments.length || c.overallMark),
      classes,
    };
  }

  // -- terms and the Grading + Progress merge ----------------------------------------

  /**
   * The term a grading period belongs to: 'Q1 Grading' and 'Q1 Progress' are both 'Q1'. Other districts name
   * periods differently ('Semester 1 Grading', 'Term 1'): drop a trailing Grading/Progress word and use the rest.
   * @param {string|null|undefined} periodName
   * @returns {string|null}
   */
  function termOf(periodName) {
    const name = String(periodName ?? "").trim();
    if (!name) return null;
    const quarter = /^(Q\d+)\b/i.exec(name);
    if (quarter) return quarter[1].toUpperCase();
    return name.replace(/\s*[-:]?\s*\b(Grading|Progress)\s*$/i, "").trim() || name;
  }

  /** The primary period's assignments plus any only the other period has (tagged `onlyIn`). Primary wins. */
  function mergeClass(primary, other, otherName) {
    const base = primary || other;
    const seen = new Set(((primary && primary.assignments) || []).map((a) => a.id));
    let assignments = [...((primary && primary.assignments) || [])];
    if (!primary) assignments = other.assignments.map((a) => ({ ...a, onlyIn: otherName }));
    else if (other)
      assignments.push(...other.assignments.filter((a) => !seen.has(a.id)).map((a) => ({ ...a, onlyIn: otherName })));
    return { ...base, assignments };
  }

  /**
   * Each class once for the term. The primary period (the one named Grading, else the first) wins; every other
   * period in the term adds the assignments the primary lacks, tagged with that period's own name.
   */
  function termClasses(periods, term) {
    const inTerm = periods.filter((p) => termOf(p.name) === term && p.hasData);
    if (!inTerm.length) return [];
    const primary = inTerm.find((p) => /grading/i.test(p.name)) || inTerm[0];
    const key = (c) => c.courseId || c.title;
    const byClass = new Map(primary.classes.map((c) => [key(c), c]));
    for (const other of inTerm) {
      if (other === primary) continue;
      for (const c of other.classes) byClass.set(key(c), mergeClass(byClass.get(key(c)) || null, c, other.name));
    }
    return [...byClass.values()].sort(
      (a, b) => periodSort(a.period) - periodSort(b.period) || a.title.localeCompare(b.title),
    );
  }

  // -- status and flags -----------------------------------------------------------

  /**
   * ParentVUE decides. Order matters: excused/dropped, then the portal's missing flag, then graded;
   * ungraded work is "Not graded" once past due and "Not due yet" otherwise (or when undated).
   */
  function statusOf(a, today) {
    if (a.excused) return "Excused";
    if (a.dropped) return "Dropped";
    if (a.missing) return "Missing";
    if (a.isGraded) return "Graded";
    if (a.dateDue && a.dateDue < today) return "Not graded";
    return "Not due yet";
  }

  const belowPrStandards = (a) => a.standards.filter((s) => markTone(s.mark) === "low");

  /** Status plus the flags the view highlights: needs attention (red), due soon (amber), below proficient (lavender). */
  function assess(a, today) {
    const status = statusOf(a, today);
    const days = a.dateDue ? daysBetween(today, a.dateDue) : null;
    const attention = status === "Missing" || status === "Not graded";
    const dueSoon = status === "Not due yet" && days !== null && days >= 0 && days <= SOON_DAYS;
    const below = belowPrStandards(a);
    return {
      status,
      daysUntilDue: days,
      attention,
      dueSoon,
      belowPr: below.length > 0,
      belowPrCodes: below.map((s) => s.code),
    };
  }

  function scoreText(a) {
    if (a.points !== null && a.pointsPossible !== null)
      return `${+a.points.toFixed(2)}/${+a.pointsPossible.toFixed(2)}`;
    const shown = (a.scoreDisplay || "").trim();
    // Placeholders the portal shows when there's no score; the status already says it.
    return /^(see standards|not graded|not due)/i.test(shown) ? "" : shown;
  }

  function overallText(c) {
    if (!c.overallMark && c.overallScore === null) return "";
    return [c.overallMark, c.overallScore !== null ? `(${+c.overallScore.toFixed(2)})` : ""].filter(Boolean).join(" ");
  }

  /** The distinct assignment types in the data (Formative, Summative, ...), sorted. */
  function assignmentTypes(classes) {
    return [...new Set(classes.flatMap((c) => c.assignments.map((a) => a.type).filter(Boolean)))].sort();
  }

  /** Keep only assignments of `type` ('all' or empty keeps everything). */
  function filterByType(classes, type) {
    if (!type || type === "all") return classes;
    return classes.map((c) => ({ ...c, assignments: c.assignments.filter((a) => a.type === type) }));
  }

  /** Decorate classes for display: every assignment gets `.view` (assess) and each class gets summary counts. */
  function annotate(classes, today) {
    return classes.map((c) => {
      const assignments = c.assignments.map((a) => ({ ...a, view: assess(a, today), scoreText: scoreText(a) }));
      const count = (f) => assignments.filter(f).length;
      return {
        ...c,
        overallText: overallText(c),
        assignments,
        counts: {
          total: assignments.length,
          missing: count((a) => a.view.status === "Missing"),
          notGraded: count((a) => a.view.status === "Not graded"),
          dueSoon: count((a) => a.view.dueSoon),
          belowPr: count((a) => a.view.belowPr),
        },
      };
    });
  }

  function totals(classes) {
    const sum = (k) => classes.reduce((n, c) => n + c.counts[k], 0);
    return {
      total: sum("total"),
      missing: sum("missing"),
      notGraded: sum("notGraded"),
      dueSoon: sum("dueSoon"),
      belowPr: sum("belowPr"),
    };
  }

  return {
    BELOW_PR_MARKS,
    SOON_DAYS,
    MARK_LEGEND,
    markKey,
    markTone,
    markMeaning,
    parseDate,
    parsePoints,
    todayIso,
    daysBetween,
    emailSubject,
    mailtoHref,
    normalizeClass,
    normalizePeriod,
    selectClassRows,
    schoolInfoOf,
    termOf,
    mergeClass,
    termClasses,
    statusOf,
    assess,
    scoreText,
    overallText,
    assignmentTypes,
    filterByType,
    annotate,
    totals,
  };
});
