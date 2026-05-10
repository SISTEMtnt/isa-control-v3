const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static("public"));

/* =========================
   CONFIG / USERS
========================= */

const USERS = {
  "andreatnt12@hotmail.com": "director"
};

const ROLE = {
  DIRECTOR: "director",
  GUEST: "guest"
};

/* =========================
   STATE MACHINE
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
   UTILITIES
========================= */

function now() {
  return Date.now();
}

function countdown() {
  return Math.max(0, state.launchTime - now());
}

function addLog(msg) {
  state.logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (state.logs.length > 15) state.logs.pop();
}

/* =========================
   AUTH MIDDLEWARE
========================= */

function requireDirector(req, res, next) {
  const role = USERS[req.body.email];

  if (role !== ROLE.DIRECTOR) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

/* =========================
   STATE UPDATER
========================= */

function updatePhase() {
  if (state.phase === PHASE.ABORTED) return;

  if (state.launchEnabled) {
    state.phase = countdown() > 0 ? PHASE.COUNTDOWN : PHASE.ACTIVE;
  } else {
    state.phase = PHASE.IDLE;
  }
}

/* =========================
   TELEMETRY ENGINE
========================= */

function updateTelemetry() {
  if (!state.launchEnabled || state.phase === PHASE.ABORTED) return;

  state.telemetry.altitude += Math.random() * 4;
  state.telemetry.velocity += Math.random() * 1.8;
  state.telemetry.fuel = Math.max(0, state.telemetry.fuel - Math.random() * 0.4);

  if (state.telemetry.fuel === 0) {
    addLog("Fuel depleted");
    state.launchEnabled = false;
    state.phase = PHASE.ABORTED;
  }
}

/* =========================
   BROADCAST (throttled)
========================= */

let lastBroadcast = 0;

function broadcast(force = false) {
  const t = now();

  // throttle to 1/sec unless forced
  if (!force && t - lastBroadcast < 1000) return;
  lastBroadcast = t;

  const payload = JSON.stringify({
    ...state,
    countdown: countdown()
  });

  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

/* =========================
   TICK LOOP
========================= */

setInterval(() => {
  updatePhase();
  updateTelemetry();
  broadcast();
}, 1000);

/* =========================
   ROUTES
========================= */

app.post("/login", (req, res) => {
  const role = USERS[req.body.email] || ROLE.GUEST;
  res.json({ role });
});

app.post("/toggle", requireDirector, (req, res) => {
  state.launchEnabled = !state.launchEnabled;

  addLog(`Launch toggled → ${state.launchEnabled}`);

  updatePhase();
  broadcast(true);

  res.json(state);
});

app.post("/abort", requireDirector, (req, res) => {
  state.launchEnabled = false;
  state.phase = PHASE.ABORTED;

  addLog("MISSION ABORTED");

  broadcast(true);

  res.json(state);
});

/* =========================
   WEBSOCKETS
========================= */

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({
    ...state,
    countdown: countdown()
  }));
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`ISA CONTROL RUNNING ON PORT ${PORT}`);
});