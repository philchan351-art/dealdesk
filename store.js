/* ===== 数据层：localStorage 持久化（MVP 方案 A） =====
 * 替换 window.Mock：与 mock.js 完全相同的接口（页面层零改动）+ Store 扩展 API。
 * W3 升级方案 B（云存储）时只替换本文件 load/save 实现，页面无感。
 */
(function () {
  "use strict";
  var KEY = "dealdesk.data.v1";
  var VERSION = 1;
  var SEED_V = "v4-w4-fresh2"; // 种子数据版本：结构变化时递增，旧本地数据自动重建（w4-fresh2：清除 W4 验证产生的测试买家，试用起步）
  var seed = window.Mock; // mock.js 作为种子数据

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (d && d.v === VERSION && d.seedV === SEED_V && d.buyers && d.followups) {
        if (!d.persona) d.persona = emptyPersona();
        return d;
      }
    } catch (e) {}
    return null;
  }
  function emptyPersona() { return { thoughts: "", scripts: "", updated: null, docs: [] }; }

  var data = load() || {
    v: VERSION,
    seedV: SEED_V,
    buyers: JSON.parse(JSON.stringify(seed.buyers)),
    followups: JSON.parse(JSON.stringify(seed.followups)),
    persona: emptyPersona(),
    savedAt: null
  };

  /* 原地替换数组：保持 Mock.buyers / Mock.followups 引用恒稳，会话内 UI 不读旧数据 */
  function replaceArr(arr, next) {
    arr.length = 0;
    (next || []).forEach(function (x) { arr.push(x); });
  }
  /* 删除黑名单：被删客户即使被云端并集"复活"也不再显示（本机永久生效） */
  function purge() {
    if (!data.deleted || !data.deleted.length) return;
    replaceArr(data.buyers, data.buyers.filter(function (b) { return data.deleted.indexOf(b.id) < 0; }));
  }
  purge();

  function saveLocal() {
    data.savedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }
  /* 用户真实改动才上云；wipeLocal/applySnapshot 这类"本地整理"绝不能触发推送（空数据上云会盖掉真数据） */
  function save() {
    saveLocal();
    if (window.Sync) Sync.pushNow().catch(function (e) { console.warn("云同步推送失败：", e.message); });
  }

  function stamp(b) { if (b) b.updatedAt = Date.now(); }

  var Mock = {
    STAGES: seed.STAGES,
    buyers: data.buyers,
    suggestions: seed.suggestions,
    followups: data.followups,
    week: seed.week,
    kpis: seed.kpis,
    getBuyer: function (id) {
      for (var i = 0; i < data.buyers.length; i++) if (data.buyers[i].id === id) return data.buyers[i];
      return null;
    }
  };

  function parseCSV(text) {
    var rows = [], row = [], field = "", inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
        else if (c !== "\r") field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  var SET_KEY = "dealdesk.settings.v1"; // 与数据分开，"恢复示例数据"不会清掉 LLM 配置

  var Store = {
    commit: save,
    getSettings: function () {
      try { return JSON.parse(localStorage.getItem(SET_KEY)) || null; } catch (e) { return null; }
    },
    saveSettings: function (s) {
      s.llm = s.llm || {};
      try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch (e) {}
    },
    addContext: function (buyerId, k, v) {
      var b = Mock.getBuyer(buyerId);
      if (!b || !k || !v) return;
      b.context = b.context || [];
      for (var i = 0; i < b.context.length; i++) {
        if (b.context[i].k === k) { b.context[i].v = v; stamp(b); save(); return; }
      }
      b.context.push({ k: k, v: v });
      stamp(b);
      save();
    },
    reset: function () {
      localStorage.removeItem(KEY);
      location.reload();
    },
    stats: function () {
      var msgs = 0;
      data.buyers.forEach(function (b) { msgs += (b.messages || []).length; });
      return { buyers: data.buyers.length, messages: msgs, savedAt: data.savedAt };
    },
    addMessage: function (buyerId, text, zh) {
      var b = Mock.getBuyer(buyerId);
      if (!b || !text) return null;
      b.messages = b.messages || [];
      var m = { from: "buyer", time: "刚刚", text: text };
      if (zh) m.zh = zh;
      b.messages.push(m);
      b.lastActive = "刚刚";
      stamp(b);
      save();
      return m;
    },
    bumpIntent: function (buyerId, delta, reason) {
      var b = Mock.getBuyer(buyerId);
      if (!b) return null;
      var old = b.intent;
      b.intent = Math.max(5, Math.min(99, old + delta));
      b.intentLog = b.intentLog || [];
      b.intentLog.push({ t: "刚刚", d: delta, r: reason || "", from: old, to: b.intent });
      stamp(b);
      save();
      return { from: old, to: b.intent };
    },
    addBuyer: function (info) {
      var cp = (window.CountryProfiles && CountryProfiles.get(info.country)) ||
        { address: info.name, style: "国家画像待积累（随沟通自动学习）", tip: "首次沟通确认其称呼与沟通偏好" };
      var b = {
        id: "u" + Date.now(),
        name: info.name,
        company: info.company || "—",
        country: info.country,
        cc: info.cc || (window.CountryProfiles ? CountryProfiles.cc(info.country) : "—"),
        product: info.product || "待确认",
        qty: "待确认",
        amount: 0,
        currency: "$",
        intent: info.intent || 50,
        stage: 0,
        followIn: 1,
        lastActive: "刚刚建档",
        unread: 0,
        tags: info.note ? [info.note] : ["新客户"],
        quoteNo: "—",
        daysInStage: 0,
        wa: info.wa || "",
        context: info.product ? [{ k: "需求", v: info.product }] : [],
        profile: cp,
        messages: [],
        updatedAt: Date.now()
      };
      data.buyers.unshift(b);
      data.followups.unshift({
        id: "f" + Date.now(), buyerId: b.id,
        action: "首次跟进：发产品资料 + 确认核心需求", dueIn: 1, done: false, updatedAt: Date.now()
      });
      save();
      return b;
    },
    clearAll: function () {
      replaceArr(data.buyers, []);
      replaceArr(data.followups, []);
      save();
    },
    removeBuyer: function (id) {
      data.deleted = data.deleted || [];
      if (data.deleted.indexOf(id) < 0) {
        data.deleted.push(id);
        if (data.deleted.length > 200) data.deleted = data.deleted.slice(-200);
      }
      replaceArr(data.buyers, data.buyers.filter(function (x) { return x.id !== id; }));
      save();
    },
    /* 切换/新建登录账号时：清掉本机上一位业务员的客户数据和话术，只保留云端该账号的数据 */
    wipeLocal: function () {
      replaceArr(data.buyers, []);
      replaceArr(data.followups, []);
      data.deleted = [];
      data.persona = emptyPersona();
      data.savedAt = null;
      saveLocal();
    },
    getPersona: function () {
      if (!data.persona) data.persona = emptyPersona();
      if (!data.persona.docs) data.persona.docs = [];
      return data.persona;
    },
    /* 文字训练：保存并上云（资料文件走 /doc/upload，不经这里） */
    savePersona: function (thoughts, scripts) {
      data.persona = data.persona || emptyPersona();
      data.persona.docs = data.persona.docs || [];
      data.persona.thoughts = String(thoughts || "").slice(0, 4000);
      data.persona.scripts = String(scripts || "").slice(0, 6000);
      data.persona.updated = new Date().toISOString();
      save();
      return data.persona;
    },
    /* 资料文件（元数据+内容）：只存本地，由调用方通过 Sync.docUpload 上云 */
    setPersonaDocs: function (docs) {
      data.persona = data.persona || emptyPersona();
      data.persona.docs = docs || [];
      saveLocal();
      return data.persona.docs;
    },
    snapshot: function () {
      return { buyers: data.buyers, followups: data.followups, persona: data.persona, updatedAt: data.savedAt };
    },
    applySnapshot: function (snap) {
      if (!snap || !snap.buyers) return false;
      replaceArr(data.buyers, snap.buyers);
      replaceArr(data.followups, snap.followups || []);
      if (snap.persona && (snap.persona.thoughts || snap.persona.scripts)) {
        data.persona = data.persona || emptyPersona();
        data.persona.thoughts = snap.persona.thoughts || "";
        data.persona.scripts = snap.persona.scripts || "";
        data.persona.updated = snap.persona.updated || data.persona.updated;
        /* 云端只存资料元数据；内容本地已有就保留，没有就留空待用 */
        var oldDocs = data.persona.docs || [], merged = [];
        (snap.persona.docs || []).forEach(function (nd) {
          var od = null;
          oldDocs.forEach(function (x) { if (x && x.name === nd.name) od = x; });
          merged.push(od ? od : { key: nd.key, name: nd.name, size: nd.size, updated: nd.updated });
        });
        data.persona.docs = merged;
      }
      purge();
      data.savedAt = snap.updatedAt || data.savedAt;
      saveLocal();
      return true;
    },
    toggleFollowup: function (fid, done) {
      for (var i = 0; i < data.followups.length; i++) {
        if (data.followups[i].id === fid) {
          data.followups[i].done = done;
          data.followups[i].updatedAt = Date.now();
          save();
          return;
        }
      }
    },
    exportCSV: function () {
      var rows = [["buyer", "company", "country", "intent", "stage", "wa", "time", "from", "text", "zh_mirror"]];
      data.buyers.forEach(function (b) {
        (b.messages || []).forEach(function (m) {
          rows.push([
            b.name, b.company, b.country, b.intent, seed.STAGES[b.stage], b.wa || "",
            m.time, m.from === "me" ? "me" : "buyer", m.text, m.zh || ""
          ]);
        });
      });
      var csv = "\uFEFF" + rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(",");
      }).join("\r\n");
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      var d = new Date();
      a.href = URL.createObjectURL(blob);
      a.download = "dealdesk-backup-" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + ".csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    },
    importCSV: function (file, cb) {
      var reader = new FileReader();
      reader.onerror = function () { cb && cb(-1); };
      reader.onload = function () {
        try {
          var rows = parseCSV(String(reader.result).replace(/^\uFEFF/, ""));
          var idx = {};
          data.buyers.forEach(function (b) { idx[b.name] = b; });
          var added = 0;
          rows.slice(1).forEach(function (r) {
            if (r.length < 10 || !r[0]) return;
            var b = idx[r[0]];
            if (!b) {
              b = {
                id: "imp_" + Math.random().toString(36).slice(2, 8), name: r[0], company: r[1],
                country: r[2], cc: "?", product: "（导入）", qty: "", amount: 0, currency: "$",
                intent: Number(r[3]) || 50, stage: Math.max(0, seed.STAGES.indexOf(r[4])),
                followIn: 7, lastActive: "导入", unread: 0, tags: [], quoteNo: "—", daysInStage: 0,
                wa: r[5], messages: []
              };
              data.buyers.push(b);
              idx[b.name] = b;
            }
            var m = { from: r[7] === "me" ? "me" : "buyer", time: r[6], text: r[8] };
            if (r[9]) m.zh = r[9];
            var dup = (b.messages || []).some(function (x) { return x.time === m.time && x.text === m.text; });
            if (!dup) { b.messages = b.messages || []; b.messages.push(m); added++; }
          });
          save();
          cb && cb(added);
        } catch (e) {
          cb && cb(-1);
        }
      };
      reader.readAsText(file, "utf-8");
    }
  };

  window.Mock = Mock;
  window.Store = Store;
})();
