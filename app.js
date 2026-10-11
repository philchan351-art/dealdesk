/* ===== 应用入口：hash 路由 / 页面调度 / 全局 Toast ===== */
(function () {
  "use strict";

  var TITLES = { home: "谈单看板", buyers: "买家管理", deals: "谈单跟踪", followup: "跟进提醒", settings: "设置" };
  var $ = function (s) { return document.querySelector(s); };

  function parse() {
    var parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "buyer" && parts[1]) return { screen: "buyer-detail", param: parts[1] };
    return TITLES[parts[0]] ? { screen: parts[0], param: null } : { screen: "home", param: null };
  }

  function nav() {
    var p = parse();
    var mod = window.Screens[p.screen];
    var el = $("#screen");
    if (!mod) return;
    el.classList.toggle("detail", p.screen === "buyer-detail");
    el.scrollTop = 0;
    el.innerHTML = mod.render(p.param);
    document.querySelectorAll(".tabbar .tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === p.screen || (p.screen === "buyer-detail" && t.dataset.tab === "buyers"));
    });
    document.title = "DealDesk · " + mod.title;
    var fab = $(".fab");
    if (fab) {
      if (p.screen === "buyer-detail") { fab.style.display = "none"; }
      else { fab.style.display = ""; fab.style.bottom = "92px"; }
    }
    if (mod.init) mod.init(p.param, el);
  }

  window.App = {
    refresh: function () { nav(); },
    go: function (screen, param) {
      var target = "/" + (param ? screen + "/" + param : screen);
      if (location.hash === "#" + target) { nav(); return; }
      location.hash = target;
    },
    toast: function (msg) {
      var phone = $(".phone");
      var t = phone.querySelector(".toast");
      if (!t) { t = document.createElement("div"); t.className = "toast"; phone.appendChild(t); }
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(t._h);
      t._h = setTimeout(function () { t.classList.remove("show"); }, 1900);
    }
  };

  window.addEventListener("hashchange", nav);
  window.addEventListener("DOMContentLoaded", function () {
    if (/[?&]preview=1/.test(location.search)) {
      var st = $(".stage");
      if (st) st.classList.add("preview");
    }
    if (!location.hash) history.replaceState(null, "", "#/home");
    nav();
    if (window.Sync && Sync.enabled()) {
      Sync.pull().then(function (server) {
        if (server && server.updatedAt && server.updatedAt > (Store.snapshot().updatedAt || "")) {
          Store.applySnapshot(server);
          nav();
          App.toast("已拉取最新团队数据");
        }
      }).catch(function (e) { console.warn("云端拉取失败：", e.message); });
    }
  });
})();
