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
  /* 气泡（与主工作台同结构：客户左 / 我方右，英文下挂中文对照，我方带交接确认条） */
  function mtime(m) {
    var t = String((m && m.at) || "");
    return t ? t.slice(5, 16).replace("T", " ") : "";
  }
  function bubble(m, idx) {
    /* P0 XSS：客户消息/译文全部来自外部数据，必须转义（存储型注入的主入口） */
    var zh = m.zh ? '<div class="zh-line' + (m.zh === "翻译中…" ? " zh-busy" : "") + '">' + esc(m.zh) + "</div>"
      : (m.zhFail ? '<div class="zh-line zh-fail" data-act="zh-retry" data-idx="' + idx + '">翻译失败 · 点按重试 ↻</div>' : "");
    var txt = esc(m.text);
    if (m.from === "me") {
      var isH = m.status === "handed";
      var handed = isH
        ? '<div class="handed-bar"><span class="handed-tag">已预填到 WhatsApp · 还没发送</span>' +
          '<button class="h-y" data-act="h-y" data-idx="' + idx + '">✓ 已发</button>' +
          '<button class="h-n" data-act="h-n" data-idx="' + idx + '">✕ 没发</button></div>'
        : "";
      var meta = esc(mtime(m)) + " " + (isH ? '<span class="h-wait">待确认</span>' : "✓✓") +
        ' <span class="m-del" data-act="m-del" data-idx="' + idx + '" title="删除这条记录">✕</span>';
      return '<div class="msg msg-me" data-idx="' + idx + '"><div class="bubble">' + txt + zh + handed + "</div>" +
        '<div class="msg-meta">' + meta + "</div></div>";
    }
    return '<div class="msg msg-buyer" data-idx="' + idx + '"><div class="bubble">' + txt + zh + "</div>" +
      '<div class="msg-meta">' + esc(mtime(m)) + "</div></div>";
  }
  global.F = { esc: esc, on: on, val: val, toast: toast, bar: bar, mtime: mtime, bubble: bubble };
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

  function deals() {
    var won = S.buyers().filter(function (b) { return b.outcome; });
    return '<div class="topbar"><div class="tb-title"><h1>成交</h1>' +
      '<span class="tb-chip" style="background:#0f8f6b">' + won.length + " 单</span></div></div>" +
      '<div class="pad">' +
      (won.length ? won.map(function (b) {
        return '<a class="card set-row" data-buyer="' + esc(b.id) + '" href="#buyer">' +
          "<span><b>" + esc(b.name) + "</b>" + (b.company ? " · " + esc(b.company) : "") +
          "<br/><small>成交 " + esc(String(b.outcome.at).slice(0, 10)) + (b.outcome.evidence ? " · " + esc(b.outcome.evidence) : "") +
          (b.repeat ? " · 返单/年框" : "") + "</small></span><b>›</b></a>";
      }).join("")
        : '<div class="card card-pad"><div class="set-note">还没有成交。学徒期不按成交率考核——每推进一个阶段，就是实打实的进展。</div></div>') +
      "</div>";
  }

  global.Pages = { home: home, buyers: buyers, newBuyer: newBuyer, deals: deals };
})(window);
/* ===== 客户详情 = 一客一对话框（内核结构与主工作台一致；大脑只用本线 f-model/f-prompts） ===== */
(function (global) {
  "use strict";
  var S = global.FabricStore, M = global.FabricModel, F = global.F;
  var esc = F.esc;

  function outcomeCard(b) {
    return '<div class="card card-pad" style="margin:10px 16px 0;background:#0f8f6b;color:#fff">' +
      "<b>✓ 已成交</b> <small>" + esc(String(b.outcome.at).slice(0, 10)) + (b.outcome.evidence ? " · " + esc(b.outcome.evidence) : "") + "</small>" +
      '<div class="set-note" style="color:#d9f2e9">App 标注成交即事实；确认返单/年框就勾下面。</div>' +
      '<label class="set-row" style="color:#fff"><span>返单 / 年框</span><input type="checkbox" id="chkRepeat"' + (b.repeat ? " checked" : "") + " /></label>" +
      "</div>";
  }

  function stageCard(b) {
    var lg = b.stageLog.length ? b.stageLog[b.stageLog.length - 1] : null;
    return '<div class="card card-pad" style="margin:10px 16px 0"><div class="set-title">阶段</div>' + F.bar(b.stage) +
      (lg ? '<div class="st-log">阶段留痕：' + esc(M.stageNames()[lg.from]) + " → " + esc(M.stageNames()[lg.to]) + (lg.why ? " · " + esc(lg.why) : "") + "</div>" : "") +
      (b.outcome ? "" :
        '<div class="st-adj" data-act="st-adj">推进阶段 ▾</div>' +
        '<div class="st-chips" style="display:none">' + M.STAGES.map(function (s, i) {
          return '<button type="button" class="st-chip' + (i === b.stage ? " active" : "") + '"' + (i <= b.stage ? " disabled" : "") + ' data-si="' + i + '">' + esc(s.name) + "</button>";
        }).join("") + "</div>" +
        '<div id="advBox" style="display:none">' +
        '<input type="hidden" id="advTo" />' +
        '<input class="set-inp" id="advWhy" placeholder="依据：已经发生了什么（如 样卡已寄 DHL 单号 xxx）" />' +
        '<div class="set-actions"><button class="set-btn-inline" id="btnAdv">确认推进</button>' +
        '<button class="set-btn-inline" id="btnDeal">标成交</button></div></div>') +
      "</div>";
  }

  function specCard(b, miss) {
    return '<div class="card card-pad" style="margin:10px 16px 0"><div class="set-title">规格台账（缺 ' + miss.length + " 项）</div>" +
      M.SPEC_REQUIRED.map(function (r) {
        var cur = "";
        (b.spec || []).forEach(function (x) { if (x.k === r.label) cur = x.v; });
        return '<label class="set-lbl">' + esc(r.label) + '</label>' +
          '<input class="set-inp" data-spec="' + esc(r.key) + '" value="' + esc(cur) + '" placeholder="' + esc(r.hint) + '" />';
      }).join("") +
      '<div class="set-actions"><button class="set-btn-inline" id="btnSaveSpec">保存规格</button></div>' +
      '<div class="set-note">报价前 5 项必须齐——缺项的报价会被草稿体检拦下。</div></div>';
  }

  function replyCard(b) {
    return '<div class="mode-card mode-a" style="margin:0 16px 10px">' +
      '<div class="mode-head"><span class="mode-badge a">✦</span>' +
      '<div class="mode-tt"><b>回复客户</b><small style="display:block;color:#5a6b64">学徒期 · AI 草拟 · 出稿自动体检</small></div></div>' +
      '<textarea id="fIntent" rows="3" placeholder="用中文写要告诉客户什么（留空 = AI 自己推进当前阶段：把缺的规格问清并给下一步）"></textarea>' +
      '<div class="set-actions" style="margin:8px 0 0"><button class="tr-btn" id="btnReply" style="flex:1">✦ 生成回复（英文 + 中文对照）</button></div>' +
      '<div id="fSuggWrap"></div></div>' +
      '<div class="card card-pad" style="margin:0 16px 10px"><div class="set-title">草稿体检（发前先过一遍）</div>' +
      '<div class="set-note">把准备发的内容贴进来，缺什么当场告诉你。</div>' +
      '<textarea class="set-inp" id="chkText" rows="4" placeholder="粘贴草稿正文"></textarea>' +
      '<div class="set-actions"><button class="set-btn-inline" id="btnCheck">体检</button></div>' +
      '<div id="chkOut"></div></div>';
  }

  function detail(b) {
    if (!b) return '<div class="pad"><div class="card card-pad">找不到这个客户。</div></div>';
    var miss = M.specMissing(b);
    var msgs = (b.messages || []).map(function (m, i) { return F.bubble(m, i); }).join("");
    var fu = null;
    S.followups().forEach(function (f) { if (f.buyerId === b.id && !fu) fu = f; });
    return '<div class="topbar">' +
      '<div class="tb-back" data-act="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div>' +
      '<div class="tb-title"><h1>' + esc(b.name) + '</h1><div class="tb-sub">' + esc(b.wa || "未填 WhatsApp") + " · " + esc(b.country || "未填国家") + "</div></div>" +
      (b.wa ? '<a class="topbar-add" href="#" data-act="wa-jump">直达对话</a>' : "") +
      "</div>" +
      '<div class="detail-body">' +
      '<div class="card d-info" style="margin:10px 16px 0">' +
      '<div class="avatar">' + esc(String(b.name || "?").slice(0, 1).toUpperCase()) + "</div>" +
      '<div><div class="d-name">' + esc(b.name) + "</div>" +
      '<div class="d-sub">' + esc([b.company, b.use, b.market].filter(Boolean).join(" · ") || "档案待补") + "</div></div>" +
      '<span class="chip" style="background:#0f8f6b;color:#fff">' + esc(M.stageNames()[b.stage]) + "</span>" +
      "</div>" +
      (b.outcome ? outcomeCard(b) : "") +
      stageCard(b) +
      specCard(b, miss) +
      '<div class="d-sec-title" style="margin-top:14px;margin-left:16px;margin-right:16px">WhatsApp 对话记录 · 过渡模式</div>' +
      '<div class="wa-chat">' +
      '<div class="wa-head"><div class="wa-hmid"><b>' + esc(b.name) + '</b><span>' + esc(b.wa || "未填 WhatsApp") + "</span></div>" +
      '<span class="zh-ver">v' + esc(global.APP_VERSION ? global.APP_VERSION.v : "?") + "</span></div>" +
      '<div class="wa-msgs zh-on" id="fMsgs">' + (msgs || '<div class="empty">还没有对话记录。<br/>把客户说的话贴进下面，点「记客户」，再让 AI 代写回复。</div>') + "</div>" +
      '<div class="wa-logrow">' +
      '<textarea id="fLog" rows="2" placeholder="记一句：客户原话照抄（Enter=记，Shift+Enter=换行）"></textarea>' +
      '<button class="log-btn" data-act="log-buyer">记客户</button>' +
      '<button class="log-btn log-btn-me" data-act="log-me">记我发</button>' +
      "</div></div>" +
      replyCard(b) +
      (fu ? '<div class="remind"><b>跟进</b><span>' + esc(fu.action) + (fu.dueDate ? " · 截止 " + esc(fu.dueDate) : "") + '</span><button class="rbt" data-act="fu">去跟进</button></div>' : "") +
      "</div>";
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
    else if (view === "deals") host.innerHTML = P.deals();
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
    F.on("#btnExp", "click", exportJson);
    F.on("#btnImpFile", "click", function () { var i = doc.querySelector("#impFile"); if (i) i.click(); });
    F.on("#impFile", "change", importJson);
    /* 登录闸门由 F5 提供：元素在才接，避免空挂监听器 */
    if (global.F5) {
      if (doc.querySelector("#btnLogin")) global.F5.wireAuth(function () { go("home"); });
    }
    if (global.F6) global.F6.wireFollowup(render);
    /* 客户详情 = 对话框：本页全部交互（记一句 / AI 回复 / 交接确认 / 阶段 / 规格 / 体检）由 F7 接 */
    if (global.F7 && view === "detail") global.F7.wireDialog(S.getBuyer(F.__hook.openId), render, go);
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

  P.login = login;
  global.F5 = { wireAuth: wireAuth };

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
/* ===== 对话框内核：结构与主工作台一致（气泡 / 自动中文对照 / AI 回复 / WhatsApp 交接确认），
 * 大脑只用本线的 f-model / f-prompts —— 另一条业务线的内容一个字不进来。
 * 学徒期安全线：AI 产出永远是「待确认」建议卡，点「发到 WhatsApp」才预填；
 * 没有任何自动发送路径。 */
(function (global) {
  "use strict";
  var doc = global.document, S = global.FabricStore, M = global.FabricModel,
    F = global.F, N = global.FabricNet, FP = global.FabricPrompts;
  var esc = F.esc;
  var zhBusy = {};               /* 正在翻译的文本锁：同一条不重复调 */
  var _chatPos = { id: null, top: 0, atBottom: true }; /* 滚动位置跨重渲染记忆：读历史时后台事件不许拽画面 */

  function msgBox() { return doc.getElementById("fMsgs"); }

  function scrollDown() {
    var box = msgBox(); if (!box) return;
    box.scrollTop = box.scrollHeight;
    var chat = doc.querySelector(".wa-chat");
    if (chat && chat.scrollIntoView) chat.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* 进客户页 → 跳最新消息；同一客户的后台重渲染 → 恢复位置，只有本来在底部才吸底 */
  function placeChat(b) {
    var box = msgBox(); if (!box) return;
    var changed = _chatPos.id !== b.id;
    if (changed) { _chatPos.top = 0; _chatPos.atBottom = true; }
    _chatPos.id = b.id;
    box.scrollTop = (changed || _chatPos.atBottom) ? box.scrollHeight
      : Math.min(_chatPos.top, Math.max(0, box.scrollHeight - (box.clientHeight || 0)));
    box.onscroll = function () {
      _chatPos.top = box.scrollTop;
      _chatPos.atBottom = box.scrollTop + (box.clientHeight || 0) >= box.scrollHeight - 60;
    };
  }

  /* 气泡级外科手术：只换那一个节点，不整页重绘（整页重绘是主工作台「页面自己跳」的老病根） */
  function patchBubble(b, m) {
    var box = msgBox(); if (!box) return;
    var idx = (b.messages || []).indexOf(m);
    if (idx < 0) return;
    var node = box.children[idx];
    if (!node) return;
    var div = doc.createElement("div");
    div.innerHTML = F.bubble(m, idx);
    try { box.replaceChild(div.firstChild, node); } catch (e) {}
  }

  function pushBubble(b, msg, idx) {
    var box = msgBox(); if (!box) return;
    var first = box.firstChild;
    if (first && /还没有对话记录/.test(first.textContent || "")) box.innerHTML = "";
    var div = doc.createElement("div");
    div.innerHTML = F.bubble(msg, idx);
    box.appendChild(div.firstChild);
    scrollDown();
  }

  /* 中文对照核心：占位→翻译（幂等，瞬断自动重试 1 次）→外科替换气泡 */
  function translateOne(b, m) {
    if (zhBusy[m.text]) return Promise.resolve();
    zhBusy[m.text] = 1;
    m.zh = "翻译中…"; m.zhFail = false;
    S.save();
    patchBubble(b, m);
    function attempt(left) {
      return N.translate(m.text).catch(function (e) {
        if (left > 0) return new global.Promise(function (res) {
          global.setTimeout(function () { res(attempt(left - 1)); }, 800);
        });
        throw e;
      });
    }
    return attempt(1).then(function (j) {
      var zh = N.pickText(j).trim();
      if (!zh) throw new Error("返回空译文");
      m.zh = zh; m.zhFail = false;
      S.save();
    }).catch(function (e) {
      m.zh = ""; m.zhFail = true;
      S.save();
      F.toast("自动翻译失败：" + String((e && e.message) || e).slice(0, 40));
    }).then(function () {
      zhBusy[m.text] = 0;
      patchBubble(b, m);
    });
  }

  function autoZh(b, text) {
    if (!text) return;
    /* 纯中文不翻；中英混合照翻（只译外文部分） */
    if (/[一-龥]/.test(text) && (text.match(/[A-Za-z]/g) || []).length < 10) return;
    if (!N.session()) return;
    var target = null;
    for (var i = (b.messages || []).length - 1; i >= 0; i--) {
      var m0 = b.messages[i];
      if (m0.text === text && (!m0.zh || m0.zh === "翻译中…" || m0.zhFail)) { target = m0; break; }
    }
    if (!target) return; /* 锁必须在确认目标之后才加，找不到的文本不能被永久锁死 */
    translateOne(b, target);
  }

  /* 进页补翻：缺中文对照的外文消息最多补 6 条、≤3 并行（一条完成接下一条，不抢 FC） */
  function backfillZh(b) {
    if (!N.session()) return;
    var miss = (b.messages || []).filter(function (m) {
      return (!m.zh || m.zh === "翻译中…") && !m.zhFail && m.text &&
        !(/[一-龥]/.test(m.text) && (m.text.match(/[A-Za-z]/g) || []).length < 10);
    }).slice(-6);
    var fresh = [];
    miss.forEach(function (m) { if (!zhBusy[m.text]) { zhBusy[m.text] = 1; fresh.push(m); } });
    if (!fresh.length) return;
    (function (items, limit) {
      var i = 0;
      function next() {
        if (i >= items.length) return;
        translateOne(b, items[i++]).then(next, next);
      }
      for (var k = 0; k < Math.min(limit, items.length); k++) next();
    })(fresh, 3);
  }

  /* 记一句：客户原话照抄，别改写——阶段与事实都从原文来 */
  function logBuyer(b) {
    var ta = doc.getElementById("fLog");
    var t = ta ? ta.value.trim() : "";
    if (!t) { F.toast("先写客户说的内容"); return; }
    var m = S.addMessage(b.id, t, "", { from: "buyer" });
    if (!m) return;
    if (ta) ta.value = "";
    pushBubble(b, S.getBuyer(b.id).messages[S.getBuyer(b.id).messages.length - 1], b.messages.length - 1);
    autoZh(b, t);
  }
  function logMe(b) {
    var ta = doc.getElementById("fLog");
    var t = ta ? ta.value.trim() : "";
    if (!t) { F.toast("先写你发的内容"); return; }
    S.addMessage(b.id, t, "", { from: "me", sentAt: new Date().toISOString() });
    if (ta) ta.value = "";
    var fresh = S.getBuyer(b.id);
    var m = (fresh.messages || [])[fresh.messages.length - 1];
    if (m) pushBubble(b, m, fresh.messages.length - 1);
    autoZh(b, t); /* 我方发的英文也即时补中文对照 */
  }

  /* WhatsApp 交接：预填进 wa.me 链接，发送动作永远是人做的 */
  function waLink(num, text) {
    var digits = String(num || "").replace(/\D/g, "");
    if (!digits) return null;
    return "https://wa.me/" + digits + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function sendWa(b, en, zh) {
    var su = waLink(b.wa, en);
    if (!su) { F.toast("该客户还没填 WhatsApp 号码，先补上再发"); return; }
    var m = S.addMessage(b.id, en, zh || "", { from: "me", status: "handed" });
    if (!m) return;
    pushBubble(b, S.getBuyer(b.id).messages[S.getBuyer(b.id).messages.length - 1], b.messages.length - 1);
    /* 当前窗口导航：Chrome 下 window.open 是后台新标签，像死按钮 */
    global.location.href = su;
    F.toast("已预填到 WhatsApp · 还没发送！发完回来点「✓ 已发」");
  }
  function copyText(t) {
    function done() { F.toast("已复制 · 打开和客户的 WhatsApp 对话，粘贴发送即可"); }
    function fallback() {
      var ta = doc.createElement("textarea");
      ta.value = t; doc.body.appendChild(ta); ta.select();
      try { doc.execCommand("copy"); done(); } catch (e) { F.toast("复制失败，请手动选择文本复制"); }
      doc.body.removeChild(ta);
    }
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(t).then(done, fallback);
    } else fallback();
  }

  /* AI 回复：写中文意图（可留空）→ 面料大脑出英文+中文对照 → 体检 → 建议卡（待确认） */
  function genReply(b, btn) {
    var wrap = doc.getElementById("fSuggWrap");
    var el = doc.getElementById("fIntent");
    var intent = el ? el.value.trim() : "";
    if (!N.session()) { F.toast("先登录，再让 AI 代写"); return; }
    if (btn) btn.disabled = true;
    if (wrap) wrap.innerHTML = '<div class="pending-warn">起草中…（qwen-flash · 不带资料注入 · 出稿自动体检）</div>';
    var p = FP.build(S.getBuyer(b.id), intent);
    N.draft(p.system, p.user).then(function (j) {
      var txt = N.pickText(j);
      if (!String(txt).trim()) {
        if (wrap) wrap.innerHTML = '<div class="pending-warn" style="color:#b91c1c">模型返回空内容，未采用。可再试一次或自己写。</div>';
        return;
      }
      var parsed = FP.parse(String(txt));
      var g = M.guardDraft(S.getBuyer(b.id), parsed.en);
      renderSugg(wrap, b, parsed, g);
    }).catch(function (e) {
      if (wrap) wrap.innerHTML = '<div class="pending-warn" style="color:#b91c1c">出稿失败：' + esc(e.message) + "</div>";
    }).then(function () { if (btn) btn.disabled = false; });
  }

  function renderSugg(wrap, b, parsed, g) {
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="sugg">' +
      '<div class="sugg-top"><span class="sugg-style">学徒期 · 草拟</span>' +
      '<div class="sugg-btns">' +
      '<button class="sugg-use" data-en="' + esc(parsed.en) + '" data-zh="' + esc(parsed.zh) + '"' + (g.pass ? "" : " disabled") + ">发到 WhatsApp</button>" +
      '<button class="sugg-copy" data-ctext="' + esc(parsed.en) + '">复制</button>' +
      "</div></div>" +
      '<div class="sugg-text">' + esc(parsed.en) + "</div>" +
      '<div class="sugg-zh">中文：' + esc(parsed.zh || "（模型没给对照）") + "</div>" +
      (g.pass
        ? '<div class="pending-warn" style="color:#0f8f6b">✓ 体检通过</div>'
        : g.hits.map(function (h) { return '<div class="pending-warn" style="color:#b91c1c">⛔ ' + esc(h.message) + "</div>"; }).join("") +
          '<div class="pending-warn" style="color:#8a6d1a">⚠ 有拦截项：「发到 WhatsApp」已禁用，改稿或重新生成</div>') +
      "</div>";
    /* 委托绑在容器上：气泡级替换 DOM 后监听不丢 */
    wrap.onclick = function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      var use = t.closest ? t.closest(".sugg-use") : null;
      var cpy = t.closest ? t.closest(".sugg-copy") : null;
      if (use && !use.disabled) sendWa(b, use.getAttribute("data-en"), use.getAttribute("data-zh"));
      else if (cpy) copyText(cpy.getAttribute("data-ctext"));
    };
  }

  function wireDialog(b, refresh, go) {
    if (!b) return;
    F.on('[data-act="back"]', "click", function () { go("buyers"); });
    F.on('[data-act="wa-jump"]', "click", function (e) {
      e.preventDefault();
      var su = waLink(b.wa);
      if (su) global.location.href = su; else F.toast("该客户还没填 WhatsApp 号码");
    });
    F.on('[data-act="log-buyer"]', "click", function () { logBuyer(b); });
    F.on('[data-act="log-me"]', "click", function () { logMe(b); });
    var logIn = doc.getElementById("fLog");
    if (logIn) logIn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); logBuyer(b); }
    });
    F.on("[data-act='st-adj']", "click", function () {
      var chips = doc.querySelector(".st-chips");
      if (chips) chips.style.display = chips.style.display === "none" ? "" : "none";
    });
    [].slice.call(doc.querySelectorAll(".st-chip")).forEach(function (ch) {
      if (ch.disabled) return;
      ch.addEventListener("click", function () {
        var box = doc.getElementById("advBox");
        var to = doc.getElementById("advTo");
        if (!box) return;
        if (to) to.value = ch.getAttribute("data-si");
        box.style.display = "";
      });
    });
    F.on("#btnAdv", "click", function () {
      var to = (doc.getElementById("advTo") || {}).value;
      var why = F.val("#advWhy");
      if (!why) { F.toast("必须写推进依据——没依据的推进不算数"); return; }
      if (!S.advance(b.id, Number(to), why, "manual", why)) { F.toast("推进失败：只能往前，且必须选目标档"); return; }
      F.toast("已推进"); refresh();
    });
    F.on("#btnDeal", "click", function () {
      var why = F.val("#advWhy") || "人工确认成交";
      if (!global.confirm("标记成交？App 标注成交即事实，不再复核付款凭证。")) return;
      S.markDeal(b.id, why);
      F.toast("已标成交"); refresh();
    });
    F.on("#btnSaveSpec", "click", function () {
      [].slice.call(doc.querySelectorAll("[data-spec]")).forEach(function (i) {
        if (i.value && i.value.trim()) S.setSpec(b.id, (M.SPEC_REQUIRED.filter(function (r) { return r.key === i.getAttribute("data-spec"); })[0] || {}).label, i.value.trim());
      });
      F.toast("规格已保存"); refresh();
    });
    F.on("#chkRepeat", "change", function (e) {
      var x = S.getBuyer(b.id);
      if (!x) return;
      x.repeat = !!e.target.checked; S.save();
      F.toast(e.target.checked ? "已标返单/年框" : "已去掉返单标记");
    });
    F.on("#btnCheck", "click", function () {
      var txt = (doc.getElementById("chkText") || {}).value || "";
      var r = M.guardDraft(S.getBuyer(b.id), txt);
      var out = doc.getElementById("chkOut");
      if (!out) return;
      out.innerHTML = r.pass
        ? '<div class="pending-warn" style="color:#0f8f6b">✓ 体检通过，可以发</div>'
        : r.hits.map(function (h) { return '<div class="pending-warn" style="color:#b91c1c">⛔ ' + esc(h.message) + "</div>"; }).join("");
    });
    F.on('[data-act="fu"]', "click", function () { go("followup"); });
    F.on("#btnReply", "click", function () { genReply(b, doc.getElementById("btnReply")); });

    /* 交接确认 / 删除记录 / 译文重试：全部委托在对话区上 */
    var box = msgBox();
    if (box) box.onclick = function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-act="h-y"],[data-act="h-n"],[data-act="m-del"],[data-act="zh-retry"]') : null;
      if (!el) return;
      var idx = +el.getAttribute("data-idx");
      var act = el.getAttribute("data-act");
      var fresh = S.getBuyer(b.id);
      var m = fresh && (fresh.messages || [])[idx];
      if (!m) return;
      if (act === "h-y" && m.status === "handed") {
        m.status = "sent"; m.sentAt = new Date().toISOString();
        S.save(); F.toast("已确认发出");
      } else if (act === "zh-retry") {
        autoZh(b, m.text);
        return;
      } else if (act === "h-n" || act === "m-del") {
        if (act === "m-del" && !global.confirm("删除这条记录？")) return;
        fresh.messages.splice(idx, 1);
        S.save(); F.toast("已删除");
      }
      refresh();
    };

    placeChat(b);
    backfillZh(b);
  }

  global.F7 = { wireDialog: wireDialog };
})(window);
