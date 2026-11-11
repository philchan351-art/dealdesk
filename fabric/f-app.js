/* 面料工作台 UI（第①步）。只读写 dd.fabric.v1，与另一条业务线零共享数据。 */
(function (global) {
  "use strict";
  var doc = global.document, S = global.FabricStore, M = global.FabricModel;
  var screen, tab = "home", openId = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function on(sel, ev, fn) {
    var n = typeof sel === "string" ? doc.querySelector(sel) : sel;
    if (n) n.addEventListener(ev, fn);
  }
  function val(sel) { var n = doc.querySelector(sel); return n ? n.value.trim() : ""; }
  function toast(msg) {
    var t = doc.getElementById("fToast");
    if (!t) return;
    /* CSS 是 .toast{opacity:0} + .toast.show{opacity:1}：只切 hidden 的话提示一直透明，
       用户点完任何按钮都看不到反馈（真机实测抓到的） */
    t.textContent = msg; t.hidden = false;
    void t.offsetWidth; /* 强制回流，否则同一帧内加 class 不触发过渡 */
    t.classList.add ? t.classList.add("show") : t.setAttribute("class", "toast show");
    global.clearTimeout(t.__timer);
    t.__timer = global.setTimeout(function () {
      t.classList.remove ? t.classList.remove("show") : t.setAttribute("class", "toast");
      t.hidden = true;
    }, 2600);
  }
  function bar(cur) {
    return '<div class="tracker">' + M.stageNames().map(function (n, i) {
      var cls = i < cur ? "done" : i === cur ? "now" : "";
      return '<div class="t-step ' + cls + '"><div class="t-dot">' + (i < cur ? "✓" : i + 1) +
        '</div><div class="t-label">' + esc(n) + "</div></div>";
    }).join('<div class="t-conn"></div>') + "</div>";
  }
  global.F = { esc: esc, on: on, val: val, toast: toast, bar: bar };
  global.F.__hook = { setScreen: function (n) { screen = n; }, get screen() { return screen; },
    setTab: function (t) { tab = t; }, get tab() { return tab; },
    setOpen: function (id) { openId = id; }, get openId() { return openId; } };
})(window);
/* ===== 页面渲染 ===== */
(function (global) {
  "use strict";
  var doc = global.document, S = global.FabricStore, M = global.FabricModel, F = global.F;
  var esc = F.esc;

  function home() {
    var st = S.stats();
    return '<div class="topbar"><div class="tb-title"><h1>面料工作台</h1>' +
      '<span class="tb-chip" style="background:#0f8f6b">学徒期 · 本地数据</span></div></div>' +
      '<div class="pad">' +
      '<div class="grid2">' +
      kpi(st.total, "客户总数") + kpi(st.sampled, "已寄样") + kpi(st.open, "跟进中") + kpi(st.won, "已成交") +
      "</div>" +
      '<div class="card card-pad"><div class="set-title">阶段分布</div>' +
      st.byStage.map(function (r) {
        return '<div class="set-row"><span>' + esc(r.name) + '</span><b>' + r.count + "</b></div>";
      }).join("") +
      '<div class="set-note">口径说明：面料是 B2B 长周期业务，<b>推进到寄样就是实打实的进展</b>，不用成交率衡量。</div>' +
      "</div>" +
      '<div class="card card-pad"><div class="set-title">首询必须先问清这 5 项</div>' +
      M.SPEC_REQUIRED.map(function (f) {
        return '<div class="set-row"><span><b>' + esc(f.label) + "</b><br/><small>" + esc(f.hint) + "</small></span></div>";
      }).join("") +
      '<div class="set-note">规格不齐就报价必错价。缺任一项时，草稿体检会拦住价格。</div></div>' +
      "</div>";
  }
  function kpi(v, label) {
    return '<div class="card card-pad" style="margin:0"><div style="font-size:24px;font-weight:700">' + v +
      '</div><div class="set-note">' + esc(label) + "</div></div>";
  }

  function buyers() {
    var list = S.buyers();
    return '<div class="topbar"><div class="tb-title"><h1>客户</h1>' +
      '<span class="tb-chip" style="background:#0f8f6b">' + list.length + " 位</span></div>" +
      '<button class="topbar-add" id="btnNew">＋ 新客户</button></div>' +
      '<div class="pad">' +
      (list.length ? list.map(function (b) {
        var miss = M.specMissing(b);
        return '<a class="card set-row" data-buyer="' + esc(b.id) + '" href="#buyer">' +
          "<span><b>" + esc(b.name) + "</b>" + (b.company ? " · " + esc(b.company) : "") +
          '<br/><small>' + esc(M.stageNames()[b.stage]) + " · 规格缺 " + (miss.length || 0) + " 项" +
          (b.outcome ? " · 已成交" : "") + "</small></span><b>›</b></a>";
      }).join("")
        : '<div class="card card-pad"><div class="set-note">还没有客户。点右上角「＋ 新客户」建第一个，' +
        "建的时候就把 5 项规格能填的都填上。</div></div>") +
      "</div>";
  }

  function newBuyer() {
    return '<div class="topbar"><div class="tb-title"><h1>新客户</h1></div>' +
      '<button class="topbar-add" id="btnBack">取消</button></div>' +
      '<div class="pad"><div class="card card-pad">' +
      f("nName", "客户称呼 *") + f("nComp", "公司") + f("nCountry", "国家/地区") + f("nWa", "WhatsApp") +
      f("nUse", "用途（做什么产品）") + f("nMarket", "目标市场（决定认证体系）") +
      '<div class="set-title" style="margin-top:8px">规格 5 项（知道多少填多少）</div>' +
      M.SPEC_REQUIRED.map(function (r) { return f("spec_" + r.key, r.label, r.hint); }).join("") +
      '<div class="set-actions"><button class="set-btn-inline" id="btnSaveNew">保存客户</button></div>' +
      "</div></div>";
  }
  /* ph 走 placeholder：标签只放名字，提示语放输入框里，避免出现「克重（每平米克重（GSM），…）」这种括号套括号 */
  function f(id, label, ph) {
    return '<label class="set-lbl">' + esc(label) + '</label><input class="set-inp" id="' + id + '"' +
      (ph ? ' placeholder="' + esc(ph) + '"' : "") + " />";
  }

  global.Pages = { home: home, buyers: buyers, newBuyer: newBuyer };
})(window);
/* ===== 客户详情：阶段 + 规格台账 + 沟通记录 + 草稿体检 ===== */
(function (global) {
  "use strict";
  var S = global.FabricStore, M = global.FabricModel, F = global.F;
  var esc = F.esc;

  function detail(b) {
    if (!b) return '<div class="pad"><div class="card card-pad">找不到这个客户。</div></div>';
    var miss = M.specMissing(b);
    return '<div class="topbar"><div class="tb-title"><h1>' + esc(b.name) + "</h1>" +
      '<span class="tb-chip" style="background:#0f8f6b">' + esc(M.stageNames()[b.stage]) + "</span></div>" +
      '<button class="topbar-add" id="btnBack">返回</button></div>' +
      '<div class="pad">' + barCard(b) +
      '<div class="card card-pad"><div class="set-title">规格台账（缺 ' + miss.length + " 项）</div>" +
      M.SPEC_REQUIRED.map(function (r) {
        var cur = "";
        (b.spec || []).forEach(function (x) { if (x.k === r.label) cur = x.v; });
        return '<label class="set-lbl">' + esc(r.label) + '</label>' +
          '<input class="set-inp" data-spec="' + esc(r.key) + '" value="' + esc(cur) + '" placeholder="' + esc(r.hint) + '" />';
      }).join("") +
      '<div class="set-actions"><button class="set-btn-inline" id="btnSaveSpec">保存规格</button></div></div>' +
      '<div class="card card-pad"><div class="set-title">沟通记录（' + b.messages.length + " 条）</div>" +
      (b.messages.slice(-12).map(function (m) {
        return '<div class="set-row"><span>' + (m.from === "me" ? "我：" : "客户：") + esc(m.text.slice(0, 120)) + "</span></div>";
      }).join("") || '<div class="set-note">还没有记录。</div>') +
      '<label class="set-lbl">记一条（谁说的都记，阶段推进要靠它）</label>' +
      '<select class="set-inp" id="msgFrom"><option value="buyer">客户说的</option><option value="me">我发的</option></select>' +
      '<textarea class="set-inp" id="msgText" rows="3" placeholder="原文照抄，别改写——阶段与事实都从原文来"></textarea>' +
      '<div class="set-actions"><button class="set-btn-inline" id="btnAddMsg">记下</button></div></div>' +
      '<div class="card card-pad"><div class="set-title">推进阶段（必须写依据）</div>' +
      '<select class="set-inp" id="advTo">' + M.stageNames().map(function (n, i) {
        return '<option value="' + i + '"' + (i <= b.stage ? " disabled" : "") + ">" + esc(n) + "</option>";
      }).join("") + "</select>" +
      '<input class="set-inp" id="advWhy" placeholder="依据：已经发生了什么（如 样卡已寄 DHL 单号 xxx）" />' +
      '<div class="set-actions"><button class="set-btn-inline" id="btnAdv">推进</button>' +
      '<button class="set-btn-inline" id="btnDeal">标成交</button></div></div>' +
      (global.Pages && global.Pages.draftCard ? global.Pages.draftCard(b) : "") +
      '<div class="card card-pad"><div class="set-title">草稿体检（发前先过一遍）</div>' +
      '<div class="set-note">把准备发的内容贴进来，缺什么当场告诉你。</div>' +
      '<textarea class="set-inp" id="chkText" rows="4" placeholder="粘贴草稿正文"></textarea>' +
      '<div class="set-actions"><button class="set-btn-inline" id="btnCheck">体检</button></div>' +
      '<div id="chkOut"></div></div>' +
      "</div>";
  }
  function barCard(b) {
    return '<div class="card card-pad"><div class="set-title">阶段</div>' + F.bar(b.stage) +
      (b.stageLog.length ? '<div class="set-note">最近推进：' +
        esc(b.stageLog[b.stageLog.length - 1].why || "") + "</div>" : "") + "</div>";
  }

  function backup() {
    return '<div class="topbar"><div class="tb-title"><h1>数据与备份</h1></div></div><div class="pad">' +
      '<div class="card card-pad"><div class="set-title">本地数据</div>' +
      '<div class="set-note">本工作台数据只存在这台设备（' + esc(S.KEY) + '），不与其它业务线共用任何记录。' +
      "云端同步在第②步接入，届时用独立命名空间。</div>" +
      '<div class="set-actions"><button class="set-btn-inline" id="btnExp">导出 JSON 备份</button>' +
      '<button class="set-btn-inline" id="btnImpFile">导入备份</button></div>' +
      '<input type="file" id="impFile" accept="application/json" style="display:none" /></div></div>';
  }

  global.Pages = global.Pages || {};
  global.Pages.detail = detail;
  global.Pages.backup = backup;
})(window);
/* ===== 路由与交互 ===== */
(function (global) {
  "use strict";
  var doc = global.document, S = global.FabricStore, M = global.FabricModel, F = global.F;
  /* esc 必须在这里取一次：体检失败分支要转义守卫文案，之前漏了这行，
     一点「体检」就 ReferenceError，表现为"含价格的草稿完全没有输出"（真实浏览器才测得出来） */
  var esc = F.esc;
  var P = global.Pages;
  var view = "home";

  function render() {
    var host = doc.getElementById("fView");
    /* 没登录只看得到登录页：客户与沟通数据都在本地空间里，未登录时不渲染任何业务内容 */
    var who = global.FabricNet && global.FabricNet.auth();
    if (!who && view !== "login") view = "login";
    if (view === "login") host.innerHTML = P.login();
    else if (view === "home") host.innerHTML = P.home();
    else if (view === "buyers") host.innerHTML = P.buyers();
    else if (view === "new") host.innerHTML = P.newBuyer();
    else if (view === "followup") host.innerHTML = P.followup();
    else if (view === "backup") host.innerHTML = P.backup();
    else host.innerHTML = P.detail(S.getBuyer(F.__hook.openId));
    wire();
    [].slice.call(doc.querySelectorAll("[data-tab]")).forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-tab") === view);
    });
  }

  function go(v, id) { view = v; if (id) F.__hook.setOpen(id); render(); }

  function wire() {
    F.on("#btnNew", "click", function () { go("new"); });
    F.on("#btnBack", "click", function () { go("buyers"); });
    F.on("#btnSaveNew", "click", saveNew);
    [].slice.call(doc.querySelectorAll("[data-buyer]")).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); go("detail", a.getAttribute("data-buyer")); });
    });
    F.on("#btnSaveSpec", "click", saveSpec);
    F.on("#btnAddMsg", "click", addMsg);
    F.on("#btnAdv", "click", adv);
    F.on("#btnDeal", "click", deal);
    F.on("#btnCheck", "click", check);
    F.on("#btnExp", "click", exportJson);
    F.on("#btnImpFile", "click", function () { var i = doc.querySelector("#impFile"); if (i) i.click(); });
    F.on("#impFile", "change", importJson);
    /* 登录页与起草卡由第②步模块提供：元素在才接，避免空挂监听器 */
    if (global.F5) {
      if (doc.querySelector("#btnLogin")) global.F5.wireAuth(function () { go("home"); });
      if (doc.querySelector("#btnDraft")) global.F5.wireDraft(S.getBuyer(F.__hook.openId));
    }
    if (global.F6) global.F6.wireFollowup(render);
  }

  function saveNew() {
    var b = S.addBuyer({
      name: F.val("#nName"), company: F.val("#nComp"), country: F.val("#nCountry"),
      wa: F.val("#nWa"), use: F.val("#nUse"), market: F.val("#nMarket")
    });
    if (!b) { F.toast("客户称呼必填"); return; }
    M.SPEC_REQUIRED.forEach(function (r) {
      var v = F.val("#spec_" + r.key);
      if (v) S.setSpec(b.id, r.label, v);
    });
    F.toast("已建档：" + b.name);
    go("detail", b.id);
  }

  function saveSpec() {
    var id = F.__hook.openId;
    [].slice.call(doc.querySelectorAll("[data-spec]")).forEach(function (i) {
      if (i.value.trim()) S.setSpec(id, (M.SPEC_REQUIRED.filter(function (r) { return r.key === i.getAttribute("data-spec"); })[0] || {}).label, i.value.trim());
    });
    F.toast("规格已保存"); render();
  }

  function addMsg() {
    var t = F.val("#msgText") || (doc.querySelector("#msgText") || {}).value || "";
    if (!String(t).trim()) { F.toast("先写内容"); return; }
    S.addMessage(F.__hook.openId, String(t), "", { from: F.val("#msgFrom") || "buyer" });
    F.toast("已记录"); render();
  }

  function adv() {
    var to = F.val("#advTo"), why = F.val("#advWhy");
    if (!why) { F.toast("必须写推进依据——没依据的推进不算数"); return; }
    if (!S.advance(F.__hook.openId, Number(to), why, "manual", why)) { F.toast("推进失败：只能往前，且必须选目标档"); return; }
    F.toast("已推进"); render();
  }

  function deal() {
    var why = F.val("#advWhy") || "人工确认成交";
    if (!global.confirm("标记成交？App 标注成交即事实，不再复核付款凭证。")) return;
    S.markDeal(F.__hook.openId, why);
    F.toast("已标成交"); render();
  }

  function check() {
    var b = S.getBuyer(F.__hook.openId);
    var txt = (doc.querySelector("#chkText") || {}).value || "";
    var r = M.guardDraft(b, txt);
    var out = doc.querySelector("#chkOut");
    if (!out) return;
    out.innerHTML = r.pass
      ? '<div class="pending-warn" style="color:#0f8f6b">✓ 体检通过，可以发</div>'
      : r.hits.map(function (h) { return '<div class="pending-warn" style="color:#b91c1c">⛔ ' + esc(h.message) + "</div>"; }).join("");
  }

  function exportJson() {
    var blob = new Blob([S.exportJSON()], { type: "application/json" });
    var a = doc.createElement("a");
    a.href = global.URL.createObjectURL(blob);
    a.download = "fabric-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
    F.toast("已导出备份");
  }

  function importJson(e) {
    var file = (e.target.files || [])[0];
    if (!file) return;
    var fr = new global.FileReader();
    fr.onload = function () {
      try { S.importJSON(String(fr.result)); F.toast("已导入"); go("home"); }
      catch (err) { F.toast("导入失败：" + err.message); }
    };
    fr.readAsText(file);
  }

  function boot() {
    S.load();
    [].slice.call(doc.querySelectorAll("[data-tab]")).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); go(a.getAttribute("data-tab")); });
    });
    render();
  }

  global.FabricApp = { boot: boot, go: go, render: render };
  /* 启动触发点不放在这里：本段之后还有段落注册页面（login/draftCard），
     在这里 boot 会在页面注册完成前渲染 → 抛错或白屏。启动统一由最后一段发起。 */
})(window);
/* ===== 第②步：登录闸门 + AI 起草 =====
 * 段落一律以 })(window) 收尾：浏览器里没有 global 这个标识符，
 * 写成 (function(global){...})(global) 会在加载期抛 ReferenceError，
 * 导致本段注册的所有页面全部消失（真机表现为首屏白屏）。 */
(function (global) {
  "use strict";
  var doc = global.document, S = global.FabricStore, M = global.FabricModel,
    F = global.F, P = global.Pages, N = global.FabricNet, FP = global.FabricPrompts;
  var esc = F.esc;

  function login() {
    var logged = N.auth();
    return '<div class="topbar"><div class="tb-title"><h1>面料工作台</h1>' +
      '<span class="tb-chip" style="background:#0f8f6b">' + (logged ? esc(logged.name) : "未登录") + "</span></div>" +
      (logged ? '<button class="topbar-add" id="btnOut">退出</button>' : "") + "</div>" +
      '<div class="pad"><div class="card card-pad">' +
      '<div class="set-title">登录</div>' +
      '<label class="set-lbl">账号（自动加前缀 fb-）</label><input class="set-inp" id="lName" placeholder="如 luo" />' +
      '<label class="set-lbl">密码</label><input class="set-inp" id="lPass" type="password" />' +
      '<div class="set-actions"><button class="set-btn-inline" id="btnLogin">登录</button>' +
      '<button class="set-btn-inline" id="btnReg">注册新面料账号</button></div>' +
      '<label class="set-lbl">团队口令（仅注册时需要）</label><input class="set-inp" id="lTok" type="password" />' +
      '<div class="set-note">注册即本业务线账号：数据落在本工作台自己的空间，与另一条业务线不共用任何记录。</div>' +
      "</div></div>";
  }

  function draftCard(b) {
    return '<div class="card card-pad"><div class="set-title">AI 起草（学徒期·草拟）</div>' +
      '<div class="set-note">缺 ' + M.specMissing(b).length + ' 项规格。出稿会自动过体检，缺什么当场标出来。</div>' +
      '<textarea class="set-inp" id="dIntent" rows="2" placeholder="这次要办什么（留空=推进当前阶段：问清缺的规格并给下一步）"></textarea>' +
      '<div class="set-actions"><button class="set-btn-inline" id="btnDraft">起草</button></div>' +
      '<div id="dOut"></div></div>';
  }

  function wireAuth(goHome) {
    F.on("#btnLogin", "click", function () { doAuth("login", goHome); });
    F.on("#btnReg", "click", function () { doAuth("register", goHome); });
    F.on("#btnOut", "click", function () { N.clearAuth(); F.toast("已退出"); goHome(); });
  }

  function doAuth(mode, done) {
    var name = F.val("#lName"), pass = (doc.querySelector("#lPass") || {}).value || "";
    var tok = (doc.querySelector("#lTok") || {}).value || "";
    var out = mode === "register" ? N.register(name, pass, tok) : N.login(name, pass);
    F.toast(mode === "register" ? "注册中…" : "登录中…");
    out.then(function (j) {
      F.toast("已登录：" + (j.name || N.full(name)));
      done();
    }).catch(function (e) { F.toast("失败：" + e.message); });
  }

  function wireDraft(b) {
    F.on("#btnDraft", "click", function () {
      var box = doc.querySelector("#dOut");
      var intent = F.val("#dIntent");
      var p = FP.build(S.getBuyer(b.id), intent);
      if (box) box.innerHTML = '<div class="pending-warn">起草中…（模型 qwen-flash，不带资料注入）</div>';
      N.draft(p.system, p.user).then(function (j) {
        var txt = (j && (j.text || j.content || (j.choices && j.choices[0] && (
          j.choices[0].text || (j.choices[0].message || {}).content)))) || "";
        if (!String(txt).trim()) {
          if (box) box.innerHTML = '<div class="pending-warn" style="color:#b91c1c">模型返回空内容，未采用。可再试一次或自己写。</div>';
          return;
        }
        var parsed = FP.parse(String(txt));
        var g = M.guardDraft(S.getBuyer(b.id), parsed.en);
        var html = '<label class="set-lbl">英文（发这个）</label>' +
          '<textarea class="set-inp" id="dEn" rows="4">' + esc(parsed.en) + "</textarea>" +
          '<label class="set-lbl">中文对照</label>' +
          '<div class="set-note">' + esc(parsed.zh || "（模型没给中文对照）") + "</div>" +
          (g.pass
            ? '<div class="pending-warn" style="color:#0f8f6b">✓ 体检通过</div>'
            : g.hits.map(function (h) { return '<div class="pending-warn" style="color:#b91c1c">⛔ ' + esc(h.message) + "</div>"; }).join(""));
        if (box) box.innerHTML = html;
      }).catch(function (e) {
        if (box) box.innerHTML = '<div class="pending-warn" style="color:#b91c1c">出稿失败：' + esc(e.message) + "</div>";
      });
    });
  }

  P.login = login;
  P.draftCard = draftCard;
  global.F5 = { wireAuth: wireAuth, wireDraft: wireDraft };

  /* 本段是页面注册的最后一站，启动从这里发起：保证 boot 时所有页面函数都已就位 */
  (function () {
    var app = global.FabricApp;
    if (!app) {
      if (global.console && global.console.error) global.console.error("[fabric] FabricApp 未就绪，无法启动");
      return;
    }
    try {
      if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", app.boot);
      else app.boot();
    } catch (e) {
      /* 首屏起不来必须在控制台留下原因，绝不静默白屏 */
      if (global.console && global.console.error) global.console.error("[fabric] 首屏启动失败", e);
    }
  })();
})(window);
/* ===== 跟进提醒：节奏按样品生命周期（寄样→追洗水测试→确认试单），不是未决事项清单。
 * 段放在 boot 发起点之后是安全的：首屏只渲染 login/home，不会取 P.followup；
 * 页面函数在用户点得进 tabbar 之前必然已就位。 */
(function (global) {
  "use strict";
  var doc = global.document, S = global.FabricStore, F = global.F;
  var esc = F.esc;

  function followup() {
    var fs = S.followups();
    return '<div class="topbar"><div class="tb-title"><h1>跟进</h1>' +
      '<span class="tb-chip" style="background:#0f8f6b">' + fs.length + " 件未办</span></div></div>" +
      '<div class="pad">' +
      (fs.length ? fs.map(function (f) {
        var b = S.getBuyer(f.buyerId);
        return '<div class="card card-pad"><div class="set-row"><span><b>' + esc(b ? b.name : "?") + "</b><br/>" +
          "<small>" + esc(f.action) + (f.dueDate ? " · 截止 " + esc(f.dueDate) : "") + "</small></span>" +
          '<button class="set-btn-inline" data-done="' + esc(f.id) + '">✓ 完成</button></div></div>';
      }).join("") :
        '<div class="card card-pad"><div class="set-note">还没有跟进任务。样品寄出 / 客户测试开始后在这里建一条——面料是长周期业务，跟进节奏按样品生命周期走，不按未决事项走。</div></div>') +
      '<div class="card card-pad"><div class="set-title">＋ 新建跟进</div>' +
      (S.buyers().length
        ? '<label class="set-lbl">客户</label><select class="set-inp" id="fuBuyer">' +
          S.buyers().map(function (b) {
            return '<option value="' + esc(b.id) + '">' + esc(b.name) + (b.company ? " · " + esc(b.company) : "") + "</option>";
          }).join("") + "</select>"
        : '<div class="set-note">还没有客户，先去「客户」建一个，再回来建跟进。</div>') +
      '<label class="set-lbl">要做什么</label><input class="set-inp" id="fuAction" placeholder="如：追洗水测试结果 / 复确认大货报价 / 安排寄样卡" />' +
      '<label class="set-lbl">期限（可选）</label><input class="set-inp" id="fuDue" type="date" />' +
      '<div class="set-actions"><button class="set-btn-inline" id="btnFuAdd">添加跟进</button></div>' +
      "</div></div>";
  }

  function wireFollowup(refresh) {
    F.on("#btnFuAdd", "click", function () {
      var bid = F.val("#fuBuyer"), action = F.val("#fuAction"), due = F.val("#fuDue");
      if (!bid) { F.toast("先选客户"); return; }
      if (!action) { F.toast("写一下要做什么"); return; }
      if (S.addFollowup(bid, action, due)) { F.toast("已建跟进"); refresh(); }
    });
    [].slice.call(doc.querySelectorAll("[data-done]")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (S.completeFollowup(btn.getAttribute("data-done"))) { F.toast("已标完成"); refresh(); }
      });
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.followup = followup;
  global.F6 = { wireFollowup: wireFollowup };
})(window);
