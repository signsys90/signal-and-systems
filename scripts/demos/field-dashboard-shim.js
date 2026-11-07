/*
 * Browser-only stand-in for the ARES CF-33 Field Dashboard's Electron bridge (window.aresDashboard).
 * Settings start from the app's built-in defaults (Windows user folder renamed). Changes live in this
 * tab only. Programs, folders and file dialogs belong to the Toughbook, so the demo says what each
 * button would do instead of doing it. Web links open normally, as they do in the app.
 */
(function () {
  const clone = (v) => JSON.parse(JSON.stringify(v));
  let settings = clone(window.__FIELD_DEMO_SETTINGS__);
  const DEMO_PORTS = [
    { id: "COM3", name: "USB Serial Device (COM3)", description: "Demo entry: a radio programming cable would appear like this", manufacturer: "Demo", status: "OK" },
    { id: "COM4", name: "u-blox GNSS receiver (COM4)", description: "Demo entry: a GPS receiver would appear like this", manufacturer: "Demo", status: "OK" },
  ];
  const kindOf = (l) => l.kind || "program";
  async function battery() {
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        return { percent: Math.round(b.level * 100), charging: b.charging, source: "This browser (demo)" };
      }
    } catch (e) { /* not offered */ }
    return { percent: null, charging: null, source: "Not available in the browser demo" };
  }
  const notChecked = (key, label, path, kind) => ({ key, label, path, kind, exists: false,
    message: kind === "url" ? "Web link" : "Not checked in the browser demo (this path is on the Toughbook)" });
  window.aresDashboard = {
    getSettings: async () => clone(settings),
    saveSettings: async (next) => { settings = clone(next); return clone(settings); },
    launchProgram: async (l) => {
      const target = (l.path || "").trim();
      if (!target) return { ok: false, message: "No path configured." };
      if (kindOf(l) === "url" && /^https?:\/\//i.test(target)) { window.open(target, "_blank", "noopener"); return { ok: true, message: "Opened " + l.label + "." }; }
      return { ok: true, message: "Demo: on the Toughbook this starts " + l.label + " (" + target + ")." };
    },
    openFolder: async (p) => ({ ok: true, message: "Demo: on the Toughbook this opens " + p + "." }),
    chooseExecutable: async () => { alert("Demo: the app opens a Windows file picker here."); return null; },
    chooseFolder: async () => { alert("Demo: the app opens a Windows folder picker here."); return null; },
    getComPorts: async () => DEMO_PORTS.map((p) => Object.assign({}, p, { note: settings.comPortNotes[p.id] || "" })),
    saveComPortNote: async (id, note) => { settings.comPortNotes[id] = note; return clone(settings); },
    getSystemStatus: async () => ({ battery: await battery(), network: { online: navigator.onLine, adapters: [] }, currentTime: new Date().toISOString() }),
    getReadiness: async () => ({
      launchers: settings.launchers.map((l) => notChecked(l.key, l.label, l.path, kindOf(l))),
      folders: settings.folders.map((f) => notChecked(f.key, f.label, f.path, "folder")),
      checkedAt: new Date().toISOString(),
    }),
    createFolder: async (p) => ({ ok: true, message: "Demo: on the Toughbook this creates " + p + "." }),
    createKitFolders: async () => ({ ok: true, message: "Demo: on the Toughbook this creates the ARES-KIT folders and default templates.", settings: clone(settings) }),
    exportSettings: async () => ({ ok: false, message: "Demo: export saves a JSON file on the Toughbook. It is turned off online." }),
    importSettings: async () => ({ ok: false, message: "Demo: import reads a JSON file on the Toughbook. It is turned off online." }),
  };
})();
