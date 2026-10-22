/*
 * Tests for the pure helpers exported by ui.js (HTML escaping, focus wrapping, stale-response guard).
 * The overlay's DOM is checked in the browser via test/preview.html.
 */
(function (root) {
  const { eq } = typeof module === "object" ? require("./harness.js") : root.PVHarness;

  const tests = [
    [
      "esc turns hostile text into inert text",
      ({ UI }) => {
        eq(UI.esc('<img src=x onerror="a()">&\''), "&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
        eq(UI.esc("Tom & Jerry's <b>"), "Tom &amp; Jerry&#39;s &lt;b&gt;");
        eq(UI.esc(null), "");
        eq(UI.esc(undefined), "");
        eq(UI.esc(42), "42");
      },
    ],
    [
      "wrapFocusIndex cycles forwards and backwards",
      ({ UI }) => {
        eq(UI.wrapFocusIndex(2, 3, false), 0);
        eq(UI.wrapFocusIndex(0, 3, true), 2);
        eq(UI.wrapFocusIndex(1, 3, false), 2);
        eq(UI.wrapFocusIndex(1, 3, true), 0);
        eq(UI.wrapFocusIndex(0, 0, false), 0);
      },
    ],
    [
      "createLatestGuard only treats the newest request as current",
      ({ UI }) => {
        const g = UI.createLatestGuard();
        const a = g.next();
        eq(g.isCurrent(a), true);
        const b = g.next();
        eq(g.isCurrent(a), false);
        eq(g.isCurrent(b), true);
      },
    ],
  ];

  const api = { tests };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.PVTestModules = root.PVTestModules || []).push(api);
})(typeof globalThis !== "undefined" ? globalThis : this);
