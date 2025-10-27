const { loadHistory, xmlEscape, httpDate, computeETagFromHistory } = require("./history");
const { SPOTIFY_BASE_URL } = require("./util/constants");
const { extractPlaylistExtras } = require("./util/parse");

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
    const hist = loadHistory();
    const last = hist[0];
    const lastDate = last?.fetched_at || new Date().toISOString();
    const etag = computeETagFromHistory(hist);

    if (
        req.headers["if-none-match"] === etag ||
        (req.headers["if-modified-since"] &&
            new Date(req.headers["if-modified-since"]).getTime() >= new Date(lastDate).getTime())
    )
        return res.status(304).end();

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

module.exports = { sendRss };
