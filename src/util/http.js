const { SPOTIFY_DAYLIST_URL } = require("./constants");

const UA_DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36";
const UA_MOBILE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function headersBase({ cookie, ua = UA_DESKTOP, referer = SPOTIFY_DAYLIST_URL } = {}) {
    const h = { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" };
    h.Accept = "text/html,application/xhtml+xml";
    if (referer) h.Referer = referer;
    if (cookie) h.Cookie = cookie;
    return h;
}

async function fetchText(url, headers = {}, { timeoutMs = 10000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs).unref?.();
    const r = await fetch(url, { headers, redirect: "follow", signal: ctrl.signal });
    const text = await r.text();
    clearTimeout(t);
    return { r, text, finalUrl: r.url || url };
}

async function fetchJson(url, headers = {}, { timeoutMs = 10000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs).unref?.();
    const r = await fetch(url, { headers, redirect: "follow", signal: ctrl.signal });
    let body = null;
    try {
        body = await r.json();
    } catch {}
    clearTimeout(t);
    return { r, json: body, finalUrl: r.url || url };
}

const sleep = ms => new Promise(res => setTimeout(res, ms));
function parseRetryAfter(h) {
    if (!h) return null;
    const sec = Number(h);
    if (!Number.isNaN(sec)) return Math.min(Math.max(sec, 1), 60) * 1000;
    const when = Date.parse(h);
    if (!Number.isNaN(when)) return Math.min(Math.max(when - Date.now(), 1000), 60000);
    return null;
}

async function withRetries(fetcher, { retries = 2, baseDelayMs = 300 } = {}) {
    let attempt = 0;
    for (;;) {
        try {
            const out = await fetcher();
            const status = out.r?.status ?? 0;
            if (status >= 200 && status < 400) return out;
            if (status !== 429 && status < 500) return out; // don’t retry 4xx (except 429)
            if (attempt >= retries) return out;
            const ra = parseRetryAfter(out.r.headers.get("retry-after"));
            const backoff = ra ?? baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 120);
            await sleep(backoff);
            attempt++;
        } catch (e) {
            if (attempt >= retries) throw e;
            await sleep(baseDelayMs * Math.pow(2, attempt));
            attempt++;
        }
    }
}

module.exports = {
    UA_MOBILE,
    headersBase,
    fetchText,
    fetchJson,
    withRetries,
};
