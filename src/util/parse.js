const { SPOTIFY_BASE_URL } = require("./constants");
const { fetchText, headersBase, withRetries, UA_MOBILE } = require("./http");

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
        .map(s =>
            s
                .replace(/(^\s+|\s+$)/g, "")
                .replace(/[–—-]+$/g, "")
                .trim()
        )
        .filter(Boolean);

    const seen = new Set();
    return [...anchorGenres, ...tailGenres].filter(g => !seen.has(g.toLowerCase()) && seen.add(g.toLowerCase()));
}

async function extractPlaylistExtras(playlistId, cookie) {
    const url = `${SPOTIFY_BASE_URL}/playlist/${playlistId}`;
    const headerSets = [headersBase({ cookie }), headersBase({ cookie, ua: UA_MOBILE })];

    for (const headers of headerSets) {
        const { text } = await withRetries(() => fetchText(url, headers));
        const image = extractMeta(text, "og:image") || extractMeta(text, "twitter:image") || null;

        const genres = extractGenresFromDescription(text);

        if (image || (genres && genres.length)) return { image, genres };
    }
    return { image: null, genres: [] };
}

const stripSpotifySuffix = (t = "") => t.replace(/\s*\|\s*Spotify(?:\s*Playlist|\s*Album|\s*Song|\s*Artist)?\s*$/i, "");

const normalizeTitle = (t = "") => String(t).normalize("NFKC").trim().replace(/[–—−]/g, "-");

function isGenericTitle(t = "") {
    const s = normalizeTitle(t).toLowerCase();
    return s === "daylist" || s === "playlist" || s === "spotify - web player";
}

module.exports = {
    extractMeta,
    extractNextName,
    extractPlaylistExtras,
    stripSpotifySuffix,
    normalizeTitle,
    isGenericTitle,
};
