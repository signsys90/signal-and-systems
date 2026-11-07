const statusFields = {
  systemState: document.getElementById("systemState"),
  relayState: document.getElementById("relayState"),
  simulationState: document.getElementById("simulationState"),
  watchdogState: document.getElementById("watchdogState"),
  lastCommand: document.getElementById("lastCommand"),
};

const allOffButton = document.getElementById("allOffButton");
const faultBanner = document.getElementById("faultBanner");
const faultText = document.getElementById("faultText");
const comPortInput = document.getElementById("comPortInput");
const baudRateInput = document.getElementById("baudRateInput");
const simulationToggle = document.getElementById("simulationToggle");
const testConnectionButton = document.getElementById("testConnectionButton");
const disconnectButton = document.getElementById("disconnectButton");
const recentLog = document.getElementById("recentLog");

let currentStatus = null;
let socket = null;
let reconnectTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  refreshStatus();
  refreshLogs();
  connectStatusSocket();
  window.setInterval(refreshLogs, 5000);
});

function bindControls() {
  allOffButton.addEventListener("click", () => {
    postJson("/api/all-off");
  });

  document.querySelectorAll("[data-channel-id]").forEach((button) => {
    button.addEventListener("click", () => {
      postJson(`/api/channel/${button.dataset.channelId}/toggle`);
    });
  });

  document.querySelectorAll("[data-profile-id]").forEach((button) => {
    button.addEventListener("click", () => {
      postJson(`/api/profile/${button.dataset.profileId}/activate`);
    });
  });

  testConnectionButton.addEventListener("click", async () => {
    await syncSimulationMode();
    await postJson("/api/connect", {
      com_port: comPortInput.value.trim(),
      baud_rate: Number.parseInt(baudRateInput.value, 10),
    });
  });

  disconnectButton.addEventListener("click", () => {
    postJson("/api/disconnect");
  });

  simulationToggle.addEventListener("change", () => {
    postJson("/api/simulation-mode", { enabled: simulationToggle.checked });
  });
}

async function syncSimulationMode() {
  if (!currentStatus || currentStatus.simulation_mode === simulationToggle.checked) {
    return;
  }
  await postJson("/api/simulation-mode", { enabled: simulationToggle.checked });
}

async function refreshStatus() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) {
      throw new Error(`Status request failed: ${response.status}`);
    }
    applyStatus(await response.json());
  } catch (error) {
    showLocalFault(error.message);
  }
}

async function refreshLogs() {
  try {
    const response = await fetch("/api/logs/recent?limit=20");
    if (!response.ok) {
      throw new Error(`Log request failed: ${response.status}`);
    }
    const payload = await response.json();
    renderLogs(payload.entries || []);
  } catch (error) {
    renderLogs([
      {
        timestamp: new Date().toISOString(),
        action: "log_fetch_failed",
        result: "fault",
        error: error.message,
      },
    ]);
  }
}

async function postJson(url, body) {
  try {
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || `Command failed: ${response.status}`);
    }
    await refreshStatus();
    await refreshLogs();
    return payload;
  } catch (error) {
    showLocalFault(error.message);
    await refreshStatus();
    await refreshLogs();
    return null;
  }
}

function connectStatusSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return;
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${window.location.host}/ws/status`);

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "status") {
      applyStatus(payload.status);
    }
  });

  socket.addEventListener("close", () => {
    setBadge("relay", "DISCONNECTED", "fault");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectStatusSocket, 1600);
  });

  socket.addEventListener("error", () => {
    socket.close();
  });
}

function applyStatus(status) {
  currentStatus = status;
  document.body.classList.toggle("night-mode", status.ui_mode === "night");

  statusFields.systemState.textContent = status.system_state;
  statusFields.relayState.textContent = status.relay_connection;
  statusFields.simulationState.textContent = status.simulation_mode ? "ON" : "OFF";
  statusFields.watchdogState.textContent = status.watchdog_status;
  statusFields.lastCommand.textContent = formatTime(status.last_command_timestamp);
  simulationToggle.checked = Boolean(status.simulation_mode);

  setBadge("system", status.system_state, status.system_state === "FAULT" ? "fault" : "ok");
  setBadge(
    "relay",
    status.relay_connection,
    status.relay_connection === "CONNECTED" || status.relay_connection === "SIMULATION"
      ? "ok"
      : "fault",
  );
  setBadge("simulation", status.simulation_mode ? "ON" : "OFF", status.simulation_mode ? "warn" : "ok");
  setBadge("watchdog", status.watchdog_status, status.watchdog_status === "FAULT" ? "fault" : "ok");
  setBadge("last", formatTime(status.last_command_timestamp), "ok");

  updateChannelCards(status.channels || []);
  updateProfileCards(status.active_profiles || []);
  updateFaultBanner(status.faults || []);
}

function updateChannelCards(channels) {
  channels.forEach((channel) => {
    const button = document.querySelector(`[data-channel-id="${channel.id}"]`);
    if (!button) {
      return;
    }
    const status = channel.status || (channel.is_on ? "ON" : "OFF");
    button.classList.toggle("is-on", status === "ON" || status === "ACTIVE");
    button.classList.toggle("is-off", status === "OFF");
    button.classList.toggle("is-fault", status === "FAULT");

    setChildText(button, "status", status);
    setChildText(button, "mapping", channel.mapping || `Relay CH${channel.channel}`);
    setChildText(button, "controlled_by", channel.controlled_by || "laptop");
    setChildText(button, "last_command", formatTime(channel.last_command_timestamp));

    const pill = button.querySelector("[data-field='status']");
    pill.className = "state-pill";
    pill.classList.add(status === "FAULT" ? "fault" : status === "OFF" ? "off" : "on");
  });
}

function updateProfileCards(activeProfiles) {
  document.querySelectorAll("[data-profile-id]").forEach((button) => {
    const active = activeProfiles.includes(button.dataset.profileId);
    button.classList.toggle("is-active", active);
    setChildText(button, "profile_status", active ? "ACTIVE" : "READY");
    const pill = button.querySelector("[data-field='profile_status']");
    pill.className = "state-pill";
    pill.classList.add(active ? "active" : "off");
  });
}

function updateFaultBanner(faults) {
  if (!faults.length) {
    faultBanner.hidden = true;
    faultText.textContent = "No active faults";
    return;
  }
  const latest = faults[faults.length - 1];
  faultBanner.hidden = false;
  faultText.textContent = `${latest.source}: ${latest.message}`;
}

function showLocalFault(message) {
  faultBanner.hidden = false;
  faultText.textContent = message;
}

function renderLogs(entries) {
  recentLog.replaceChildren();
  if (!entries.length) {
    const item = document.createElement("li");
    item.innerHTML = "<strong>No events yet</strong><span>Commands will appear here.</span>";
    recentLog.appendChild(item);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement("li");
    if (entry.result === "fault" || entry.error || entry.message) {
      item.classList.add("fault");
    }
    const title = entry.action || entry.source || "event";
    const detail = entry.error || entry.message || entry.result || "ok";
    item.innerHTML = `
      <time>${formatTime(entry.timestamp)}</time>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    `;
    recentLog.appendChild(item);
  });
}

function setBadge(name, text, stateClass) {
  const badge = document.querySelector(`[data-badge="${name}"]`);
  if (!badge) {
    return;
  }
  badge.classList.remove("ok", "warn", "fault");
  badge.classList.add(stateClass);
  const strong = badge.querySelector("strong");
  if (strong) {
    strong.textContent = text || "None";
  }
}

function setChildText(parent, field, value) {
  const element = parent.querySelector(`[data-field="${field}"]`);
  if (element) {
    element.textContent = value || "None";
  }
}

function formatTime(value) {
  if (!value) {
    return "None";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

