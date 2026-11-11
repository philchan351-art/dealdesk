/* ===== 数据层：localStorage 持久化（MVP 方案 A） =====
 * 替换 window.Mock：与 mock.js 完全相同的接口（页面层零改动）+ Store 扩展 API。
 * W3 升级方案 B（云存储）时只替换本文件 load/save 实现，页面无感。
 */
(function () {
  "use strict";
  /* 2026-11-10 共享内核切换（Phil「共享内核，直接做」）：数据命名空间参数化。
     默认值 = 原 key，主工作台逐字节零变化；面料入口的 fabric-boot.js 声明
     window.DEALDESK_KEY 换到 dd.fabric.v1。本行是本次发版对冻结行李箱代码的唯一改动。 */
  var KEY = window.DEALDESK_KEY || "dealdesk.data.v1";
  var VERSION = 1;
  var SEED_V = "v4-w4-fresh2"; // 种子数据版本：结构变化时递增，旧本地数据自动重建（w4-fresh2：清除 W4 验证产生的测试买家，试用起步）
  var seed = window.Mock; // mock.js 作为种子数据

  /* 2026-11-09 多业务域：store.js 先于 app.js 加载，而本文件的迁移/取数都要知道当前域，
     所以在这里就从登录态绑定（app.js 只负责处理"未绑定"和"登录后换绑"）。
     未登录或登录态里没有域标签 → current() 返回 null，各入口按兜底逻辑走，不抛错白屏 */
  if (window.DealDomain) { try { DealDomain.bindFromStorage(); } catch (e) { console.warn && console.warn("[域绑定失败]", e); } }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (d && d.v === VERSION && d.seedV === SEED_V && d.buyers && d.followups) {
        if (!d.persona) d.persona = emptyPersona();
        /* P0：旧版本地黑名单 deleted 迁移为墓碑 deletedIds（随推送上云，90 天防删除复活） */
        if (d.deleted && !d.deletedIds) { d.deletedIds = d.deleted; delete d.deleted; }
        if (!d.deletedIds) d.deletedIds = [];
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
    deletedIds: [],
    savedAt: null
  };
  if (!data.deletedIds) data.deletedIds = [];

  /* 原地替换数组：保持 Mock.buyers / Mock.followups 引用恒稳，会话内 UI 不读旧数据 */
  function replaceArr(arr, next) {
    arr.length = 0;
    (next || []).forEach(function (x) { arr.push(x); });
  }
  /* 墓碑（P0）：被删客户的 id 记在 deletedIds，本地立即隐藏；
     推送时一并上云，服务端在 90 天窗口内阻止"旧设备/旧快照把已删客户并回来" */
  function purge() {
    if (!data.deletedIds.length) return;
    replaceArr(data.buyers, data.buyers.filter(function (b) { return data.deletedIds.indexOf(b.id) < 0; }));
    replaceArr(data.followups, data.followups.filter(function (f) { return f.buyerId == null || data.deletedIds.indexOf(f.buyerId) < 0; }));
  }
  purge();
  /* 2026-10-14 现场反馈：初版原型的 9 个示例客户（b1-b9）混进了真实数据，看板一直显示案例数字。
     一次性清理：删除 + 打墓碑（随云同步上云，服务端 90 天内阻止恢复）；每次云端拉取后复查，防其他设备并回来 */
  var DEMO_IDS = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9"];
  function purgeDemo() {
    var hit = false;
    data.buyers.forEach(function (b) { if (DEMO_IDS.indexOf(b.id) >= 0) { tombAdd(b.id); hit = true; } });
    if (!hit) return;
    replaceArr(data.buyers, data.buyers.filter(function (b) { return DEMO_IDS.indexOf(b.id) < 0; }));
    replaceArr(data.followups, data.followups.filter(function (f) { return DEMO_IDS.indexOf(f.buyerId) < 0; }));
    saveLocal();
  }
  purgeDemo();
  migrateFollowDates();
  /* 先补形再回填成交——缺 stage 的记录补成 0 后，成交回填才不会漏 */
  migrateBuyerShapes();
  /* 2026-11-09 多业务域：客户/跟进打域标签（老记录一律归遗留域，与当前所选域无关） */
  migrateDomainTags();
  /* 一次性修复 v1.11.2 及之前「按当前域打标」搬错的数据（判据保守，见函数注释） */
  try { repairMisTags(); } catch (e) { console.warn && console.warn("[域标签修复失败]", e); }
  migrateOutcomeStages();
  rescanStages(); /* 启动回扫：store 先于 utils 加载时此处 U 未定义（自动跳过），由 app.js startApp 补跑 */

  /* 2026-10-22（Phil「业务员无法保存新客户」排查）：这里原来的空 catch 是"功能偶尔消失"的暗雷——
     本地存储写满（数据里有 base64 消息图片）时，所有本地保存静默失败，用户只看到"没保存上"。
     现在：失败必 toast（15 秒限流，带当前数据体量）+ console 留原始错误，永不静默 */
  var _saveWarnAt = 0;
  function saveLocal() {
    data.savedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("[saveLocal 失败]", e);
      var now = Date.now();
      if (now - _saveWarnAt > 15000) {
        _saveWarnAt = now;
        if (window.App) App.toast("⚠ 本地存储已满（约 " + dataSizeMB().toFixed(1) + "MB），本次保存可能没保住；设置→版本卡 看数据体量", 5000);
      }
      return false;
    }
  }
  function dataSizeMB() {
    try {
      var all = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        all += (localStorage.getItem(k) || "").length;
      }
      return all / 1024 / 1024;
    } catch (e) { return 0; }
  }
  /* 用户真实改动才上云；wipeLocal/applySnapshot 这类"本地整理"绝不能触发推送（空数据上云会盖掉真数据） */
  var pushWarnAt = {};
  function save() {
    saveLocal();
    if (window.Sync) Sync.pushNow().catch(function (e) {
      var m = String((e && e.message) || e);
      console.warn("云同步推送失败：", m);
      /* 修复（审计 H2）：推送失败绝不能静默——会话失效/账号停用意味着本机改动正悄悄丢失；
         同一原因 60 秒内只提示一次，避免刷屏 */
      var now = Date.now(), k = m.slice(0, 24);
      if (now - (pushWarnAt[k] || 0) < 60000) return;
      pushWarnAt[k] = now;
      if (/会话失效|请重新登录|已停用|用户不存在/.test(m)) {
        App.toast("⚠ 登录状态失效，本机新数据未上云：请点「设置 → 切换账号」重新登录（30 天内数据在云端等待合并）", 6000);
      } else {
        App.toast("⚠ 云同步失败：" + m.slice(0, 40), 6000);
      }
    });
  }

  /* P0：updatedAt 统一 ISO 字符串（服务端按字符串比较新旧；毫秒数与 ISO 混用会比较错） */
  function stamp(b) { if (b) b.updatedAt = new Date().toISOString(); }

  /* 2026-10-22（跟进到期日每日滚动）：dueDate 存本地日历日 YYYY-MM-DD（按用户时区算，不用 UTC 防跨天漂移） */
  function dayISO(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function addDaysISO(days) {
    var d = new Date();
    d.setDate(d.getDate() + (Number(days) || 0));
    return dayISO(d);
  }
  /* 老跟进任务只有静态 dueIn（建完就不再变，"1 天后"永不进"今天/逾期"）→ 一次性迁移补 dueDate=今天+dueIn；
     幂等：已迁移过的不碰；迁移结果随 saveLocal 落盘并随云同步共享给其他设备 */
  function migrateFollowDates() {
    var hit = false;
    data.followups.forEach(function (f) {
      if (!f.dueDate) { f.dueDate = addDaysISO(f.dueIn || 0); hit = true; }
    });
    if (hit) saveLocal();
  }
  /* 2026-10-22（Phil：「有实际成交你还是没有判定」）：存量「已标记成交但 stage 还停在前面」的客户
     （如 Amritpal 24h 成交案例）回填 stage=5 并进 stageLog 留痕；幂等——回填后 stage=5 不再命中 */
  function migrateOutcomeStages() {
    var hit = false;
    data.buyers.forEach(function (b) {
      var deal = (window.U && U.dealOf) ? U.dealOf(b) : 5;
      if (b.outcome && b.outcome.status === "won" && b.stage < deal && window.U && U.applyStage) {
        b.outcome.prevStage = b.stage;
        if (U.applyStage(b, deal, "补记：已成交标记", "migrate", null, true)) hit = true;
      }
    });
    if (hit) saveLocal();
  }
  /* 2026-10-23（Phil「很多客户已经报过价、甚至成交了，还是待报价/停在旧阶段」）：存量对话全量回扫。
     v1.4.0 起机械扫描只跑在"当时新记录"的消息上——存量对话里早就写着的报价/议价/样品/付款证据
     从来没被读过，阶段就冻在旧值（且 index.html 里 store 先于 utils 加载，启动时 U 还没定义，
     启动迁移在本地已同步数据上根本跑不了）。现在把每个客户的消息按时间顺序重放进同一个扫描：
     1-4 走 applyStage（只进不退、已到档位返回 false → 天然幂等、不重复留痕）；
     5 只挂"成交信号"卡、绝不自动成交（Phil 口径：成交=人工终裁）。
     触发点：应用启动（app.js startApp）/ 云端快照 / 历史导入 / CSV 导入；无命中零写入 */
  function rescanStages() {
    if (!(window.U && U.stageScan && U.applyStage)) return 0;
    var changed = 0;
    data.buyers.forEach(function (b) {
      var s0 = b.stage, cs0 = !!b.closeSignal;
      var deal = (window.U && U.dealOf) ? U.dealOf(b) : 5;
      if (b.outcome) {
        /* 2026-10-23（二次审计）：v1.4.0 前"已标记成交但 stage 停在旧值"的旧数据，启动时也补到成交档——
           此前只在云端快照时补（本地数据已同步的设备永远等不到快照），成交客户的阶段条不再冻在旧档 */
        if (b.outcome.status === "won") {
          if (b.stage < deal && b.outcome.prevStage == null) b.outcome.prevStage = b.stage;
          if (U.applyStage(b, deal, "补记：已成交标记", "rescan", null, true)) { stamp(b); changed++; }
        }
        return; /* 已成交/已流失：消息不再扫描推进 */
      }
      (b.messages || []).forEach(function (m) {
        var t = m && m.text;
        if (!t) return;
        var sig = U.stageScan(b, t);
        if (!sig) return;
        if (sig.to >= deal) {
          if (!b.closeSignal) b.closeSignal = { at: new Date().toISOString(), why: sig.why, evidence: String(t).slice(0, 80), src: "rescan" };
        } else if (U.applyStage(b, sig.to, sig.why + "·补扫", "rescan", t)) {
          /* 推进已写入 b.stage + stageLog（上限 20 条） */
        }
      });
      if (b.stage !== s0 || !!b.closeSignal !== cs0) { stamp(b); changed++; }
    });
    if (changed) saveLocal();
    return changed;
  }
  /* 2026-10-22（Phil「客户进不去了」）：老版本建的客户记录可能缺 tags/messages/context 等字段，
     缺一个字段 render 就抛异常、页面卡死且无声无息。统一补形（幂等）；
     应用云端快照时也跑一遍——老设备可能推上来不完整记录 */
  function migrateBuyerShapes() {
    var hit = false;
    data.buyers.forEach(function (b) {
      if (!Array.isArray(b.tags)) { b.tags = []; hit = true; }
      if (!Array.isArray(b.messages)) { b.messages = []; hit = true; }
      if (!Array.isArray(b.context)) { b.context = []; hit = true; }
      if (!Array.isArray(b.intentLog)) { b.intentLog = []; hit = true; }
      if (!Array.isArray(b.stageLog)) { b.stageLog = []; hit = true; }
      if (typeof b.stage !== "number") { b.stage = 0; hit = true; }
      if (typeof b.intent !== "number") { b.intent = 50; hit = true; }
    });
    if (hit) saveLocal();
  }
  /* ===== 2026-11-09（Phil 裁决「一人绑一域」）：业务域标签 =====
     domainId 是记录的一等字段：客户、跟进都带。隔离做在取数层（domainBuyers/domainFollowups），
     不是 UI 隐藏——搜索、导出、复盘、看板全部走同一把过滤刀，换 UI 也漏不出去。 */
  /* 遗留域：业务域功能上线之前，全系统只有行李箱/宠物这一条业务线，所以没有 domainId 的老记录
     只可能属于它。这是事实推断，不是替谁决定卖什么。 */
  var LEGACY_DOMAIN = "e-scooter";
  function currentDomainId() {
    return (window.DealDomain && DealDomain.currentId && DealDomain.currentId()) || null;
  }
  /* ⚠ 这里曾经是一个会造成数据损坏的 bug（v1.11.2 及之前）：无标签记录被打上「当前所选域」。
     后果：管理员账号从行李箱域切进面料域的瞬间，他名下全部行李箱客户被改标成面料客户并持久化上云——
     不是"没隔开"，是主动把客户搬进了新域。
     正确模型（Phil 定调「全新的域，不是在原来基础上生成」）：**切域永远不搬数据、不改标签**。
     老记录一律归遗留域；新域是个干净的空世界，要客户就自己新建。 */
  function migrateDomainTags() {
    var hit = false;
    data.buyers.forEach(function (b) { if (!b.domainId) { b.domainId = LEGACY_DOMAIN; hit = true; } });
    data.followups.forEach(function (f) { if (!f.domainId) { f.domainId = LEGACY_DOMAIN; hit = true; } });
    if (hit) saveLocal();
    return hit;
  }
  /* 修复被上面那个 bug 搬错的记录：判据只用「产品线字段明确是 suitcase/pet」这一条硬事实。
     不用 free text 正则——面料客户里真实存在"给行李箱厂供布"的，产品描述会带 suitcase 字样，
     按文本搬就会把真面料客户搬走（漏修可以人工处理，误搬是破坏数据）。
     跟进记录一律跟随其客户的域，客户不在本域的跟进也一并归位。
     该函数任何时候跑都安全（幂等、只认硬字段），所以启动与拉云端快照后各跑一次。 */
  var LINES_IN_LEGACY = { suitcase: 1, pet: 1 };
  function repairMisTags() {
    var moved = 0;
    data.buyers.forEach(function (b) {
      if (!b || b.domainId === LEGACY_DOMAIN) return;
      if (LINES_IN_LEGACY[String(b.scope || "").toLowerCase()]) { b.domainId = LEGACY_DOMAIN; moved++; }
    });
    var byId = {};
    data.buyers.forEach(function (b) { if (b && b.id) byId[b.id] = b; });
    data.followups.forEach(function (f) {
      if (!f) return;
      var owner = byId[f.buyerId];
      if (owner) { if (f.domainId !== owner.domainId) { f.domainId = owner.domainId; moved++; } }
      else if (LINES_IN_LEGACY[String(f.scope || "").toLowerCase()]) { f.domainId = LEGACY_DOMAIN; moved++; }
    });
    if (moved) saveLocal();
    return moved;
  }
  /* 归属修复（管理员动作，带预览确认）：把指定客户连同其跟进改到目标域。
     为什么不由我自动判：误标发生在业务域上线之前，而"给行李箱厂供面料"的客户描述里也会带 suitcase，
     任何文本启发式都可能把真面料客户搬走。所以这里只执行人勾选的结果，不猜。 */
  function retagBuyers(ids, toDomain) {
    if (!ids || !ids.length || !toDomain) return 0;
    var want = {}, moved = 0;
    ids.forEach(function (id) { want[id] = 1; });
    data.buyers.forEach(function (b) {
      if (want[b.id] && b.domainId !== toDomain) { b.domainId = toDomain; moved++; }
    });
    data.followups.forEach(function (f) {
      if (want[f.buyerId] && f.domainId !== toDomain) { f.domainId = toDomain; moved++; }
    });
    if (moved) save();
    return moved;
  }

  /* 列出"看起来不属于本域"的客户供勾选：本域客户里没有任何本域特征的那些。
     只是候选清单，不做任何自动改动。 */
  function strayCandidates() {
    var pack = (window.DealDomain && DealDomain.current) ? DealDomain.current() : null;
    if (!pack) return [];
    var line = (pack.productLines || []).map(function (l) { return l.key; }).filter(Boolean);
    var mark = /(面料|fabric|克重|gsm|门幅|后整理|finishing|色号|pantone|成分|composition|涂层|coated|涤纶|polyester|锦纶|nylon|丹尼|denier|塔丝绒|牛津布|oxford)/i;
    return domainBuyers().filter(function (b) {
      if (line.indexOf(String(b.scope || "")) >= 0) return false;              /* 产品线就是本域 → 不动 */
      var hay = [b.product, b.qty, b.note].concat((b.context || []).map(function (c) {
        return c ? [c.k, c.v].join(" ") : "";
      })).concat((b.messages || []).map(function (m) { return m && m.text; })).join(" ");
      return !mark.test(hay);                                                   /* 通篇找不到本域特征 → 列为候选 */
    });
  }

  /* 产品线值域由域包给（行李箱：suitcase/pet/all；面料：fabric）。
     写死值域就是第二个域一上线就报错的根因。非法值一律回落"未定"，不猜 */
  function validScope(scope) {
    var lines = (window.DealDomain && DealDomain.current() && DealDomain.productLines()) || null;
    var allowed = lines ? lines.map(function (l) { return l.key; }) : ["", "suitcase", "pet", "all"];
    return allowed.indexOf(scope) >= 0 ? scope : "";
  }

  /* 本域可见客户：唯一的取数入口（页面一律用它，不再裸读 Mock.buyers） */
  function domainBuyers() {
    var d = currentDomainId();
    if (!d) return data.buyers; /* 域运行时未就绪：退回全量，宁可多看不白屏（并留一次告警） */
    return data.buyers.filter(function (b) { return !b.domainId || b.domainId === d; });
  }
  function domainFollowups() {
    var d = currentDomainId();
    if (!d) return data.followups;
    return data.followups.filter(function (f) { return !f.domainId || f.domainId === d; });
  }

  function tombAdd(id) {
    if (!id) return;
    if (data.deletedIds.indexOf(id) < 0) {
      data.deletedIds.push(id);
      if (data.deletedIds.length > 400) data.deletedIds = data.deletedIds.slice(-400);
    }
  }

  var Mock = {
    buyers: data.buyers,
    suggestions: seed.suggestions,
    followups: data.followups,
    week: seed.week,
    kpis: seed.kpis,
    getBuyer: function (id) {
      var list = domainBuyers();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
  };
  /* 2026-11-09 多业务域：STAGES 由当前域包提供（行李箱域返回与 mock.js 逐字一致的 6 段 → 现网零变化；
     面料域 7 段）。用 getter 而不是常量：绑定发生在 app.js 登录后，取数时才知道是哪个域 */
  Object.defineProperty(Mock, "STAGES", {
    get: function () {
      if (window.DealDomain) {
        var p = DealDomain.current();
        if (p) return DealDomain.stageNames(p);
      }
      return seed.STAGES;
    }
  });
  Object.defineProperty(Mock, "DEAL_STAGE", {
    get: function () {
      if (window.DealDomain) {
        var p = DealDomain.current();
        if (p) return DealDomain.dealStage(p);
      }
      return 5;
    }
  });
  /* 看板分桶用的「已报价档 / 谈判档」同样由域包给：行李箱 2 与 3；
     面料「已报价」= 大货报价(5)，谈判档沿用 5（面料没有独立的议价阶段，议价发生在报价档内） */
  Object.defineProperty(Mock, "QUOTE_STAGE", {
    get: function () {
      if (window.DealDomain) {
        var p = DealDomain.current();
        if (p) return DealDomain.quoteStage(p);
      }
      return 2;
    }
  });
  Object.defineProperty(Mock, "NEGOTIATION_STAGE", {
    get: function () {
      if (window.DealDomain) {
        var p = DealDomain.current();
        if (p) return DealDomain.negotiationStage(p);
      }
      return 3;
    }
  });

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
    rescanStages: rescanStages, /* 2026-10-23 app.js startApp 启动时补跑（启动时 U 尚未加载）；应用快照/导入在内部自跑 */
    dataSizeMB: dataSizeMB, /* 2026-10-22 设置版本卡展示本地数据体量 */
    /* ===== 2026-11-09 多业务域：页面取数一律走这两个入口，隔离做在这里 ===== */
    domainBuyers: domainBuyers,
    domainFollowups: domainFollowups,
    currentDomainId: currentDomainId,
    migrateDomainTags: migrateDomainTags,
    repairMisTags: repairMisTags,
    retagBuyers: retagBuyers,
    strayCandidates: strayCandidates,
    validScope: validScope,
    /* 账号换域是管理员动作：本域标签不迁移，原域记录留在原域（该账号此后看不到） */
    rebindAccountDomain: function (domainId) {
      if (!window.DealDomain || !DealDomain.get(domainId)) return false;
      try {
        var a = DealDomain.readAccount() || {};
        a.domainId = domainId;
        localStorage.setItem(DealDomain.AUTH_KEY, JSON.stringify(a));
        DealDomain.setAccount(a);
        migrateDomainTags();
        return true;
      } catch (e) { console.error("[换域失败]", e); return false; }
    },
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
    /* 2026-10-23（Phil「整个客户状态系列都存在问题」）：全部消息写入的唯一入口——
       记客户/记我发/记一条/话术步进/发 WhatsApp/照片/编号选项一律走这里，机械硬信号扫描
       对每条消息生效，谁都不许再直接 b.messages.push 绕过（此前 8 条写入路径只有 1 条被扫，
       业务员记"已报价 EXW 222"阶段纹丝不动，就是绕路造成的）。
       opts: { from: "me"|"buyer"（默认 buyer）, time, imgs, sentAt, status, noSave: 只写入+扫描不落盘（调用方统一 commit）} */
    addMessage: function (buyerId, text, zh, opts) {
      var b = Mock.getBuyer(buyerId);
      var o = opts || {};
      if (!b || (!text && !(o.imgs && o.imgs.length))) return null; /* 纯空记录不收；纯图片可 */
      b.messages = b.messages || [];
      var m = { from: o.from === "me" ? "me" : "buyer", time: o.time || "刚刚", text: text || "" };
      if (zh) m.zh = zh;
      if (o.imgs) m.imgs = o.imgs;
      if (o.sentAt) m.sentAt = o.sentAt;
      if (o.status) m.status = o.status;
      b.messages.push(m);
      b.lastActive = "刚刚";
      /* 2026-10-22（Phil：阶段判定不能"表面"）：每条记录消息都过机械硬信号扫描——
         1-4 档自动推进并留痕；5 成交信号不自动标成交（Phil 口径：成交=人工终裁），只挂"成交信号"卡等一键确认 */
       /* 2026-10-31（话术自动翻译）：scanText=与存储文本分离的扫描文本——存目标语言译文、
          扫中文原文（已报价/EXW 222 等信号词只存在于中文，扫译文会漏判阶段） */
       var sig = (window.U && U.stageScan) ? U.stageScan(b, o.scanText || m.text) : null;
      var deal = (window.U && U.dealOf) ? U.dealOf(b) : 5;
      if (sig && !b.outcome) {
        if (sig.to >= deal) {
          if (!b.closeSignal) b.closeSignal = { at: new Date().toISOString(), why: sig.why, evidence: String(m.text || "").slice(0, 80), src: "rule" };
        } else if (U.applyStage(b, sig.to, sig.why, "rule", m.text)) {
          /* 推进已写入 b.stage + stageLog，随下方 save 同步 */
        }
      }
      stamp(b);
      if (!o.noSave) save();
      return m;
    },
    /* 2026-10-23（Phil「没有给他放到成交」）：标记成交的唯一数据入口——
       客户详情页小按钮、成交信号卡、客户列表卡片一键 ✓ 全部走这里：
       outcome=won + stage→5（留痕、记 prevStage 可回退）+ 清成交信号卡。
       付款发生在 App 之外（银行短信/ACH 通知/内部同步）的单，一条都不该被漏掉 */
    markWon: function (buyerId, via) {
      var b = Mock.getBuyer(buyerId);
      if (!b || b.outcome) return null;
      b.outcome = { status: "won", at: new Date().toISOString() };
      var deal = (window.U && U.dealOf) ? U.dealOf(b) : 5;
      if (b.stage < deal && window.U && U.applyStage) {
        b.outcome.prevStage = b.stage;
        U.applyStage(b, deal, via === "signal" ? "成交信号确认" : "手动标记成交", "manual", b.closeSignal ? b.closeSignal.evidence : null, true);
      }
      b.closeSignal = null;
      stamp(b);
      save();
      return b;
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
      /* 2026-11-09：客户建在哪个域 = 建档账号绑的域，建完锁定（一个客户只属一个域） */
      var dom = currentDomainId();
      if (!dom) {
        if (window.App) App.toast("⚠ 当前账号未绑定业务域，请先在弹出卡片里选择", 4000);
        return null;
      }
      var b = {
        /* id 加随机尾：原来 "u"+Date.now() 在同毫秒连续建档（批量导入/快速补录）会撞号，
           撞了以后 getBuyer 只会命中第一条，消息与阶段就记到别人头上（多业务域回归测试实锤） */
        id: "u" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        domainId: dom,
        name: info.name,
        company: info.company || "—",
        country: info.country,
        cc: info.cc || (window.CountryProfiles ? CountryProfiles.cc(info.country) : "—"),
        product: info.product || "待确认",
        qty: info.qty || "待确认",
        amount: Number(info.amount) > 0 ? Number(info.amount) : 0, /* 2026-10-23：金额首次有了真实写入入口（建档/编辑表单） */
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
        scope: validScope(info.scope),
        /* extraContext：FB 表单识别出的扩展要点（邮箱/首单计划/业务类型…），最多 6 条 */
      context: [].concat(info.product ? [{ k: "需求", v: info.product }] : []).concat((info.extraContext || []).filter(function (x) { return x && x.k && String(x.v || "").trim(); }).slice(0, 6)),
        profile: cp,
        messages: [],
        /* 2026-10-22（浏览器真机复现）：新建客户必须带全留痕数组——
           此前缺 stageLog/intentLog，详情页 render 裸读 .length 直接崩，点不进客户 */
        stageLog: [],
        intentLog: [],
        updatedAt: new Date().toISOString()
      };
      data.buyers.unshift(b);
      data.followups.unshift({
        id: "f" + Date.now(), buyerId: b.id, domainId: dom,
        action: "首次跟进：发产品资料 + 确认核心需求", dueIn: 1, dueDate: addDaysISO(1),
        done: false, updatedAt: new Date().toISOString()
      });
      save();
      return b;
    },
    /* 2026-10-22（Phil）：手动新建跟进任务——客户 + 要做什么 + 几天后到期（存具体日历日，之后逐日滚动） */
    addFollowup: function (buyerId, action, dueInDays) {
      var b = Mock.getBuyer(buyerId);
      if (!b) return null;
      var n = Math.round(Number(dueInDays) || 0);
      var f = {
        id: "f" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        buyerId: buyerId,
        domainId: b.domainId || currentDomainId(),
        action: String(action || "").trim().slice(0, 80),
        dueIn: n,
        dueDate: addDaysISO(n),
        done: false,
        updatedAt: new Date().toISOString()
      };
      data.followups.unshift(f);
      save();
      return f;
    },
    /* 编辑档案（2026-10-14 现场需求）：改姓名/WhatsApp/国家等基础信息；不触碰对话、意向、档案要点 */
    updateBuyer: function (id, f) {
      var b = Mock.getBuyer(id);
      if (!b) return null;
      if (f.name) b.name = String(f.name).slice(0, 60);
      if (f.wa !== undefined) b.wa = String(f.wa).slice(0, 30);
      if (f.company !== undefined) b.company = f.company || "—";
      if (f.msgLang !== undefined) { if (f.msgLang) b.msgLang = f.msgLang; else delete b.msgLang; }
      if (f.product !== undefined) b.product = f.product || "待确认";
      if (f.qty !== undefined) b.qty = f.qty || "待确认";
      if (f.amount !== undefined) { var amt = parseFloat(f.amount); b.amount = (isFinite(amt) && amt > 0) ? amt : 0; } /* 2026-10-23：报价/订单金额可录可清 */
      /* 产品线（2026-10-15）：决定客户页显示哪套公共资料/话术剧本 */
      if (f.scope !== undefined) b.scope = validScope(f.scope);
      if (f.note !== undefined) {
        var nt = String(f.note).trim();
        b.tags = nt ? [nt] : [];
      }
      if (f.country && f.country !== b.country) {
        b.country = f.country;
        if (window.CountryProfiles) b.cc = CountryProfiles.cc(f.country);
        var cp = (window.CountryProfiles && CountryProfiles.get(f.country)) || null;
        if (cp) b.profile = cp; /* 国家变了，沟通画像跟着换 */
      }
      stamp(b);
      save();
      return b;
    },
    clearAll: function () {
      /* P0：清空前先给全部客户打墓碑，防止其他设备的旧快照把它们并回来 */
      data.buyers.forEach(function (b) { tombAdd(b.id); });
      replaceArr(data.buyers, []);
      replaceArr(data.followups, []);
      save();
    },
    removeBuyer: function (id) {
      tombAdd(id); /* 墓碑上云，服务端 90 天窗口内防"删除复活" */
      replaceArr(data.buyers, data.buyers.filter(function (x) { return x.id !== id; }));
      replaceArr(data.followups, data.followups.filter(function (f) { return f.buyerId !== id; }));
      save();
    },
    /* 切换/新建登录账号时：清掉本机上一位业务员的客户数据和话术，只保留云端该账号的数据 */
    wipeLocal: function () {
      replaceArr(data.buyers, []);
      replaceArr(data.followups, []);
      data.deletedIds = [];
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
    /* 过往聊天导入：对话前置（标"历史导入"）+ 档案要点合并 + 长期记忆累积（按账号随云端保存） */
    importIntoBuyer: function (buyerId, convo, summary, fields) {
      var b = null;
      data.buyers.forEach(function (x) { if (x.id === buyerId) b = x; });
      if (!b) return null;
      var dateStr = new Date().toLocaleDateString("zh-CN");
      var lines = (convo || []).map(function (line) {
        return { from: String(line.from || "").indexOf("卖") >= 0 ? "me" : "buyer", text: String(line.text || ""), time: "历史", tag: "历史导入" };
      }).filter(function (l) { return l.text; }).reverse();
      lines.forEach(function (l) { b.messages.unshift(l); });
      if (!b.context) b.context = [];
      (fields || []).forEach(function (f) {
        var k = String(f.k || "").slice(0, 40), v = String(f.v || "").slice(0, 200);
        if (!k || !v) return;
        var hit = (b.context || []).some(function (c) {
          if (c.k === k) { c.v = v; return true; }
          return false;
        });
        if (!hit) b.context.push({ k: k, v: v });
      });
      if (summary) {
        b.memory = (b.memory ? b.memory + "\n\n" : "") + "（" + dateStr + " 导入）" + String(summary).slice(0, 1000);
      }
      b.updatedAt = new Date().toISOString();
      rescanStages(); /* 导入的历史对话里若含报价/付款证据，阶段当场补正，不等下次启动 */
      save();
      return b;
    },
    /* 资料文件（元数据+内容）：只存本地，由调用方通过 Sync.docUpload 上云 */
    setPersonaDocs: function (docs) {
      data.persona = data.persona || emptyPersona();
      data.persona.docs = docs || [];
      saveLocal();
      return data.persona.docs;
    },
    snapshot: function () {
      return { buyers: data.buyers, followups: data.followups, persona: data.persona, updatedAt: data.savedAt, deletedIds: data.deletedIds };
    },
    applySnapshot: function (snap) {
      if (!snap || !snap.buyers) return false;
      /* P0：云端墓碑并入本地黑名单（多设备删除同步） */
      if (snap.tombstones && typeof snap.tombstones === "object") {
        Object.keys(snap.tombstones).forEach(function (id) { tombAdd(id); });
      }
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
        purgeDemo();
        migrateFollowDates(); /* 云端快照可能来自旧版本设备，无 dueDate 的同样补一次（幂等） */
        migrateBuyerShapes(); /* 同上：旧设备记录缺字段（tags 等）的，拉下来补形（幂等）；必须在成交回填之前 */
        migrateDomainTags(); /* 同上：没有域标签的记录一律归遗留域（不认当前域，否则切域就搬客户） */
        try { repairMisTags(); } catch (e) { console.warn && console.warn("[域标签修复失败]", e); }
        migrateOutcomeStages(); /* 同上：旧设备标记成交但 stage 未进 5 的，拉下来同样补（幂等） */
        rescanStages(); /* 同上：其他设备/旧版本没扫过的存量对话，拉下来同样补扫（幂等） */
        data.savedAt = snap.updatedAt || data.savedAt;
      /* 修复（审计 M3）：单独记录"已同步到的云端版本"，拉取判断用它而不是本机 savedAt（本机时钟漂移会导致永远不拉新数据） */
      if (snap.updatedAt) data.serverAt = String(snap.updatedAt);
      saveLocal();
      return true;
    },
    getServerAt: function () { return data.serverAt || ""; },
    toggleFollowup: function (fid, done) {
      for (var i = 0; i < data.followups.length; i++) {
        if (data.followups[i].id === fid) {
          data.followups[i].done = done;
          data.followups[i].updatedAt = new Date().toISOString();
          save();
          return;
        }
      }
    },
    exportCSV: function () {
      /* 2026-11-09：导出限定当前域 + 阶段名取域包（面料导出里不会再出现「样品确认」这类行李箱档名） */
      var names = Mock.STAGES, dl = domainBuyers();
      var rows = [["buyer", "company", "country", "intent", "stage", "wa", "time", "from", "text", "zh_mirror"]];
      dl.forEach(function (b) {
        (b.messages || []).forEach(function (m) {
          rows.push([
            b.name, b.company, b.country, b.intent, names[b.stage] || "", b.wa || "",
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
          var names = Mock.STAGES, dom = currentDomainId();
          domainBuyers().forEach(function (b) { idx[b.name] = b; });
          var added = 0;
          rows.slice(1).forEach(function (r) {
            if (r.length < 10 || !r[0]) return;
            var b = idx[r[0]];
            if (!b) {
              b = {
                id: "imp_" + Math.random().toString(36).slice(2, 8), name: r[0], company: r[1],
                country: r[2], cc: "?", product: "（导入）", qty: "", amount: 0, currency: "$",
                domainId: dom,
                intent: Number(r[3]) || 50, stage: Math.max(0, names.indexOf(r[4])),
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
          rescanStages(); /* CSV 恢复的对话同样过一遍硬信号扫描（幂等） */
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
