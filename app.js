/* ===== 应用入口：hash 路由 / 页面调度 / 全局 Toast / 业务员登录（多用户数据隔离） ===== */
(function () {
  "use strict";

  var TITLES = { home: "谈单看板", buyers: "买家管理", deals: "谈单跟踪", followup: "跟进提醒", settings: "设置" };
  var $ = function (s) { return document.querySelector(s); };
  var AUTH_KEY = "dealdesk.auth.v1";

  window.Auth = {
    get: function () { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; } },
    save: function (a) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch (e) {} },
    clear: function () { try { localStorage.removeItem(AUTH_KEY); } catch (e) {} }
  };

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

  function phoneEl() { return $(".phone"); }

  /* ===== 登录页 ===== */
  function authHtml() {
    var st = Store.getSettings() || {};
    var cl = st.cloud || {};
    return '<div class="auth-wrap">' +
      '<div class="auth-brand"><div class="auth-logo">D</div><h1>DealDesk</h1><p>谈单工作台 · 每位业务员只看自己的客户</p></div>' +
      '<div class="auth-card">' +
      '<div class="auth-tabs"><span id="authTabLogin" class="on">登录</span><span id="authTabReg">新账号</span></div>' +
      '<label class="set-lbl">姓名</label>' +
      '<input class="set-inp" id="authName" type="text" maxlength="20" placeholder="你的名字（如 Cherry）"/>' +
      '<label class="set-lbl">密码</label>' +
      '<input class="set-inp" id="authPass" type="password" placeholder="至少 4 位"/>' +
      '<input class="set-inp" id="authPass2" type="password" placeholder="确认密码" style="display:none"/>' +
      '<button class="auth-btn" id="authGo">登录</button>' +
      '<div class="set-note" id="authMsg"></div>' +
      '<details class="auth-cloud"><summary>云服务设置（首次使用 / 报错时展开）</summary>' +
      '<label class="set-lbl">云服务地址</label>' +
      '<input class="set-inp" id="authCloudUrl" type="url" placeholder="https://….fcapp.run" value="' + (cl.proxyUrl || "https://dealdes-clnhfkexse.cn-hangzhou.fcapp.run") + '"/>' +
      '<label class="set-lbl">团队口令（管理员给）</label>' +
      '<input class="set-inp" id="authCloudToken" type="password" placeholder="形如 dd-2026-xxxx（找管理员要）" value="' + (cl.token || "") + '"/>' +
      "</details>" +
      "</div>" +
      "</div>";
  }

  function bindAuth() {
    var el = $("#screen");
    var mode = "login";
    var tabL = el.querySelector("#authTabLogin");
    var tabR = el.querySelector("#authTabReg");
    var p2 = el.querySelector("#authPass2");
    var go = el.querySelector("#authGo");
    var msg = el.querySelector("#authMsg");
    function setMode(m) {
      mode = m;
      tabL.classList.toggle("on", m === "login");
      tabR.classList.toggle("on", m === "register");
      p2.style.display = m === "register" ? "" : "none";
      go.textContent = m === "register" ? "创建账号并登录" : "登录";
    }
    tabL.addEventListener("click", function () { setMode("login"); });
    tabR.addEventListener("click", function () { setMode("register"); });

    function submit() {
      var cUrl = el.querySelector("#authCloudUrl").value.trim();
      var cTok = el.querySelector("#authCloudToken").value.trim();
      if (cUrl || cTok) {
        var st = Store.getSettings() || {};
        st.cloud = {
          proxyUrl: cUrl || (st.cloud || {}).proxyUrl || "",
          token: cTok || (st.cloud || {}).token || ""
        };
        Store.saveSettings(st);
      }
      var name = el.querySelector("#authName").value.trim();
      var pass = el.querySelector("#authPass").value;
      function fail(text) { msg.textContent = text; App.toast(text); }
      if (!name) { fail("请先输入姓名"); return; }
      if (!pass) { fail("请输入密码"); return; }
      if (mode === "register" && pass !== p2.value) { fail("两次输入的密码不一致"); return; }
      if (!window.Sync || !Sync.enabled()) {
        var det = el.querySelector(".auth-cloud");
        if (det) det.open = true;
        fail("先填「云服务设置」里的团队口令（找管理员要）");
        return;
      }
      go.disabled = true;
      msg.textContent = mode === "register" ? "创建中…" : "登录中…";
      Sync.authCall(name, pass, mode, 15000).then(function (j) {
        Auth.save({ key: j.key, name: j.name });
        var st2 = Store.getSettings() || {};
        st2.name = j.name;
        Store.saveSettings(st2);
        App.toast("你好，" + j.name);
        startApp(j.name, true);
      }).catch(function (e) {
        fail(e.message);
        go.disabled = false;
      });
    }
    go.addEventListener("click", submit);
    el.querySelector("#authPass2").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    el.querySelector("#authPass").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  function renderAuth() {
    var el = $("#screen");
    el.classList.remove("detail");
    el.innerHTML = authHtml();
    document.title = "DealDesk · 业务员登录";
    var p = phoneEl();
    if (p) p.classList.add("auth-on");
    bindAuth();
  }

  /* freshLogin=true：切换/新建账号后清本地旧数据，只保留云端该账号的数据 */
  function startApp(name, freshLogin) {
    var p = phoneEl();
    if (p) p.classList.remove("auth-on");
    if (freshLogin && Store.wipeLocal) Store.wipeLocal();
    if (!location.hash || location.hash === "#/") history.replaceState(null, "", "#/home");
    nav();
    if (window.Sync && Sync.enabled()) {
      Sync.pull().then(function (server) {
        /* 重新登录后本地刚被清空，云端就是权威数据源，只要云端有数据就强制应用（不做新旧比较，避免"本地看起来更新"把云端数据扔掉） */
        var cur = Store.snapshot().updatedAt || "";
        if (server && server.updatedAt && (freshLogin || server.updatedAt > cur)) {
          Store.applySnapshot(server);
          nav();
          App.toast(freshLogin ? "已拉取你的云端数据" : "已拉取最新数据");
        }
      }).catch(function (e) {
        if (/请重新登录|用户不存在/.test(String(e.message))) {
          Auth.clear();
          renderAuth();
          App.toast("账号已失效，请重新登录");
        } else {
          console.warn("云端拉取失败：", e.message);
          App.toast("云端数据没拉下来：" + e.message);
        }
      });
    }
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
    var a = Auth.get();
    if (!a) { renderAuth(); return; }
    startApp(a.name, false);
  });
})();
