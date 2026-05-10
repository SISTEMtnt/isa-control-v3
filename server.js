const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

/* =========================
   WEBSOCKET
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

function getRole(email) {
  return USERS[email] || "guest";
}

function isDirector(email) {
  return getRole(email) === "director";
}

/* =========================
   STATE
========================= */
const PHASE = {
  IDLE: "IDLE",
  COUNTDOWN: "COUNTDOWN",
  ACTIVE: "ACTIVE",
  ABORTED: "ABORTED"
};

let state = {
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
function now() {
  return Date.now();
}

function countdown() {
  return Math.max(0, state.launchTime - now());
}

function log(msg) {
  state.logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (state.logs.length > 15) state.logs.pop();
}

/* =========================
   BROADCAST (SAFE)
========================= */
function broadcast() {
  const payload = JSON.stringify({
    ...state,
    countdown: countdown()
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

/* =========================
   TELEMETRY LOOP
========================= */
setInterval(() => {
  try {
    if (state.launchEnabled && state.phase !== PHASE.ABORTED) {
      state.telemetry.altitude += Math.random() * 3;
      state.telemetry.velocity += Math.random() * 1.5;
      state.telemetry.fuel = Math.max(0, state.telemetry.fuel - Math.random() * 0.3);

      if (state.telemetry.fuel === 0) {
        state.launchEnabled = false;
        state.phase = PHASE.ABORTED;
        log("FUEL DEPLETED - ABORTING");
      }
    }

    broadcast();
  } catch (err) {
    console.error("Telemetry error:", err);
  }
}, 1000);

/* =========================
   LOGIN
========================= */
app.post("/login", (req, res) => {
  const role = getRole(req.body.email);
  res.json({ role });
});

/* =========================
   TOGGLE LAUNCH
========================= */
app.post("/toggle", (req, res) => {
  if (!isDirector(req.body.email)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  state.launchEnabled = !state.launchEnabled;
  state.phase = state.launchEnabled ? PHASE.COUNTDOWN : PHASE.IDLE;

  log("Launch toggled: " + state.launchEnabled);

  broadcast();
  res.json(state);
});

/* =========================
   ABORT
========================= */
app.post("/abort", (req, res) => {
  if (!isDirector(req.body.email)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  state.launchEnabled = false;
  state.phase = PHASE.ABORTED;

  log("MISSION ABORTED");

  broadcast();
  res.json(state);
});

/* =========================
   WEBSOCKET CONNECT
========================= */
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({
    ...state,
    countdown: countdown()
  }));
});

/* =========================
   START SERVER (RENDER SAFE)
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ISA CONTROL RUNNING ON PORT ${PORT}`);
});