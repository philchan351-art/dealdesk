/* 面料业务线回归：node fabric/f-test.js
 * 重点锁两件事：① 面料目录里不得出现任何另一条业务线的产品词；② 面料写数据永不碰行李箱的键。
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.log("  FAIL " + name + (extra === undefined ? "" : " → " + JSON.stringify(extra)));
}

const DIR = __dirname;

/* ---------- ① 目录纯净度：不允许出现另一条线的任何产品词 ---------- */
const LUGGAGE_WORDS = ["行李箱", "suitcase", "luggage", "Titan", "titanx", "93.6", "电池", "专利", "航空合规", "INMETRO", "宠物用品", "壁灯", "彩盒", "吴总", "Cherry"];
const files = fs.readdirSync(DIR).filter(f => /\.(js|html)$/.test(f) && f !== "f-test.js");
ok("fabric 目录含模型/存储/UI/入口四个文件", ["f-model.js", "f-store.js", "f-app.js", "index.html"].every(f => files.includes(f)), files);
files.forEach(f => {
  const src = fs.readFileSync(path.join(DIR, f), "utf8");
  const hit = LUGGAGE_WORDS.filter(w => src.includes(w)).concat(src.match(/\d+\s*台|一台/g) || []);
  ok(`${f} 不含另一条业务线的产品词`, hit.length === 0, hit);
  ok(`${f} 不引用主工作台存储键`, src.indexOf("dealdesk.data.v1") < 0);
});

/* ---------- 装载（假 localStorage，记录每一次写入的 key） ---------- */
function makeCtx() {
  const mem = {};
  const writes = [];
  const ctx = {
    console, setTimeout: () => {}, URL: { createObjectURL: () => "blob:x" },
    Blob: function () {}, FileReader: function () {},
    document: { readyState: "complete", getElementById: () => null, querySelector: () => null,
      querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { toggle() {} }, click() {} }),
      body: { appendChild() {}, removeChild() {} }, addEventListener() {} },
    localStorage: {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); writes.push(k); },
      removeItem: k => { delete mem[k]; }
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  ["f-model.js", "f-store.js"].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), ctx, { filename: f }));
  ctx.mem = mem; ctx.writes = writes;
  return ctx;
}

const c = makeCtx();
c.FabricStore.load();

/* ---------- ② 写数据只碰自己的命名空间 ---------- */
["A 客户", "B 客户", "C 客户"].forEach(n => c.FabricStore.addBuyer({ name: n, country: "德国" }));
ok("面料建 3 个客户成功", c.FabricStore.buyers().length === 3);
ok("全部写入都落在 dd.fabric.v1", c.writes.every(k => k === "dd.fabric.v1"), [...new Set(c.writes)]);
ok("另一条业务线的记录集合一条都没被写", !c.writes.includes("dealdesk.data.v1"));
ok("面料客户记录里没有 domainId 这类归属判别字段",
  !Object.keys(c.FabricStore.buyers()[0]).some(k => /domain|line|scope|tenant/i.test(k)),
  Object.keys(c.FabricStore.buyers()[0]));

/* ---------- ③ 阶段机 ---------- */
const b = c.FabricStore.buyers()[0];
ok("成交档是末档", c.FabricModel.isDealStage(c.FabricModel.DEAL_STAGE) && c.FabricModel.DEAL_STAGE === 6);
ok("没写依据不能推进", c.FabricStore.advance(b.id, 3, "", "manual", "") === false);
ok("不能跳档倒退（先推到 1）", c.FabricStore.advance(b.id, 1, "已发 A/B 两版规格", "manual", "A/B") === true);
ok("倒退被拒", c.FabricStore.advance(b.id, 0, "退回去", "manual", "") === false);
ok("推进留痕可审计", c.FabricStore.getBuyer(b.id).stageLog.length === 1);

/* ---------- ③b 跟进（按样品生命周期，不是未决事项清单） ---------- */
const fu1 = c.FabricStore.addFollowup(b.id, "追洗水测试结果", "2026-11-15");
ok("跟进创建成功", !!fu1 && c.FabricStore.followups().length === 1);
ok("完成后移出未办列表", c.FabricStore.completeFollowup(fu1.id) === true && c.FabricStore.followups().length === 0);
ok("完成不存在的 id 返回 false", c.FabricStore.completeFollowup("ff-nosuch") === false);

/* ---------- ④ 守卫：学徒期敢用 AI 的前提 ---------- */
const buyerFull = {
  spec: [
    { k: "成分", v: "100% 涤纶" }, { k: "克重", v: "160 GSM" }, { k: "门幅", v: "150cm" },
    { k: "后整理", v: "C6 DWR" }, { k: "色号", v: "Pantone 19-4052 TCX" }
  ]
};
const tech = c.FabricModel.guardDraft({ spec: [] }, "This 210T fabric is 65 GSM, width 150cm, C6 DWR finishing.");
ok("不含价格的技术底稿可放行", tech.pass === true, tech.hits);
const noSpec = c.FabricModel.guardDraft({ spec: [] }, "USD 3.2 per meter, valid 15 days");
ok("规格不全的报价被拦", noSpec.hits.some(h => h.id === "spec"));
const noUnit = c.FabricModel.guardDraft(buyerFull, "USD 3.2, valid until Nov 30");
ok("缺计价单位被拦", noUnit.hits.some(h => h.id === "unit"));
const noCur = c.FabricModel.guardDraft(buyerFull, "3.2 per meter, valid until Nov 30");
ok("缺币种被拦", noCur.hits.some(h => h.id === "currency"));
const noValid = c.FabricModel.guardDraft(buyerFull, "USD 3.2 per meter");
ok("缺有效期被拦", noValid.hits.some(h => h.id === "validity"));
const facts = c.FabricModel.guardDraft(buyerFull, "USD 3.2 per meter, valid until Nov 30");
ok("事实未终裁时价格一律拦下", facts.hits.some(h => h.id === "facts_pending") && facts.pass === false, facts.hits);
const claim = c.FabricModel.guardDraft({ spec: [] }, "Our fabric is 100% waterproof and zero color difference.");
ok("绝对化承诺被拦", claim.hits.some(h => h.id === "claim"));
const bare = c.FabricModel.guardDraft({ spec: [] }, "unit price 0.32/m");
ok("不写币种的裸单价也算价格", bare.hits.length > 0, bare.hits);

/* ---------- ⑤ 术语 ---------- */
const g = c.FabricModel.GLOSSARY.map(x => x.zh);
["门幅", "克重", "缸差", "缩水率", "剪样", "后整理"].forEach(w => ok("术语表含 " + w, g.includes(w)));

/* ---------- ⑥ 出稿装配：装出来的提示词本身必须零另一线事实 ---------- */
console.log("\n[H] 出稿装配（大脑内容层）");
vm.runInContext(fs.readFileSync(path.join(DIR, "f-prompts.js"), "utf8"), c, { filename: "f-prompts.js" });
const FP = c.FabricPrompts;
const pb = { name: "Marco", company: "OutdoorCo", country: "意大利", use: "登山夹克外壳", market: "欧盟",
  stage: 1, spec: [{ k: "成分", v: "100% 涤纶" }, { k: "克重", v: "65 GSM" }],
  messages: [{ from: "buyer", text: "Can you do 5000mm with 75D?" }, { from: "me", text: "we can offer 40D" }] };
const built = FP.build(pb, "把门幅和色号问清，提议寄样卡");
const allText = built.system + "\n" + built.user;
ok("装配结果含学徒期定位", /学徒期/.test(allText));
ok("装配结果含未终裁与禁价指令", /未终裁/.test(allText) && /禁止出现任何价格/.test(allText));
ok("装配结果列出仍缺的规格项", allText.indexOf("门幅、色号") >= 0 || /仍缺/.test(built.user), built.user.slice(-260));
ok("装配结果含术语译法（缸差不是 color difference）", /batch-to-batch/.test(built.system));
ok("装配结果带阶段硬事实口径", /选型推荐/.test(built.user) && /A.B 差异说明/.test(built.user));
ok("装配结果要求中英对照", allText.indexOf("ZH:") >= 0);
const dirty = ["行李箱", "suitcase", "luggage", "Titan", "93.6", "电池", "专利", "航空合规", "INMETRO", "宠物用品", "壁灯", "吴总"].filter(function (w) { return allText.indexOf(w) >= 0; });
ok("* 装配出的提示词无任何另一线产品事实", dirty.length === 0, dirty);
ok("* 提示词不以经验为由", !/我们通常|以往成交都|按我们的经验/.test(allText));
const fence = String.fromCharCode(96, 96, 96);
const p1 = FP.parse("EN: Sure - could you confirm width and colour?\nZH: 可以，能确认门幅和色号吗？");
ok("解析 EN/ZH 正常", p1.en.indexOf("width") >= 0 && p1.zh.indexOf("门幅") >= 0, p1);
const p2 = FP.parse(fence + "\nEN: Hello\nZH: 你好\n" + fence);
ok("解析容忍代码围栏", p2.en === "Hello" && p2.zh === "你好", p2);
const p3 = FP.parse("just plain text");
ok("无标记时退化不报错", p3.en.length > 0, p3);
const p4 = FP.parse("EN: Only english part");
ok("缺中文对照不崩", p4.en === "Only english part" && p4.zh === "", p4);

/* ---------- ⑦ 加载冒烟：真的在假 DOM 里执行一遍全部模块 ----------
 * 专防"加载期抛 ReferenceError → 首屏白屏"这一类：上一版 })(global) 就是这么漏的，
 * 语法检查过得去、单元测试全绿，浏览器一开就是白的。 */
console.log("\n[I] 加载冒烟");
function fakeEl() {
  return {
    innerHTML: "", textContent: "", value: "", hidden: true, style: {}, offsetWidth: 1,
    classList: {
      _m: {}, add: function (c) { this._m[c] = 1; }, remove: function (c) { delete this._m[c]; },
      toggle: function () {}, contains: function (c) { return !!this._m[c]; }
    },
    addEventListener: function () {}, setAttribute: function () {}, click: function () {}
  };
}
function loadAll() {
  const mem = {}, nodes = {};
  const g = {
    console,
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    localStorage: {
      getItem: function (k) { return k in mem ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    },
    fetch: function () { return Promise.reject(new Error("no network in test")); },
    AbortController: null,
    URL: { createObjectURL: function () { return "blob:x"; } },
    Blob: function () {}, FileReader: function () {},
    document: {
      readyState: "complete",
      getElementById: function (id) { return nodes["#" + id] || (nodes["#" + id] = fakeEl()); },
      querySelector: null,
      querySelector: function (s) { return nodes[s] || (nodes[s] = fakeEl()); },
      querySelectorAll: function () { return []; },
      createElement: function () { return fakeEl(); },
      body: { appendChild: function () {}, appendChild: function () {}, removeChild: function () {}, removeChild: function () {} },
      addEventListener: function () {}
    }
  };
  g.AbortController = function () { this.signal = null; this.abort = function () {}; };
  g.window = g;
  vm.createContext(g);
  ["f-model.js", "f-store.js", "f-net.js", "f-prompts.js", "f-app.js"].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), g, { filename: f });
  });
  return { g: g, view: nodes["#fView"] };
}
let L = null, lerr = null;
try { L = loadAll(); } catch (e) { lerr = e; }
ok("* 全部模块加载期不抛异常", lerr === null, lerr && String(lerr.message));
if (L) {
  ["home", "buyers", "newBuyer", "detail", "backup", "followup", "login", "draftCard"].forEach(function (k) {
    ok("页面已注册 " + k, typeof L.g.Pages[k] === "function");
  });
  const html = String(L.view.innerHTML);
  ok("* 未登录首屏渲染出登录闸门（非白屏）", html.indexOf("登录") >= 0 && html.indexOf("lName") >= 0, html.slice(0, 60));
  ok("* 登录页没有云服务地址输入框与导入按钮", html.indexOf("云服务地址") < 0 && html.indexOf("cfgUrl") < 0 && html.indexOf("btnBorrow") < 0 && html.indexOf("btnSaveUrl") < 0);
  ok("* 首屏不含任何业务内容", html.indexOf("阶段分布") < 0 && html.indexOf("草稿体检") < 0);
  const fuBuyer = L.g.FabricStore.addBuyer({ name: "FuTest" });
  const fuTask = L.g.FabricStore.addFollowup(fuBuyer.id, "追洗水测试结果", "2026-11-15");
  const fuHtml = String(L.g.Pages.followup());
  ok("跟进页渲染出未办任务与期限", !!fuTask && fuHtml.indexOf("FuTest") >= 0 && fuHtml.indexOf("2026-11-15") >= 0);
  /* 断言任务行消失（data-done 按钮），不查客户名——客户名还会出现在新建表单的下拉里 */
  ok("跟进完成后页面不再显示该任务", L.g.FabricStore.completeFollowup(fuTask.id) && String(L.g.Pages.followup()).indexOf('data-done="' + fuTask.id + '"') < 0);
  ok("账号前缀自动补 fb-（已带前缀不重复补）",
    L.g.FabricNet.full("luo") === "fb-luo" && L.g.FabricNet.full("fb-luo") === "fb-luo");
  ok("未登录时无会话→出稿通道会明确拒绝而不是静默", L.g.FabricNet.session() === "");
  ok("云地址内置默认：hasCloud=true 且无需手填", L.g.FabricNet.hasCloud() === true && L.g.FabricNet.cfg().proxyUrl === "https://dealdes-clnhfkexse.cn-hangzhou.fcapp.run");
  ok("导入函数已移除（不再引用另一条线）", typeof L.g.FabricNet.borrowCfg === "undefined");
  ok("面料会话/配置只用自己的 key，不读另一条线的存储",
    L.g.FabricNet.CFG_KEY === "dd.fabric.cfg.v1" && L.g.FabricNet.AUTH_KEY === "dd.fabric.auth.v1");
}

console.log(`\n面料业务线回归：${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
