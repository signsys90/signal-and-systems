(function() {
  var _a, _b;
  function applyTheme(mode) {
    var _a2;
    try {
      if ((_a2 = window.AresMap) == null ? void 0 : _a2.setBaseMapTheme) {
        window.AresMap.setBaseMapTheme(mode);
      }
    } catch (_) {
    }
  }
  window.setThemeMap = function setThemeMap(mode) {
    applyTheme(mode);
  };
  window.addEventListener("ares:theme-changed", (event) => {
    var _a2, _b2, _c;
    applyTheme(((_a2 = event == null ? void 0 : event.detail) == null ? void 0 : _a2.mode) || ((_c = (_b2 = window.AresTheme) == null ? void 0 : _b2.getMode) == null ? void 0 : _c.call(_b2)) || "day");
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      var _a2, _b2;
      applyTheme(((_b2 = (_a2 = window.AresTheme) == null ? void 0 : _a2.getMode) == null ? void 0 : _b2.call(_a2)) || "day");
    }, { once: true });
  } else {
    applyTheme(((_b = (_a = window.AresTheme) == null ? void 0 : _a.getMode) == null ? void 0 : _b.call(_a)) || "day");
  }
})();
