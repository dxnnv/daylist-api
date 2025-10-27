const express = require("express");

const { SPOTIFY_BASE_URL, SPOTIFY_DAYLIST_URL } = require("./util/constants");
const { extractPlaylistExtras } = require("./util/parse");
const { PORT, getCookie } = require("./config");
const { resolveCurrentDaylistIdViaPortal, resolveDaylistTitle } = require("./spotify");
const { recordIfChanged, loadHistory } = require("./history");
const { sendRss } = require("./rss");
const { notifyError, notifyNewDaylist } = require("./ntfy");

const app = express();
app.set("etag", false);

app.get("/", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");

    try {
        const latestId = await resolveCurrentDaylistIdViaPortal();
        const cookie = getCookie();
        const cur = await resolveDaylistTitle(latestId, cookie || undefined);
        const extras = await extractPlaylistExtras(cur.id, cookie || undefined);

        const prev = loadHistory()[0] || null;
        const entry = {
            id: cur.id || null,
            name: cur.name,
            fetched_at: new Date().toISOString(),
            link: `${SPOTIFY_BASE_URL}/playlist/${cur.id}`,
        };

        const { changed } = recordIfChanged(entry);

        if (changed) {
            await notifyNewDaylist({
                name: entry.name,
                id: entry.id,
                link: entry.link,
                image: extras.image,
                genres: extras.genres,
                old_name: prev?.name || null,
            });
        }

        return res.json({
            source: cur.via,
            id: cur.id,
            name: cur.name,
            link: entry.link,
            image: extras.image,
            genres: extras.genres,
            changed,
            previous: prev ? { id: prev.id, name: prev.name, fetched_at: prev.fetched_at } : null,
            fetched_at: entry.fetched_at,
        });
    } catch (e) {
        const msg = String(e || "");
        await notifyError({ error: msg, hint: "Refresh SPOTIFY_WEB_COOKIE (or *_FILE).", route: "/" });
        return res.status(503).json({ ok: false, error: msg });
    }
});

app.get("/healthz", (_req, res) => res.sendStatus(200));

app.get("/status", async (_req, res) => {
    try {
        const cookie = getCookie();
        if (!cookie) return res.json({ ok: false, reason: "missing_cookie" });
        const r = await fetch(SPOTIFY_DAYLIST_URL, {
            headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en", Cookie: cookie },
            redirect: "follow",
        });
        const finalUrl = r.url || SPOTIFY_DAYLIST_URL;
        return res.json({ ok: !/\/login/i.test(finalUrl), finalUrl });
    } catch (e) {
        return res.json({ ok: false, error: String(e) });
    }
});

app.get("/daylist.rss", (req, res) => sendRss(res, req));

const srv = app.listen(Number(PORT), () => {
    console.log(`daylist-api listening on :${PORT}`);
});
srv.on("error", e => {
    console.error("[listen:error]", e && (e.stack || e));
    process.exit(1);
});
