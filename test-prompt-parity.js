/* ===== 提示词平价回归（node test-prompt-parity.js）=====
 * 锁一条线：多业务域改造对「行李箱域」的提示词必须是零变化——同输入下 HEAD 版与当前版
 * suggest()/read() 逐字节相等。黄金集、五数发布线全部压在这段提示词上，动 prompts.js 必跑本文件。
 * 同时反向断言面料域确实拿到学徒期定位块、且拿不到行李箱回合库（防止闸门被悄悄改回注入）。 */
const fs = require("fs");
const vm = require("vm");
const cp = require("child_process");
const noop = () => {};
const el = () => ({ style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, appendChild: noop, removeChild: noop, addEventListener: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], setAttribute: noop, getAttribute: () => null, textContent: "", innerHTML: "", children: [] });

function runWith(promptsSrc, bindDomain) {
  const mem = {};
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout,
    location: { hash: "#/home", search: "" },
    navigator: { clipboard: null },
    document: { createElement: el, body: el(), querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: noop, title: "" },
    localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, key: () => null, length: 0 }
  };
  ctx.window = ctx;
  if (bindDomain) mem["dealdesk.auth.v1"] = JSON.stringify({ key: "k", name: "Phil", role: "admin", domainId: bindDomain });
  ["mock.js", "domain.js", "country-profiles.js", "turns.js", "skills.js", "kb.js"].forEach(f => {
    try { vm.runInContext(fs.readFileSync(f, "utf8"), vm.createContext(ctx), { filename: f }); } catch (e) { /* 缺依赖时该块自动降级为空 */ }
  });
  vm.runInContext(promptsSrc, vm.createContext(ctx), { filename: "prompts.js" });
  const P = ctx.window.Prompts;
  const buyer = {
    id: "b1", domainId: bindDomain, name: "Amritpal", company: "ImportHub", country: "印度", cc: "IN",
    stage: 2, quoteStage: 2, intent: 72, scope: "suitcase", unread: 0, messages: [
      { from: "buyer", text: "can you lower the price? my target is 200 USD", time: "10-21" },
      { from: "me", text: "our best for 1000 units is USD 205", time: "10-21" }
    ],
    context: [{ k: "数量", v: "1000 台" }, { k: "目标价", v: "200 USD" }],
    stageLog: [{ to: 2, src: "manual" }], aiEvents: []
  };
  return { suggest: P.suggest(buyer), read: typeof P.read === "function" ? P.read(buyer) : P.read };
}

const head = cp.execSync("git show HEAD:prompts.js", { encoding: "utf8", maxBuffer: 64e6 });
const cur = fs.readFileSync("prompts.js", "utf8");

let bad = 0;
["e-scooter", null].forEach(dom => {
  const a = runWith(head, dom), b = runWith(cur, dom);
  const tag = dom || "未绑域";
  ["suggest", "read"].forEach(k => {
    const same = a[k] === b[k];
    if (!same) bad++;
    console.log(`[${tag}] ${k}: ${same ? "逐字节一致 ✓" : "有差异 ✗  HEAD=" + String(a[k]).length + " NEW=" + String(b[k]).length}`);
  });
});

/* 面料域必须确实拿到学徒期定位块、且不再含行李箱回合库 */
const fabNew = runWith(cur, "functional-fabric"), fabOld = runWith(head, "functional-fabric");
console.log("[面料] 新版含学徒期定位块: " + /学徒期/.test(fabNew.suggest));
console.log("[面料] 旧版含学徒期定位块: " + /学徒期/.test(fabOld.suggest) + "（应为 false，证明这是本次新增）");
console.log("[面料] 新版不再注入回合库块: " + !/回合库·底稿参考/.test(fabNew.suggest));
console.log("[面料] 旧版确实在注入回合库: " + /回合库·底稿参考/.test(fabOld.suggest) + "（证明泄漏是真的）");
console.log("[行李箱] 新版仍注入回合库: " + /回合库/.test(runWith(cur, "e-scooter").suggest));
process.exit(bad === 0 ? 0 : 1);
