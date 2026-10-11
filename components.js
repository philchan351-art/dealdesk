/* ===== 组件层：跨页面复用的 HTML 片段 ===== */
(function () {
  "use strict";

  function topbar(title, sub, right) {
    return '<div class="topbar"><div class="tb-title"><h1>' + title + "</h1>" +
      (sub ? '<div class="tb-sub">' + sub + "</div>" : "") + "</div>" +
      (right || "") + "</div>";
  }

  var BELL = '<div class="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg><em>' +
    U.unreadTotal() + "</em></div>";

  var GEAR = '<button class="tb-bell" data-act="settings" aria-label="设置"><svg viewBox="0 0 24 24"><path d="M4 7h9M19 7h1M4 12h3M13 12h7M4 17h12M21 17h-1"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18.5" cy="17" r="2.2"/></svg></button>';

  window.UI = {
    topbar: topbar,
    bell: BELL,
    gear: GEAR
  };
})();
