/*
 * The release zip (Node only): manifest.json at the top level, everything the manifest and the injected
 * scripts need, and nothing from tests, docs or tooling.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { unzipSync } = require("fflate");
const { eq } = require("./harness.js");

const root = path.join(__dirname, "..");
const extDir = path.join(root, "extension");
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, "manifest.json"), "utf8"));

const tests = [
  [
    "package: zip is named from the manifest version and has manifest.json at its top level",
    () => {
      const { buildZip } = require("../scripts/package.mjs");
      const zip = buildZip(extDir);
      eq(zip.name, `parentvue-better-assignment-view-${manifest.version}.zip`);
      eq(zip.entries[0], "manifest.json");
      const files = unzipSync(zip.bytes);
      eq(JSON.parse(Buffer.from(files["manifest.json"]).toString("utf8")).version, manifest.version);
      eq(Object.keys(files).sort(), [...zip.entries].sort());
    },
  ],
  [
    "package: zip holds every file the extension needs and nothing else",
    () => {
      const { buildZip } = require("../scripts/package.mjs");
      const { CONTENT_SCRIPT_FILES } = require("../extension/portal.js");
      const { entries } = buildZip(extDir);
      const needed = [
        "manifest.json",
        manifest.background.service_worker,
        manifest.action.default_popup,
        "popup.js",
        "popup.css",
        ...CONTENT_SCRIPT_FILES,
        ...Object.values(manifest.icons),
      ];
      for (const f of needed) eq(entries.includes(f), true, f);
      for (const e of entries) {
        eq(/^(test|docs|scripts|node_modules|dist|\.github)\//.test(e), false, e);
        eq(e.startsWith("."), false, e);
      }
    },
  ],
];

module.exports = { tests, nodeOnly: true };
