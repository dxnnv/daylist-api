const { loadHistory, xmlEscape, httpDate, computeETagFromHistory } = require("./history");
const { SPOTIFY_BASE_URL } = require("./util/constants");

function buildRssXml({ siteTitle, siteLink, siteDesc, items, lastDate }) {
    const itemsXml = items
        .map(it => {
            const thumb = it.image ? `\n    <media:thumbnail url="${xmlEscape(it.image)}" />` : "";
            const cats = Array.isArray(it.genres)
                ? it.genres.map(g => `\n    <category>${xmlEscape(g)}</category>`).join("")
                : "";
            return `
<item>
  <title>${xmlEscape(it.name || "(untitled)")}</title>
  <link>${xmlEscape(it.link || siteLink)}</link>
  <guid isPermaLink="false">${xmlEscape(`${it.id || "unknown"}#${it.fetched_at}`)}</guid>
  <pubDate>${httpDate(it.fetched_at)}</pubDate>
  <description>${xmlEscape(`Daylist title updated to: ${it.name}`)}</description>${thumb}${cats}
</item>`;
        })
        .join("");

    return `
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <title>${xmlEscape(siteTitle)}</title>
  <link>${xmlEscape(siteLink)}</link>
  <description>${xmlEscape(siteDesc)}</description>
  <lastBuildDate>${httpDate(lastDate)}</lastBuildDate>
  <ttl>15</ttl>${itemsXml}
</channel></rss>`;
}

function sendRss(res, req) {
    res.setHeader("Vary", "If-None-Match, If-Modified-Since");

    const hist = [...loadHistory()].sort((a, b) => new Date(b?.fetched_at || 0) - new Date(a?.fetched_at || 0));
    const lastDate = hist[0]?.fetched_at || new Date(0).toISOString();
    const etag = `W/"${computeETagFromHistory(hist)}"`;

    const inm = req?.headers?.["if-none-match"];
    if (inm && etagListContains(inm, etag)) {
        res.setHeader("ETag", etag);
        res.setHeader("Last-Modified", httpDate(lastDate));
        return res.sendStatus(304);
    }

    const ims = req?.headers ? req.headers["if-modified-since"] : undefined;
    if (ims && new Date(lastDate) <= new Date(ims)) {
        res.setHeader("ETag", etag);
        res.setHeader("Last-Modified", httpDate(lastDate));
        return res.sendStatus(304);
    }
    const last = hist[0];

    const siteTitle = process.env.FEED_TITLE || "Daylist Tracker";
    const siteLink = last?.link || SPOTIFY_BASE_URL;
    const siteDesc = process.env.FEED_DESCRIPTION || "Title changes for your Spotify Daylist";

    const rss = buildRssXml({
        siteTitle,
        siteLink,
        siteDesc,
        items: hist,
        lastDate,
    });

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", httpDate(lastDate));
    return res.status(200).send(rss);
}

function etagListContains(header, tag) {
    if (!header) return false;
    const h = header.trim();
    if (h === "*") return true;

    const strip = s => s.trim().replace(/^W\/"?|^"?|"?$/g, "");
    const want = strip(tag);
    return h.split(",").some(t => strip(t) === want);
}

module.exports = { sendRss };
