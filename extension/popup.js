// The toolbar popup: lets the parent approve (or remove) the current ParentVUE site.
// All text is set with textContent. `permissions.request` runs straight from the click.
(function () {
  "use strict";
  const P = globalThis.PVPortal;
  const $ = (id) => document.getElementById(id);
  let current = null; // { tabId, pattern, kind }

  async function render(note) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab && tab.url;
    const pattern = P.originPatternOf(url);
    const enabled = pattern ? await chrome.permissions.contains({ origins: [pattern] }) : false;
    const page = P.describePage(url, enabled);
    current = { tabId: tab && tab.id, pattern: page.pattern, kind: page.kind };

    const button = $("action");
    button.hidden = page.kind === "unsupported";
    button.className = page.kind === "enabled" ? "secondary" : "";
    if (page.kind === "unsupported") {
      $("message").textContent = "This only works on ParentVUE pages.";
      $("hint").textContent = "Open your school's ParentVUE, then click this icon again.";
    } else if (page.kind === "enable") {
      $("message").textContent = `Turn on the better assignment view for ${page.host}?`;
      $("hint").textContent =
        "Chrome will ask you to confirm. Nothing is sent anywhere; the extension only reads the page you are on.";
      button.textContent = `Enable on ${page.host}`;
    } else {
      $("message").textContent = `Enabled on ${page.host}.`;
      $("hint").textContent = "Open the Grade Book to see the Better assignment view button.";
      button.textContent = "Disable on this site";
    }
    if (note) $("hint").textContent = note;
  }

  async function enable() {
    const granted = await chrome.permissions.request({ origins: [current.pattern] });
    if (!granted) return render("Permission was not granted, so nothing changed.");
    await chrome.runtime.sendMessage({ type: "sync" });
    try {
      await chrome.scripting.executeScript({ target: { tabId: current.tabId }, files: P.CONTENT_SCRIPT_FILES });
    } catch {
      return render("Enabled. Reload this page to see the button.");
    }
    return render("Enabled. Open the Grade Book to see the Better assignment view button.");
  }

  async function disable() {
    await chrome.permissions.remove({ origins: [current.pattern] });
    await chrome.runtime.sendMessage({ type: "sync" });
    return render("Disabled. Reload this page to remove the button.");
  }

  $("action").addEventListener("click", () => {
    if (!current) return;
    (current.kind === "enable" ? enable() : disable()).catch((e) => render(`Something went wrong: ${e.message}`));
  });
  render().catch((e) => ($("message").textContent = `Something went wrong: ${e.message}`));
})();
