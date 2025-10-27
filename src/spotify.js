const { getCookie } = require("./config");
const { headersBase, fetchText, USER_AGENT_CURL, USER_AGENT_DESKTOP } = require("./util/http");
const { extractMeta, extractNextName, stripSpotifySuffix, isGenericTitle } = require("./util/parse");
const { SPOTIFY_BASE_URL, SPOTIFY_DAYLIST_URL } = require("./util/constants");

async function resolveCurrentDaylistIdViaPortal() {
    const cookie = getCookie();
    if (!cookie) throw new Error("Missing SPOTIFY_WEB_COOKIE_FILE");

    const { text, finalUrl } = await fetchText(SPOTIFY_DAYLIST_URL, headersBase({ cookie }), {});
    let id = finalUrl.match(/playlist\/([A-Za-z0-9]{22})/)?.[1] || null;
    if (!id) id = text.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/)?.[1] || null;
    if (!id) throw new Error("Portal did not reveal a playlist ID (cookie expired or not logged in).");
    return id;
}

async function tryOEmbed(idOrUrl) {
    const urlParam = encodeURIComponent(/https?:/.test(idOrUrl) ? idOrUrl : `${SPOTIFY_BASE_URL}/playlist/${idOrUrl}`);
    const r = await fetch(`${SPOTIFY_BASE_URL}/oembed?url=${urlParam}`, {
        headers: headersBase({ ua: USER_AGENT_CURL }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const title = j && typeof j.title === "string" ? j.title.trim() : "";
    return !title || isGenericTitle(title) ? null : title;
}

async function fetchViaHTML(idOrUrl, cookieOpt) {
    const id = String(idOrUrl).match(/([A-Za-z0-9]{22})/)?.[1];
    const candidates = [
        id ? `${SPOTIFY_BASE_URL}/playlist/${id}` : String(idOrUrl),
        id ? `${SPOTIFY_BASE_URL}/intl-en/playlist/${id}` : null,
        id ? `${SPOTIFY_BASE_URL}/embed/playlist/${id}` : null,
    ].filter(Boolean);

    const headerSets = [
        { ...headersBase({ cookie: cookieOpt, ua: USER_AGENT_DESKTOP }), Referer: SPOTIFY_DAYLIST_URL },
        { ...headersBase({ cookie: cookieOpt, ua: USER_AGENT_CURL }), Referer: SPOTIFY_DAYLIST_URL },
    ];

    for (const url of candidates) {
        for (const headers of headerSets) {
            const { text, finalUrl } = await fetchText(url, headers, {});
            let title =
                extractMeta(text, "og:title") ||
                extractMeta(text, "twitter:title") ||
                extractNextName(text) ||
                stripSpotifySuffix(text.match(/<title>([^<]+)<\/title>/i)?.[1] || "");

            if (title && !isGenericTitle(title)) {
                const curId = finalUrl.match(/playlist\/([A-Za-z0-9]{22})/)?.[1] || id;
                return { id: curId, name: title, via: "html" };
            }
        }
    }
    throw new Error("No usable title found in HTML!");
}

async function resolveDaylistTitle(idOrUrl, cookieOpt) {
    const fromOEmbed = await tryOEmbed(idOrUrl).catch(() => null);
    if (fromOEmbed) {
        const id = String(idOrUrl).match(/([A-Za-z0-9]{22})/)?.[1] || null;
        return { id, name: fromOEmbed, via: "oembed" };
    }
    const html = await fetchViaHTML(idOrUrl, cookieOpt);
    return { id: html.id, name: html.name, via: html.via };
}

module.exports = { resolveCurrentDaylistIdViaPortal, resolveDaylistTitle };
