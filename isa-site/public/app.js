let email = "";
let role = "guest";

const ws = new WebSocket("ws://localhost:3000");

ws.onmessage = (msg)=>{

    const data = JSON.parse(msg.data);

    document.getElementById("countdown").innerText =
        "T-" + Math.floor(data.countdown/1000) + "s";

    document.getElementById("status").innerText =
        data.launchEnabled ? "LAUNCH ARMED" : "DISABLED";

    document.getElementById("telemetry").innerText =
        `ALT: ${data.telemetry.altitude.toFixed(1)} | ` +
        `VEL: ${data.telemetry.velocity.toFixed(1)} | ` +
        `FUEL: ${data.telemetry.fuel.toFixed(1)}`;

    document.getElementById("logs").innerText =
        data.logs.join("\n");

};

/* LOGIN */

function login(){

    email = document.getElementById("email").value;

    fetch("/login",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email })
    })
    .then(r=>r.json())
    .then(d=>{

        role = d.role;

        document.getElementById("role").innerText =
            "ROLE: " + role;

        if(role === "director"){
            document.getElementById("directorPanel").style.display = "block";
        }

    });

}

/* ACTIONS */

function toggleLaunch(){

    fetch("/toggle",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email })
    });

}

function abortLaunch(){

    fetch("/abort",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email })
    });

}