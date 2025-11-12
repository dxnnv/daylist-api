const { NTFY } = require("./config");

const authHeader = () => (NTFY ? { Authorization: `Bearer ${NTFY.token}` } : {});

// Debounce to avoid spam
const lastSent = new Map();
function shouldSend(key, minMs) {
    const now = Date.now();
    const prev = lastSent.get(key) || 0;
    if (now - prev < minMs) return false;
    lastSent.set(key, now);
    return true;
}

async function sendTemplate(topic, templateName, payload, extras = {}) {
	if (!NTFY || !NTFY.base) return;
	
    try {
        const url = new URL(NTFY.base);
        url.pathname = "/daylist";
        url.searchParams.set("template", templateName);

        const headers = { "Content-Type": "application/json", ...authHeader() };
        if (extras.priority) headers.Priority = String(extras.priority);
        if (extras.tags) headers.Tags = Array.isArray(extras.tags) ? extras.tags.join(",") : String(extras.tags);

        await fetch(url.toString(), {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });
    } catch (err) {
    	    console.error("Failed to send ntfy template", err);
    }
}

async function notifyError(fields, { debounceMs = 30 * 60 * 1000 } = {}) {
    if (!shouldSend("error", debounceMs)) return;
    return sendTemplate(
        NTFY.topicError,
        "daylist-error",
        {
            when: new Date().toISOString(),
            ...fields,
        },
        { priority: 5, tags: ["rotating_light"] }
    );
}

async function notifyNewDaylist(fields) {
    return sendTemplate(
        NTFY.topicNew,
        "daylist-new",
        {
            fetched_at: new Date().toISOString(),
            ...fields,
        },
        { priority: 4, tags: ["headphones", "sparkles"] }
    );
}

module.exports = { notifyError, notifyNewDaylist };
