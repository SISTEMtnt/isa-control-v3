const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static("public"));

/* =========================
   USERS
========================= */

const USERS = {
    "andreatnt12@hotmail.com": "director"
};

/* =========================
   STATE ENGINE
========================= */

let state = {
    launchEnabled: false,
    launchTime: Date.now() + 300000,
    phase: "IDLE",
    logs: [],
    telemetry: {
        altitude: 0,
        velocity: 0,
        fuel: 100
    }
};

/* =========================
   LOG SYSTEM
========================= */

function log(msg){
    state.logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if(state.logs.length > 15) state.logs.pop();
}

/* =========================
   COUNTDOWN
========================= */

function countdown(){
    return Math.max(0, state.launchTime - Date.now());
}

/* =========================
   TELEMETRY SIMULATION
========================= */

setInterval(()=>{

    if(state.launchEnabled){

        state.telemetry.altitude += Math.random() * 3;
        state.telemetry.velocity += Math.random() * 1.5;
        state.telemetry.fuel -= Math.random() * 0.3;

        if(state.telemetry.fuel < 0)
            state.telemetry.fuel = 0;

    }

    broadcast();

},1000);

/* =========================
   AUTH
========================= */

app.post("/login",(req,res)=>{

    const role = USERS[req.body.email] || "guest";
    res.json({ role });

});

/* =========================
   ACTIONS
========================= */

app.post("/toggle",(req,res)=>{

    if(USERS[req.body.email] !== "director")
        return res.sendStatus(403);

    state.launchEnabled = !state.launchEnabled;

    log("Launch toggled: " + state.launchEnabled);

    broadcast();

    res.json(state);

});

app.post("/abort",(req,res)=>{

    if(USERS[req.body.email] !== "director")
        return res.sendStatus(403);

    state.launchEnabled = false;
    state.phase = "ABORTED";

    log("MISSION ABORTED");

    broadcast();

    res.json(state);

});

/* =========================
   WEBSOCKET
========================= */

function broadcast(){

    const payload = JSON.stringify({
        ...state,
        countdown: countdown()
    });

    wss.clients.forEach(c=>{
        if(c.readyState === WebSocket.OPEN){
            c.send(payload);
        }
    });

}

wss.on("connection",(ws)=>{
    ws.send(JSON.stringify({
        ...state,
        countdown: countdown()
    }));
});

/* =========================
   START
========================= */

server.listen(3000,()=>{
    console.log("ISA CONTROL V3 RUNNING");
});