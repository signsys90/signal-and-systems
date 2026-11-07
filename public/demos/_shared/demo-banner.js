/* Signal & Systems demo bar: says what the visitor is looking at and links back. */
(function () {
  var d = document.currentScript && document.currentScript.dataset || {};
  function mount() {
    if (document.getElementById("ss-demo-bar")) return;
    var bar = document.createElement("div");
    bar.id = "ss-demo-bar";
    bar.setAttribute("role", "note");
    bar.innerHTML =
      '<strong>Live demo</strong><span>' + (d.note || "Runs in your browser with demonstration data. Nothing is saved or sent anywhere.") +
      '</span><a href="' + (d.back || "/projects/") + '">Back to the project page</a>';
    var st = document.createElement("style");
    st.textContent =
      "#ss-demo-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;flex-wrap:wrap;gap:.25rem .75rem;align-items:center;" +
      "padding:.45rem 1rem;background:#0b1220;color:#e6edf7;border-top:2px solid #f5a524;box-shadow:0 -4px 16px rgba(0,0,0,.35);font:500 13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif}" +
      "#ss-demo-bar strong{color:#f5a524;text-transform:uppercase;letter-spacing:.06em;font-size:12px}" +
      "#ss-demo-bar span{flex:1 1 18rem}#ss-demo-bar a{color:#7cc4ff;text-decoration:underline;white-space:nowrap}";
    document.head.appendChild(st);
    var pad=function(){document.documentElement.style.scrollPaddingBottom=bar.offsetHeight+"px";document.body.style.paddingBottom=bar.offsetHeight+"px";};
    document.body.appendChild(bar); pad(); window.addEventListener("resize", pad);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
