/* ===== 面料业务线存储：独立命名空间，无归属判别字段 =====
 * 为什么没有 domainId：判别字段本身就是错误来源（字段填错 → 数据跨域，本业务线当天为此翻车两次）。
 * 面料客户只存在于 dd.fabric.v1 这一个空间里，没有"属于哪条线"这个属性，也就没有填错的可能。
 * 第①步只做本地存储 + JSON 导出/导入备份；云端同步在第②步以**独立命名空间**接入，
 * 绝不与另一条业务线共用同一条记录集合。
 */
(function (global) {
  "use strict";

  var KEY = "dd.fabric.v1";
  var M = global.FabricModel;

  function blank() {
    return { v: 1, savedAt: "", buyers: [], followups: [], deletedIds: [] };
  }

  var data = blank();

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.v === 1 && Array.isArray(o.buyers)) data = o;
      }
    } catch (e) { /* 损坏时不覆盖：交给 export 前先提示，避免静默清空 */ }
    return data;
  }

  function save() {
    data.savedAt = new Date().toISOString();
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function uid(p) {
    /* 随机尾不能省：同毫秒连续建档会撞号，撞号后消息与阶段会记到别人头上 */
    return p + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  }

  function buyers() { return data.buyers.slice(); }

  function getBuyer(id) {
    for (var i = 0; i < data.buyers.length; i++) if (data.buyers[i].id === id) return data.buyers[i];
    return null;
  }

  function addBuyer(info) {
    var b = {
      id: uid("fb"),
      name: String((info && info.name) || "").slice(0, 40),
      company: String((info && info.company) || "").slice(0, 60),
      country: String((info && info.country) || "").slice(0, 30),
      wa: String((info && info.wa) || "").slice(0, 30),
      use: String((info && info.use) || "").slice(0, 60),      /* 用途：做什么产品，决定推荐方向 */
      market: String((info && info.market) || "").slice(0, 40), /* 目标市场，决定认证体系 */
      stage: 0,
      spec: [],           /* 5 项规格要素 [{k,v}] */
      messages: [],
      stageLog: [],
      repeat: false,      /* 成交后标记：返单/年框 */
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!b.name) return null;
    data.buyers.unshift(b);
    save();
    return b;
  }

  function setSpec(id, k, v) {
    var b = getBuyer(id);
    if (!b) return false;
    var hit = null;
    b.spec.forEach(function (r) { if (r.k === k) hit = r; });
    if (hit) hit.v = String(v || "").slice(0, 120);
    else b.spec.push({ k: k, v: String(v || "").slice(0, 120) });
    b.updatedAt = new Date().toISOString();
    return save();
  }

  /* 阶段推进唯一写入口：只进不退、必须带硬事实原文（可审计，防止凭感觉跳档） */
  function advance(id, to, why, src, evidence) {
    var b = getBuyer(id);
    if (!b || b.outcome) return false;
    to = Number(to);
    /* 推进必须写硬事实依据：没依据的推进等于凭感觉跳档，事后无法复盘也无法纠错 */
    if (!String(why || "").trim()) return false;
    if (!(to >= 0) || to > M.DEAL_STAGE || to <= b.stage) return false;
    b.stageLog.push({
      from: b.stage, to: to, why: String(why || "").slice(0, 60),
      src: src || "manual", evidence: String(evidence || "").slice(0, 80), at: new Date().toISOString()
    });
    b.stage = to;
    b.updatedAt = new Date().toISOString();
    return save();
  }

  /* 成交只能人工确认：AI 与机械信号最多提出候选 */
  function markDeal(id, evidence) {
    var b = getBuyer(id);
    if (!b) return false;
    b.outcome = { status: "won", at: new Date().toISOString(), evidence: String(evidence || "").slice(0, 80) };
    if (b.stage < M.DEAL_STAGE) advance(id, M.DEAL_STAGE, "人工标记成交", "manual", evidence);
    return save();
  }

  function addMessage(id, text, zh, opts) {
    var b = getBuyer(id);
    if (!b) return null;
    var o = opts || {};
    var m = {
      from: o.from === "me" ? "me" : "buyer",
      text: String(text || "").slice(0, 2000),
      zh: String(zh || "").slice(0, 2000),
      at: new Date().toISOString(),
      way: o.way || ""
    };
    if (!m.text) return null;
    b.messages.push(m);
    b.updatedAt = new Date().toISOString();
    save();
    return m;
  }

  function addFollowup(id, action, dueDate) {
    var b = getBuyer(id);
    if (!b) return null;
    var f = { id: uid("ff"), buyerId: b.id, action: String(action || "").slice(0, 120), dueDate: dueDate || "", done: false, at: new Date().toISOString() };
    data.followups.unshift(f);
    save();
    return f;
  }

  function followups() { return data.followups.filter(function (f) { return !f.done; }); }

  function completeFollowup(id) {
    for (var i = 0; i < data.followups.length; i++) {
      if (data.followups[i].id === id) {
        data.followups[i].done = true;
        data.followups[i].doneAt = new Date().toISOString();
        return save();
      }
    }
    return false;
  }

  function stats() {
    var open = data.buyers.filter(function (b) { return !b.outcome; });
    var byStage = M.stageNames().map(function (n, i) {
      return { name: n, count: open.filter(function (b) { return b.stage === i; }).length };
    });
    return {
      total: data.buyers.length,
      open: open.length,
      won: data.buyers.filter(function (b) { return b.outcome; }).length,
      sampled: data.buyers.filter(function (b) { return b.stage >= 2; }).length,
      /* 学徒期口径：推进阶段数才算进展，不用成交率衡量（B2B 周期以月计） */
      byStage: byStage
    };
  }

  function exportJSON() { return JSON.stringify(data, null, 2); }

  function importJSON(text) {
    var o = JSON.parse(text);
    if (!o || o.v !== 1 || !Array.isArray(o.buyers)) throw new Error("文件格式不对：应是本工作台导出的 JSON");
    data = o;
    return save();
  }

  global.FabricStore = {
    KEY: KEY, load: load, save: save,
    buyers: buyers, getBuyer: getBuyer, addBuyer: addBuyer, setSpec: setSpec,
    advance: advance, markDeal: markDeal, addMessage: addMessage,
    addFollowup: addFollowup, followups: followups, completeFollowup: completeFollowup, stats: stats,
    exportJSON: exportJSON, importJSON: importJSON
  };
})(typeof window !== "undefined" ? window : global);
