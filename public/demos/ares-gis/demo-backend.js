/*
 * Browser-only stand-in for the ARES Duval GIS server API.
 * GET answers were recorded from the real server running locally with fictional DEMO operators,
 * incidents and tasks, tracking and radio providers off, and repeater and frequency lists removed.
 * Anything that would change data is refused: the demo is read-only. Map tiles load from the
 * same public tile servers the app uses.
 */
(function () {
  const REC = window.__GIS_DEMO__ || {};
  const READ_ONLY = { ok: false, error: "This is the read-only online demo with fictional data. Changes work in the deployed app." };
  const json = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: { "Content-Type": "application/json" } });
  const realFetch = window.fetch.bind(window);
  function lookup(path, search) {
    if (REC[path + search]) return REC[path + search];
    if (REC[path]) return REC[path];
    // Same route with any query string recorded.
    const k = Object.keys(REC).find((x) => x.split("?")[0] === path);
    return k ? REC[k] : null;
  }
  window.fetch = function (input, init) {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const i = url.pathname.indexOf("/api/");
    if (i < 0) return realFetch(input, init);
    const path = url.pathname.slice(i);
    const method = ((init && init.method) || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    if (method !== "GET") return Promise.resolve(json(READ_ONLY, 403));
    if (path.startsWith("/api/reference/fl511-camera-image")) return Promise.resolve(new Response("", { status: 404 }));
    const hit = lookup(path, url.search);
    if (!hit) return Promise.resolve(json({ error: "Not part of the online demo" }, 404));
    return Promise.resolve(json(hit.body, hit.status));
  };
  // Location sharing needs the server; keep the browser from asking for the visitor's location.
  try {
    if (navigator.geolocation) {
      const deny = (ok, fail) => { if (fail) fail({ code: 1, message: "Location is turned off in the online demo" }); return 0; };
      Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: deny, watchPosition: deny, clearWatch() {} } });
    }
  } catch (e) { /* leave as is */ }
})();
