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

  var lastKey = "";
  function nav() {
    var p = parse();
    var mod = window.Screens[p.screen];
    var el = $("#screen");
    if (!mod) return;
    /* 2026-10-18（Phil：进客户页"页面不断自己往上拉+闪烁"）：同一页面的刷新不得把
       #screen 强制回顶——此前任何后台事件（翻译完成/意向完成）都整页重绘并归零，
       十几秒内被反复拽回页面顶部。换页才归零，同页刷新恢复原滚动位置 */
    var key = p.screen + "/" + (p.param || "");
    var sameScreen = (key === lastKey);
    lastKey = key;
    var prevTop = el.scrollTop;
    window.DDNav = { same: sameScreen }; /* 页面模块用此区分"进入页面"与"同页刷新" */
    el.classList.toggle("detail", p.screen === "buyer-detail");
    el.innerHTML = mod.render(p.param);
    document.querySelectorAll(".tabbar .tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === p.screen || (p.screen === "buyer-detail" && t.dataset.tab === "buyers"));
    });
    document.title = "谈单舱 · " + mod.title;
    var fab = $(".fab");
    if (fab) {
      if (p.screen === "buyer-detail") { fab.style.display = "none"; }
      else { fab.style.display = ""; fab.style.bottom = "92px"; }
    }
    if (mod.init) mod.init(p.param, el);
    /* 同页刷新恢复外层滚动位置，换页回顶。必须 instant：.screen 带 scroll-behavior:smooth，
       用默认赋值会被平滑动画，恢复动作本身反而变成可见的"滚动" */
    var target = sameScreen ? prevTop : 0;
    try { el.scrollTo({ top: target, behavior: "instant" }); }
    catch (e) { el.scrollTop = target; }
  }

  function phoneEl() { return $(".phone"); }

  /* ===== 登录页 ===== */
  function authHtml() {
    var st = Store.getSettings() || {};
    var cl = st.cloud || {};
    return '<div class="auth-wrap">' +
      '<div class="auth-brand"><div class="auth-logo"><img src="logo.jpg?v=51" alt="谈单舱"/></div><h1>谈单舱</h1><p>B2B 谈单工作台 · 每位业务员只看自己的客户</p></div>' +
      '<div class="auth-card">' +
      '<div class="auth-tabs"><span id="authTabLogin" class="on">登录</span><span id="authTabReg">新账号</span></div>' +
      '<label class="set-lbl">姓名</label>' +
      '<input class="set-inp" id="authName" type="text" maxlength="20" placeholder="你的名字（如 Cherry）"/>' +
      '<label class="set-lbl" id="authPassLbl">密码</label>' +
      '<input class="set-inp" id="authPass" type="password" placeholder="你的密码"/>' +
      '<input class="set-inp" id="authPass2" type="password" placeholder="确认密码" style="display:none"/>' +
      '<div id="authTokenBox" style="display:none">' +
      '<label class="set-lbl">团队口令（找管理员要）</label>' +
      '<input class="set-inp" id="authTeamToken" type="password" placeholder="形如 dd-2026-xxxx（只在新建账号时需要，不会被保存）"/>' +
      "</div>" +
      '<button class="auth-btn" id="authGo">登录</button>' +
      '<div class="set-note" id="authMsg"></div>' +
      '<details class="auth-cloud"><summary>云服务设置（首次使用 / 报错时展开）</summary>' +
      '<label class="set-lbl">云服务地址</label>' +
      '<input class="set-inp" id="authCloudUrl" type="url" placeholder="https://….fcapp.run" value="' + (cl.proxyUrl || "https://dealdes-clnhfkexse.cn-hangzhou.fcapp.run") + '"/>' +
      '<div class="set-note">地址已预填。团队口令只在「新账号」时填一次，登录不需要</div>' +
      "</details>" +
      "</div>" +
      '<div style="text-align:center;font-size:12px;color:var(--muted);margin-top:12px">第一次用？<a href="manual.html?v=55" style="color:var(--brand-deep);text-decoration:underline">先看 2 分钟使用手册</a>，看完就能上手</div>' +
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
      el.querySelector("#authTokenBox").style.display = m === "register" ? "" : "none";
      el.querySelector("#authPass").placeholder = m === "register" ? "至少 6 位，且同时包含字母和数字" : "你的密码";
      go.textContent = m === "register" ? "创建账号并登录" : "登录";
    }
    tabL.addEventListener("click", function () { setMode("login"); });
    tabR.addEventListener("click", function () { setMode("register"); });

    function submit() {
      var cUrl = el.querySelector("#authCloudUrl").value.trim();
      if (cUrl) {
        var st = Store.getSettings() || {};
        var oldCl = st.cloud || {};
        /* P0：只存云服务地址；团队口令不再持久化（仅注册时临时使用） */
        st.cloud = { proxyUrl: cUrl, token: oldCl.token || "" };
        Store.saveSettings(st);
      }
      var name = el.querySelector("#authName").value.trim();
      var pass = el.querySelector("#authPass").value;
      var teamTok = el.querySelector("#authTeamToken").value.trim();
      function fail(text) { msg.textContent = text; App.toast(text); }
      if (!name) { fail("请先输入姓名"); return; }
      if (!pass) { fail("请输入密码"); return; }
      if (mode === "register" && pass !== p2.value) { fail("两次输入的密码不一致"); return; }
      if (!window.Sync || !Sync.hasCloud()) {
        var det = el.querySelector(".auth-cloud");
        if (det) det.open = true;
        fail("先填「云服务设置」里的云服务地址（已预填，直接点登录即可）");
        return;
      }
      go.disabled = true;
      msg.textContent = mode === "register" ? "创建中…" : "登录中…";
      Sync.authCall(name, pass, mode, teamTok, 15000).then(function (j) {
        Auth.save({ key: j.key, name: j.name, role: j.role || "rep", session: j.session });
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
    document.title = "谈单舱 · 业务员登录";
    var p = phoneEl();
    if (p) p.classList.add("auth-on");
    bindAuth();
  }

  /* freshLogin=true：切换/新建账号后清本地旧数据，只保留云端该账号的数据 */
  function startApp(name, freshLogin) {
    var p = phoneEl();
    if (p) p.classList.remove("auth-on");
    if (freshLogin && Store.wipeLocal) Store.wipeLocal();
    /* 2026-10-17（Phil 反馈："我重新进入软件，一定会出现这个；然后会自动打开录音，这个就是bug了"）：
       移除"首次触摸自动预热麦克风"——进应用后第一次点按任何位置都会自动申请麦克风权限并真实开启录音，
       属于用户未预期的惊吓。现在麦克风只在真正按住「🎤 按住说话」时才申请；
       万一第一次按住时弹的系统框被点了 Cancel，由常驻恢复面板（Voice.showDeniedPanel）兜底教学，
       不会锁死。 */
    if (!location.hash || location.hash === "#/") history.replaceState(null, "", "#/home");
    nav();
    if (window.Sync && Sync.enabled()) {
      Sync.pull().then(function (server) {
        /* 三种必须应用云端的情况：重新登录（本地刚清空）/ 本地是空的（防"卡空"）/ 云端更新
           修复（审计 M3）：cur 用"上次同步到的云端版本"(serverAt) 而非本机 savedAt——
           本机时钟偏快会让 server.updatedAt 永远不大于本地时间，导致这台设备再也拉不到新数据 */
        var snap = Store.snapshot();
        var cur = (Store.getServerAt && Store.getServerAt()) || "";
        var localEmpty = !(snap.buyers && snap.buyers.length);
        if (server && server.updatedAt && (freshLogin || localEmpty || server.updatedAt > cur)) {
          Store.applySnapshot(server);
          nav();
          App.toast(freshLogin ? "已拉取你的云端数据" : "已拉取最新数据");
        }
      }).catch(function (e) {
        var m = String(e.message || e);
        if (/请重新登录|会话失效|用户不存在|账号已停用/.test(m)) {
          Auth.clear();
          renderAuth();
          App.toast(/账号已停用/.test(m) ? "账号已停用，请联系管理员" : "登录状态已失效，请重新登录");
        } else {
          console.warn("云端拉取失败：", e.message);
          App.toast("云端数据没拉下来：" + m);
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
    toast: function (msg, ms) {
      var phone = $(".phone");
      var t = phone.querySelector(".toast");
      if (!t) { t = document.createElement("div"); t.className = "toast"; phone.appendChild(t); }
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(t._h);
      t._h = setTimeout(function () { t.classList.remove("show"); }, ms || 1900);
    }
  };

  window.addEventListener("hashchange", nav);
  window.addEventListener("DOMContentLoaded", function () {
    if (/[?&]preview=1/.test(location.search)) {
      var st = $(".stage");
      if (st) st.classList.add("preview");
    }
    var a = Auth.get();
    /* P0：旧版本只存了姓名没有会话的本地状态一律要求重新登录（一次性的切换成本，之后 30 天免登） */
    if (!a || !a.session) { renderAuth(); return; }
    startApp(a.name, false);
  });
})();
