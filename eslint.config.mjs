import js from "@eslint/js";
import globals from "globals";
import noUnsanitized from "eslint-plugin-no-unsanitized";

const rules = {
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  eqeqeq: ["error", "always"],
  "no-var": "error",
  "prefer-const": "error",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-script-url": "error",
};

// Namespaces the extension's classic scripts share inside the extension's isolated world.
const namespaces = { PVBetter: "readonly", PVBetterUI: "readonly", PVPortal: "readonly" };

export default [
  { ignores: ["dist/", "node_modules/", ".superpowers/"] },
  js.configs.recommended,
  { rules },
  // Portal text reaches the page as HTML, so every innerHTML-style sink must be fed through an approved escaper.
  {
    files: ["extension/**/*.js"],
    plugins: { "no-unsanitized": noUnsanitized },
    rules: {
      "no-unsanitized/method": ["error", { escape: { methods: ["esc"] } }],
      "no-unsanitized/property": ["error", { escape: { methods: ["esc"] } }],
    },
  },
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, chrome: "readonly", module: "readonly", ...namespaces },
    },
  },
  {
    files: ["extension/background.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.serviceworker, chrome: "readonly", PVPortal: "readonly" },
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser, ...namespaces, PVHarness: "readonly", PVTestModules: "writable" },
    },
  },
  {
    files: ["scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { sourceType: "module", globals: globals.node },
  },
];
