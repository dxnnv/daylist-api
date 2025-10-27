const { getCookie } = require("./config");
const { fetchText, headersBase, withRetries, UA_MOBILE } = require("./util/http");
const { extractMeta, normalizeTitle, stripSpotifySuffix, isGenericTitle } = require("./util/parse");
const { SPOTIFY_BASE_URL, SPOTIFY_DAYLIST_URL } = require("./util/constants");

function extractJSONLDName(html) {
    const m = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!m) return null;
    try {
        const obj = JSON.parse(m[1]);
        const dfs = o => {
            if (!o || typeof o !== "object") return null;
            if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
            for (const v of Object.values(o)) {
                const r = dfs(v);
                if (r) return r;
            }
            return null;
        };
        return dfs(obj);
    } catch {
        return null;
    }
}

function pickPlaylistIdFromUrl(urlOrFinal) {
    return String(urlOrFinal).match(/playlist\/([A-Za-z0-9]{22})/)?.[1] || null;
}

async function resolveFinalId(idOrUrl, cookie) {
    const id = String(idOrUrl).match(/([A-Za-z0-9]{22})/)?.[1] || null;
    const url = id ? `${SPOTIFY_BASE_URL}/playlist/${id}` : String(idOrUrl);
    const headers = headersBase({ cookie });
    const { r, finalUrl } = await withRetries(() => fetchText(url, headers));
    return pickPlaylistIdFromUrl(r?.url || finalUrl) || id;
}

async function resolveCurrentDaylistIdViaPortal() {
    const cookie = getCookie();
    if (!cookie) throw new Error("Missing SPOTIFY_WEB_COOKIE_FILE");

    const headers = headersBase({ cookie });
    const { r, text, finalUrl } = await withRetries(() => fetchText(SPOTIFY_DAYLIST_URL, headers));

    let id = pickPlaylistIdFromUrl(r?.url || finalUrl);
    if (id) return id;

    id = pickPlaylistIdFromUrl(text.match(/https?:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]{22}/)?.[0] || "");
    if (id) return id;

    throw new Error("Portal did not reveal a playlist ID (cookie expired or not logged in).");
}

async function tryOEmbed(idOrUrl) {
    const id = String(idOrUrl).match(/([A-Za-z0-9]{22})/)?.[1];
    const urlParam = encodeURIComponent(/https?:/.test(idOrUrl) ? idOrUrl : `${SPOTIFY_BASE_URL}/playlist/${id}`);
    const headers = { "User-Agent": "curl/8.6.0", "Accept-Language": "en" };
    const { r, text } = await withRetries(() => fetchText(`${SPOTIFY_BASE_URL}/oembed?url=${urlParam}`, headers));
    if (!r.ok) return null;
    let title = null;
    try {
        title = JSON.parse(text)?.title?.trim() || null;
    } catch {}
    return title && !isGenericTitle(title) ? normalizeTitle(title) : null;
}

async function fetchTitleViaHTML(idOrUrl, cookie) {
    const id = String(idOrUrl).match(/([A-Za-z0-9]{22})/)?.[1];
    const candidates = [
        id ? `${SPOTIFY_BASE_URL}/playlist/${id}` : String(idOrUrl),
        id ? `${SPOTIFY_BASE_URL}/intl-en/playlist/${id}` : null,
        id ? `${SPOTIFY_BASE_URL}/embed/playlist/${id}` : null,
    ].filter(Boolean);

    const headerSets = [headersBase({ cookie }), headersBase({ cookie, ua: UA_MOBILE })];

    for (const url of candidates) {
        for (const headers of headerSets) {
            const { r, text, finalUrl } = await withRetries(() => fetchText(url, headers));
            let title =
                extractMeta(text, "og:title") ||
                extractMeta(text, "twitter:title") ||
                extractJSONLDName(text) ||
                stripSpotifySuffix(text.match(/<title>([^<]+)<\/title>/i)?.[1] || "");

            if (title && !isGenericTitle(normalizeTitle(title))) {
                const curId = pickPlaylistIdFromUrl(r?.url || finalUrl) || id;
                return { id: curId, name: normalizeTitle(title), via: "html" };
            }
        }
    }
    throw new Error("No usable title in HTML (only generic/shell).");
}

async function resolveDaylistTitle(idOrUrl, cookie) {
    const fromOEmbed = await tryOEmbed(idOrUrl).catch(() => null);
    if (fromOEmbed && !isGenericTitle(fromOEmbed)) {
        const id = String(idOrUrl).match(/([A-Za-z0-9]{22})/)?.[1] || null;
        return { id, name: normalizeTitle(fromOEmbed), via: "oembed" };
    }
    const html = await fetchTitleViaHTML(idOrUrl, cookie);
    return { id: html.id, name: html.name, via: html.via };
}

module.exports = {
    resolveFinalId,
    resolveCurrentDaylistIdViaPortal,
    resolveDaylistTitle,
    extractJSONLDName,
};
