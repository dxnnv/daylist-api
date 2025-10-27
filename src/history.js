const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DAYLIST_HISTORY_FILE = path.join(process.cwd(), "daylist_history.json");

function loadHistory() {
    try {
        const arr = JSON.parse(fs.readFileSync(DAYLIST_HISTORY_FILE, "utf8"));
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}
function saveHistory(arr) {
    try {
        fs.mkdirSync(path.dirname(DAYLIST_HISTORY_FILE), { recursive: true });
        fs.writeFileSync(DAYLIST_HISTORY_FILE, JSON.stringify(arr, null, 2));
    } catch (e) {
        console.error("[history:save] failed:", e && (e.stack || e));
        throw e;
    }
}
function recordIfChanged(entry, maxItems = 200) {
    const hist = loadHistory();
    const last = hist[0];
    const changed = !last || last.name !== entry.name || entry.id !== last?.id;
    if (changed) {
        hist.unshift(entry);
        if (hist.length > maxItems) hist.length = maxItems;
        saveHistory(hist);
    }
    return { changed, hist };
}
function xmlEscape(s = "") {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
function httpDate(d) {
    return new Date(d).toUTCString();
}
function computeETagFromHistory(hist) {
    const hash = crypto.createHash("sha1");
    for (const it of hist) hash.update(`${it.id}|${it.name}|${it.fetched_at}\n`);
    return `W/"${hash.digest("hex")}"`;
}

module.exports = { loadHistory, saveHistory, recordIfChanged, xmlEscape, httpDate, computeETagFromHistory };
