/* ===== 救援通道端到端（node test-rescue.js）· v1.28.0 =====
 * 场景：Phil 实锤「选西班牙语/法语，按意图扩充和 AI 代写生成的依然是英语」。
 * mock 一个顽固模型：suggest 首答与纠正重试都出英语 → 断言救援通道把每条自动转
 * localize 直译（句数/事实守恒）→ 最终文本=目标语言＋rescued 标＋语言类 ⛔ 清除。
 * expand 同构。另测「救援也失败」分支：localize mock 仍出英语 → 保留原 ⛔（不静默放行）。
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const REPO = __dirname + "/";
const noop = function () {};
const el = () => ({ style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, appendChild: noop, removeChild: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], setAttribute: noop, getAttribute: () => null, textContent: "", innerHTML: "", children: [] });
const mem = {};
const ctx = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, key: i => Object.keys(mem)[i], get length() { return Object.keys(mem).length; } },
  location: { hash: "#/home", search: "", href: "https://x/", replace: noop, reload: noop },
  history: { replaceState: noop },
  document: { createElement: el, body: el(), querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: noop, title: "" },
  navigator: { userAgent: "node" }, performance: { now: () => Date.now() }, requestAnimationFrame: noop,
  Blob: function () {}, URL: { createObjectURL: () => "", revokeObjectURL: noop }, FileReader: function () {}
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
function load(f) { vm.runInContext(fs.readFileSync(REPO + f, "utf8"), ctx, { filename: f }); }
load("country-profiles.js");
load("prompts.js");
load("llm.js");

const LLM = ctx.window.LLM;
/* 每条源文对应的西语译文——数字与源文一致（句数/事实守恒，过 localize 的 F6 膨胀闸） */
const SPAN = {
  "Hi, the price is 10 dollars per unit. How many units do you need?": "Hola, el precio es de 10 dólares por unidad. ¿Cuántas unidades necesita?",
  "We can start with 50 units, shipping takes 15 days.": "Podemos empezar con 50 unidades, el envío tarda 15 días.",
  "Please confirm your target market and quantity.": "Confirme su mercado objetivo y la cantidad, por favor.",
  "The price is 10 dollars per unit. We can start with 50 units.": "El precio es de 10 dólares por unidad. Podemos empezar con 50 unidades."
};
const EN_SUGGEST = JSON.stringify({
  diagnosis: { nextGoal: "拿到数量", blocker: "无", move: "小步试探" },
  suggestions: [
    { style: "直接报价", text: "Hi, the price is 10 dollars per unit. How many units do you need?", zh: "每台10美元，需要多少台？" },
    { style: "轻开场", text: "We can start with 50 units, shipping takes 15 days.", zh: "50台起订，物流15天" },
    { style: "问市场", text: "Please confirm your target market and quantity.", zh: "请确认目标市场和数量" }
  ]
});
const EN_EXPAND = JSON.stringify({
  buyerLast: "问价格", check: "无", brain: "先直接报价",
  text: "The price is 10 dollars per unit. We can start with 50 units.", zh: "每台10美元，50台起订"
});
/* 顽固模型：非 localize 调用一律英语（首答与纠正重试都顽固）；localize 正常出西语 */
let localizeCalls = 0;
let fetchN = 0;
function resp(content) {
  return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: content } }] })); } });
}
function mockFetch() {
  return function (url, opts) {
    var body = JSON.parse(opts.body);
    var sys = String(body.messages[0].content || "");
    if (sys.indexOf("逐句翻译器") >= 0) {
      localizeCalls++;
      if (ctx.rescueFail) return resp("The price is 10 dollars per unit.");
      var src = String(body.messages[1].content || "").split("中文原文：").pop().trim();
      return resp(SPAN[src] || "Traducción no encontrada para: " + src);
    }
    return resp(opts.body.indexOf("buyerLast") >= 0 ? EN_EXPAND : EN_SUGGEST);
  };
}
ctx.rescueFail = false;
ctx.fetch = mockFetch();
ctx.window.fetch = ctx.fetch;
ctx.Store = { getSettings: function () { return { llm: { key: "test-key" } }; }, getPersona: function () { return null; } };
ctx.window.Store = ctx.Store;
ctx.Mock = { STAGES: { 0: "询盘", 1: "需求确认", 2: "报价", 3: "谈判", 4: "样品确认", 5: "成交" } };
ctx.window.Mock = ctx.Mock;

const buyer = {
  name: "Santi", country: "西班牙", msgLang: "西班牙语", stage: 0,
  messages: [{ from: "buyer", text: "What is your best price?" }],
  context: [], memory: ""
};

Promise.resolve().then(function () {
  assert.ok(LLM && LLM.wrongLang, "LLM 加载成功");
  /* —— 测试 1：suggest 顽固英语 ×2 → 三条全被救援成西语 —— */
  return LLM.suggest(buyer).then(function (r) {
    assert.ok(r && r.list && r.list.length === 3, "suggest 返回 3 条");
    r.list.forEach(function (it, i) {
      assert.ok(it.rescued === true, "第" + (i + 1) + "条带 rescued 标");
      assert.ok(/Hola|Podemos|Confirme/.test(it.text), "第" + (i + 1) + "条已救援成西语: " + it.text);
      assert.ok(!(it.blockReasons || []).some(function (x) { return /仍是英语|含中文/.test(String(x)); }), "语言类 ⛔ 已清除: " + JSON.stringify(it.blockReasons));
    });
    assert.strictEqual(r.list[1].text, SPAN["We can start with 50 units, shipping takes 15 days."], "第2条救援译文与源文逐句对应");
    assert.ok(r.list[1].text.indexOf("50") >= 0 && r.list[1].text.indexOf("15") >= 0, "救援保事实：50/15 数字守恒");
    assert.strictEqual(localizeCalls, 3, "R1 阶段恰好 3 次 localize 救援（实际 " + localizeCalls + "）");
    console.log("R1 suggest 救援 PASS（3 条英语→西语，各 1 次 localize，数字守恒）");
  });
}).then(function () {
  /* —— 测试 2：expand 顽固英语 → 救援成西语，wrongLang 清除 —— */
  return LLM.expand("问问价格", buyer).then(function (o) {
    assert.strictEqual(o.text, SPAN["The price is 10 dollars per unit. We can start with 50 units."], "expand 已被救援成西语: " + o.text);
    assert.strictEqual(o.rescued, true, "带 rescued 标");
    assert.ok(!o.wrongLang, "wrongLang 已清: " + o.wrongLang);
    console.log("R2 expand 救援 PASS");
  });
}).then(function () {
  /* —— 测试 3：救援也失败（localize 仍出英语）→ 保留原 ⛔，不静默放行 —— */
  ctx.rescueFail = true;
  return LLM.expand("问问价格", buyer).then(function (o) {
    assert.ok(o.wrongLang, "救援失败保留 ⛔: " + o.wrongLang);
    assert.ok(!o.rescued, "不打 rescued 标");
    console.log("R3 救援失败兜底 PASS（⛔ 保留: " + o.wrongLang + "）");
    console.log("ALL RESCUE PASS");
  });
}).catch(function (e) {
  console.error("RESCUE-FAIL: " + (e && e.stack || e));
  process.exit(1);
});
