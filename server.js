const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

/* =========================
   WEBSOCKET SETUP
========================= */
const wss = new WebSocket.Server({ server });

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(express.static("public"));

/* =========================
   USERS
========================= */
const USERS = {
  "andreatnt12@hotmail.com": "director"
};

const getRole = (email) => USERS[email] || "guest";
const isDirector = (email) => getRole(email) === "director";

/* =========================
   STATE
========================= */
const PHASE = {
  IDLE: "IDLE",
  COUNTDOWN: "COUNTDOWN",
  ACTIVE: "ACTIVE",
  ABORTED: "ABORTED"
};

const state = {
  launchEnabled: false,
  launchTime: Date.now() + 300000,

  phase: PHASE.IDLE,

  logs: [],
  telemetry: {
    altitude: 0,
    velocity: 0,
    fuel: 100
  }
};

/* =========================
   HELPERS
========================= */
const now = () => Date.now();

const getCountdown = () =>
  Math.max(0, state.launchTime - now());

function addLog(message) {
  state.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (state.logs.length > 15) state.logs.pop();
}

/* =========================
   PAYLOAD (WHAT FRONTEND SEES)
========================= */
function buildPayload() {
  return {
    launchEnabled: state.launchEnabled,
    phase: state.phase,

    // 👇 FUN TEST TEXTS (VISIBLE IN UI)
    statusText: state.launchEnabled
      ? "🚀 ROCKET IS PANICKING"
      : "🛑 SYSTEM IS NAPPING",

    countdown: getCountdown(),

    telemetry: state.telemetry,
    logs: state.logs,

    funMessage: "🔥 ISA CONTROL IS ALIVE AND SLIGHTLY CHAOTIC"
  };
}

/* =========================
   BROADCAST
========================= */
function broadcast() {
  const data = JSON.stringify(buildPayload());

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

/* =========================
   TELEMETRY LOOP
========================= */
setInterval(() => {
  try {
    if (state.launchEnabled && state.phase !== PHASE.ABORTED) {
      state.telemetry.altitude += Math.random() * 5;
      state.telemetry.velocity += Math.random() * 3;
      state.telemetry.fuel -= Math.random() * 0.5;

      addLog("📡 Rocket doing questionable physics...");

      if (state.telemetry.fuel <= 0) {
        state.telemetry.fuel = 0;
        state.launchEnabled = false;
        state.phase = PHASE.ABORTED;

        addLog("⛽ Rocket ran out of snacks (fuel depleted)");
      }
    }

    broadcast();
  } catch (err) {
    console.error("Telemetry error:", err);
  }
}, 1000);

/* =========================
   ROUTES
========================= */

// LOGIN
app.post("/login", (req, res) => {
  const email = req.body?.email;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  res.json({
    role: getRole(email),
    message: "👋 Welcome to Rocket Chaos System"
  });
});

// TOGGLE LAUNCH
app.post("/toggle", (req, res) => {
  const email = req.body?.email;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  if (!isDirector(email)) {
    return res.status(403).json({
      error: "🚫 You are not the rocket overlord"
    });
  }

  state.launchEnabled = !state.launchEnabled;

  state.phase = state.launchEnabled
    ? PHASE.COUNTDOWN
    : PHASE.IDLE;

  addLog(
    state.launchEnabled
      ? "🚀 Launch sequence activated (panic mode)"
      : "🛑 Launch canceled (rocket is disappointed)"
  );

  broadcast();

  res.json(buildPayload());
});

// ABORT
app.post("/abort", (req, res) => {
  const email = req.body?.email;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  if (!isDirector(email)) {
    return res.status(403).json({
      error: "🚫 Only rocket parents can abort"
    });
  }

  state.launchEnabled = false;
  state.phase = PHASE.ABORTED;

  addLog("🧯 ABORT INITIATED — rocket is relieved");

  broadcast();

  res.json(buildPayload());
});

/* =========================
   WEBSOCKET CONNECTION
========================= */
wss.on("connection", (ws) => {
  ws.send(JSON.stringify(buildPayload()));

  addLog("👀 A new astronaut joined the control room");
  broadcast();
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 ISA CONTROL RUNNING ON PORT ${PORT}`);
});