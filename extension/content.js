/*
 * Runs on a ParentVUE site the parent has approved, and acts only on the gradebook page: it adds a button
 * that opens the overlay (ui.js). Data comes from the same internal endpoints the page itself calls
 * (docs/parentvue-api-notes.md), fetched same-origin with the visitor's existing session: no password
 * handling, and nothing leaves the browser.
 */
(function () {
  "use strict";
  const logic = globalThis.PVBetter;
  const portal = globalThis.PVPortal;
  const ui = globalThis.PVBetterUI;

  // The extension is registered for the whole approved site; only the gradebook page gets the button.
  if (!portal.isGradebookPath(location.pathname)) return;
  // Registering the scripts and injecting them into the open tab can both run; once is enough.
  if (globalThis.__pvBetterLoaded) return;
  globalThis.__pvBetterLoaded = true;

  const TRANSFER = "/api/GB/ClientSideData/Transfer";
  const TIMEOUT_MS = 20000;

  async function transfer(friendlyName, method, parameters) {
    const body = { FriendlyName: friendlyName, Method: method, Parameters: JSON.stringify(parameters) };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(`${TRANSFER}?action=${encodeURIComponent(`${friendlyName}-${method}`)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (/login/i.test(new URL(resp.url).pathname)) {
        throw new Error("Your ParentVUE session has expired. Reload the page and sign in again.");
      }
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("json")) {
        throw new Error(`ParentVUE returned something unexpected (HTTP ${resp.status}). It may have changed.`);
      }
      const data = await resp.json();
      if (!resp.ok) {
        const detail = typeof data === "string" ? data : JSON.stringify(data).slice(0, 200);
        throw new Error(`ParentVUE error (${friendlyName}-${method}): ${detail}`);
      }
      return data;
    } catch (e) {
      if (controller.signal.aborted) {
        throw new Error("ParentVUE took too long to respond. Try Refresh.", { cause: e });
      }
      if (e instanceof TypeError) {
        throw new Error("Could not reach ParentVUE. Check your connection and try Refresh.", { cause: e });
      }
      if (e instanceof SyntaxError) {
        throw new Error("ParentVUE returned something unexpected. It may have changed.", { cause: e });
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  let ctx = null; // { group, terms } once loaded
  const periodCache = new Map(); // grading period GU -> normalized period

  async function init() {
    if (ctx) return ctx;
    const def = await transfer("pxp.school.classes", "get", {});
    const group = (def.SchoolGradingGroups || [])[0];
    if (!group) throw new Error("ParentVUE returned no school for this student.");
    const terms = await transfer("pxp.term.selector", "get", {
      termData: {
        SchoolId: group.SchoolId,
        OrgYearGu: group.OrgYearGU,
        GradingPeriodGroup: group.GradingPeriodGroup || "Regular",
      },
    });
    ctx = { group, terms };
    return ctx;
  }

  async function loadPeriod(meta, force) {
    if (!force && periodCache.has(meta.GradingPeriodGU)) return periodCache.get(meta.GradingPeriodGU);
    const { group } = ctx;
    const groupName = group.GradingPeriodGroup || "Regular";
    const raw = await transfer("pxp.school.classes", "getSchool", {
      args: {
        SchoolId: group.SchoolId,
        OrgYearGu: group.OrgYearGU,
        GradingPeriodGroup: groupName,
        GradingPeriodGU: meta.GradingPeriodGU,
        schoolGradingGroup: {
          SchoolId: group.SchoolId,
          OrgYearGU: group.OrgYearGU,
          GradingPeriodGroup: groupName,
          GradingPeriodGU: null,
        },
      },
    });
    const period = logic.normalizePeriod(meta, raw);
    periodCache.set(meta.GradingPeriodGU, period);
    return period;
  }

  async function loadTerm(term, force) {
    await init();
    const metas = (ctx.terms.GradingPeriods || []).filter((p) => logic.termOf(p.PeriodName) === term);
    const periods = await Promise.all(metas.map((m) => loadPeriod(m, force)));
    return logic.termClasses(periods, term);
  }

  /** The page's own script sets `ST.SM_ChildName = '<first name>'` for the selected student. */
  function studentName() {
    for (const s of document.scripts) {
      const m = /ST\.SM_ChildName\s*=\s*'([^']*)'/.exec(s.textContent || "");
      if (m && m[1].trim()) return m[1].trim();
    }
    return null;
  }

  async function savedTheme() {
    try {
      const { theme } = await chrome.storage.local.get("theme");
      return theme === "light" || theme === "dark" ? theme : null;
    } catch {
      return null;
    }
  }

  function saveTheme(theme) {
    chrome.storage.local.set({ theme }).catch(() => {});
  }

  let overlay = null;
  async function open() {
    const theme = await savedTheme();
    const common = {
      logic,
      loadTerm,
      theme,
      onThemeChange: saveTheme,
      onClose: () => {
        overlay = null;
        periodCache.clear(); // closing discards the data, so reopening fetches fresh grades
      },
    };
    try {
      await init();
    } catch (e) {
      // Show the failure inside the overlay rather than silently doing nothing.
      overlay = ui.create({ ...common, terms: [], loadTerm: () => Promise.reject(e) });
      overlay.open();
      return;
    }
    const terms = [...new Set((ctx.terms.GradingPeriods || []).map((p) => logic.termOf(p.PeriodName)).filter(Boolean))];
    overlay = ui.create({
      ...common,
      terms,
      currentTerm: logic.termOf(ctx.terms.GradingPeriodDescription) || terms[0],
      studentName: studentName(),
    });
    overlay.open();
  }

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Better assignment view";
  button.title = "Show all classes' assignments in one clearer view";
  Object.assign(button.style, {
    position: "fixed",
    right: "20px",
    bottom: "84px", // clears the portal's footer bar
    zIndex: "2147483646",
    padding: "10px 16px",
    border: "0",
    borderRadius: "999px",
    background: "#2557d6",
    color: "#fff",
    font: "600 14px system-ui, sans-serif",
    boxShadow: "0 2px 10px rgba(0,0,0,.3)",
    cursor: "pointer",
  });
  button.addEventListener("click", () => {
    if (!overlay) open();
  });
  document.documentElement.appendChild(button);
})();
