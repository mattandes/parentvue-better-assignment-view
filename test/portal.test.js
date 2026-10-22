/*
 * Tests for portal.js: deciding whether a page is ParentVUE, whether it is the gradebook, and which
 * origin to request permission for.
 */
(function (root) {
  const { eq } = typeof module === "object" ? require("./harness.js") : root.PVHarness;

  const PORTLAND = "https://or-psd-psv.edupoint.com/PXP2_Login_Parent.aspx?regenerateSessionId=True";
  const SALEM = "https://sis-portal.salkeiz.k12.or.us/PXP2_Login_Parent.aspx?regenerateSessionId=true";
  const BEAVERTON = "https://parentvue.beaverton.k12.or.us/PXP2_Login.aspx";

  const tests = [
    [
      "isParentVuePath accepts PXP2 pages in any case and the home page",
      ({ P }) => {
        for (const p of [
          "/PXP2_Login_Parent.aspx",
          "/PXP2_Login.aspx",
          "/PXP2_GradeBook.aspx",
          "/pxp2_gradebook.aspx",
          "/Home_PXP2.aspx",
        ]) {
          eq(P.isParentVuePath(p), true, p);
        }
        for (const p of ["/", "/login", "/Home.aspx", "/PXP3_Login.aspx", "", "/x/PXP2_Login.aspx"]) {
          eq(P.isParentVuePath(p), false, p);
        }
      },
    ],
    [
      "isGradebookPath accepts both casings and nothing else",
      ({ P }) => {
        eq(P.isGradebookPath("/PXP2_GradeBook.aspx"), true);
        eq(P.isGradebookPath("/PXP2_Gradebook.aspx"), true);
        eq(P.isGradebookPath("/pxp2_gradebook.aspx"), true);
        eq(P.isGradebookPath("/PXP2_Login.aspx"), false);
        eq(P.isGradebookPath("/PXP2_Gradebook.aspx/x"), false);
        eq(P.isGradebookPath(""), false);
      },
    ],
    [
      "originPatternOf returns an https origin pattern for the three example portals",
      ({ P }) => {
        eq(P.originPatternOf(PORTLAND), "https://or-psd-psv.edupoint.com/*");
        eq(P.originPatternOf(SALEM), "https://sis-portal.salkeiz.k12.or.us/*");
        eq(P.originPatternOf(BEAVERTON), "https://parentvue.beaverton.k12.or.us/*");
        eq(P.originPatternOf("https://host.example:8443/x?y=1"), "https://host.example:8443/*");
      },
    ],
    [
      "originPatternOf rejects anything that is not an https URL",
      ({ P }) => {
        for (const u of [
          "http://or-psd-psv.edupoint.com/PXP2_Login.aspx",
          "chrome://extensions",
          "",
          "not a url",
          undefined,
          null,
        ]) {
          eq(P.originPatternOf(u), null, String(u));
        }
      },
    ],
    [
      "scriptIdOf is stable and derived from the pattern",
      ({ P }) => {
        eq(P.scriptIdOf("https://a.b/*"), "pvbetter:https://a.b/*");
      },
    ],
    [
      "describePage: enable, enabled and unsupported",
      ({ P }) => {
        eq(P.describePage(BEAVERTON, false), {
          kind: "enable",
          host: "parentvue.beaverton.k12.or.us",
          pattern: "https://parentvue.beaverton.k12.or.us/*",
        });
        eq(P.describePage(BEAVERTON, true).kind, "enabled");
        const none = { kind: "unsupported", host: null, pattern: null };
        eq(P.describePage("https://example.com/", false), none);
        eq(P.describePage("http://x.example/PXP2_Login.aspx", false), none);
        eq(P.describePage("https://example.com/Home.aspx", true), none);
        eq(P.describePage(undefined, false), none);
      },
    ],
    [
      "CONTENT_SCRIPT_FILES lists the scripts in load order",
      ({ P }) => {
        eq(P.CONTENT_SCRIPT_FILES, ["portal.js", "logic.js", "ui.js", "content.js"]);
      },
    ],
  ];

  const api = { tests };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.PVTestModules = root.PVTestModules || []).push(api);
})(typeof globalThis !== "undefined" ? globalThis : this);
