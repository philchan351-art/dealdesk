/* ===== 应用入口：hash 路由 / 页面调度 / 全局 Toast / 业务员登录（多用户数据隔离） ===== */
(function () {
  "use strict";

  var TITLES = { home: "谈单看板", buyers: "买家管理", deals: "谈单跟踪", followup: "跟进提醒", settings: "设置" };
  var $ = function (s) { return document.querySelector(s); };
  /* 2026-11-09 多业务域：登录态的 key 由域运行时持有（store.js 先于本文件加载就要读它），
     两处各写一份字符串是"改一处漏一处"的老坑，这里只留一个引用 */
  var AUTH_KEY = (window.DealDomain && DealDomain.AUTH_KEY) || "dealdesk.auth.v1";

  window.Auth = {
    get: function () { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; } },
    save: function (a) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch (e) {} },
    clear: function () { try { localStorage.removeItem(AUTH_KEY); } catch (e) {} }
  };

  function parse() {
    var parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "buyer" && parts[1]) return { screen: "buyer-detail", param: parts[1] };
    /* 2026-10-21（Phil）：其余页面也透传后续段（如 #/buyers/waiting 预选「待回复」）；
       2026-10-22：段用 / 拼接保留（#followup/new/<buyerId> 深链直接打开新建跟进表单） */
    return TITLES[parts[0]] ? { screen: parts[0], param: parts.slice(1).join("/") || null } : { screen: "home", param: null };
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
    /* 2026-10-22（Phil「客户进不去了」Chrome 真机）：render/init 抛异常绝不能静默——
       此前某客户记录缺字段时 render 一抛，页面停住、无任何提示，用户看到的就是"点了没反应"。
       现在：渲染失败 → 可见错误卡（原因+客户名+回列表按钮）；init 失败 → toast 提示 */
    var renderOk = true;
    try {
      el.innerHTML = mod.render(p.param);
    } catch (err) {
      renderOk = false;
      console.error("[render 失败]", p.screen, p.param, err);
      var who = "";
      if (p.screen === "buyer-detail") { var bb = window.Mock.getBuyer(p.param); who = bb ? "客户「" + bb.name + "」" : ""; }
      el.innerHTML = '<div class="empty" style="padding:48px 24px;text-align:center">' +
        '<div style="font-size:34px">⚠️</div>' +
        '<div style="font-weight:700;margin:10px 0 6px">' + who + " 打开失败</div>" +
        '<div class="set-note" style="margin:0 0 14px">' + escHtml(String(err.message || err).slice(0, 80)) + "<br/>报给 Phil 时带上这句话，能直接定位</div>" +
        '<button class="wgo" data-err-back="1">← 回买家列表</button></div>';
      document.title = "谈单舱 · 页面打开失败";
      var eb = el.querySelector("[data-err-back]");
      if (eb) eb.addEventListener("click", function () { App.go("buyers"); });
      return;
    }
    document.querySelectorAll(".tabbar .tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === p.screen || (p.screen === "buyer-detail" && t.dataset.tab === "buyers"));
    });
    document.title = "谈单舱 · " + mod.title;
    injectDomainBadge(); /* 2026-11-09：每次渲染后补域角标（topbar 由页面重绘，角标跟着重建） */
    var fab = $(".fab");
    if (fab) {
      if (p.screen === "buyer-detail") { fab.style.display = "none"; }
      else { fab.style.display = ""; fab.style.bottom = "92px"; }
    }
    if (mod.init) {
      try { mod.init(p.param, el); }
      catch (err2) {
        console.error("[init 失败]", p.screen, p.param, err2);
        if (renderOk) App.toast("页面初始化出错：" + String(err2.message || err2).slice(0, 40));
      }
    }
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
        /* 2026-11-09：服务端 /auth 一旦回 domain 字段就以它为准（管理员在成员卡里指定的域）；
           服务端还没这个字段时为空 → startApp 里弹一次性选择卡。
           注意：这只是界面归属，服务端注入资料/话术要真正按域隔离，还需 /llm 与 /shared 按 domainId 过滤 */
        Auth.save({
          key: j.key, name: j.name, role: j.role || "rep", session: j.session,
          domainId: j.domain || j.domainId || ""
        });
        var st2 = Store.getSettings() || {};
        st2.name = j.name;
        Store.saveSettings(st2);
        App.toast("你好，" + j.name);
        startApp(j.name, true);
        if (window.DDSharedPrefetch) setTimeout(window.DDSharedPrefetch, 300); /* 2026-10-21：登录成功后预取话术 */
      }).catch(function (e) {
        fail(e.message);
        go.disabled = false;
      });
    }
    go.addEventListener("click", submit);
    el.querySelector("#authPass2").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    el.querySelector("#authPass").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  /* ===== 2026-11-09（Phil 裁决「业务员一人绑一域」）：业务域绑定卡 =====
     未绑域的账号绝不进应用，也绝不自动挑一个域——挑错域 = 看到另一套产品事实/话术/客户，
     比让人多按一下严重得多。老账号升级后第一次登录会看到这张卡（一次性）。 */
  function domainPickerHtml() {
    var ids = window.DealDomain ? DealDomain.ids() : [];
    var name = (Auth.get() || {}).name || "";
    return '<div class="auth-wrap"><div class="auth-brand">' +
      '<div class="auth-logo"><img src="logo.jpg?v=51" alt="谈单舱"/></div>' +
      '<h1>选择业务域</h1><p>' + escHtml(name) + '，这个账号做哪条业务线？</p></div>' +
      '<div class="auth-card">' +
      '<div class="set-note" style="margin-bottom:10px">一人一域：绑定后只看得到本域的客户、话术、资料与报价口径；' +
      '要换业务线由管理员在「设置 → 成员」里改，改完原域数据对该账号不再可见。</div>' +
      ids.map(function (id) {
        var p = DealDomain.get(id);
        return '<label class="dom-opt" style="display:flex;align-items:flex-start;gap:10px;padding:12px;' +
          'border:1px solid #e3ddd2;border-radius:12px;margin-bottom:8px;cursor:pointer">' +
          '<input type="radio" name="domPick" value="' + escHtml(id) + '" style="margin-top:4px" />' +
          '<span><b style="color:' + escHtml(p.accentColor || "#333") + '">' + escHtml(p.name) + "</b>" +
          '<div class="set-note">' + escHtml(p.stages.length + " 段阶段管道 · " + (p.glossary.length) + " 条术语" +
            (p.brain && p.brain.repliesEnabled ? " · AI 可出稿" : " · AI 暂不出稿（语料未达门槛）")) + "</div></span></label>";
      }).join("") +
      '<button class="auth-btn" id="domGo" style="margin-top:10px">进入谈单舱</button>' +
      '<div class="set-note" id="domMsg"></div>' +
      "</div></div>";
  }
  /* 走错入口的说明卡：说清"这个账号绑哪条线、该去哪个入口"，并给退出通道，不留白屏 */
  function renderEntryMismatch(es) {
    var el = $("#screen");
    el.classList.remove("detail");
    var accDom = (window.DealDomain && DealDomain.get) ? DealDomain.get(es.accountDomain) : null;
    var accName = accDom ? accDom.name : (es.accountDomain || "其它业务线");
    var here = (window.DealDomain && DealDomain.get) ? DealDomain.get(es.entry) : null;
    var other = window.DEAL_DOMAIN_OTHER_ENTRY || "index.html";
    el.innerHTML = '<div class="auth-wrap"><div class="auth-brand">' +
      '<div class="auth-logo"><img src="logo.jpg?v=51" alt="谈单舱"/></div>' +
      '<h1>入口不对</h1><p>这里是「' + escHtml(here ? here.name : "本业务线") + '」工作台</p></div>' +
      '<div class="card" style="margin:0 16px"><div class="ctx-card">' +
      '<div class="ctx-title">当前账号「' + escHtml(es.accountName) + '」绑的是「' + escHtml(accName) + '」</div>' +
      '<div class="set-note" style="margin-top:8px">两个业务域的数据、资料与话术完全分开，所以不能交叉进入。' +
      '要处理「' + escHtml(accName) + '」的客户，请回到 <b>' + escHtml(other) + '</b>；' +
      '要用这个工作台，请退出后用「' + escHtml(here ? here.name : "本业务线") + '」的账号登录（或由管理员新建一个绑本域的账号）。</div>' +
      '<button class="auth-btn" id="mmOut" style="margin-top:12px">退出，换账号</button>' +
      '<a class="auth-btn ghost" href="' + escHtml(other) + '" style="display:block;text-align:center;margin-top:8px">去 ' + escHtml(other) + '</a>' +
      "</div></div></div>";
    document.title = "谈单舱 · 入口不对";
    var p = phoneEl();
    if (p) p.classList.add("auth-on");
    var out = document.getElementById("mmOut");
    if (out) out.addEventListener("click", function () { Auth.clear(); location.hash = "#/"; renderAuth(); });
  }

  function renderDomainPicker() {
    var el = $("#screen");
    el.classList.remove("detail");
    el.innerHTML = domainPickerHtml();
    document.title = "谈单舱 · 选择业务域";
    var p = phoneEl();
    if (p) p.classList.add("auth-on");
    var go = el.querySelector("#domGo"), msg = el.querySelector("#domMsg");
    go.addEventListener("click", function () {
      var pick = el.querySelector('input[name="domPick"]:checked');
      if (!pick) { msg.textContent = "先选一个业务域"; return; }
      var a = Auth.get() || {};
      a.domainId = pick.value;
      Auth.save(a);
      try {
        DealDomain.setAccount(a);
        if (window.Store && Store.migrateDomainTags) Store.migrateDomainTags();
        App.toast("已进入「" + DealDomain.current().name + "」");
        startApp(a.name, false);
      } catch (e) { msg.textContent = String(e.message || e); }
    });
  }
  /* 域角标：让业务员永远知道自己在哪个域（错域发错价是本改造要根治的事故类型）。
     rep 不给切换入口——不是禁用样式，是压根不渲染 */
  function injectDomainBadge() {
    if (!window.DealDomain) return;
    var bd = DealDomain.badge();
    if (!bd) return;
    var host = $(".topbar .tb-title h1") || $(".topbar");
    if (!host) return;
    /* :scope 在老 WebView 里会抛 SyntaxError，而这段每次渲染都跑 → 用 try 兜住，
       宁可角标偶尔不出现，也不能把整个页面渲染打断（"功能偶尔消失"的老坑） */
    try { if (host.querySelector(":scope > .dom-chip")) return; }
    catch (e) { if (host.querySelector(".dom-chip")) return; }
    var chip = document.createElement("span");
    chip.className = "dom-chip";
    chip.setAttribute("style", "display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;" +
      "font-size:11px;font-weight:700;vertical-align:middle;color:#fff;background:" + bd.color);
    chip.textContent = bd.text;
    host.appendChild(chip);
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
    /* 2026-11-09（Phil 裁决「一人绑一域」）：没绑定业务域就不进应用，也不替他猜一个。
       本次升级前建的老账号第一次登录会看到选择卡（一次性），之后由管理员在成员卡里改 */
    if (window.DealDomain) {
      var es = DealDomain.entryState ? DealDomain.entryState() : { state: "none" };
      /* 走错入口：账号绑的是另一条业务线。这里必须拦住——让行李箱账号进面料工作台，
         等于把两个域的数据摆在同一屏上，正是 Phil 要根治的那个现象 */
      if (es.state === "mismatch") { renderEntryMismatch(es); return; }
      var a0 = Auth.get() || {};
      /* 独立入口自带业务域：没绑过就直接按入口绑，不再让新同事猜 */
      if (es.state === "unbound" && es.entry) {
        a0.domainId = es.entry;
        Auth.save(a0);
      }
      var ok = !!a0.domainId;
      if (ok) { try { DealDomain.setAccount(a0); } catch (e) { ok = false; console.warn("[域绑定失败]", e.message); } }
      if (!ok) { renderDomainPicker(); return; }
    }
    if (freshLogin && Store.wipeLocal) Store.wipeLocal();
    /* 2026-10-23（Phil「整个客户状态系列都存在问题」）：启动补跑存量对话回扫。
       index.html 里 store.js 先于 utils.js 加载，store 启动时的迁移此刻 U 尚未定义（自动跳过）；
       这里所有脚本就绪后跑一次——已报价/已成交的存量客户阶段当场补正。幂等：无命中零写入 */
    try { if (window.Store && Store.rescanStages) Store.rescanStages(); } catch (e) { console.warn("[启动回扫失败]", e); }
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
  /* 2026-10-22：全局错误可见化——未捕获异常 / 未处理 Promise 拒绝当场 toast（限流 8s），
     业务员手机上直接看见，报障不再靠猜。console 保留完整堆栈 */
  var _lastErrToast = 0;
  function errToast(msg) {
    var now = Date.now();
    if (now - _lastErrToast < 8000) return;
    _lastErrToast = now;
    if (window.App) App.toast("⚠ " + String(msg).slice(0, 60), 3500);
  }
  window.addEventListener("error", function (e) {
    console.error("[uncaught]", e.message, e.filename, e.lineno);
    errToast(e.message + (e.lineno ? " @" + e.lineno : ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    console.error("[unhandled rejection]", e.reason);
    errToast((e.reason && e.reason.message) || e.reason || "异步任务出错");
  });
  window.addEventListener("DOMContentLoaded", function () {
    if (/[?&]preview=1/.test(location.search)) {
      var st = $(".stage");
      if (st) st.classList.add("preview");
    }
    var a = Auth.get();
    /* P0：旧版本只存了姓名没有会话的本地状态一律要求重新登录（一次性的切换成本，之后 30 天免登） */
    if (!a || !a.session) { renderAuth(); return; }
    startApp(a.name, false);
    /* 2026-10-21（Phil）：启动即预取话术元数据（缓存暖了，进客户页话术卡秒出） */
    if (window.DDSharedPrefetch) setTimeout(window.DDSharedPrefetch, 300);
  });
})();
