// Service worker: keeps the content-script registrations in step with the sites the parent has approved.
// A site is approved when the popup gets its `https://host/*` permission; this registers the scripts for it.
import "./portal.js";

const P = globalThis.PVPortal;
const ID_PREFIX = "pvbetter:";

/** Granted per-site patterns (https, one exact host, path wildcard), never the all-sites wildcard. */
async function grantedPatterns() {
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter((o) => /^https:\/\/[^/*]+\/\*$/.test(o));
}

async function syncOnce() {
  const wanted = new Map((await grantedPatterns()).map((pattern) => [P.scriptIdOf(pattern), pattern]));
  const ours = (await chrome.scripting.getRegisteredContentScripts()).filter((s) => s.id.startsWith(ID_PREFIX));

  const stale = ours.filter((s) => !wanted.has(s.id)).map((s) => s.id);
  if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });

  const have = new Set(ours.map((s) => s.id));
  const missing = [...wanted]
    .filter(([id]) => !have.has(id))
    .map(([id, pattern]) => ({
      id,
      matches: [pattern],
      js: P.CONTENT_SCRIPT_FILES,
      runAt: "document_idle",
      persistAcrossSessions: true,
    }));
  if (missing.length) await chrome.scripting.registerContentScripts(missing);
}

// Events can arrive together; run the syncs one at a time so two never register the same script.
let queue = Promise.resolve();
function sync() {
  queue = queue.then(syncOnce).catch((e) => console.error("ParentVUE: Better assignment view: sync failed", e));
  return queue;
}

chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);
chrome.permissions.onAdded.addListener(sync);
chrome.permissions.onRemoved.addListener(sync);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || message.type !== "sync") return false;
  sync().then(() => sendResponse({ ok: true }));
  return true; // the answer is sent asynchronously
});
