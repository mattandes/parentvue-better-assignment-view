/*
 * Invariants of extension/manifest.json (Node only). These guard the permission model: the install prompt
 * must not ask for site access, and access is requested per site from the popup.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { eq } = require("./harness.js");

const extDir = path.join(__dirname, "..", "extension");
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, "manifest.json"), "utf8"));
const exists = (rel) => fs.existsSync(path.join(extDir, rel));
const pngSize = (rel) => {
  const b = fs.readFileSync(path.join(extDir, rel));
  const signature = b.subarray(0, 8).toString("hex");
  return { signature, width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

const tests = [
  [
    "manifest: name, version and manifest version",
    () => {
      eq(manifest.name, "ParentVUE: Better assignment view");
      eq(manifest.manifest_version, 3);
      eq(/^\d+\.\d+\.\d+$/.test(manifest.version), true, "semver version");
      eq(manifest.description.length > 0 && manifest.description.length <= 132, true, "description 1..132 chars");
    },
  ],
  [
    "manifest: no site access at install time",
    () => {
      eq("content_scripts" in manifest, false, "no static content_scripts");
      eq("host_permissions" in manifest, false, "no required host_permissions");
      eq(manifest.permissions, ["activeTab", "scripting", "storage"]);
      eq(manifest.optional_host_permissions, ["https://*/*"]);
    },
  ],
  [
    "manifest: content security policy and minimum Chrome version",
    () => {
      eq(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
      eq(/^\d+$/.test(manifest.minimum_chrome_version) && Number(manifest.minimum_chrome_version) >= 96, true);
    },
  ],
  [
    "manifest: service worker, popup and icons exist",
    () => {
      eq(manifest.background.service_worker, "background.js");
      eq(manifest.background.type, "module");
      eq(exists(manifest.background.service_worker), true);
      eq(exists(manifest.action.default_popup), true);
      for (const size of [16, 32, 48, 128]) {
        const rel = manifest.icons[String(size)];
        eq(exists(rel), true, rel);
        eq(pngSize(rel), { signature: "89504e470d0a1a0a", width: size, height: size }, rel);
        eq(manifest.action.default_icon[String(size)], rel, "action icon " + size);
      }
    },
  ],
  [
    "manifest: every injected script exists",
    () => {
      const { CONTENT_SCRIPT_FILES } = require("../extension/portal.js");
      for (const f of CONTENT_SCRIPT_FILES) eq(exists(f), true, f);
    },
  ],
];

module.exports = { tests, nodeOnly: true };
