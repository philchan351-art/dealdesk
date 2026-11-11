/* ===== 多业务域回归（node test-domain.js）=====
 * 用最小浏览器壳（window/localStorage）按 index.html 的真实顺序加载 mock → domain → utils → store，
 * 验证两条裁决 + 现网零行为变化。行李箱域若有任何一条不一致 = Step 0 迁移失败，禁止合入。
 */
"use strict";
const fs = require("fs");
const vm = require("vm");

function makeCtx() {
  const mem = {};
  const noop = function () {};
  const el = () => ({
    style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, appendChild: noop, removeChild: noop, addEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [], setAttribute: noop, getAttribute: () => null,
    textContent: "", innerHTML: "", children: []
  });
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; },
      key: i => Object.keys(mem)[i],
      get length() { return Object.keys(mem).length; }
    },
    location: { hash: "#/home", search: "", href: "https://x/", replace: noop, reload: noop },
    history: { replaceState: noop },
    document: {
      createElement: el, body: el(), querySelector: () => null, querySelectorAll: () => [],
      getElementById: () => null, addEventListener: noop, title: ""
    },
    navigator: { userAgent: "node" },
    performance: { now: () => Date.now() },
    requestAnimationFrame: noop,
    Blob: function () {}, URL: { createObjectURL: () => "", revokeObjectURL: noop },
    FileReader: function () {}, fetch: () => Promise.reject(new Error("no net in test"))
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  ctx.localStorage._mem = mem;
  vm.createContext(ctx);
  return ctx;
}
function load(ctx, file) { vm.runInContext(fs.readFileSync(__dirname + "/" + file, "utf8"), ctx, { filename: file }); }

let pass = 0, fail = 0;
function safe(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); return; }
  fail++;
  console.log("  FAIL " + name + (extra === undefined ? "" : " → " + safe(extra)));
}
function boot(domainId) {
  const ctx = makeCtx();
  if (domainId) ctx.localStorage.setItem("dealdesk.auth.v1", JSON.stringify({ name: "T", role: "rep", session: "s", domainId: domainId }));
  load(ctx, "mock.js");
  load(ctx, "domain.js");
  load(ctx, "utils.js");
  load(ctx, "store.js");
  return ctx;
}

console.log("\n[1] 域包注册（两个域都必须通过契约校验）");
let c = boot("e-scooter");
ok("两个域都注册成功", Object.keys(c.DealDomain.packs).length === 2, c.DealDomain.rejected);
ok("无被拒域", c.DealDomain.rejected.length === 0, c.DealDomain.rejected);

console.log("\n[2] 行李箱域现网零变化（Step 0 的验收底线）");
const mockStages = c.Mock.STAGES;
ok("阶段名逐字一致", safe(mockStages) === safe(["询盘", "需求确认", "报价", "谈判", "样品确认", "成交"]), mockStages);
ok("成交档仍是 5", c.Mock.DEAL_STAGE === 5 && c.DealDomain.dealStage() === 5);
ok("报价档仍是 2", c.DealDomain.quoteStage() === 2);
ok("产品线值域不变", safe(c.DealDomain.productLines().map(l => l.key)) === safe(["", "suitcase", "pet", "all"]));
ok("行李箱开脑", c.DealDomain.brainMode().replyDraft === true);
ok("回合库语料计入闸门", c.DealDomain.brainMode().have >= 1, c.DealDomain.brainMode());

console.log("\n[3] 裁决 1 覆盖（Phil「不开脑不行」）：面料走 docs_driven 开脑 + 三条硬约束");
let f = boot("functional-fabric");
const fb = f.DealDomain.brainMode();
ok("面料已开脑", fb.replyDraft === true, fb);
ok("模式是 docs_driven（资料+棋谱驱动，非底稿替换）", fb.mode === "docs_driven");
ok("每条底稿带学徒期水印（不假装有基准可比）", /学徒期/.test(fb.unverifiedMark) && /核对/.test(fb.unverifiedMark), fb.unverifiedMark);
ok("水印不提具体人名（面料域话稿归属未定）", /吴总|Cherry|Phil/.test(fb.unverifiedMark) === false, fb.unverifiedMark);
ok("面料域定位 = novice（学徒）", fb.authority === "novice", fb.authority);
ok("行李箱域定位 = master（已有基准）", c.DealDomain.brainMode().authority === "master");
ok("面料客户拿不到回合库（按客户所属域判，非登录域）", f.DealDomain.turnLibrary(f.DealDomain.get("functional-fabric")) === false);
ok("行李箱客户仍能拿到回合库", eScooterTurnLib() === true);
function eScooterTurnLib() { return c.DealDomain.turnLibrary(c.DealDomain.get("e-scooter")); }
ok("风险签核留痕", /Phil/.test(fb.riskAcceptedBy), fb.riskAcceptedBy);
ok("事实未终裁 → factsReady=false", fb.factsReady === false);
ok("状态卡/阶段判定/风险/复盘仍开", fb.statusCard && fb.stageDetection && fb.riskHints && fb.review);
ok("门槛 60 条、当前 0 条（够数改回 runtime 切回底稿法）", fb.gate === 60 && fb.have === 0, fb);
/* 闸门可以被签字绕开，不能被"顺手改个 true"绕开 */
const nosign = JSON.parse(safe(f.DealDomain.get("functional-fabric")));
delete nosign.brain.acceptedRiskBy;
ok("docs_driven 缺风险签核 → 拒载该域", f.DealDomain.validatePack(nosign).some(e => /签核/.test(e)));
const wrongmode = JSON.parse(safe(f.DealDomain.get("functional-fabric")));
delete wrongmode.brain.mode;
ok("source=docs 但未声明 docs_driven 模式 → 拒载", f.DealDomain.validatePack(wrongmode).some(e => /docs_driven/.test(e)));
ok("8 段设计落成 7 段且成交=末档", f.Mock.STAGES.length === 7 && f.Mock.DEAL_STAGE === 6, f.Mock.STAGES);
ok("阶段名是面料的", safe(f.Mock.STAGES) === safe(["规格确认", "选型推荐", "寄样", "客户测试", "试单", "大货报价", "首单成交"]), f.Mock.STAGES);
ok("面料报价档=大货报价(5)", f.DealDomain.quoteStage() === 5);
/* 以下两项都校验副本，绝不改活包（改了会污染后面的阶段用例） */
const broken = JSON.parse(safe(f.DealDomain.get("functional-fabric")));
broken.stages = broken.stages.map(function (s, i) { return { key: s.key, name: s.name, isDeal: i === 2 }; }); /* isDeal 挪到中档 = 成交后还有阶段 */
ok("成交档挪出末位 → 契约拒绝该域", f.DealDomain.validatePack(broken).some(e => /末档/.test(e)));
ok("活包未被污染（仍是 7 段）", f.DealDomain.get("functional-fabric").stages.length === 7);
const sneak = JSON.parse(safe(f.DealDomain.get("e-scooter")));
sneak.id = "sneak";
sneak.brain = { repliesEnabled: true, corpusGate: { minRealReplies: 60, source: "runtime" } };
ok("零语料想开脑 → 契约直接拒载", f.DealDomain.validatePack(sneak).some(e => /禁止开脑/.test(e)));

console.log("\n[4] 裁决 2：一人绑一域 + 取数层隔离");
ok("行李箱账号取到行李箱包", c.DealDomain.current().id === "e-scooter");
ok("面料账号取到面料包", f.DealDomain.current().id === "functional-fabric");
let threw = "";
try { c.DealDomain.setAccount({ name: "X", role: "rep" }); } catch (e) { threw = e.message; }
ok("未绑域账号抛错，不回落默认域", /ACCOUNT_WITHOUT_DOMAIN/.test(threw), threw);
threw = "";
try { c.DealDomain.setAccount({ name: "X", domainId: "no-such" }); } catch (e) { threw = e.message; }
ok("未知域抛错", /UNKNOWN_DOMAIN/.test(threw), threw);

/* 两个域各建客户 → 互相看不见 */
c.Store.addBuyer({ name: "LugBuyer", country: "美国", qty: "100 台", scope: "suitcase" });
f.Store.addBuyer({ name: "FabBuyer", country: "德国", qty: "3000 米", scope: "fabric" });
ok("行李箱侧可见 1 个客户", c.Store.domainBuyers().length === 1, c.Store.domainBuyers().map(b => b.name));
ok("面料侧可见 1 个客户", f.Store.domainBuyers().length === 1, f.Store.domainBuyers().map(b => b.name));
ok("客户带上域标签", c.Store.domainBuyers()[0].domainId === "e-scooter" && f.Store.domainBuyers()[0].domainId === "functional-fabric");
ok("面料侧看不到行李箱客户（按名字）", !f.Store.domainBuyers().some(b => b.name === "LugBuyer"));
ok("面料侧建客户能选本域产品线", f.Store.domainBuyers()[0].scope === "fabric");
/* 防回退锁：functional/coated 这类自造 key 服务端永远认不了（白名单只有 suitcase/pet/all/fabric），
   用它当线值会让资料 owner 反推为 null，被自己的隔离规则挡在门外——所以必须继续被拒 */
ok("自造线值 functional 被拒（不再是合法值）", (f.Store.addBuyer({ name: "Old", country: "德国", scope: "functional" }), f.Store.domainBuyers().find(b => b.name === "Old").scope === ""));
ok("跨域产品线值被回落为未定", (f.Store.addBuyer({ name: "Bad", country: "美国", scope: "pet" }), f.Store.domainBuyers().find(b => b.name === "Bad").scope === ""));
/* 两个 node 上下文同毫秒建客户会撞 id（"u"+Date.now()），所以直接改本地记录的域标签来验隔离：
   本域库里存在这条记录，但它不属于本域 → getBuyer 必须取不到（跨域 id 命中也拿不到人） */
const flip = f.Store.domainBuyers().find(b => b.name === "FabBuyer");
flip.domainId = "e-scooter";
ok("getBuyer 也走隔离（本库记录但域不符 → 取不到）", f.Mock.getBuyer(flip.id) === null);
ok("客户详情侧同样看不到", !f.Store.domainBuyers().some(b => b.id === flip.id));
flip.domainId = "functional-fabric";

console.log("\n[5] 面料阶段管道：机械扫描按面料词表推进");
const fab = f.Store.domainBuyers().find(b => b.name === "FabBuyer");
f.Store.addMessage(fab.id, "我要 210T 春亚纺，克重 65，门幅 150cm", "", { from: "buyer" });
ok("规格信号 → 规格确认(0)", fab.stage === 0, fab.stage);
f.Store.addMessage(fab.id, "建议走 40D 加后整理，A 方案更轻 B 方案更耐磨", "", { from: "me" });
ok("选型推荐 → 1", fab.stage === 1, fab.stage);
f.Store.addMessage(fab.id, "样卡已寄，DHL 单号 1234567890", "", { from: "me" });
ok("寄样 → 2", fab.stage === 2, fab.stage);
f.Store.addMessage(fab.id, "客户说 SGS 测试开始了，等结果", "", { from: "buyer" });
ok("客户测试 → 3", fab.stage === 3, fab.stage);
f.Store.addMessage(fab.id, "先做 300 米试单", "", { from: "buyer" });
ok("试单 → 4", fab.stage === 4, fab.stage);
f.Store.addMessage(fab.id, "bulk price USD 3.2/m, valid until 11-30", "", { from: "me" });
ok("大货报价 → 5", fab.stage === 5, fab.stage);
ok("留痕可审计", fab.stageLog.length >= 5, fab.stageLog.length);
f.Store.markWon(fab.id, "manual");
ok("首单成交 → 6 且需人工标记", fab.stage === 6 && fab.outcome.status === "won");
ok("U-quoteLabel：面料 5 档算已报价", f.U.quoteLabel({ stage: 5 }) === "已报价" && f.U.quoteLabel({ stage: 2 }) === "未报价", f.U.quoteLabel({ stage: 2 }));
ok("U-quoteLabel：行李箱 2 档仍是已报价", c.U.quoteLabel({ stage: 2 }) === "已报价");

console.log("\n[6] 面料守卫：无规格报价必红警（该域最易砸单的错）");
const specCtx = [{ k: "成分", v: "92%PA 8%EA" }, { k: "克重", v: "160" }, { k: "门幅", v: "150" }, { k: "后整理", v: "DWR C6" }, { k: "色号", v: "19-4053 TCX" }];
const fabPack = f.DealDomain.current();
let g1 = f.DealDomain.guardDraft(fabPack, { context: [{ k: "成分", v: "92%PA" }] }, "Our price is USD 3.2 per meter");
ok("只有成分 → block 且列出缺项", g1.pass === false && g1.hits.some(h => h.id === "spec" && h.missing.length === 4), g1.hits);
let g2 = f.DealDomain.guardDraft(fabPack, { context: specCtx }, "Our price is USD 3.2 per meter, valid until Nov 30");
ok("规格齐了但事实未终裁 → 仍拦（AI 不得替无价格表的域定价）", g2.pass === false && g2.hits.some(h => h.id === "facts_pending"), g2.hits);
const readyPack = JSON.parse(safe(fabPack));
readyPack.facts.items[0].verified = true; /* 模拟 Phil 终裁了成分/价格口径 */
ok("事实一旦终裁 + 规格齐 + 单位币种有效期齐 → 放行", f.DealDomain.guardDraft(readyPack, { context: specCtx }, "Our price is USD 3.2 per meter, valid until Nov 30").pass === true);
ok("零价格的技术底稿不受禁价约束（docs_driven 可正常出规格类草稿）", f.DealDomain.guardDraft(fabPack, { context: specCtx }, "This 210T fabric is 65 GSM, width 150cm, with C6 DWR finishing").pass === true);
ok("缺有效期 → block", f.DealDomain.guardDraft(fabPack, { context: specCtx }, "USD 3.2 per meter").hits.some(h => h.id === "validity"));
ok("缺单位（只给数字价）→ block", f.DealDomain.guardDraft(fabPack, { context: specCtx }, "USD 3.2 only").hits.some(h => h.id === "unit"));
ok("绝对化承诺 → block", f.DealDomain.guardDraft(fabPack, { context: specCtx }, "hand feel 100% 一致, 永久防水").hits.some(h => h.id === "claim"));
ok("面料无阶梯表 → 阶梯守卫自动跳过（不用估算值拦人）", f.DealDomain.guardDraft(fabPack, { context: specCtx }, "USD 99 per meter, valid 7 days").hits.every(h => h.id !== "ladder"));

console.log("\n[7] 行李箱守卫：历史缺陷（1000 台报 215）回归");
const sc = c.DealDomain.current();
const bad = c.DealDomain.guardDraft(sc, { qty: "1000 台", context: [{ k: "型号", v: "X1" }] }, "USD 215 per unit");
ok("跨档报价被拦", bad.pass === false, bad.hits);
ok("提示应为 205/212", safe(bad.hits).indexOf("205") >= 0);
ok("正确价 205 放行", c.DealDomain.guardDraft(sc, { qty: "1000 台", context: [{ k: "型号", v: "X1" }] }, "USD 205 per unit, formal quote attached").pass === true);
ok("100 台档 222 放行", c.DealDomain.guardDraft(sc, { qty: "100 台", context: [] }, "USD 222 per unit").pass === true);

console.log("\n[8] 术语表 + 界面禁词");
const gl = f.DealDomain.applyGlossary(fabPack, "门幅 150，克重 160，缸差控制在色差允收内");
ok("门幅/克重/缸差 走术语表", /fabric width/.test(gl.text) && /GSM/.test(gl.text) && /batch-to-batch color variation/.test(gl.text), gl);
ok("缸差不被直译成 color difference", gl.text.indexOf("缸差") < 0 && gl.text.indexOf("color tolerance") >= 0);
ok("面料界面命中「整柜」报禁词", f.DealDomain.forbiddenTermHits(fabPack, "这个整柜价格").indexOf("整柜") >= 0);
ok("行李箱界面命中「门幅」报禁词", c.DealDomain.forbiddenTermHits(null, "门幅多少").indexOf("门幅") >= 0);
ok("域角标不可切换", c.DealDomain.badge().switchable === false && f.DealDomain.badge().text === "功能性面料");

console.log("\n[8.5] 出稿/发送两个出口共用的域提示（draftNotes）");
const notes = f.DealDomain.draftNotes(fabPack, { context: specCtx }, "Our price is USD 3.2 per meter", "pending-warn");
ok("含域守卫红条", /域守卫/.test(notes.html));
ok("含学徒期水印", /学徒期草拟/.test(notes.html), notes.html.slice(0,80));
ok("用的是待发确认卡的样式类", notes.html.indexOf('class="pending-warn"') >= 0, notes.html.slice(0, 60));
ok("blocked=true", notes.blocked === true);
ok("提示里的价格与文案已转义（不注入 HTML）", notes.html.indexOf("<script") < 0);
const xss = f.DealDomain.draftNotes(fabPack, { context: [{ k: "成分", v: '</div><img src=x onerror=alert(1)>' }] }, "USD 3.2 per meter");
/* 档案值本身不会进这段提示（只渲染缺失的标签名），但守卫消息统一过 esc()：
   断言"输出里没有可执行标签"，而不是断言某个转义串出现在哪里 */
ok("提示输出无可执行标签（档案含攻击性内容时）", /<img|onerror=/i.test(xss.html) === false, xss.html.slice(0, 140));
ok("档案值确实被拦在提示之外（缺的是克重/门幅等标签名）", /克重/.test(xss.html) && /onerror/.test(xss.html) === false);
const npx = f.DealDomain.guardDraft(fabPack, { context: [] }, "unit price 0.32/m, valid 15 days");
ok("没写币种的单价（0.32/m）也识别为价格", npx.hits.length > 0, npx.hits);
const sNotes = c.DealDomain.draftNotes(null, { context: [{ k: "型号", v: "X1" }, { k: "数量", v: "1000 台" }] }, "USD 215 per unit");
ok("行李箱域无水印（本域已有话稿基准）", /学徒期草拟/.test(sNotes.html) === false, sNotes.html);

console.log("\n[9] 资料污染防线：服务端产品线（x-dealdesk-scope / nodocs）");
const eScooter = c.DealDomain;
ok("行李箱域：客户 scope 原样送服务端（现网不变）", eScooter.serverScope({ scope: "pet" }) === "pet");
ok("行李箱域：scope 为空仍送空（不发该头，落 any 包 = 现网行为）", eScooter.serverScope({ scope: "" }) === "");
ok("行李箱域：资料注入允许", eScooter.docsAllowed() === true);
ok("面料域：无论客户 scope 填什么，一律送 fabric（不给落 any 包的机会）", f.DealDomain.serverScope({ scope: "" }) === "fabric" && f.DealDomain.serverScope({ scope: "functional" }) === "fabric");
ok("面料域：服务端未上线 fabric → docsAllowed=false（客户端改发 nodocs:1）", f.DealDomain.docsAllowed() === false);
const flipPack = JSON.parse(safe(f.DealDomain.get("functional-fabric")));
flipPack.serverLineReady = true; /* 模拟 FC 已加第四条产品线 */
ok("FC 上线后翻一个开关即放行，无需改代码", f.DealDomain.docsAllowed(flipPack) === true);

console.log("\n[10] 未绑域账号：拒绝建档，且不得谎报成功");
const n = boot(null); /* 老设备升级后的本地状态：登录态里没有 domainId */
const seen = [];
n.App = { toast: m => seen.push(m) };
const nb = n.Store.addBuyer({ name: "NoDomain", country: "美国", qty: "100 台" });
ok("addBuyer 返回 null（不给盖域标签就不建）", nb === null);
ok("客户列表没有凭空多出一条", n.Store.domainBuyers().length === 0, n.Store.domainBuyers().map(b => b.name));
ok("给了可见提示而不是静默失败", /业务域/.test(seen.join(" ")), seen);

console.log("\n[11] 内容资产层隔离（Phil 实测：进面料域仍看到电动行李箱内容）");
const ASSETS = [
  { key: "d1", title: "电动行李箱参数速查表", scope: "suitcase" },
  { key: "d2", title: "宠物用品报价说明", scope: "pet" },
  { key: "d3", title: "底线手册（历史通用）", scope: "all" },
  { key: "d4", title: "210T 塔丝绒规格表", scope: "fabric" },
  { key: "d5", title: "无 scope 的旧资料" }
];
const inScooter = c.DealDomain.filterShare(ASSETS).map(d => d.key);
const inFabric = f.DealDomain.filterShare(ASSETS).map(d => d.key);
ok("行李箱域：本域 + 历史通用全可见（现网不变）", inScooter.join(",") === "d1,d2,d3,d5", inScooter);
ok("面料域：只剩面料自己的资料", inFabric.join(",") === "d4", inFabric);
ok("面料域看不到行李箱/宠物资料", inFabric.indexOf("d1") < 0 && inFabric.indexOf("d2") < 0);
ok("面料域连历史「通用」也不收（那些全是行李箱时代写的）", inFabric.indexOf("d3") < 0 && inFabric.indexOf("d5") < 0);
ok("产品线名由域包给（面料域不显示电动行李箱）", f.DealDomain.scopeLabel("fabric") === "功能性面料" && c.DealDomain.scopeLabel("suitcase") === "电动行李箱");
ok("面料主产品线 = fabric（对齐服务端待加的第四条线）", f.DealDomain.primaryLine() === "fabric");
ok("scope→归属域 反推（服务端只有 scope，没有 domainId）",
  c.DealDomain.ownerDomainOfScope("pet") === "e-scooter" &&
  c.DealDomain.ownerDomainOfScope("fabric") === "functional-fabric" &&
  c.DealDomain.ownerDomainOfScope("all") === null);

console.log("\n[12] 切域绝不搬数据（Phil「要用全新的域，不是在原来基础上生成」）");
const g = boot("functional-fabric");
g.App = { toast: function () {} };
g.Store.applySnapshot({ buyers: [
  { id: "old_plain", name: "PlainOld", country: "德国" },
  { id: "old_suit", name: "LugOld", country: "美国", scope: "suitcase", qty: "500 台" },
  { id: "bad_tag", name: "MisTagged", country: "美国", scope: "suitcase", domainId: "functional-fabric", qty: "1000 台" }
], followups: [{ id: "f1", buyerId: "bad_tag", domainId: "functional-fabric", action: "跟进报价" }] });
ok("面料域看这老账号：一个客户都没有（无标签记录归遗留域，不是当前域）", g.Store.domainBuyers().length === 0, g.Store.domainBuyers().map(b => b.name + "/" + b.domainId));
g.DealDomain.setAccount({ id: "x", name: "Phil", role: "admin", domainId: "e-scooter" });
const back = g.Store.domainBuyers().map(b => b.name).sort().join(",");
ok("切回行李箱域：三条老客户一条不少（切域不搬数据）", back === "LugOld,MisTagged,PlainOld", back);
ok("被 bug 搬错的那条已自动归位", g.Store.domainBuyers().find(b => b.name === "MisTagged").domainId === "e-scooter");
ok("跟进跟随其客户归位", g.Store.domainFollowups().find(f => f.id === "f1").domainId === "e-scooter");
ok("真面料客户不会被误搬（scope 不是 suitcase/pet 就一律不动）", (function () {
  g.DealDomain.setAccount({ id: "x", name: "Phil", role: "admin", domainId: "functional-fabric" });
  g.Store.applySnapshot({ buyers: [{ id: "fab_real", name: "RealFabric", country: "意大利", scope: "fabric", domainId: "functional-fabric", product: "suitcase lining fabric 210T" }] });
  return g.Store.domainBuyers().some(b => b.id === "fab_real" && b.domainId === "functional-fabric");
})(), "给行李箱厂供布的客户描述了 suitcase 但必须留在面料域");

console.log("\n[13] 新客话术不跨域外借");
const SCRIPTS = [
  { key: "s1", type: "script", scope: "suitcase", name: "新客话术·六步（Titan X）", steps: ["a", "b"] },
  { key: "s2", type: "script", scope: "pet", name: "宠物六步", steps: ["c"] },
  { key: "s3", type: "script", scope: "fabric", name: "面料首询", steps: ["d"] }
];
/* 10-21 现网场景：宠物客户但宠物线还没有专属剧本 → 本域内回退显示行李箱剧本（带说明），这条行为不能改 */
const scSel = c.DealDomain.selectScripts([SCRIPTS[0]], "pet");
ok("行李箱域宠物客户无专属剧本时仍回退本域全部（现网保留）", scSel.scripts.length === 1 && scSel.fallback === true, scSel);
ok("有专属剧本时不回退", c.DealDomain.selectScripts(SCRIPTS, "pet").scripts.map(d => d.key).join(",") === "s2");
const faSel = f.DealDomain.selectScripts(SCRIPTS, "fabric");
ok("面料客户只看得到面料剧本", faSel.scripts.map(d => d.key).join(",") === "s3", faSel);
const faNone = f.DealDomain.selectScripts([SCRIPTS[0], SCRIPTS[1]], "fabric");
ok("面料域没有自己的剧本 → 返回空 + noneInDomain（绝不借Titan X六步）", faNone.scripts.length === 0 && faNone.noneInDomain === true, faNone);
ok("行李箱域看不到面料剧本", c.DealDomain.selectScripts(SCRIPTS, "suitcase").scripts.map(d => d.key).indexOf("s3") < 0);

console.log("\n[14] 面料入口切换：旧入口退役，重定向到独立体系 fabric/（v1.13.0，domainId 路线 11-09 终裁取消）");
const fabHtml = fs.readFileSync(__dirname + "/fabric.html", "utf8");
ok("旧入口 fabric.html 是纯重定向页（不加载任何脚本）", !/<script/.test(fabHtml));
ok("重定向目标为新面料工作台 fabric/index.html", /url=fabric\/index\.html/.test(fabHtml));
ok("旧入口文件已退役（fabric-boot.js / domain-seed.js 不再存在）", !fs.existsSync(__dirname + "/fabric-boot.js") && !fs.existsSync(__dirname + "/domain-seed.js"));
const wbHtml = fs.readFileSync(__dirname + "/workbench.html", "utf8");
ok("电动行李箱主入口（workbench.html，v1.16.0 起）仍加载全套行李箱模块", /mock\.js\?v=/.test(wbHtml) && /turns\.js\?v=/.test(wbHtml));
console.log("\n[15] 入口与账号错配必须被拦住");
const mm = boot("e-scooter");
mm.DEAL_DOMAIN_ENTRY = "functional-fabric";
const mmState = mm.DealDomain.entryState();
ok("行李箱账号 + 面料入口 = mismatch", mmState.state === "mismatch", mmState);
ok("错配时报的是账号所属域", mmState.accountDomain === "e-scooter", mmState);
const ub = boot(null);
ub.DEAL_DOMAIN_ENTRY = "functional-fabric";
ok("未绑域 + 独立入口 = unbound（由 app.js 按入口自动绑，不再让人选）", ub.DealDomain.entryState().state === "unbound");
const okm = boot("functional-fabric");
okm.DEAL_DOMAIN_ENTRY = "functional-fabric";
ok("账号域与入口一致 = match", okm.DealDomain.entryState().state === "match");
ok("index.html 无入口声明时保持原逻辑（state=none）", boot("e-scooter").DealDomain.entryState().state === "none");

console.log("\n[16] 归属修复只动勾选的记录");
const rp = boot("functional-fabric");
rp.App = { toast: function () {} };
rp.Store.applySnapshot({ buyers: [
  { id: "keep1", name: "FabricA", country: "意大利", scope: "fabric", domainId: "functional-fabric", product: "210T 塔丝绒 克重160" },
  { id: "stray1", name: "LugStray", country: "美国", domainId: "functional-fabric", qty: "500" },
  { id: "keep2", name: "NoTouch", country: "德国", domainId: "functional-fabric" }
], followups: [{ id: "ff1", buyerId: "stray1", domainId: "functional-fabric", action: "跟进" }] });
const stray = rp.Store.strayCandidates().map(b => b.id);
ok("有面料特征的客户不进候选", stray.indexOf("keep1") < 0, stray);
ok("通篇无本域特征的进候选", stray.indexOf("stray1") >= 0, stray);
const before = rp.Store.domainBuyers().length;
rp.Store.retagBuyers(["stray1"], "e-scooter");
ok("未勾选的一律不动", rp.Store.domainBuyers().some(b => b.id === "keep2"));
ok("勾选的已离开本域", rp.Store.domainBuyers().length === before - 1 && !rp.Store.domainBuyers().some(b => b.id === "stray1"));
ok("其跟进随客户一起走", !rp.Store.domainFollowups().some(f => f.buyerId === "stray1"));
ok("retag 返回受影响条数（客户+跟进）", typeof rp.Store.retagBuyers([], "e-scooter") === "number");

console.log("\n[17] 入口即边界：行李箱入口声明自己的域，并指向新的面料独立工作台");
const idxBoot = fs.readFileSync(__dirname + "/domain-boot.js", "utf8");
const idxScripts = [...fs.readFileSync(__dirname + "/workbench.html", "utf8").matchAll(/<script src="([^"?]+)/g)].map(x => x[1]);
ok("workbench.html 第一个脚本是入口声明", idxScripts[0] === "domain-boot.js", idxScripts[0]);
ok("index.html 声明的是电动行李箱域", /DEAL_DOMAIN_ENTRY\s*=\s*"e-scooter"/.test(idxBoot));
ok("行李箱侧「走错入口」卡指向新面料工作台 fabric/index.html", /fabric\/index\.html/.test(idxBoot));
const swap = boot("functional-fabric");
swap.DEAL_DOMAIN_ENTRY = "e-scooter";
ok("面料账号直接打开 index.html 会被判为错配", swap.DealDomain.entryState().state === "mismatch", swap.DealDomain.entryState());
const legacy = boot(null);
legacy.DEAL_DOMAIN_ENTRY = "e-scooter";
ok("老账号未绑域进 index.html → 按入口自动归遗留域（不再多问一次）", legacy.DealDomain.entryState().state === "unbound");
console.log("\n[18] 共享内核切换（v1.15.0）：面料入口 = 主工作台内核 + 独立大脑 + 独立数据命名空间");
/* -- 入口结构：脚本清单纯净（行李箱内容模块物理不加载） -- */
const fabIdx = fs.readFileSync(__dirname + "/fabric/index.html", "utf8");
const fabScripts = [...fabIdx.matchAll(/<script src="([^"?]+)/g)].map(x => x[1]);
ok("面料入口第一个脚本是入口声明", fabScripts[0] === "fabric-boot.js", fabScripts[0]);
ok("域种子顶替 mock.js", fabScripts.indexOf("fabric-seed.js") >= 0);
const noLoad = ["mock.js", "turns.js", "skills.js", "kb.js", "domain-boot.js"];
ok("行李箱内容模块与行李箱入口声明在面料入口物理不加载", noLoad.every(x => fabScripts.indexOf(x) < 0 && fabScripts.indexOf("../" + x) < 0), noLoad);
const kernelFiles = ["version.js", "domain.js", "country-profiles.js", "store.js", "docextract.js", "utils.js", "prompts.js", "llm.js", "sync.js", "voice.js", "components.js", "home.js", "buyers.js", "buyer-detail.js", "deals.js", "followup.js", "settings.js", "log-sheet.js", "buyer-sheet.js", "app.js"];
ok("内核 20 个文件全部在面料入口（共享内核）", kernelFiles.every(x => fabScripts.indexOf("../" + x) >= 0), kernelFiles.filter(x => fabScripts.indexOf("../" + x) < 0));
ok("面料入口脚本引用只来自 ../根目录 或 本目录两个声明文件", fabScripts.every(p => p.indexOf("../") === 0 || p === "fabric-boot.js" || p === "fabric-seed.js"), fabScripts);
const fabCss = [...fabIdx.matchAll(/<link[^>]+href="([^"?]+)/g)].map(x => x[1]);
ok("CSS/manifest/图标全部 ../ 指向根目录", fabCss.length >= 8 && fabCss.every(p => p.indexOf("../") === 0), fabCss);
const fabBootSrc = fs.readFileSync(__dirname + "/fabric/fabric-boot.js", "utf8");
ok("入口声明 = 功能性面料域", /DEAL_DOMAIN_ENTRY\s*=\s*"functional-fabric"/.test(fabBootSrc));
ok("走错入口卡从子目录回主工作台", /DEAL_DOMAIN_OTHER_ENTRY\s*=\s*"\.\.\/index\.html"/.test(fabBootSrc));
ok("数据命名空间 = dd.fabric.v1", /DEALDESK_KEY\s*=\s*"dd\.fabric\.v1"/.test(fabBootSrc));

/* -- store.js 命名空间参数化（对冻结代码的唯一改动） -- */
const storeSrc = fs.readFileSync(__dirname + "/store.js", "utf8");
ok("store.js 命名空间参数化：默认值 = 原 key（主工作台零变化）", /window\.DEALDESK_KEY\s*\|\|\s*"dealdesk\.data\.v1"/.test(storeSrc));
ok("主工作台（无 DEALDESK_KEY）写原 key、从不碰面料命名空间",
  c.localStorage._mem["dealdesk.data.v1"] !== undefined && c.localStorage._mem["dd.fabric.v1"] === undefined,
  Object.keys(c.localStorage._mem));

/* -- 面料入口行为：命名空间 + v1.13/v1.14 遗留数据一次性迁移 -- */
const fabCtx = makeCtx();
fabCtx.localStorage.setItem("dd.fabric.v1", JSON.stringify({
  v: 1, savedAt: "", deletedIds: [],
  buyers: [{ id: "fb1", name: "LegacyFab", company: "OutdoorCo", country: "德国", wa: "49123456", stage: 2, stageLog: [], messages: [], spec: [], createdAt: "", updatedAt: "" }],
  followups: [{ id: "ff1", buyerId: "fb1", action: "追洗水测试结果", dueDate: "2026-11-15", done: false }]
}));
fabCtx.DEAL_DOMAIN_ENTRY = "functional-fabric";
load(fabCtx, "fabric/fabric-boot.js");
load(fabCtx, "version.js");
load(fabCtx, "domain.js");
load(fabCtx, "fabric/fabric-seed.js");
load(fabCtx, "country-profiles.js");
load(fabCtx, "store.js");
load(fabCtx, "utils.js");
const fabDb = fabCtx.Store.domainBuyers();
ok("手写工作台时期的存量客户在共享内核可见（切换不丢）", fabDb.length === 1 && fabDb[0].name === "LegacyFab", fabDb.map(b => b.name));
ok("存量客户按命名空间归属打面料域标签（不是遗留行李箱域）", fabDb[0].domainId === "functional-fabric", fabDb[0].domainId);
ok("存量跟进可见且归本域", fabCtx.Store.domainFollowups().length === 1 && fabCtx.Store.domainFollowups()[0].domainId === "functional-fabric");
const migrated = JSON.parse(fabCtx.localStorage.getItem("dd.fabric.v1"));
ok("一次性迁移补上 seedV/persona（内核 accept 这个 blob）", migrated.seedV === "v4-w4-fresh2" && !!migrated.persona && Array.isArray(migrated.deletedIds));
const before2 = fabCtx.localStorage.getItem("dd.fabric.v1");
load(fabCtx, "fabric/fabric-seed.js");
ok("迁移幂等（重跑种子不再动数据）", fabCtx.localStorage.getItem("dd.fabric.v1") === before2);
fabCtx.Store.addBuyer({ name: "NewFab", country: "意大利", qty: "1000 米", scope: "fabric" });
const fMem = fabCtx.localStorage._mem;
ok("面料工作台写入只落 dd.fabric.v1", fMem["dd.fabric.v1"] !== undefined && fMem["dealdesk.data.v1"] === undefined, Object.keys(fMem));
ok("新建客户带面料域标签、阶段管道是 7 段", fabCtx.Store.domainBuyers().length === 2 && fabCtx.Mock.STAGES.length === 7, fabCtx.Mock.STAGES);

/* -- 版本一致性：两个入口 HTML 与 version.js 同步 -- */
const verM = fs.readFileSync(__dirname + "/version.js", "utf8").match(/v:\s*"(\d+\.\d+\.\d+)"/);
const curV = verM ? verM[1] : "";
ok("三个入口 HTML 全量当前版本（无旧版残留引用）", curV !== "" && ["index.html", "workbench.html", "fabric/index.html"].every(h => {
  const s = fs.readFileSync(__dirname + "/" + h, "utf8");
  return s.indexOf("?v=" + curV) >= 0 && s.indexOf("1.14.0") < 0 && s.indexOf("1.15.0") < 0 && s.indexOf("1.16.0") < 0 && s.indexOf("1.17.0") < 0 && s.indexOf("1.18.0") < 0;
}), curV);

console.log("\n[19] 业务线选择入口（v1.16.0）：先选线，再进工作台");
const landSrc = fs.readFileSync(__dirname + "/index.html", "utf8");
ok("根入口现在是选择页（零内核脚本加载）", landSrc.indexOf("landing.js") >= 0 && !/<script src="[^"]*(app\.js|store\.js|domain\.js|mock\.js)[^"]*"/.test(landSrc));
ok("选择页给两条业务线选择卡（data-line）", landSrc.indexOf('data-line="e-scooter"') >= 0 && landSrc.indexOf('data-line="functional-fabric"') >= 0);
const ljs = fs.readFileSync(__dirname + "/landing.js", "utf8");
ok("选完路由到对应工作台（ROUTES）", ljs.indexOf("workbench.html") >= 0 && ljs.indexOf("fabric/index.html") >= 0);
/* 登录与选线同屏（Phil「登入的时候，需要有个电动行李箱和面料选择」） */
ok("登录表单在选择页上（登录/注册页签＋账号/密码/团队口令/按钮）", ["lName", "lPass", "lTok", "lGo", "tLogin", "tNew"].every(id => landSrc.indexOf('id="' + id + '"') >= 0));
ok("注册是一级页签入口（不是小勾选）", landSrc.indexOf("注册新账号（首次用这条线）") >= 0 && landSrc.indexOf('id="lNew"') < 0);
ok("登录契约与内核一致（POST /login＋register 模式＋token）", ljs.indexOf('"/login"') >= 0 && ljs.indexOf('"register"') >= 0 && ljs.indexOf("body.token = tok") >= 0);
const wbSrc = fs.readFileSync(__dirname + "/workbench.html", "utf8");
ok("电动行李箱工作台 = 原主入口内容（仍声明行李箱入口＋加载全套行李箱模块）", wbSrc.indexOf("domain-boot.js") >= 0 && wbSrc.indexOf("mock.js") >= 0 && wbSrc.indexOf("kb.js") >= 0 && wbSrc.indexOf("turns.js") >= 0);
ok("切换业务线链接两个工作台都有", wbSrc.indexOf('href="index.html"') >= 0 && fs.readFileSync(__dirname + "/fabric/index.html", "utf8").indexOf('href="../index.html"') >= 0);
/* 跳转行为：绑定域决定工作台（与内核 entryState 同口径）；未登录/老账号→停留选择页 */
const l1 = makeCtx();
load(l1, "landing.js");
ok("未登录 → 停留选择页", l1.LandingRedirect() === null);
l1.localStorage.setItem("dealdesk.auth.v1", JSON.stringify({ name: "cherry", domainId: "e-scooter" }));
ok("行李箱绑定账号 → 电动行李箱工作台", l1.LandingRedirect() === "workbench.html");
l1.localStorage.setItem("dealdesk.auth.v1", JSON.stringify({ name: "fb-luo", domainId: "functional-fabric" }));
ok("面料绑定账号 → 面料工作台", l1.LandingRedirect() === "fabric/index.html");
l1.localStorage.setItem("dealdesk.auth.v1", JSON.stringify({ name: "old", domainId: "" }));
ok("未绑域老账号 → 停留选择页（绑定由内核登录后完成）", l1.LandingRedirect() === null);
l1.localStorage.setItem("dealdesk.auth.v1", "{broken json");
ok("登录态损坏 → 停留选择页不抛错", l1.LandingRedirect() === null);
/* 域优先级（与内核登录同口径）：服务端 > 同账号已有绑定 > 本次所选线 */
const l2 = makeCtx();
load(l2, "landing.js");
l2.localStorage.setItem("dealdesk.auth.v1", JSON.stringify({ key: "cherry", name: "cherry", role: "admin", session: "s1", domainId: "e-scooter" }));
ok("服务端（管理员）指定域优先于所选线", l2.LandingResolveDomain({ key: "cherry", domain: "functional-fabric" }, "e-scooter") === "functional-fabric");
ok("同账号已有绑定不被所选线静默改绑", l2.LandingResolveDomain({ key: "cherry" }, "functional-fabric") === "e-scooter");
ok("新账号 → 按所选线写域", l2.LandingResolveDomain({ key: "newbie" }, "functional-fabric") === "functional-fabric");
l2.localStorage.setItem("dealdesk.auth.v1", JSON.stringify({ key: "other", name: "other", role: "rep", session: "s2", domainId: "functional-fabric" }));
ok("换账号登录 → 不受他人绑定影响，所选线生效", l2.LandingResolveDomain({ key: "fresh" }, "e-scooter") === "e-scooter");
/* 云地址：共享设置优先（与主工作台同源），缺省内置默认 */
ok("无共享设置 → 内置默认云地址", l2.LandingFcUrl() === "https://dealdes-clnhfkexse.cn-hangzhou.fcapp.run");
l2.localStorage.setItem("dealdesk.settings.v1", JSON.stringify({ cloud: { proxyUrl: "https://example.cn.fcapp.run/" } }));
ok("共享设置有云地址 → 使用它", l2.LandingFcUrl() === "https://example.cn.fcapp.run/");

console.log("\n[20] 退出账号后回选线（v1.18.0）：一个人做两个项目，退出必回到选线");
const owCtx = makeCtx();
load(owCtx, "logout-watch.js");
ok("行李箱工作台 → 选线页是根 index.html", owCtx.LogoutWatch.landingFor("/dealdesk/workbench.html") === "index.html");
ok("面料工作台（子目录）→ 选线页回上一层", owCtx.LogoutWatch.landingFor("/dealdesk/fabric/index.html") === "../index.html");
ok("根路径/其它路径 → index.html", owCtx.LogoutWatch.landingFor("/dealdesk/index.html") === "index.html" && owCtx.LogoutWatch.landingFor("/") === "index.html");
const st1 = {};
ok("匿名直达工作台不被赶走（从未有登录态）", owCtx.LogoutWatch.shouldLeave(st1, null) === false);
ok("登录后仍在（记 hadAuth）", owCtx.LogoutWatch.shouldLeave(st1, { session: "s1" }) === false && st1.hadAuth === true);
ok("登录态消失 → 回选线", owCtx.LogoutWatch.shouldLeave(st1, null) === true);
const st2 = { hadAuth: true };
ok("页面加载时已登录、随后退出 → 回选线", owCtx.LogoutWatch.shouldLeave(st2, null) === true);
/* reload 桥接（v1.19.0）：内核设置页退出＝Auth.clear()+location.reload()，新页面用持久标记判断 */
ok("刚退出（标记新鲜）→ 回选线", owCtx.LogoutWatch.shouldLeaveAfterReload({ at: Date.now() }) === true);
ok("标记过期（>5 分钟）→ 匿名不赶走", owCtx.LogoutWatch.shouldLeaveAfterReload({ at: Date.now() - 6 * 60 * 1000 }) === false);
ok("无标记 → 匿名直达不赶走", owCtx.LogoutWatch.shouldLeaveAfterReload(null) === false);
const wb3 = fs.readFileSync(__dirname + "/workbench.html", "utf8");
const fi3 = fs.readFileSync(__dirname + "/fabric/index.html", "utf8");
ok("两个工作台入口都加载 logout-watch.js（app.js 之后）", wb3.indexOf("logout-watch.js") >= 0 && wb3.indexOf("logout-watch.js") > wb3.indexOf("app.js") && fi3.indexOf("../logout-watch.js") >= 0 && fi3.indexOf("../logout-watch.js") > fi3.indexOf("../app.js"));
const land3 = fs.readFileSync(__dirname + "/index.html", "utf8");
ok("选线页写明「两条线用独立账号、退出回本页选线」机制", land3.indexOf("独立账号") >= 0 && land3.indexOf("回到本页选线") >= 0);

console.log("\n———— " + pass + " passed, " + fail + " failed ————\n");
process.exit(fail ? 1 : 0);
