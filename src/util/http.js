const UA_CURL = "curl/8.6.0";
const UA_DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36";

function headersBase({ cookie, ua = UA_DESKTOP } = {}) {
    const h = { "User-Agent": ua, "Accept-Language": "en" };
    if (cookie) h.Cookie = cookie;
    return h;
}

async function fetchText(url, headers, { timeoutMs = 10000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs).unref?.();
    const r = await fetch(url, { headers, redirect: "follow", signal: ctrl.signal });
    const text = await r.text();
    clearTimeout(t);
    return { r, text, finalUrl: r.url || url };
}

module.exports = { UA_CURL, UA_DESKTOP, headersBase, fetchText };
