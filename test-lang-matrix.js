/* ===== 13 语言 × 3 路径全矩阵验证（node test-lang-matrix.js）· v1.28.1 =====
 * Phil「你再把十三种语言检查下，包括按意图扩充、逐句直译、ai代写，用不同语言，能否对应生成各自的语言」
 * FC 真机需会话凭证（本环境无），本矩阵确定性覆盖决定成败的代码层：
 *   P1 提示词层：三条路的提示词是否把目标语言灌进去（铁律/禁令/锚点/自相矛盾/日语汉字例外/巴西葡）
 *   P2 闸门层：  该语言的「正常业务输出」必须放行（防误杀）；英语惯性输出必须拦截（防漏判）
 *   P3 救援层：  expand 端到端——模型两次顽固出英语 → 自动转 localize → 最终必为该语言（mock 顽固模型）
 * 13 行＝12 规范语言＋「自动」档（按国家解析，测 美国→英语 / 巴西→葡萄牙语）
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
const P = ctx.window.Prompts;

/* 各语言「正常业务输出」（通用商务短句，无业务事实——数字仅作占位）与 GREET 锚点期望 */
const GOOD = {
  "英语": "Hi, the price is 10 dollars per unit. We can start with 50 units.",
  "中文": "好的，价格是每台10美元，50台起订。",
  "西班牙语": "Hola, el precio es de 10 dólares por unidad. Podemos empezar con 50 unidades.",
  "法语": "Bonjour, le prix est de 10 dollars l'unité. Nous pouvons commencer avec 50 unités.",
  "德语": "Hallo, der Preis beträgt 10 Dollar pro Stück. Wir können mit 50 Stück beginnen.",
  "葡萄牙语": "Olá, o preço é de 10 dólares por unidade. Podemos começar com 50 unidades.",
  "日语": "こんにちは、価格は1台10ドルです。50台からご注文いただけます。",
  "韩语": "안녕하세요, 가격은 1대 10달러입니다. 50대에서 시작할 수 있습니다.",
  "阿拉伯语": "مرحباً، السعر 10 دولارات للوحدة. يمكننا البدء بـ 50 وحدة.",
  "俄语": "Здравствуйте, цена 10 долларов за единицу. Мы можем начать с 50 единиц.",
  "意大利语": "Buongiorno, il prezzo è di 10 dollari a pezzo. Possiamo iniziare con 50 pezzi.",
  "土耳其语": "Merhaba, fiyat birim başına 10 dolardır. 50 adetle başlayabiliriz."
};
const GREET = { "西班牙语": "Hola", "法语": "Bonjour", "德语": "Hallo", "葡萄牙语": "Olá", "日语": "こんにちは", "韩语": "안녕하세요", "阿拉伯语": "مرحباً", "俄语": "Здравствуйте", "意大利语": "Buongiorno", "土耳其语": "Merhaba" };
const EN_INERTIA = "Hi, the price is 10 dollars per unit. We can start with 50 units. Please confirm.";
const EN_EXPAND = JSON.stringify({ buyerLast: "问价格", check: "无", brain: "先直接报价", text: "The price is 10 dollars per unit. We can start with 50 units.", zh: "每台10美元，50台起订" });

let currentLang = "英语";
ctx.fetch = function () {
  var body = JSON.parse(arguments[1].body);
  var sys = String(body.messages[0].content || "");
  var resp = function (content) { return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: content } }] })); } }); };
  if (sys.indexOf("逐句翻译器") >= 0) return resp(GOOD[currentLang]); /* 直译引擎正常：按当前测试语言回正确译文 */
  return resp(arguments[1].body.indexOf("buyerLast") >= 0 ? EN_EXPAND : EN_EXPAND_LIST);
};
var EN_EXPAND_LIST = JSON.stringify({
  diagnosis: { nextGoal: "拿到数量", blocker: "无", move: "小步试探" },
  suggestions: [
    { style: "a", text: "Hi, the price is 10 dollars per unit. How many units do you need?", zh: "1" },
    { style: "b", text: "We can start with 50 units, shipping takes 15 days.", zh: "2" },
    { style: "c", text: "Please confirm your target market and quantity.", zh: "3" }
  ]
});
ctx.Store = { getSettings: function () { return { llm: { key: "test-key" } }; }, getPersona: function () { return null; } };
ctx.window.Store = ctx.Store;
ctx.Mock = { STAGES: { 0: "询盘", 1: "需求确认", 2: "报价", 3: "谈判", 4: "样品确认", 5: "成交" } };
ctx.window.Mock = ctx.Mock;

function mkBuyer(l) { return { name: "t", msgLang: l, stage: 0, messages: [{ from: "buyer", text: "What is your best price?" }], context: [], memory: "" }; }

let fails = 0;
function cell(name, fn) {
  try { fn(); return "✓"; } catch (e) { fails++; return "✗ " + String(e.message || e).slice(0, 60); }
}

console.log("13 语言 × 3 路径全矩阵（P1 提示词 / P2 闸门 / P3 救援端到端）");
console.log("─".repeat(100));
const rows = [];
Object.keys(GOOD).forEach(function (lang) {
  const b = mkBuyer(lang);
  const isEn = (lang === "英语"), isZh = (lang === "中文");
  /* P1 提示词层 × 3 路 */
  const p1sugg = cell("代写", function () {
    const s = P.suggest(b);
    assert.ok(s.indexOf("必须全部用" + lang + "书写") >= 0, "suggest 缺语言铁律");
    if (!isEn) assert.ok(s.indexOf("也严禁输出英语") >= 0, "suggest 缺禁英语");
    if (isZh) assert.ok(s.indexOf("严禁出现任何中文汉字") < 0, "中文目标出现禁汉字矛盾");
    if (lang === "日语") assert.ok(s.indexOf("text 中严禁出现中文句子（日语正常使用的汉字保留）") >= 0, "日语缺汉字例外");
    if (!isEn && !isZh) {
      assert.ok(s.indexOf("【语言硬约束·输出前最后检查】") >= 0, "suggest 缺尾部锚点");
      assert.ok(s.indexOf("「" + GREET[lang] + "」") >= 0, "suggest 缺首词锚点 " + GREET[lang]);
    }
  });
  const p1loc = cell("直译", function () {
    const s = P.localize(b);
    assert.ok(s.indexOf("全部用" + lang + "书写") >= 0, "localize 缺语言铁律");
    if (lang === "日语") assert.ok(s.indexOf("输出中严禁出现中文句子") >= 0, "日语直译缺汉字例外");
    if (lang === "葡萄牙语") assert.ok(P.suggest(mkBuyer("葡萄牙语（巴西）")).indexOf("必须是巴西葡语") >= 0, "巴西葡特判失效");
  });
  const p1exp = cell("扩充", function () {
    const s = P.expand(b);
    assert.ok(s.indexOf("全部用" + lang + "书写") >= 0, "expand 缺语言铁律");
    if (!isEn && !isZh) {
      assert.ok(s.indexOf("【语言硬约束·输出前最后检查】") >= 0, "expand 缺尾部锚点");
      assert.ok(s.indexOf("「" + GREET[lang] + "」") >= 0, "expand 缺首词锚点 " + GREET[lang]);
    }
  });
  /* P2 闸门层 × 3 路（suggest/expand 同闸；localize 同闸 + cjkLeak） */
  const p2 = cell("闸门", function () {
    assert.strictEqual(LLM.wrongLang(GOOD[lang], lang), false, "正常" + lang + "输出被误杀: " + GOOD[lang]);
    if (!isZh) assert.strictEqual(LLM.cjkLeak(GOOD[lang], lang), false, "正常" + lang + "被当中文泄漏");
    if (!isEn) assert.strictEqual(LLM.wrongLang(EN_INERTIA, lang), true, "英语惯性输出未被拦截（" + lang + "目标）");
  });
  rows.push({ lang: lang, p1sugg: p1sugg, p1loc: p1loc, p1exp: p1exp, p2: p2, p3: "" });
});

/* P3 救援端到端：expand 顽固英语 ×2 → 自动 localize → 必为对应语言（11 个非英语目标；英语目标无闸门无救援）
   串行执行：currentLang 在每次 expand 发起前设定，mock 的 localize 回当前语言的正确译文 */
Promise.resolve().then(function () {
  let chain = Promise.resolve();
  Object.keys(GOOD).forEach(function (lang) {
    if (lang === "英语") return;
    chain = chain.then(function () {
      currentLang = lang;
      return LLM.expand("问问价格", mkBuyer(lang)).then(function (o) {
        const row = rows.find(function (r) { return r.lang === lang; });
        if (o.rescued === true && !o.wrongLang && o.text === GOOD[lang]) row.p3 = "✓";
        else { row.p3 = "✗ text=" + String(o.text).slice(0, 30) + " wrongLang=" + o.wrongLang + " rescued=" + o.rescued; fails++; }
      });
    });
  });
  return chain;
}).then(function () {
  /* 「自动」档（第 13 行）：msgLang 空 → 按国家解析 */
  const autoUS = P.langOf({ name: "t", country: "美国", stage: 0, messages: [] });
  const autoBR = P.langOf({ name: "t", country: "巴西", stage: 0, messages: [] });
  const sUS = P.suggest({ name: "t", country: "美国", stage: 0, messages: [] });
  const sBR = P.suggest({ name: "t", country: "巴西", stage: 0, messages: [] });
  const autoOK = (autoUS === "英语" && autoBR === "葡萄牙语（巴西）"
    && sUS.indexOf("【语言硬约束") < 0
    && sBR.indexOf("必须全部用葡萄牙语（巴西）书写") >= 0
    && sBR.indexOf("必须是巴西葡语") >= 0
    && sBR.indexOf("「Olá」") >= 0 /* v1.28.1：带括号规范名的锚点回落到 Olá */);
  rows.push({ lang: "自动（美国→英语/巴西→葡）", p1sugg: autoOK ? "✓" : "✗ 解析/锚点错", p1loc: autoOK ? "✓" : "✗", p1exp: autoOK ? "✓" : "✗", p2: "—", p3: "—" });
  if (!autoOK) fails++;

  console.log("语言".padEnd(24) + "  代写P1   直译P1   扩充P1   闸门P2   救援P3(expand 顽固英语→目标语言)");
  rows.forEach(function (r) {
    const bad = [r.p1sugg, r.p1loc, r.p1exp, r.p2, r.p3].some(function (x) { return x.indexOf("✗") >= 0; });
    console.log((r.lang + " ").slice(0, 24).padEnd(24) + "  " + r.p1sugg.slice(0, 8).padEnd(8) + " " + r.p1loc.slice(0, 8).padEnd(8) + " " + r.p1exp.slice(0, 8).padEnd(8) + " " + r.p2.slice(0, 8).padEnd(8) + " " + (r.p3 || "—") + (bad ? "   ← 有失败项" : ""));
  });
  console.log("─".repeat(100));
  if (fails === 0) { console.log("MATRIX-ALL-GREEN（13 行 × 3 路径全过）"); process.exit(0); }
  console.log("MATRIX-FAILS=" + fails); process.exit(1);
}).catch(function (e) { console.error("MATRIX-CRASH: " + (e && e.stack || e)); process.exit(1); });
