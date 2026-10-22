/*
 * Pure helpers for recognizing ParentVUE (Edupoint Synergy "PXP2") pages and for deciding which site to ask
 * the parent to approve. No DOM, no Chrome APIs, so it runs in the popup, the service worker, the content
 * script and the Node tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PVPortal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /** The scripts injected into an approved site, in load order (each relies on the ones before it). */
  const CONTENT_SCRIPT_FILES = ["portal.js", "logic.js", "ui.js", "content.js"];

  /** Pages on a ParentVUE site: `/PXP2_<anything>` (login, gradebook, ...) and the home page. Any letter case. */
  function isParentVuePath(pathname) {
    return /^\/(?:PXP2_[\w.]+|Home_PXP2\.aspx)$/i.test(String(pathname ?? ""));
  }

  /** The gradebook page. The portal writes it both `PXP2_GradeBook.aspx` and `PXP2_Gradebook.aspx`. */
  function isGradebookPath(pathname) {
    return /^\/PXP2_Gradebook\.aspx$/i.test(String(pathname ?? ""));
  }

  function parseUrl(url) {
    try {
      return new URL(String(url));
    } catch {
      return null;
    }
  }

  /** `https://host[:port]/*` for an https URL; null for anything else (http, chrome://, junk). */
  function originPatternOf(url) {
    const u = url ? parseUrl(url) : null;
    return u && u.protocol === "https:" ? `https://${u.host}/*` : null;
  }

  /** The id a site's registered content script is stored under. */
  function scriptIdOf(pattern) {
    return `pvbetter:${pattern}`;
  }

  /**
   * What the popup should offer for the page the parent is on.
   * @param {string|undefined} url  the active tab's address
   * @param {boolean} enabled  whether the parent already approved this site
   * @returns {{kind: "unsupported"|"enable"|"enabled", host: string|null, pattern: string|null}}
   */
  function describePage(url, enabled) {
    const pattern = originPatternOf(url);
    const u = pattern ? parseUrl(url) : null;
    if (!pattern || !u || !isParentVuePath(u.pathname)) return { kind: "unsupported", host: null, pattern: null };
    return { kind: enabled ? "enabled" : "enable", host: u.host, pattern };
  }

  return { CONTENT_SCRIPT_FILES, isParentVuePath, isGradebookPath, originPatternOf, scriptIdOf, describePage };
});
