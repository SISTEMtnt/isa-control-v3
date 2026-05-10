let email = "";
let role = "guest";

const API_BASE = window.location.origin;

// ✅ FIX: use correct WS protocol for Render (auto-detect http/https)
const WS_URL =
    window.location.protocol === "https:"
        ? `wss://${window.location.host}`
        : `ws://${window.location.host}`;

let ws;

/* ---------------- WebSocket ---------------- */

function connectWS() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("WebSocket connected");
    };

    ws.onclose = () => {
        console.warn("WebSocket closed. Reconnecting in 2s...");
        setTimeout(connectWS, 2000);
    };

    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };

    ws.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);
            updateUI(data);
        } catch (e) {
            console.error("Invalid WS message:", e);
        }
    };
}

connectWS();

/* ---------------- UI ---------------- */

function updateUI(data) {
    const countdownEl = document.getElementById("countdown");
    const statusEl = document.getElementById("status");
    const telemetryEl = document.getElementById("telemetry");
    const logsEl = document.getElementById("logs");

    if (countdownEl) {
        countdownEl.innerText = `T-${Math.floor((data.countdown || 0) / 1000)}s`;
    }

    if (statusEl) {
        statusEl.innerText = data.launchEnabled ? "LAUNCH ARMED" : "DISABLED";
        statusEl.style.color = data.launchEnabled ? "lime" : "red";
    }

    if (telemetryEl && data.telemetry) {
        const { altitude = 0, velocity = 0, fuel = 0 } = data.telemetry;

        telemetryEl.innerText =
            `ALT: ${altitude.toFixed(1)} | ` +
            `VEL: ${velocity.toFixed(1)} | ` +
            `FUEL: ${fuel.toFixed(1)}`;
    }

    if (logsEl && Array.isArray(data.logs)) {
        logsEl.innerText = data.logs.join("\n");
    }
}

/* ---------------- LOGIN ---------------- */

async function login() {
    email = document.getElementById("email")?.value || "";

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await res.json();
        role = data.role || "guest";

        const roleEl = document.getElementById("role");
        if (roleEl) roleEl.innerText = `ROLE: ${role}`;

        const directorPanel = document.getElementById("directorPanel");
        if (directorPanel) {
            directorPanel.style.display =
                role === "director" ? "block" : "none";
        }

    } catch (err) {
        console.error("Login failed:", err);
    }
}

/* ---------------- ACTIONS ---------------- */

async function toggleLaunch() {
    if (!email) return alert("Login required");

    await fetch(`${API_BASE}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });
}

async function abortLaunch() {
    if (!email) return alert("Login required");

    await fetch(`${API_BASE}/abort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });
}