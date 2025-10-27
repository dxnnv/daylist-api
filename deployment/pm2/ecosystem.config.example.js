module.exports = {
    apps: [
        {
            name: "daylist-api",
            script: "./src/server.js",
            cwd: "~/daylist-api",
            env: {
                PORT: "5001",
                SPOTIFY_WEB_COOKIE_FILE: "/etc/daylist-api/cookie",
                NTFY_BASE: "https://ntfy.sh",
                NTFY_TOPIC_NEW: "daylist-new",
                NTFY_TOPIC_ERROR: "daylist-error",
                NTFY_TOKEN: "INSERT TOKEN HERE",
                NODE_ENV: "production",
            },
            exec_mode: "fork",
            instances: 1,
            watch: false,
            autorestart: true,
            max_memory_restart: "1000M",
            out_file: "/var/log/daylist-api/daylist.out.log",
            error_file: "/var/log/daylist-api/daylist.err.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
        },
    ],
};
