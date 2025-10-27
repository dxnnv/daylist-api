const { SPOTIFY_BASE_URL } = require("./constants");

function extractMeta(content, propOrName) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${propOrName}["'][^>]+content=["']([^"']+)["']`, "i");
    return content.match(re)?.[1]?.trim() || null;
}

function extractNextName(html) {
    const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (!m) return null;
    try {
        const data = JSON.parse(m[1]);
        const walk = o => {
            if (!o || typeof o !== "object") return null;
            if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
            for (const v of Object.values(o)) {
                const r = walk(v);
                if (r) return r;
            }
            return null;
        };
        return walk(data);
    } catch {
        return null;
    }
}

function extractGenresFromDescription(html) {
    const block = html.match(/Here(?:&#x27;|&rsquo;|’|')s some([\s\S]*?)(?:—|&mdash;)/i);
    if (!block) return [];

    const segment = block[1];

    const anchorGenres = Array.from(segment.matchAll(/<a[^>]*>([^<]+)<\/a>/gi))
        .map(m => m[1].trim())
        .filter(Boolean);

    const tail = segment.replace(/<a[^>]*>[^<]+<\/a>/gi, "");
    const tailGenres = tail
        .split(/[,，]/g)
        .map(s => s.replace(/[\s–-]+$/g, "").trim())
        .filter(Boolean);

    const seen = new Set();
    return [...anchorGenres, ...tailGenres].filter(g => !seen.has(g.toLowerCase()) && seen.add(g.toLowerCase()));
}

async function extractPlaylistExtras(playlistId, cookieOpt) {
    const url = `${SPOTIFY_BASE_URL}/playlist/${playlistId}`;
    const headers = {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
        "Accept-Language": "en",
    };
    if (cookieOpt) headers.Cookie = cookieOpt;

    const r = await fetch(url, { headers, redirect: "follow" });
    const html = await r.text();

    const image = extractMeta(html, "og:image") || extractMeta(html, "twitter:image") || null;

    const genres = extractGenresFromDescription(html);
    return { image, genres };
}

function stripSpotifySuffix(t) {
    return (t || "").replace(/\s*\|\s*Spotify(?:\s*Playlist|\s*Album|\s*Song|\s*Artist)?\s*$/i, "");
}

function isGenericTitle(t = "") {
    const s = t.trim();
    return s == /(day|play)list/i || s == /spotify (–|-) web player/i;
}

module.exports = { extractMeta, extractNextName, extractPlaylistExtras, stripSpotifySuffix, isGenericTitle };
