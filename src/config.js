const fs = require("fs");

const PORT = Number(process.env.PORT || 3000);
const COOKIE_FILE = process.env.SPOTIFY_WEB_COOKIE_FILE || "";

function getCookie() {
    try {
        return fs.readFileSync(COOKIE_FILE, "utf8").trim();
    } catch {}
}

const NTFY = {
    base: process.env.NTFY_BASE || "https://ntfy.sh",
    topicNew: process.env.NTFY_TOPIC_NEW || "daylist-new",
    topicError: process.env.NTFY_TOPIC_ERROR || "daylist-error",
    token: process.env.NTFY_TOKEN || "",
};

module.exports = { PORT, getCookie, NTFY };
