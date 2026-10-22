"use strict";
// Runs every test module under Node: `npm test`.
const fs = require("node:fs");
const path = require("node:path");
const harness = require("./harness.js");

const root = path.join(__dirname, "..");
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8"));

const ctx = {
  root,
  L: require("../extension/logic.js"),
  P: require("../extension/portal.js"),
  UI: require("../extension/ui.js"),
  F: {
    q1_grading: fixture("q1_grading.json"),
    q1_progress: fixture("q1_progress.json"),
    q2_progress: fixture("q2_progress.json"),
  },
};

const modules = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.js"))
  .sort()
  .map((f) => require(path.join(__dirname, f)));

const results = harness.run(modules, ctx);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : "\n" + r.error}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
