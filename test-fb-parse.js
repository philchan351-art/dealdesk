/* FB 表单识别冒烟测试（2026-10-17）：用真实样例 George Singh 验证规则路径与 LLM 路径 */
var assert = require("assert");
global.window = {};
var cp = require("fs").readFileSync(__dirname + "/country-profiles.js", "utf8");
eval(cp);
global.CountryProfiles = window.CountryProfiles;
require("./buyer-sheet.js");
var BS = window.BuyerSheet;

var GEORGE = [
  "Hello! I filled out your form and would like to know more about your business.",
  "Country: AU",
  "Full name: George  Singh",
  "Is this inquiry for your business or for personal use?: My business (wholesale purchase)",
  "What is your estimated first order quantity?: Less 50 units",
  "Company name: jam builders",
  "When do you plan to place your first order?: In 3+ months",
  "Phone number: 0439 467 498",
  "Email: calia25@hotmail.com",
  "Which best describes your business?: Brand / Manufacturer",
  "WhatsApp number: +61439467498"
].join("\n");

BS.parseForm(GEORGE).then(function (r) {
  assert.equal(r.f.name, "George Singh", "name 应为 George Singh，实为 " + r.f.name);
  assert.equal(r.f.country, "澳大利亚", "AU 应映射为 澳大利亚，实为 " + r.f.country);
  assert.equal(r.f.company, "jam builders", "company");
  assert.equal(r.f.wa, "+61439467498", "wa 优先取 WhatsApp 号，实为 " + r.f.wa);
  assert.equal(r.f.phone, "0439 467 498", "phone");
  assert.equal(r.f.email, "calia25@hotmail.com", "email");
  assert.equal(r.f.qty, "Less 50 units", "qty");
  var ctxK = r.ctx.map(function (c) { return c.k + "=" + c.v; });
  assert.ok(ctxK.some(function (s) { return s.indexOf("首单计划=In 3+ months") >= 0; }), "首单计划缺失: " + ctxK.join("; "));
  assert.ok(ctxK.some(function (s) { return s.indexOf("业务类型=Brand / Manufacturer") >= 0; }), "业务类型缺失: " + ctxK.join("; "));
  assert.ok(ctxK.some(function (s) { return s.indexOf("采购类型=My business") >= 0; }), "采购类型缺失: " + ctxK.join("; "));
  assert.ok(ctxK.some(function (s) { return s.indexOf("邮箱=calia25@hotmail.com") >= 0; }), "邮箱要点缺失: " + ctxK.join("; "));
  console.log("T1 规则路径(George 真实表单) PASS");

  /* T2：CSV 两行（FB 导出常见格式） */
  var csv = "Full Name,Phone Number,WhatsApp number,Country,Product of Interest\nJohn Smith,+1 555 1234,+1 555 1234,US,School backpacks";
  return BS.parseForm(csv).then(function (r2) {
    assert.equal(r2.f.name, "John Smith", "csv name");
    assert.equal(r2.f.wa, "+1 555 1234", "csv wa");
    assert.equal(r2.f.country, "美国", "csv US→美国，实为 " + r2.f.country);
    assert.equal(r2.f.product, "School backpacks", "csv product");
    console.log("T2 规则路径(CSV) PASS");
  });
}).then(function () {
  /* T3：LLM 路径（stub 模型返回 JSON，验证映射/国家归一/多语言） */
  var llmStub = {
    chat: function (sys, usr) {
      return Promise.resolve('```json\n{"name":"María López","country":"Mexico","company":"","wa":"+52 55 1234 5678","phone":"","product":"Pet grooming tools","qty":"200","email":"maria@example.com","budget":"","extra":[{"k":"首单计划","v":"这个月内"}]}\n```');
    },
    configured: function () { return true; }
  };
  window.LLM = llmStub;
  global.LLM = llmStub;
  return BS.parseForm("任意西班牙语表单…").then(function (r3) {
    assert.equal(r3.f.name, "María López", "llm name");
    assert.equal(r3.f.country, "墨西哥", "Mexico→墨西哥，实为 " + r3.f.country);
    assert.equal(r3.f.wa, "+52 55 1234 5678", "llm wa");
    assert.ok(r3.ctx.some(function (c) { return c.k === "首单计划" && c.v === "这个月内"; }), "llm extra 透传");
    assert.ok(r3.ctx.some(function (c) { return c.k === "邮箱"; }), "llm 邮箱要点");
    assert.ok(/AI 识别/.test(r3.via), "via 标记");
    console.log("T3 LLM 路径(多语言+代码块剥离) PASS");

    /* T4：LLM 失败 → 自动降级规则路径 */
    llmStub.chat = function () { return Promise.reject(new Error("cloud down")); };
    return BS.parseForm(GEORGE).then(function (r4) {
      assert.equal(r4.f.name, "George Singh", "降级后 name 仍在");
      assert.ok(/规则识别/.test(r4.via), "via 应标注降级: " + r4.via);
      console.log("T4 LLM 失败降级规则 PASS");
    });
  });
}).then(function () {
  console.log("ALL PASS");
}).catch(function (e) {
  console.error("FAIL:", e.message);
  process.exit(1);
});
