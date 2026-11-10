/* ===== 面料业务线：出稿装配（大脑的内容层）=====
 * 独立性要求：本文件的输入 100% 来自面料自己的文件（f-model）与客户档案，
 * 不加载、不引用另一条业务线的任何提示词、句式库、回合库或资料段。
 * 因此这里不需要任何"禁止引用对方卖点"的否定块——对方的词根本不出现在本页。
 */
(function (global) {
  "use strict";
  var M = global.FabricModel;

  function specBlock(b) {
    var miss = M.specMissing(b);
    var have = (b.spec || []).filter(function (r) { return r && r.v; });
    var lines = have.length
      ? have.map(function (r) { return "  - " + r.k + "：" + r.v; }).join("\n")
      : "  （档案里还没有任何规格）";
    return "【客户已确认的规格】\n" + lines +
      "\n【仍缺的规格要素】" + (miss.length ? miss.join("、") : "无（5 项齐）") + "\n";
  }

  function glossaryBlock() {
    return "【术语译法（必须照此写，错译会砸专业形象）】\n" +
      M.GLOSSARY.slice(0, 12).map(function (g) {
        return "  - " + g.zh + " = " + g.en + (g.note ? "（" + g.note + "）" : "");
      }).join("\n") + "\n";
  }

  function factsBlock() {
    var ready = M.FACTS.moq.some(function (f) { return f.verified; });
    if (!ready) {
      return "【本线业务事实状态】MOQ、价格、报价有效期均未终裁。\n" +
        "→ 本次出稿禁止出现任何价格、起订量数字、交期或认证承诺；\n" +
        "→ 该做的动作是把规格问清、把风险讲在前面、给出可核对的下一步（如寄样卡）。\n";
    }
    return "【本线业务事实（只有这些数字可以用）】\n" +
      M.FACTS.moq.map(function (f) {
        return "  - " + f.label + "：" + (f.verified && f.value != null ? f.value + " " + f.unit : "未终裁，不得引用");
      }).join("\n") + "\n";
  }

  function lastTexts(b, n) {
    return (b.messages || []).slice(-(n || 6)).map(function (m) {
      return (m.from === "me" ? "我方：" : "客户：") + m.text;
    }).join("\n") || "（还没有沟通记录）";
  }

  /* system：身份 + 学徒期定位 + 事实边界 + 术语；user：客户档案 + 对话 + 本次意图 */
  function build(b, intent) {
    var system =
      "你是外贸功能性面料业务的资深业务员，替中国面料厂/供应商在 WhatsApp 上写一条要发给海外采购商的消息。\n" +
      M.POSITIONING +
      factsBlock() +
      glossaryBlock() +
      "【输出要求】\n" +
      "  1) 只输出要发给客户的那一条消息正文，不要解释、不要前后缀、不要标题。\n" +
      "  2) 用英文写（客户是海外采购商），句长以 WhatsApp 手机屏可读为准，控制在 120 词内。\n" +
      "  3) 客户看得懂优先于术语堆砌：指标写具体值，不写「高性能」这类空词。\n" +
      "  4) 结尾给一个明确的下一步（问一项缺失规格 / 提议寄样卡 / 约确认时间）。\n" +
      "  5) 同时输出一行中文对照，格式严格为：\nEN: <英文正文>\nZH: <中文意思>\n";
    var user =
      "【客户】" + [b.name, b.company, b.country, b.use && ("用途：" + b.use), b.market && ("目标市场：" + b.market)].filter(Boolean).join(" / ") + "\n" +
      "【当前阶段】" + M.stageNames()[b.stage] + "（" + (M.STAGES[b.stage] || {}).hard + "）\n" +
      specBlock(b) +
      "【最近对话】\n" + lastTexts(b) + "\n" +
      "【本次要办的事】" + (intent || "推进当前阶段：把还缺的规格问清，并给出下一步。") + "\n";
    return { system: system, user: user };
  }

  /* 解析：容忍被代码围栏包裹、缺 ZH 行、顺序颠倒（现网翻译就是这么被截断坑过的） */
  function parse(text) {
    var s = String(text || "").replace(/^```(?:\w+)?\s*/i, "").replace(/```\s*$/, "").trim();
    var mEn = s.match(/EN:\s*([\s\S]*?)(?=\n\s*ZH:|$)/i);
    var mZh = s.match(/ZH:\s*([\s\S]*)$/i);
    var en = mEn && mEn[1].trim();
    var zh = mZh && mZh[1].trim();
    if (!en && !zh) return { en: s, zh: "" };
    return { en: en || s, zh: zh || "" };
  }

  global.FabricPrompts = { build: build, parse: parse, factsBlock: factsBlock };
})(window);
