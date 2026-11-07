(function() {
  const STORAGE_KEY = "ares-theme-mode";
  function normalize(mode) {
    const value = String(mode || "").toLowerCase();
    return value === "dark" || value === "night" ? "dark" : "day";
  }
  function apply(mode) {
    const resolved = normalize(mode);
    document.body.classList.toggle("theme-dark", resolved === "dark");
    document.body.classList.toggle("theme-day", resolved !== "dark");
    document.body.dataset.theme = resolved;
    try {
      localStorage.setItem(STORAGE_KEY, resolved);
    } catch (_) {
    }
    window.dispatchEvent(new CustomEvent("ares:theme-changed", { detail: { mode: resolved } }));
    return resolved;
  }
  function getMode() {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY) || "day");
    } catch (_) {
      return "day";
    }
  }
  function toggle() {
    const next = getMode() === "dark" ? "day" : "dark";
    return apply(next);
  }
  window.AresTheme = { apply, toggle, getMode };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => apply(getMode()));
  } else {
    apply(getMode());
  }
})();
