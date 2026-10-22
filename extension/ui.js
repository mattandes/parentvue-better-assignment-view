/*
 * The full-page overlay. Renders annotated classes (see logic.js) inside a shadow root so ParentVUE's
 * own styles can't leak in and ours can't leak out. No network here: the caller supplies `loadTerm`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PVBetterUI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  --bg: #f4f5f7; --card: #fff; --ink: #1c2330; --muted: #667085; --line: #e3e6ec;
  --accent: #2557d6; --accent-ink: #fff;
  --red: #c62828; --red-bg: #fdecec; --amber: #8a5a00; --amber-bg: #fff4d6;
  --green: #1b7a43; --green-bg: #e6f5ec; --lav: #5b3fb0; --lav-bg: #efeafc; --grey-bg: #eef0f4;
  position: fixed; inset: 0; z-index: 2147483647; overflow: auto; background: var(--bg); color: var(--ink);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.root[data-theme="dark"] {
  --bg: #12151b; --card: #1b2029; --ink: #e8ebf1; --muted: #98a1b3; --line: #2b3240;
  --accent: #6c93ff; --accent-ink: #0d1424;
  --red: #ff8a80; --red-bg: #3a1e1f; --amber: #ffd27a; --amber-bg: #3a2f14;
  --green: #7fd8a0; --green-bg: #17301f; --lav: #c0adff; --lav-bg: #2a2342; --grey-bg: #262c38;
  color-scheme: dark;
}
.root[data-theme="light"] { color-scheme: light; }
.overall.good { background: var(--green-bg); color: var(--green); }
.overall.low { background: var(--lav-bg); color: var(--lav); }
select { font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; }
label.field { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.legend-box { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-top: 20px; scroll-margin-top: 110px; }
.legend-box h2 { font-size: 14px; margin: 0 0 10px; }
.legend-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; }
.legend-cols h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 0 0 6px; }
.legend-item { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
.legend-item .mark { min-width: 34px; text-align: center; cursor: default; }
.legend-item .swatch { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
.root:focus { outline: none; }
.bar { position: sticky; top: 0; z-index: 2; background: var(--card); border-bottom: 1px solid var(--line); padding: 12px 20px; }
.bar-row { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center; max-width: 1180px; margin: 0 auto; }
.bar-row + .bar-row { margin-top: 10px; }
h1 { font-size: 18px; margin: 0; font-weight: 650; }
.sub { color: var(--muted); font-size: 12px; }
.grow { flex: 1; }
button { font: inherit; color: inherit; cursor: pointer; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.seg button { border: 0; background: none; padding: 5px 12px; }
.seg button + button { border-left: 1px solid var(--line); }
.seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); font-weight: 600; }
.chip { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 4px 11px; }
.chip[aria-pressed="true"] { border-color: var(--accent); background: var(--accent); color: var(--accent-ink); }
.chip .n { opacity: .75; margin-left: 4px; font-variant-numeric: tabular-nums; }
.tool { border: 1px solid var(--line); background: var(--card); border-radius: 8px; padding: 5px 11px; }
.close { font-size: 18px; line-height: 1; padding: 4px 10px; }
input[type=search] { font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 5px 10px; min-width: 200px; }
main { max-width: 1180px; margin: 0 auto; padding: 16px 20px 48px; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; }
.stat b { display: block; font-size: 24px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.stat span { color: var(--muted); font-size: 12px; }
.stat.red b { color: var(--red); } .stat.amber b { color: var(--amber); } .stat.lav b { color: var(--lav); }
.stat.zero b { color: var(--muted); }
details.class { background: var(--card); border: 1px solid var(--line); border-radius: 12px; margin-bottom: 14px; overflow: hidden; }
details.class > summary { list-style: none; cursor: pointer; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 12px 16px; }
details.class > summary::-webkit-details-marker { display: none; }
details.class > summary::before { content: "▸"; color: var(--muted); }
details.class[open] > summary::before { content: "▾"; }
.cls-title { font-weight: 650; font-size: 15px; }
.cls-meta { color: var(--muted); font-size: 12px; }
.mail { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 24px; border: 1px solid var(--muted); border-radius: 8px; background: var(--card); color: var(--ink); }
.mail:hover { background: var(--grey-bg); }
.mail svg { width: 15px; height: 15px; }
.overall { font-weight: 700; padding: 2px 10px; border-radius: 999px; background: var(--grey-bg); }
.pills { display: flex; gap: 6px; flex-wrap: wrap; }
.pill { font-size: 12px; padding: 1px 8px; border-radius: 999px; white-space: nowrap; background: var(--grey-bg); color: var(--muted); }
.pill.red { background: var(--red-bg); color: var(--red); font-weight: 600; }
.pill.amber { background: var(--amber-bg); color: var(--amber); font-weight: 600; }
.pill.green { background: var(--green-bg); color: var(--green); }
.pill.lav { background: var(--lav-bg); color: var(--lav); font-weight: 600; }
.rows { border-top: 1px solid var(--line); }
.row { display: grid; grid-template-columns: minmax(180px, 2.2fr) 84px 130px 70px minmax(150px, 2fr) 120px; gap: 4px 14px; padding: 9px 16px; align-items: start; border-bottom: 1px solid var(--line); }
.row:last-child { border-bottom: 0; }
.row.head { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding-top: 7px; padding-bottom: 7px; }
.row.attention { background: var(--red-bg); box-shadow: inset 3px 0 0 var(--red); }
.row.soon { background: var(--amber-bg); box-shadow: inset 3px 0 0 var(--amber); }
.row.dim { color: var(--muted); }
.name { font-weight: 550; overflow-wrap: anywhere; }
.comment { color: var(--muted); font-size: 12px; font-style: italic; margin-top: 2px; }
.only { color: var(--muted); font-size: 11px; }
.due small { display: block; color: var(--muted); font-size: 11px; }
.marks { display: flex; flex-wrap: wrap; gap: 4px; }
.mark { font-size: 12px; border-radius: 6px; padding: 1px 6px; background: var(--grey-bg); white-space: nowrap; cursor: help; }
.mark b { font-weight: 700; margin-left: 3px; }
.mark.good b { color: var(--green); }
.mark.low b { color: var(--lav); }
.empty { text-align: center; color: var(--muted); padding: 48px 16px; }
.err { background: var(--red-bg); color: var(--red); border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
@media (max-width: 820px) {
  .row { grid-template-columns: 1fr 1fr; }
  .row.head { display: none; }
  .row > :first-child { grid-column: 1 / -1; }
  .marks { grid-column: 1 / -1; }
}
`;

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );

  const MAIL_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';

  // Shown under the filters once data has loaded: Refresh reuses the same session, so it can't clear stale grades.
  const STALE_HINT = "Not seeing a recent grade? Sign out of ParentVUE and back in, then reopen this view.";

  /** Index of the next (or previous) focusable control, wrapping at the ends; used to keep Tab inside the dialog. */
  function wrapFocusIndex(index, count, backwards) {
    if (count <= 0) return 0;
    return (index + (backwards ? -1 : 1) + count) % count;
  }

  /** Hands out tokens; only the newest one is current, so a late response from an earlier request can be ignored. */
  function createLatestGuard() {
    let latest = 0;
    return {
      next: () => ++latest,
      isCurrent: (token) => token === latest,
    };
  }

  const FILTERS = [
    ["all", "All", () => true],
    ["attention", "Needs attention", (a) => a.view.attention],
    ["soon", "Due soon", (a) => a.view.dueSoon],
    ["below", "Below proficient", (a) => a.view.belowPr],
  ];

  function fmtDue(iso) {
    if (!iso) return "No due date";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function relDue(days) {
    if (days === null) return "";
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    return days > 0 ? `in ${days} days` : `${-days} days ago`;
  }

  function statusPill(a) {
    const s = a.view.status;
    const cls = a.view.attention ? "red" : a.view.dueSoon ? "amber" : s === "Graded" ? "green" : "";
    return `<span class="pill ${cls}">${a.view.dueSoon ? "Due soon" : esc(s)}</span>`;
  }

  function marksHtml(a, logic) {
    const marks = a.standards.filter((s) => s.mark);
    if (!marks.length) return '<span class="sub">—</span>';
    return marks
      .map((s) => {
        const meaning = logic.markMeaning(s.mark);
        const tip = `${s.code}${s.description ? " — " + s.description : ""}${meaning ? `\n${s.mark}: ${meaning}` : ""}`;
        return `<span class="mark ${logic.markTone(s.mark)}" title="${esc(tip)}">${esc(s.code)}<b>${esc(s.mark)}</b></span>`;
      })
      .join("");
  }

  function legendHtml(logic) {
    const items = (list) =>
      list
        .map(
          ([m, d]) =>
            `<div class="legend-item"><span class="mark ${logic.markTone(m)}"><b style="margin:0">${esc(m)}</b></span>${esc(d)}</div>`,
        )
        .join("");
    const sw = (color, text) =>
      `<div class="legend-item"><span class="swatch" style="background:${color}"></span>${text}</div>`;
    return `<section class="legend-box" id="legend"><h2>Legend</h2><div class="legend-cols">
      <div><h3>Standards marks</h3>${items(logic.MARK_LEGEND.standards)}</div>
      <div><h3>Traits of Learners</h3>${items(logic.MARK_LEGEND.traits)}</div>
      <div><h3>Highlights</h3>
        ${sw("var(--red)", "Missing, or past due and not graded")}
        ${sw("var(--amber)", `Not graded yet, due within ${logic.SOON_DAYS} days`)}
        ${sw("var(--lav)", "Below proficient (CP, DP, NS)")}
        ${sw("var(--green)", "Proficient or better (PR, HP)")}</div>
    </div><p class="sub" style="margin:10px 0 0">Grades come from ParentVUE as shown there; this view only reorganizes them.</p></section>`;
  }

  function rowHtml(a, logic) {
    const due = fmtDue(a.dateDue);
    const rel = a.view.status === "Graded" ? "" : relDue(a.view.daysUntilDue);
    const cls = a.view.attention
      ? "attention"
      : a.view.dueSoon
        ? "soon"
        : ["Excused", "Dropped"].includes(a.view.status)
          ? "dim"
          : "";
    return `<div class="row ${cls}">
      <div><div class="name">${esc(a.name)}</div>
        ${a.teacherComment ? `<div class="comment">“${esc(a.teacherComment)}”</div>` : ""}
        ${a.onlyIn ? `<div class="only">Only in ${esc(a.onlyIn)}</div>` : ""}</div>
      <div>${a.type ? `<span class="pill">${esc(a.type)}</span>` : ""}</div>
      <div class="due">${esc(due)}${rel ? `<small>${esc(rel)}</small>` : ""}</div>
      <div>${esc(a.scoreText)}</div>
      <div class="marks">${marksHtml(a, logic)}</div>
      <div>${statusPill(a)}</div>
    </div>`;
  }

  function classHtml(c, rows, state, logic, studentName) {
    const k = c.counts;
    const pills = [
      k.missing ? `<span class="pill red">${k.missing} missing</span>` : "",
      k.notGraded ? `<span class="pill red">${k.notGraded} not graded</span>` : "",
      k.dueSoon ? `<span class="pill amber">${k.dueSoon} due soon</span>` : "",
      k.belowPr ? `<span class="pill lav">${k.belowPr} below proficient</span>` : "",
      `<span class="pill">${k.total} assignments</span>`,
    ].join("");
    const mailto = logic.mailtoHref(c.teacherEmail, logic.emailSubject(studentName, c.title, c.period));
    const meta = [c.period ? `Period ${esc(c.period)}` : "", c.teacher ? esc(c.teacher) : ""]
      .filter(Boolean)
      .join(" · ");
    const mailBtn = mailto
      ? `<a class="mail" href="${esc(mailto)}" title="Email teacher" aria-label="Email teacher">${MAIL_ICON}</a>`
      : "";
    return `<details class="class" data-key="${esc(c.courseId ?? c.title)}" ${state.collapsed.has(String(c.courseId ?? c.title)) ? "" : "open"}>
      <summary><span class="cls-title">${esc(c.title)}</span>
        ${c.overallText ? `<span class="overall ${logic.markTone(c.overallMark)}" title="Overall mark${logic.markMeaning(c.overallMark) ? ": " + esc(logic.markMeaning(c.overallMark)) : ""}">${esc(c.overallText)}</span>` : ""}
        <span class="cls-meta">${meta}</span>${mailBtn}<span class="grow"></span><span class="pills">${pills}</span></summary>
      <div class="rows">
        <div class="row head"><div>Assignment</div><div>Type</div><div>Due</div><div>Score</div><div>Standards</div><div>Status</div></div>
        ${rows.map((a) => rowHtml(a, logic)).join("")}
      </div></details>`;
  }

  /** The saved theme if it is valid, otherwise the OS preference. */
  function initialTheme(saved) {
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /**
   * @param {object} options
   * @param {object} options.logic  the PVBetter namespace
   * @param {string[]} options.terms  picker entries, e.g. ["Q1", "Q2"]
   * @param {string} [options.currentTerm]
   * @param {(term: string, force: boolean) => Promise<object[]>} options.loadTerm
   * @param {() => void} [options.onClose]
   * @param {string|null} [options.studentName]
   * @param {"light"|"dark"|null} [options.theme]  saved choice; null follows the OS
   * @param {(theme: "light"|"dark") => void} [options.onThemeChange]
   */
  function create({ logic, terms, currentTerm, loadTerm, onClose, studentName, theme, onThemeChange }) {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const latest = createLatestGuard();
    const state = {
      term: currentTerm || terms[0],
      filter: "all",
      query: "",
      type: "all",
      newestFirst: false,
      collapsed: new Set(),
      data: null,
      error: "",
      theme: initialTheme(theme),
    };

    // Static markup; the only interpolations are the CSS constant, the validated theme and esc()'d student name.
    // eslint-disable-next-line no-unsanitized/property
    shadow.innerHTML = `<style>${CSS}</style>
      <div class="root" role="dialog" aria-modal="true" aria-label="ParentVUE: Better assignment view" tabindex="-1" data-theme="${state.theme}">
        <div class="bar">
          <div class="bar-row">
            <h1>${studentName ? `Assignments for ${esc(studentName)}` : "Assignments"}</h1>
            <div class="seg" id="terms"></div>
            <span class="grow"></span>
            <span class="sub" id="asof"></span>
            <button class="tool" id="legendbtn">Legend</button>
            <button class="tool" id="theme"></button>
            <button class="tool" id="refresh">Refresh</button>
            <button class="tool close" id="close" aria-label="Close" title="Close (Esc)">✕</button>
          </div>
          <div class="bar-row">
            <div id="filters" class="pills"></div>
            <label class="field">Type <select id="type"><option value="all">All types</option></select></label>
            <span class="grow"></span>
            <input type="search" id="q" placeholder="Search assignments" aria-label="Search assignments" />
            <label class="field">Sort by due date
              <select id="sort"><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select>
            </label>
            <button class="tool" id="fold">Collapse all</button>
          </div>
          <div class="bar-row"><span class="sub" id="stale"></span></div>
        </div>
        <main id="main"></main>
      </div>`;
    const $ = (id) => shadow.getElementById(id);

    function visibleRows(c) {
      const f = FILTERS.find((x) => x[0] === state.filter)[2];
      const q = state.query.trim().toLowerCase();
      let rows = c.assignments.filter(f);
      if (q) {
        rows = rows.filter((a) => a.name.toLowerCase().includes(q));
      }
      const asc = (a, b) =>
        (a.dateDue || "9999-99-99").localeCompare(b.dateDue || "9999-99-99") || a.name.localeCompare(b.name);
      return rows.sort(state.newestFirst ? (a, b) => asc(b, a) : asc);
    }

    function render() {
      // Every portal-supplied value goes through esc() (as below).
      // eslint-disable-next-line no-unsanitized/property
      $("terms").innerHTML = terms
        .map((t) => `<button data-t="${esc(t)}" aria-pressed="${t === state.term}">${esc(t)}</button>`)
        .join("");
      $("sort").value = state.newestFirst ? "newest" : "oldest";
      $("theme").textContent = state.theme === "dark" ? "Light mode" : "Dark mode";
      shadow.querySelector(".root").dataset.theme = state.theme;
      const d = state.data;
      $("asof").textContent = d
        ? `As of ${new Date(d.loadedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "";
      $("stale").textContent = d ? STALE_HINT : "";
      const main = $("main");
      if (state.error) {
        main.innerHTML = `<div class="err">${esc(state.error)}</div>`;
        $("filters").innerHTML = "";
        return;
      }
      if (!d) {
        main.innerHTML = '<div class="empty">Loading…</div>';
        $("filters").innerHTML = "";
        return;
      }

      // Types come from the data; the Type filter narrows everything (tiles, chip counts, class cards).
      const types = logic.assignmentTypes(d.raw);
      if (state.type !== "all" && !types.includes(state.type)) state.type = "all";
      // eslint-disable-next-line no-unsanitized/property
      $("type").innerHTML = [
        '<option value="all">All types</option>',
        ...types.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`),
      ].join("");
      $("type").value = state.type;
      const view = logic.annotate(logic.filterByType(d.raw, state.type), d.today);
      const viewTotals = logic.totals(view);

      const all = view.flatMap((c) => c.assignments);
      // Labels and ids are constants from FILTERS; the rest are numbers.
      // eslint-disable-next-line no-unsanitized/property
      $("filters").innerHTML = FILTERS.map(
        ([id, label, fn]) =>
          `<button class="chip" data-f="${id}" aria-pressed="${state.filter === id}">${label}<span class="n">${all.filter(fn).length}</span></button>`,
      ).join("");

      const t = viewTotals;
      const stat = (n, label, tone) => `<div class="stat ${n ? tone : "zero"}"><b>${n}</b><span>${label}</span></div>`;
      const summary = `<div class="summary">${stat(t.missing, "Missing", "red")}${stat(t.notGraded, "Past due, not graded", "red")}${stat(t.dueSoon, `Due in the next ${logic.SOON_DAYS} days`, "amber")}${stat(t.belowPr, "Below proficient", "lav")}${stat(t.total, "Assignments", "")}</div>`;

      const cards = view
        .map((c) => ({ c, rows: visibleRows(c) }))
        .filter((x) => x.rows.length || (state.filter === "all" && state.type === "all" && !state.query.trim()))
        .map((x) => classHtml(x.c, x.rows, state, logic, studentName));
      const body = view.length
        ? cards.join("") || '<div class="empty">Nothing matches.</div>'
        : `<div class="empty">No classes or assignments in ${esc(state.term)} yet.</div>`;
      // summary, body and legendHtml are built from numbers, constants and esc()'d portal text (classHtml, rowHtml).
      // eslint-disable-next-line no-unsanitized/property
      main.innerHTML = summary + body + legendHtml(logic);
    }

    async function load(force) {
      const token = latest.next();
      state.error = "";
      state.data = null;
      render();
      let data = null;
      let error = "";
      try {
        const classes = await loadTerm(state.term, force);
        data = { raw: classes, today: logic.todayIso(), loadedAt: Date.now() };
      } catch (e) {
        error = e && e.message ? e.message : String(e);
      }
      if (!latest.isCurrent(token)) return; // a newer request has started; drop this late answer
      state.data = data;
      state.error = error;
      render();
    }

    shadow.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.t) {
        state.term = t.dataset.t;
        load(false);
      } else if (t.dataset.f) {
        state.filter = t.dataset.f;
        render();
      } else if (t.id === "refresh") load(true);
      else if (t.id === "close") api.close();
      else if (t.id === "theme") {
        state.theme = state.theme === "dark" ? "light" : "dark";
        if (onThemeChange) onThemeChange(state.theme);
        render();
      } else if (t.id === "legendbtn") {
        const l = $("legend");
        const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (l) l.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      } else if (t.id === "fold") {
        const els = [...shadow.querySelectorAll("details.class")];
        const anyOpen = els.some((d) => d.open);
        els.forEach((d) => {
          d.open = !anyOpen;
          if (anyOpen) state.collapsed.add(d.dataset.key);
          else state.collapsed.delete(d.dataset.key);
        });
        t.textContent = anyOpen ? "Expand all" : "Collapse all";
      }
    });
    shadow.addEventListener(
      "toggle",
      (e) => {
        const d = e.target;
        if (d.matches && d.matches("details.class")) {
          if (d.open) state.collapsed.delete(d.dataset.key);
          else state.collapsed.add(d.dataset.key);
        }
      },
      true,
    );
    $("q").addEventListener("input", (e) => {
      state.query = e.target.value;
      render();
    });
    $("type").addEventListener("change", (e) => {
      state.type = e.target.value;
      render();
    });
    $("sort").addEventListener("change", (e) => {
      state.newestFirst = e.target.value === "newest";
      render();
    });

    const focusables = () =>
      [...shadow.querySelectorAll("button, input, select, summary")].filter(
        (el) => !el.disabled && el.offsetParent !== null,
      );
    const onKey = (e) => {
      if (e.key === "Escape") {
        api.close();
      } else if (e.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const at = items.indexOf(shadow.activeElement);
        // Only intervene at the ends (or when focus is outside the dialog) so normal tabbing is untouched.
        if (at === -1 || (e.shiftKey && at === 0) || (!e.shiftKey && at === items.length - 1)) {
          e.preventDefault();
          items[at === -1 ? 0 : wrapFocusIndex(at, items.length, e.shiftKey)].focus();
        }
      }
    };
    let opened = false;
    let returnFocusTo = null;
    const api = {
      host,
      state,
      open() {
        if (opened) return;
        opened = true;
        returnFocusTo = document.activeElement;
        document.documentElement.appendChild(host);
        document.documentElement.style.overflow = "hidden";
        document.addEventListener("keydown", onKey, true);
        shadow.querySelector(".root").focus();
        load(false);
      },
      close() {
        if (!opened) return;
        opened = false;
        host.remove();
        document.documentElement.style.overflow = "";
        document.removeEventListener("keydown", onKey, true);
        if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
        if (onClose) onClose();
      },
    };
    return api;
  }

  return { create, esc, wrapFocusIndex, createLatestGuard };
});
