/* ===== "记一条"弹层 =====
 * AI 模式（LLM 已配置）：粘贴 → 自动翻译 + 字段提取 + 意向信号 → 确认入库
 * 手动模式（未配置）：粘贴 + 手填中文对照 + 快捷动作
 */
(function () {
  "use strict";

  var CHIPS = [
    { label: "索要报价", delta: 8, reason: "索要报价" },
    { label: "确认样品", delta: 8, reason: "确认样品" },
    { label: "大单信号", delta: 15, reason: "明确大单信号" },
    { label: "砍价/比价", delta: -5, reason: "砍价或比价" },
    { label: "长期未回复", delta: -10, reason: "长期未回复" }
  ];
  var state = { buyerId: null, chip: null, ai: null, phase: "input" };

  /* M2 修复：买家为空时 Mock.buyers[0] 是 undefined，取 .id 直接抛错，"记一条"打不开 */
  function defaultBuyer() {
    var open = Mock.followups.filter(function (f) { return !f.done; })
      .sort(function (a, b) { return a.dueIn - b.dueIn; })[0];
    return open ? open.buyerId : (Mock.buyers[0] ? Mock.buyers[0].id : "");
  }
  function cur() { return Mock.getBuyer(state.buyerId); }
  function aiOn() { return window.LLM && LLM.configured(); }

  function build(bd) {
    if (!state.buyerId || !Mock.getBuyer(state.buyerId)) state.buyerId = defaultBuyer();
    if (!state.buyerId) { bd.innerHTML = ""; bd.hidden = true; return; }
    if (state.phase === "review" && state.ai) { renderReview(bd); return; }
    bd.innerHTML = '<div class="sheet">' +
      '<div class="sheet-head"><b>记一条 · 客户消息</b><button class="sheet-x" data-act="x">✕</button></div>' +
      '<div class="sheet-sub">' + (aiOn() ? "粘贴客户消息（任意语言），AI 自动完成中文对照、字段提取、意向分更新" : "粘贴客户消息 → 手填中文对照与动作（设置里配置 LLM 后可全自动）") + "</div>" +
      '<div class="sl-buyers">' + Mock.buyers.map(function (b) {
        return '<button class="sl-b' + (b.id === state.buyerId ? " active" : "") + '" data-bid="' + escHtml(b.id) + '">' +
          '<span class="sl-b-name">' + escHtml(b.name) + '</span><span class="sl-b-sub">' + escHtml(b.cc) + " · " + Mock.STAGES[b.stage] + " · " + b.intent + "分</span></button>";
      }).join("") + "</div>" +
      '<textarea class="sl-text" id="slText" rows="3" placeholder="粘贴客户消息…（支持原文，任意语言）"></textarea>' +
      '<input class="sl-zh" id="slZh" placeholder="中文对照（AI 模式自动填充，可修改）"/>' +
      '<div class="sl-chips">' + CHIPS.map(function (c, i) {
        return '<button class="sl-chip' + (state.chip === i ? " active" : "") + '" data-ci="' + i + '">' + c.label + " " + (c.delta > 0 ? "+" : "") + c.delta + "</button>";
      }).join("") + "</div>" +
      '<button class="sl-save" data-act="save">存入客户档案</button>' +
      "</div>";
    wire(bd);
  }

  function renderReview(bd) {
    var ai = state.ai;
    var b = cur() || { intent: 50 }; /* 客户在 AI 识别期间被删的兜底 */
    bd.innerHTML = '<div class="sheet">' +
      '<div class="sheet-head"><b>AI 识别结果 · 确认后入库</b><button class="sheet-x" data-act="x">✕</button></div>' +
      '<div class="sl-msg">' + escHtml(ai.text) + "</div>" +
      '<label class="set-lbl">中文对照（可修改）</label>' +
      '<input class="sl-zh" id="slZh" value="' + escHtml(ai.zh || "") + '"/>' +
      '<label class="set-lbl">提取字段（勾选入库，新值覆盖旧值）</label>' +
      '<div class="sl-fields">' + (ai.fields && ai.fields.length ? ai.fields.map(function (f, i) {
        return '<label class="sl-field"><input type="checkbox" data-fi="' + i + '" checked/><span class="slf-k">' + escHtml(f.k) + '</span><span class="slf-v">' + escHtml(f.v) + "</span></label>";
      }).join("") : '<div class="set-note">本条消息未检测到业务字段</div>') + "</div>" +
      (ai.delta ? '<div class="sl-delta">意向信号 ' + (ai.delta.delta > 0 ? "+" : "") + ai.delta.delta +
        ' · ' + escHtml(ai.delta.reason || "") + "（" + b.intent + " → " + Math.max(5, Math.min(99, b.intent + ai.delta.delta)) + "）</div>" : "") +
      '<div class="set-actions"><button class="set-btn-inline ghost" data-act="back">← 重填</button><button class="set-btn-inline" data-act="save">确认入库</button></div>' +
      "</div>";
    wire(bd);
  }

  function wire(bd) {
    function close() { bd.hidden = true; state.phase = "input"; }
    bd.querySelector('[data-act="x"]').addEventListener("click", close);
    bd.addEventListener("click", function (e) { if (e.target === bd) close(); });

    if (state.phase === "review") {
      bd.querySelector('[data-act="back"]').addEventListener("click", function () {
        state.phase = "input";
        build(bd);
      });
      bd.querySelector('[data-act="save"]').addEventListener("click", function () {
        doSave(bd);
      });
      return;
    }

    bd.querySelectorAll(".sl-b").forEach(function (el) {
      el.addEventListener("click", function () {
        state.buyerId = el.dataset.bid;
        bd.querySelectorAll(".sl-b").forEach(function (x) { x.classList.remove("active"); });
        el.classList.add("active");
      });
    });
    bd.querySelectorAll(".sl-chip").forEach(function (el) {
      el.addEventListener("click", function () {
        var i = Number(el.dataset.ci);
        state.chip = state.chip === i ? null : i;
        bd.querySelectorAll(".sl-chip").forEach(function (x) { x.classList.remove("active"); });
        if (state.chip !== null) el.classList.add("active");
      });
    });
    bd.querySelector('[data-act="save"]').addEventListener("click", function () {
      var text = document.getElementById("slText").value.trim();
      if (!text) { App.toast("先粘贴客户消息"); return; }
      if (!aiOn()) { doSave(bd); return; }
      var btn = bd.querySelector('[data-act="save"]');
      btn.disabled = true;
      btn.textContent = "AI 识别中…（翻译 + 提取 + 研判）";
      var b = cur();
      if (!b) { App.toast("这个客户已不存在，请重新选择"); btn.disabled = false; btn.textContent = "存入客户档案"; return; }
      Promise.all([
        LLM.translate(text, b).catch(function () { return null; }),
        LLM.extract(text, b).catch(function () { return []; }),
        LLM.readMsg(text, b).catch(function () { return null; })
      ]).then(function (res) {
        /* v1.2.12：delta 字段现在装的是完整研判对象 {delta,reason,posture,concern,warm,evidence}（键名沿用兼容 doSave 旧逻辑） */
        state.ai = { text: text, zh: res[0], fields: res[1], delta: res[2] };
        state.phase = "review";
        renderReview(bd);
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = "存入客户档案";
        App.toast("AI 失败，转手动：" + e.message);
      });
    });
  }

  function doSave(bd) {
    var text = state.phase === "review" ? state.ai.text : document.getElementById("slText").value.trim();
    var zh = document.getElementById("slZh").value.trim();
    Store.addMessage(state.buyerId, text, zh);

    var applied = [];
    var d = null, reason = "";
    if (state.phase === "review" && state.ai) {
      bd.querySelectorAll(".sl-field input").forEach(function (cb) {
        if (!cb.checked) return;
        var f = state.ai.fields[Number(cb.dataset.fi)];
        if (f && f.k && f.v) { Store.addContext(state.buyerId, f.k, f.v); applied.push(f.k); }
      });
      if (state.ai.delta && state.ai.delta.delta) { d = state.ai.delta.delta; reason = state.ai.delta.reason || "AI 判断"; }
    }
    if (!d && state.chip !== null) { d = CHIPS[state.chip].delta; reason = CHIPS[state.chip].reason; }

    var b = cur();
    if (!b) { App.toast("这个客户已不存在"); closeSheet(); return; }
    var from = b.intent;
    if (d) Store.bumpIntent(state.buyerId, d, reason);
    /* v1.2.12「读」入库：研判存进档案，生成链路自动吃到 */
    var rd = (state.phase === "review" && state.ai) ? state.ai.delta : null;
    if (rd && rd.posture) {
      b.lastRead = { posture: rd.posture, concern: rd.concern || "", warm: rd.warm || "", evidence: rd.evidence || "", at: new Date().toISOString() };
      Store.commit();
    }
    closeSheet();
    App.toast("已记录" + (applied.length ? " · 沉淀 " + applied.length + " 项" : "") + (d ? " · 意向 " + from + "→" + b.intent : ""));
    App.refresh();
  }

  function closeSheet() {
    document.getElementById("logSheet").hidden = true;
    state.phase = "input";
    state.ai = null;
  }

  window.LogSheet = {
    open: function () {
      var bd = document.getElementById("logSheet");
      state.chip = null;
      state.phase = "input";
      state.ai = null;
      build(bd);
      bd.hidden = false;
    }
  };

  document.getElementById("fabLog").addEventListener("click", function () {
    window.LogSheet.open();
  });
})();
