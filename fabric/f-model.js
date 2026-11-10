/* ===== 面料业务模型：阶段管道 / 规格要素 / 业务事实 / 术语 / 出稿守卫 =====
 * 本文件是「功能性面料」业务线自己的模型，与另一条业务线工作台无任何依赖或共享数据。
 * 业务事实一律 verified:false + value:null —— 没有 Phil 终裁就留空位，
 * 绝不用行业常见值填，否则模型会照着假数字报给客户（这是过去踩过的坑）。
 */
(function (global) {
  "use strict";

  /* 7 段阶段管道：寄样与测试是主干，不是分支。
     成交档必须是末档（全应用以"成交=末档、只进不退"为前提），返单/年框作成交后标记。 */
  var STAGES = [
    { key: "spec", name: "规格确认", hard: "客户给出成分/克重/门幅/用途任一项硬规格" },
    { key: "recommend", name: "选型推荐", hard: "我方已发出具体规格或替代方案（含 A/B 差异说明）" },
    { key: "sample", name: "寄样", hard: "样卡/剪样/匹样已寄出（有单号或客户确认收到）" },
    { key: "testing", name: "客户测试", hard: "客户开始或反馈测试、成衣试制、水洗结果" },
    { key: "trial", name: "试单", hard: "小缸/散剪试单已确认（数量与色号落定）" },
    { key: "bulk", name: "大货报价", hard: "给出含规格的大货价（单价+门幅+有效期）" },
    { key: "first", name: "首单成交", hard: "订单或定金确认", isDeal: true }
  ];
  var DEAL_STAGE = STAGES.length - 1;

  /* 首询必须先问清这 5 项——面料没有规格就报不出价，谁先报价谁被动。
     新面料业务员不懂面料时，至少知道该问什么。 */
  var SPEC_REQUIRED = [
    { key: "composition", label: "成分", hint: "如 100% 涤纶 / 锦纶+氨纶，影响强度与手感和价格档" },
    { key: "gsm", label: "克重", hint: "每平米克重（GSM），决定厚度与成本" },
    { key: "width", label: "门幅", hint: "有效幅宽，直接决定客户实际用多少米" },
    { key: "finishing", label: "后整理", hint: "防水/透湿/阻燃/涂层等，功能指标主要靠它" },
    { key: "colorSpec", label: "色号", hint: "Pantone TCX 或客户实物样，涉及缸差与起订量" }
  ];

  /* 业务事实：全部空位，等 Phil 终裁。value 为 null 时守卫禁止任何报价进入草稿。 */
  var FACTS = {
    moq: [
      { key: "stock", label: "现货剪样起订", value: null, unit: "米", verified: false },
      { key: "dyedYarn", label: "定织（色纱）起订", value: null, unit: "米/色", verified: false },
      { key: "dyedPiece", label: "定染（匹染）起订", value: null, unit: "米/色", verified: false },
      { key: "coating", label: "涂层/复合加工起订", value: null, unit: "米", verified: false }
    ],
    quote: {
      unit: "米",
      units: ["米", "码", "KG"],
      unitTokens: ["米", "码", "KG", "m", "meter", "meters", "metre", "metres", "yd", "yds", "yard", "yards"],
      currency: "USD",
      validityDays: null, /* 待终裁：面料价格随纱价与汇率浮动，有效期必须明写 */
      ladder: []          /* 待终裁：没有真阶梯表就不启用阶梯校验，也不用估算值拦人 */
    },
    /* 让步授权维度：面料不是"降几个点"，而是这几件事。额度待 Phil 定，定前守卫不拦。 */
    concessions: [
      { key: "finishingDowngrade", label: "后整理降配（换更便宜方案）", allowed: null },
      { key: "moqRelax", label: "起订量放宽", allowed: null },
      { key: "freeSampleQuota", label: "免费样额度", allowed: null },
      { key: "leadTime", label: "交期压缩", allowed: null }
    ]
  };

  /* 术语：写错的英文比不会写更伤专业形象（缸差直译成 color difference 就是典型） */
  var GLOSSARY = [
    { zh: "门幅", en: "fabric width", note: "不是 size" },
    { zh: "克重", en: "GSM (g/m2)" },
    { zh: "缸差", en: "batch-to-batch color variation", note: "逐匹差说 roll-to-roll；不是 color difference" },
    { zh: "缩水率", en: "shrinkage" },
    { zh: "色牢度", en: "color fastness" },
    { zh: "剪样", en: "cut sample" },
    { zh: "样卡", en: "swing sample / hanger" },
    { zh: "匹样", en: "bulk sample" },
    { zh: "手感", en: "hand feel" },
    { zh: "后整理", en: "finishing" },
    { zh: "涂层", en: "coating" },
    { zh: "贴膜", en: "membrane / laminating" },
    { zh: "透湿", en: "moisture permeability (MVTR)" },
    { zh: "静水压", en: "hydrostatic head" },
    { zh: "涤纶", en: "polyester" },
    { zh: "锦纶", en: "nylon" },
    { zh: "氨纶", en: "spandex" },
    { zh: "塔丝绒", en: "tactel / textured woven" },
    { zh: "丹尼", en: "denier" }
  ];

  /* 学徒期定位块：面料线没有话稿基准，AI 不许拿"经验"当理由。
     刻意不提其它业务线的任何卖点——写出来就是再喂一遍。 */
  var POSITIONING =
    "\n【本业务线定位】你代表中国的功能性面料厂/供应商，正在 WhatsApp 上跟采购商谈单。本线当前处于学徒期：\n" +
    "1) 本线没有已确立的话稿基准：不得用「行规」「老做法」「过往成例」这类说法替自己撑腰，也不得暗示本厂存在历史惯例。\n" +
    "2) 只能使用客户档案、本域资料与本条对话里真实出现过的值；没有的就明确说需确认后回复，不许用行业惯例填补。\n" +
    "3) 学徒期该做的是把 5 项规格问清、把风险讲在前面（缸差、缩水率、色牢度、洗后功能衰减）、给出可核对的下一步，" +
    "不是模仿资深业务口的口吻推销。宁可短、准、留一句待确认。\n" +
    "4) 让步与例外不写任何具体人名，统一「需我方确认后回复」。\n" +
    "5) 本线业务事实尚未终裁（见 facts 全部为空）：不得给出任何价格、交期或认证承诺。\n";

  var FORBIDDEN_CLAIMS = [
    { re: /(100%|绝对|永久|永不|绝无)\s*(防水|透湿|一致|无色差|不掉色|不起球)/i, why: "绝对化承诺：洗后功能会衰减、批次必然存在缸差" },
    { re: /zero\s*(color\s*)?difference|no\s*color\s*variation|permanent\s*waterproof|100%\s*(waterproof|consistent)/i, why: "绝对化承诺（英文）" }
  ];

  function stageNames() { return STAGES.map(function (s) { return s.name; }); }
  function isDealStage(i) { return i === DEAL_STAGE; }

  function specMissing(buyer) {
    var have = {};
    ((buyer && buyer.spec) || []).forEach(function (r) { if (r && r.k) have[String(r.k)] = r.v; });
    return SPEC_REQUIRED.filter(function (f) {
      var v = have[f.label];
      return !(v && String(v).trim() && String(v).indexOf("待") !== 0);
    }).map(function (f) { return f.label; });
  }

  function priceHits(text) {
    var out = [];
    var re = /(?:US\s?\$|USD|RMB|CNY|[$¥￥])\s?[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?\s?(?:美元|美金|元)/gi, m;
    while ((m = re.exec(text || ""))) out.push(m[0]);
    /* 面料正文最常见的是不写币种的裸单价：0.32/m、3.2 per yard。
       只认小数 + 斜杠/每 + 单位，整数不当价（避免 "1/2 sample" 这类误判）。 */
    var re2 = /\d+\.\d+\s*(?:\/|每|per\s+)(?:m|meter|meters|metre|metres|yd|yds|yard|yards|米|码|KG|kg)\b/gi;
    while ((m = re2.exec(text || ""))) out.push(m[0]);
    return out;
  }

  function unitRe() {
    var parts = FACTS.quote.unitTokens.map(function (t) {
      return /^[\x00-\x7F]+$/.test(t) ? "\\b" + t + "(?:s|es)?\\b" : t;
    });
    return new RegExp("(?:" + parts.join("|") + ")", "i");
  }

  /* 出稿守卫：确定性校验，不依赖模型自觉 */
  function guardDraft(buyer, text) {
    var hits = [];
    var body = String(text || "");
    var prices = priceHits(body);

    if (prices.length) {
      /* 业务事实一条都没终裁 → 本线没有可写的价格。这是学徒期敢用 AI 的前提。 */
      var factsReady = FACTS.moq.some(function (f) { return f.verified; }) || FACTS.quote.ladder.length > 0;
      if (!factsReady) {
        hits.push({ id: "facts_pending", severity: "block", message: "本线价格事实尚未终裁（MOQ/阶梯/有效期都是空位），AI 不得替没有价格表的业务线定价；先补 f-model.js 的 FACTS" });
      }
      var miss = specMissing(buyer);
      if (miss.length) {
        hits.push({ id: "spec", severity: "block", message: "报价缺规格要素：" + miss.join("/") + "——面料规格不全报出的价必错" });
      }
      if (!unitRe().test(body)) {
        hits.push({ id: "unit", severity: "block", message: "价格缺计价单位（应为 " + FACTS.quote.unit + "），单位混用必错总价" });
      }
      if (!/(USD|RMB|CNY|US\s?\$|[$¥￥]|美元|美金|元)/i.test(body)) {
        hits.push({ id: "currency", severity: "block", message: "报价未标币种" });
      }
      if (!/(有效期|报价有效期|valid\s+(for|until)|quote\s+(is\s+)?valid|有效期至)/i.test(body)) {
        hits.push({ id: "validity", severity: "block", message: "报价未写有效期——面料价格随纱价与汇率浮动，无有效期等于日后被按旧价追" });
      }
    }

    FORBIDDEN_CLAIMS.forEach(function (f) {
      if (f.re.test(body)) hits.push({ id: "claim", severity: "block", message: f.why });
    });

    var block = hits.filter(function (h) { return h.severity === "block"; });
    return { pass: block.length === 0, hits: hits };
  }

  global.FabricModel = {
    STAGES: STAGES,
    stageNames: stageNames,
    DEAL_STAGE: DEAL_STAGE,
    isDealStage: isDealStage,
    SPEC_REQUIRED: SPEC_REQUIRED,
    specMissing: specMissing,
    FACTS: FACTS,
    GLOSSARY: GLOSSARY,
    POSITIONING: POSITIONING,
    guardDraft: guardDraft,
    priceHits: priceHits
  };
})(typeof window !== "undefined" ? window : global);
