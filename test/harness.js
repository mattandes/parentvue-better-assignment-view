/*
 * A tiny dependency-free test harness that runs the same test modules under Node (`npm test`) and in a
 * browser (`test/index.html`). A test module is `{ tests: [[name, fn(ctx)], ...], nodeOnly?: boolean }`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PVHarness = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /** Deep-equality by JSON, with a readable failure message. */
  function eq(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg || "not equal"}\n  expected ${e}\n  actual   ${a}`);
  }

  /** Run every test; modules marked `nodeOnly` are skipped unless `ctx.root` (the repo path) is set. */
  function run(modules, ctx) {
    const results = [];
    for (const mod of modules) {
      if (mod.nodeOnly && !ctx.root) continue;
      for (const [name, fn] of mod.tests) {
        try {
          fn(ctx);
          results.push({ name, ok: true });
        } catch (e) {
          results.push({ name, ok: false, error: e && e.message ? e.message : String(e) });
        }
      }
    }
    return results;
  }

  return { eq, run };
});
