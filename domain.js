/* ===== 业务域（Domain）：一个域 = 一套阶段管道 + 一套事实 + 一套守卫 + 一套语料 =====
 * 2026-11-09（Phil 两条裁决）：
 *   裁决 1 面料域零语料 → 框架先搭、AI 不开脑（brain.repliesEnabled=false + corpusGate 门槛，未达量直接拒载）
 *   裁决 2 业务员一人绑一域 → 账号必须有 domainId，未绑域拒绝进入，绝不回落默认域
 * 设计边界：壳层只做过滤（Store.domainBuyers / 共享层 scope），脑层全部由域包驱动；
 *          任何页面里都不许出现 if (domainId === "xxx")。新增第三个域 = 只加一个包，不改代码。
 * 与 mock.js/stores.js 的关系：行李箱域的阶段名、成交档、报价档与现网逐字节一致（Step 0 零行为变化）。
 */
(function () {
  "use strict";

  var SCHEMA_VERSION = 1;

  /* ---------- 域包 1：电动行李箱（= 现网内容原样迁出，事实来源见各条 source） ---------- */
  var SCOOTER = {
    id: "e-scooter",
    name: "电动行李箱",
    enabled: true,
    accentColor: "#B97516",

    brain: {
      repliesEnabled: true,
      reason: "已有吴总真实回复底稿与棋谱 v1，正常开脑",
      corpusGate: { minRealReplies: 1, source: "bundled", countedFrom: "回合库回合条数（TURNS.list，随包发布）" }
    },

    /* 阶段管道：与 mock.js STAGES 逐字一致，成交=末档（全应用「stage < DEAL_STAGE = 进行中」的前提不变） */
    stages: [
      { key: "inquiry", name: "询盘" },
      { key: "needs", name: "需求确认" },
      { key: "quote", name: "报价" },
      { key: "negotiating", name: "谈判" },
      { key: "sample", name: "样品确认" },
      { key: "won", name: "成交", isDeal: true }
    ],
    quoteStage: 2,        /* 「已报价」口径：stage ≥ 2 */
    negotiationStage: 3,  /* 看板「谈判中」计数 */
    needsStage: 1,        /* 数量/规格入库的确定性兜底目标档 */
    /* 硬信号扫描词表沿用 utils.js 内置（行李箱专用，迁包会动到现网 200+ 行正则，Step 0 不碰） */
    stagePatterns: null,

    facts: {
      assetLibrary: "Titan资料",
      items: [
        { key: "netWeight", label: "净重", value: "8.4", unit: "kg", verified: true, source: "2026-10-30 终裁" },
        { key: "grossWeight", label: "毛重", value: "11.9", unit: "kg", verified: true, source: "2026-10-30 终裁" },
        { key: "range", label: "续航", value: "10-15", unit: "km", verified: true, source: "2026-10-30 E1/E2 统一口径" },
        { key: "load", label: "承重", value: "120", unit: "kg", verified: true, source: "2026-10-30 终裁：一律 120kg" },
        { key: "cert", label: "认证", value: "RoHS / FCC", verified: true, source: "扫描件待补" },
        { key: "localDelivery", label: "本地交付", value: "N5 仅限中国境内客户", verified: true, source: "2026-10-30 终裁" }
      ]
    },

    moq: [
      { key: "standard", label: "标准品", value: 50, unit: "台", verified: true },
      { key: "lightbarLogo", label: "灯条 Logo 定制", value: 100, unit: "台", verified: true },
      { key: "labeling", label: "贴标", value: 100, unit: "台", verified: true },
      { key: "photochromic", label: "感光变色", value: 200, unit: "台", verified: true },
      { key: "customColor", label: "定制色", value: 500, unit: "台", verified: true }
    ],

    quote: {
      unit: "台",
      units: ["台"],
      /* 草稿里的单位写法（中英都认）：守卫扫的是发给客户的原文，不会写中文"台" */
      unitTokens: ["台", "pcs", "piece", "pieces", "unit", "units", "set", "sets", "each"],
      currency: "USD",
      requiredSpecLabels: ["型号", "数量"],
      minValidityDays: 0,
      /* 四档价：两列口径（[待确认列名]），守卫按任一命中放行 */
      ladder: [
        { minQty: 100, maxQty: 299, prices: [222, 236] },
        { minQty: 300, maxQty: 699, prices: [215, 225] },
        { minQty: 700, maxQty: 999, prices: [210, 218] },
        { minQty: 1000, maxQty: null, prices: [205, 212], requireFormalQuote: true }
      ]
    },

    /* 技能库/回合库归属：只有声明了 skillSet 的域才注入行李箱句式，面料域未建库 → null */
    /* 行李箱域：沿用现网逐客户 scope（suitcase/pet/all），服务端已支持 → 资料注入照常。
       serverLine=null 表示"不按域强制覆盖产品线"，交回 buyer.scope */
    serverLine: null,
    serverLineReady: true,

    authority: "master", /* 本域话稿基准已确立：吴总真实回复 + 棋谱 v1 + 技能库 */
    skillSet: "scooter",
    turnLibrary: true,   /* 回合库（53 条真实回合）只属于本域 */
    primaryLine: "suitcase",
    photoLibrary: true,    /* Titan 行李箱素材库属本域 */

    /* 客户产品线（沿用现网 scope 值域，避免第二套分类法） */
    productLines: [
      { key: "", label: "未定" },
      { key: "suitcase", label: "电动行李箱" },
      { key: "pet", label: "宠物用品" },
      { key: "all", label: "通用" }
    ],

    guards: {
      concessionMaxPoints: 2,
      forbiddenClaims: [],
      requireSpecInQuote: false,
      requireValidityDays: false,
      requireCurrency: true,
      requireUnitMatch: true
    },

    followUp: { driver: "open_items", coldAfterDays: 30 },
    board: { forbiddenTerms: ["门幅", "克重", "缸差", "米数"] },

    glossary: [
      { zh: "阶梯价", en: "tiered price / quantity price break" },
      { zh: "灯条", en: "LED light bar" },
      { zh: "感光变色", en: "photochromic color change" },
      { zh: "贴标", en: "labeling / private label" },
      { zh: "整柜", en: "full container load (FCL)" },
      { zh: "毛重", en: "gross weight (GW)" },
      { zh: "净重", en: "net weight (NW)" }
    ]
  };

  /* ---------- 域包 2：功能性面料（空框架：结构完整，业务事实一律 verified:false 占位） ---------- */
  var FABRIC = {
    id: "functional-fabric",
    name: "功能性面料",
    enabled: true,
    accentColor: "#0f8f6b",

    brain: {
      repliesEnabled: true,
      /* 2026-11-09（Phil 覆盖裁决「不开脑不行」）：本域没有回合库底稿，开脑改走 docs_driven ——
         底稿来源从「吴总真实回复」换成「本域资料库 + 棋谱骨架」，并叠三条硬约束：
           1) 每条底稿打「未验证底稿」标记，业务员必须知道这不是吴总原话；
           2) 价格/交期/认证类内容仍由确定性守卫拦下（本域事实 verified:false，等于没有价格可写）；
           3) 出稿只准走棋谱内打法，棋谱 evidence 为空时 blocker 必须注明"无底稿依据"。
         语料到 60 条后把 source 改回 runtime，即切回底稿替换法。 */
      mode: "docs_driven",
      acceptedRiskBy: "Phil 2026-11-09（零话稿开脑，接受学徒期定位与下述约束）",
      reason: "学徒期开脑：本域没有话稿基准，AI 只做草拟与追问，不模拟资深口吻；价格与承诺类内容仍被守卫拦下",
      /* 从 0 积累：计数口径是"本域自己确认发送的回复"，不预设归属人。
         基准话稿是谁的（Phil？未来的面料业务员？）由 Phil 后续指定，指定前本域不承认任何"经验" */
      corpusGate: { minRealReplies: 60, source: "docs", countedFrom: "本域确认发送且经核对的回复条数（实时统计本域客户的已发送记录，从 0 起算）" },
      realReplyCount: 0,
      playbookUnverifiedAllowed: true
    },

    /* 8 段设计压成 7 段：成交（首单）必须是末档——全应用「stage < DEAL_STAGE = 进行中」「成交=终态」
       的前提要保住；「返单/年框」改挂成交后的标记（postDealTag），不占阶段位 */
    stages: [
      { key: "spec_confirm", name: "规格确认" },
      { key: "recommended", name: "选型推荐" },
      { key: "sample_sent", name: "寄样" },
      { key: "testing", name: "客户测试" },
      { key: "trial_order", name: "试单" },
      { key: "bulk_quoted", name: "大货报价" },
      { key: "first_order", name: "首单成交", isDeal: true }
    ],
    postDealTag: { key: "repeat", name: "返单/年框" },
    quoteStage: 5,
    negotiationStage: 5,
    needsStage: null, /* 面料 0 档就是「规格确认」，1 档是「选型推荐」——字段入库不能跳到「已推荐」 */
    /* 追加进「读」提示词的本域阶段表（行李箱域不提供 = 沿用提示词里的六档原文，一字未动） */
    readStageTable: "七档 0规格确认 1选型推荐 2寄样 3客户测试 4试单 5大货报价 6首单成交。" +
      "判定标准（该档事实已发生才给该档，没发生给更低档或 null）：" +
      "0规格确认＝客户给出成分/克重/门幅/用途任一项硬规格；" +
      "1选型推荐＝我方已发出具体规格或替代方案（含 A/B 差异说明）——只问「有什么面料」不算；" +
      "2寄样＝样卡/剪样/匹样/lab dip 已寄出（有快递单号或客户确认收到）；" +
      "3客户测试＝客户开始或反馈测试、成衣/水洗评估、手感判断（提到 SGS/测试报告/样衣也算）；" +
      "4试单＝散剪或小缸试单成立（客户明确要 N 米先做/试单 PO）；" +
      "5大货报价＝我方发出含单价+计价单位+有效期的大货正式报价；" +
      "6首单成交＝首单 PO + 定金/全款到账的硬证据。" +
      "注意：面料的样品是主流程不是分支——「已寄样」就该给 2，不要因为没报价就退回 0；" +
      "「客户说要做成衣洗洗看」＝3，不是拖延到 null；" +
      "「先做 200 米」＝4 试单，不是成交；报价没写有效期或未写克重门幅 → 不算 5。",
    /* 面料硬信号词表：只认已发生的动作，方向无关（我方寄样与客户要样都算寄样档） */
    stagePatterns: [
      { to: 6, why: "首单付款硬信号", re: /(PO|订单|定金|deposit|down\s?payment|invoice).{0,24}(已|paid|received|收到|签|confirm)|已收(到)?(货款|定金|首款|款项|转账)|deposit\s+(paid|received|sent)|first\s+order\s+(placed|confirmed)/i },
      { to: 5, why: "大货报价信号", re: /(大货价|bulk\s+(price|quote)|bulk\s+order\s+price|正式报价).{0,20}(\$|USD|RMB|元|\/\s?m|每米)|valid\s+(until|for)\s+\d+|报价(有效期|有效期至)/i },
      { to: 4, why: "试单信号", re: /(试单|trial\s+order|small\s+lot|散剪|sample\s+yardage|\d{2,4}\s?(米|码|m|yds?).{0,12}(试|先|first))/i },
      { to: 3, why: "客户测试评估信号", re: /(测试|test(ing)?|lab\s+report|test\s+report|SGS|Intertek|Intertek|BV|水洗|wash\s*test|成衣|样衣|garment\s*\+?test|hand\s?feel|手感).{0,24}(结果|result|反馈|feedback|开始|doing|收到|收到|report)|收到(样品|样卡)/i },
      { to: 2, why: "寄样信号", re: /(样卡|剪样|匹样|swing\s+sample|hanger|cut\s+sample|off-?cut|bulk\s+sample|lab\s*dip).{0,24}(寄|发|已|sent|shipped|tracking|收到|ok)|快递单号|tracking\s*(no|number)?[:：]?\s*[A-Z0-9]{8,}/i },
      { to: 1, why: "选型推荐信号", re: /(推荐|建议|可以用|改用).{0,20}(规格|克重|成分|后整理|涂层|贴膜|denier|D\b|D\b纱)|A\s?(方案|款).{0,8}B\s?(方案|款)|替代(方案|规格)/i },
      { to: 0, why: "规格信号（成分/克重/门幅/用途）", re: /(\d{2,4}\s?(g\/?m2?|GSM|克)|门幅|\d{2,3}\s?cm\s?(宽|门幅)?|width\s*[:：]?\s*\d{2,3}|成分|polyester|polyamide|nylon|PA\d|PU\s?coated|210T|190T|420D|600D|塔丝龙|春亚纺)/i }
    ],

    facts: {
      assetLibrary: "[待建：面料素材库（禁用 Titan资料）]",
      items: [
        { key: "composition", label: "成分", value: null, verified: false, source: "[待终裁]" },
        { key: "gsm", label: "克重", value: null, unit: "g/m2", verified: false, source: "[待终裁]" },
        { key: "width", label: "门幅", value: null, unit: "cm", verified: false, source: "[待终裁]" },
        { key: "finishing", label: "后整理", value: null, verified: false, source: "[待终裁]" },
        { key: "waterproof", label: "静水压", value: null, unit: "mmH2O", verified: false, source: "[待终裁：做不到的范围必须写做不到]" },
        { key: "breathability", label: "透湿量", value: null, unit: "g/m2/24h", verified: false, source: "[待终裁]" },
        { key: "shrinkage", label: "缩水率", value: null, unit: "%", verified: false, source: "[待终裁：注明测试标准]" },
        { key: "colorFastness", label: "色牢度", value: null, verified: false, source: "[待终裁：水洗/摩擦/日晒分开]" },
        { key: "cert", label: "认证体系", value: null, verified: false, source: "[待终裁：OEKO-TEX/bluesign/REACH 哪几项有真实效文件]" }
      ]
    },

    moq: [
      { key: "stock", label: "现货（库存缸）起订", value: null, unit: "米", verified: false, note: "[待终裁]" },
      { key: "cutSample", label: "剪样上限", value: null, unit: "米", verified: false, note: "[待终裁：免费样额度另计]" },
      { key: "yarnDyed", label: "定织定染（按缸）起订", value: null, unit: "米/色", verified: false, note: "[待终裁：含拼缸规则]" }
    ],

    quote: {
      unit: "米",
      units: ["米", "码", "KG"],
      /* 面料草稿常见写法：/m、per meter、per yard；m 要带边界，否则 "3.2/m" 认不到、"time" 里还会误认 */
      unitTokens: ["米", "码", "KG", "m", "meter", "meters", "metre", "metres", "yd", "yds", "yard", "yards"],
      currency: "USD",
      /* 报价前必须齐备的规格（客户档案要点标签）——缺任一 → 无规格报价红警 */
      requiredSpecLabels: ["成分", "克重", "门幅", "后整理", "色号"],
      minValidityDays: 7,
      ladder: [],
      ladderPending: true
    },

    /* 服务端产品线（FC 侧 scope 三线打包机制，2026-10-16 已上线 suitcase/pet/any）
       serverLineReady=false 期间本域强制不注入团队资料：
       服务端白名单只认 suitcase/pet/all，面料的 scope 会被打回 "" → 落进 any 包
       = 行李箱与宠物资料一起灌进面料的脑子。宁可没资料，也不能错资料。 */
    serverLine: "fabric",
    serverLineReady: false,

    authority: "novice", /* 学徒期：无话稿基准、无归属人，AI 只草拟不装经验 */
    skillSet: null, /* 面料域未建技能库：宁可不注入，也不能拿行李箱句式当面料话术 */
    /* 2026-11-09（Phil「面料和吴总话术没关系，从 0 开始」）：回合库=53 条吴总行李箱真实回合，
       提示词里标的是"最高优先级参照"。面料不关掉它，等于让 AI 拿零售锚点/整单重算/柜级口径去谈面料。 */
    turnLibrary: false,
    /* 追加式覆盖块：行李箱域不发这一段 → CONCRETE 原文一字不动（黄金集压着它）；
       面料域在 CONCRETE 之后追加，明确宣布上文那些行李箱事实与审批人不适用于本域 */
    /* 覆盖块只否定、不枚举：把行李箱卖点逐条写出来反而把它们重新喂回模型（不要想大象）。
       所以这里不提任何对方域的事实，只把本域可用的东西正向框死。 */
    promptOverrides: "\n【本域定位·优先级高于上文】本业务线是「功能性面料」，且当前处于学徒期：\n" +
      "1) 上文通则里凡属其它产品线的数字、认证、卖点、计量单位与内部审批流程，本域一律不得引用；本域没有成熟话稿，" +
      "禁止使用「我们通常/一贯/以往成交都是这样/按我们的经验」这类以经验为由的表述——本域还没有资格谈经验。\n" +
      "2) 只能使用客户档案、本域资料与本条对话里真实出现过的值；没有的就明确说需确认后回复，不许用行业惯例填补。\n" +
      "3) 学徒期该做的是把指标问清、把风险讲在前面（缸差、缩水率、色牢度、洗后功能衰减）、给出可核对的下一步，" +
      "不是模仿资深业务口的口吻推销。宁可短、准、留一句待确认，也不要长而空。\n" +
      "4) 让步与例外不写任何具体人名，统一写「需我方确认后回复」。\n",
    markText: "学徒期草拟·本域尚无话稿基准，请逐句核对后再发",

    /* 线值必须是服务端能认的 scope（fabric 即待加的第四条线）：用 functional/coated 这类
       自定义 key，资料上传后 owner 反推为 null，会被自己的隔离规则挡在门外 */
    productLines: [
      { key: "", label: "未定" },
      { key: "fabric", label: "功能性面料" }
    ],
    primaryLine: "fabric", /* 学徒域内 scope 为空时按主产品线处理，避免"传了资料客户却看不到" */
    photoLibrary: false,   /* 面料素材库尚未建立：不展示 Titan 行李箱产品图 */

    guards: {
      concessionMaxPoints: null,
      forbiddenClaims: ["100% 一致", "永久防水", "永不起球", "零色差", "保证通过测试", "绝对不缩水", "100% color match", "permanent waterproof", "guaranteed to pass"],
      requireSpecInQuote: true,
      requireValidityDays: true,
      requireCurrency: true,
      requireUnitMatch: true
    },

    followUp: { driver: "sample_lifecycle", coldAfterDays: 120 },
    board: { forbiddenTerms: ["整柜", "行李箱", "灯条", "续航", "承重", "Titan资料", "宠物"] },

    glossary: [
      { zh: "门幅", en: "fabric width", note: "不是 size" },
      { zh: "克重", en: "GSM (g/m2)" },
      { zh: "缸差", en: "batch-to-batch color variation", note: "逐匹差说 roll-to-roll；不要写 color difference（那是色差本身）" },
      { zh: "色差允收", en: "color tolerance (ΔE)" },
      { zh: "缩水率", en: "shrinkage" },
      { zh: "色牢度", en: "color fastness", note: "水洗/摩擦/日晒分开" },
      { zh: "剪样", en: "cut sample / off-cut" },
      { zh: "样卡", en: "swing sample / hanger sample" },
      { zh: "匹样", en: "bulk sample / full roll sample" },
      { zh: "手感", en: "hand feel" },
      { zh: "后整理", en: "finishing", note: "功能整理 = functional finishing" },
      { zh: "静水压", en: "hydrostatic head" },
      { zh: "透湿", en: "moisture vapor transmission rate (MVTR)" },
      { zh: "起毛起球", en: "pilling" },
      { zh: "拼缸", en: "dye lot consolidation" }
    ]
  };

  var PACK_LIST = [SCOOTER, FABRIC];

  /* ---------- 校验：缺字段/未达语料门槛的域一律拒绝加载 ----------
     裁决 1 的硬约束写在这里：repliesEnabled=true 但真实语料未达 corpusGate → 该域不予注册，
     杜绝日后有人手滑给零语料域开脑 */
  function validatePack(p) {
    var errs = [];
    if (!p) return ["域包为空"];
    if (!p.id || !/^[a-z][a-z0-9-]{1,40}$/.test(p.id)) errs.push("id 非法: " + p.id);
    ["name", "brain", "stages", "facts", "moq", "quote", "guards", "followUp", "board", "glossary"].forEach(function (k) {
      if (!p[k]) errs.push("缺字段 " + k);
    });
    if (!p.stages || p.stages.length < 3) errs.push("stages 至少 3 段");
    var deals = (p.stages || []).filter(function (s) { return s.isDeal; });
    if (deals.length !== 1) errs.push("必须且只能有一个 isDeal 阶段（全应用以「stage < DEAL_STAGE = 进行中」为前提）");
    else if (deals[0] !== p.stages[p.stages.length - 1]) errs.push("isDeal 阶段必须是末档（成交=终态，返单等走 postDealTag）");
    if (typeof p.quoteStage !== "number" || p.quoteStage < 0 || p.quoteStage >= p.stages.length) errs.push("quoteStage 越界");
    if (p.brain) {
      var cg = p.brain.corpusGate || {};
      var min = cg.minRealReplies || 1;
      if (p.brain.repliesEnabled === true) {
        if (cg.source === "docs") {
          /* 零底稿开脑是允许的，但必须留下签字：谁批的、走的是哪条模式。
             闸门可以被授权绕开，不可以被"顺手改个 true"绕开——这是这条线存在的唯一意义 */
          if (p.brain.mode !== "docs_driven") errs.push("corpusGate.source=docs 必须同时声明 brain.mode=docs_driven");
          if (!p.brain.acceptedRiskBy) errs.push("docs_driven 开脑缺 brain.acceptedRiskBy 风险签核 —— 拒载");
          if (!(p.brain.playbookUnverifiedAllowed === true)) errs.push("docs_driven 需要 playbookUnverifiedAllowed=true 才允许用未验证棋谱出稿");
        } else if (corpusCount(p) < min) {
          errs.push("brain.repliesEnabled=true 但真实语料 " + corpusCount(p) + " < 门槛 " + min + " —— 无语料禁止开脑");
        }
      }
    }
    return errs;
  }

  /* 语料条数：bundled = 随包发布的回合库（行李箱，回合文件缺失属加载故障，不算零语料）；
     runtime = 上线后累积回填的真实回复；docs = 不看条数（改由签核 + 三条硬约束把关） */
  function corpusCount(p) {
    var cg = (p && p.brain && p.brain.corpusGate) || {};
    if (cg.source === "bundled") {
      return (window.TURNS && window.TURNS.list && window.TURNS.list.length) || (cg.minRealReplies || 1);
    }
    /* 实时统计本域"已确认发送"的回复条数：从 0 起算，随使用自然增长，不预设话稿归属人 */
    var live = countSentReplies(p);
    var seedN = (p && p.brain && p.brain.realReplyCount) || 0;
    return Math.max(live, seedN);
  }
  /* 数据源与首页"AI 学习进度"同源：aiEvents 里 t=sent 且带 raw 的才算是人确认发过的真实回复 */
  function countSentReplies(p) {
    try {
      if (!p || !window.Store || !Store.domainBuyers) return 0;
      var n = 0;
      Store.domainBuyers().forEach(function (b) {
        (b.aiEvents || []).forEach(function (e) { if (e && e.t === "sent" && e.raw) n++; });
      });
      return n;
    } catch (e) { return 0; }
  }

  /* ---------- 注册表 ----------
     语料条数一律实时取（corpusCount），不缓存：turns.js 在本文件之后加载，缓存在注册期会拿到 0 */
  var packs = {}, rejected = [];
  PACK_LIST.forEach(function (p) {
    p.brain = p.brain || {};
    var errs = validatePack(p);
    if (errs.length) { rejected.push({ id: p && p.id, errors: errs }); return; }
    packs[p.id] = p;
  });

  var currentId = null;
  var listeners = [];

  /* ---------- 当前域：唯一来源是账号绑定（Auth.domainId），绝不猜默认域 ----------
     store.js 先于 app.js 加载，而 Auth 在 app.js 里定义 → 登录态的 key 与解析放在这里作单一事实源，
     app.js 改用 DealDomain.AUTH_KEY 读写，避免两处各写一份 key 字符串（改一处漏一处的老坑） */
  var AUTH_KEY = "dealdesk.auth.v1";
  function readAccount() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; }
  }
  /* 静默绑定（启动用）：未绑域返回 null 而不抛错，由 app.js 决定弹绑定卡——
     不在数据层抛错，是为了避免"页面白屏但不知道为什么"那种暗雷 */
  function bindFromStorage() {
    var a = readAccount();
    /* 独立入口（fabric.html）：入口本身就声明了业务域，账号未绑域时按入口绑，
       不再让新同事在面料工作台里选一次"电动行李箱还是面料"——选错就是把整条业务线走错。
       已绑到别的域 → 不绑定，交给 app.js 拦住并提示换入口。 */
    var entry = window.DEAL_DOMAIN_ENTRY || null;
    if (entry && packs[entry]) {
      if (!a || !a.domainId) { currentId = entry; return packs[entry]; }
      if (a.domainId === entry) { currentId = entry; return packs[entry]; }
      currentId = null;
      return null;
    }
    if (!a || !a.domainId || !packs[a.domainId]) { currentId = null; return null; }
    currentId = a.domainId;
    return packs[a.domainId];
  }
  /* 入口与账号是否搭：mismatch 时界面必须说清楚"去哪个入口"，不能只白屏 */
  function entryState() {
    var entry = window.DEAL_DOMAIN_ENTRY || null;
    if (!entry) return { entry: null, state: "none" };
    var a = readAccount();
    if (!a || !a.domainId) return { entry: entry, state: "unbound" };
    if (a.domainId === entry) return { entry: entry, state: "match" };
    return { entry: entry, state: "mismatch", accountDomain: a.domainId, accountName: a.name || "" };
  }
  /* ===== 云端数据槽的线归属（v1.20.0，根治"行李箱账号进面料线还带着老客户"）=====
     FC 的数据槽按账号唯一（users[key].data），两个工作台共用同一个槽——本地绑定
     会被历史登录翻转（入口自动绑定/选线页残留），只有槽里的内容才是事实：
     快照的 line 字段是槽的"线戳"（归属证书）。entryState 管的是"本地绑定"，
     本组函数管的是"云端槽"，两层判据互补，缺任一层都会漏。
     推断规则（landing.js 有同规则副本，test-domain [21] 断言两者逐条一致）：
       有 line → 认它；无 line 但有客户 → e-scooter（面料线出现之前只有这一条线，事实推断）；
       无 line 无客户 → 空槽 = 未占有，归先用哪个入口（入口即身份）。 */
  function slotLineOf(server) {
    if (!server || typeof server !== "object") return "";
    if (typeof server.line === "string" && server.line) return server.line;
    if (server.buyers && server.buyers.length) return "e-scooter";
    return "";
  }
  /* 槽归属与入口线不一致 = 冲突（返回槽属线，供界面说明）；一致或空槽 = null（放行） */
  function slotConflict(server, entry) {
    var slot = slotLineOf(server);
    if (!slot) return null;
    var entryLine = (typeof entry === "string" && entry) ? entry : "e-scooter";
    return slot === entryLine ? null : slot;
  }
  function setAccount(account) {
    var id = account && account.domainId;
    if (!id) throw new Error("ACCOUNT_WITHOUT_DOMAIN: 账号 " + ((account && account.name) || "?") + " 未绑定业务域");
    if (!packs[id]) throw new Error("UNKNOWN_DOMAIN: " + id + "（未注册或校验未通过）");
    if (!packs[id].enabled) throw new Error("DOMAIN_DISABLED: " + id);
    currentId = id;
    listeners.forEach(function (f) { try { f(packs[id]); } catch (e) {} });
    return packs[id];
  }
  function current() { return currentId ? packs[currentId] : null; }
  /* 单条记录取域：记录没打域标签视为脏数据 → 归当前域并 console.warn（迁移期兜底，不静默丢记录） */
  function of(record) {
    if (!record) return null;
    if (record.domainId) return packs[record.domainId] || null;
    return current();
  }

  /* ---------- 壳层：共享集合按域取数 ---------- */
  /* 服务端资料/剧本只有 scope 字段，没有 domainId —— 之前按 d.domainId 过滤的条件永远不成立，
     等于没过滤（Phil 实测"进面料域还是看到电动行李箱内容"就是这个）。scope 是唯一的归属线索：
     suitcase/pet → 行李箱域；fabric → 面料域；all/未标 → 历史通用（行李箱时代建的参数表与底线手册）。
     隔离规则刻意不对称：
       · 行李箱域（现网）→ 本域 + 通用，行为与今天完全一致；
       · 其它域 → 只认明确属于自己的 scope，连"通用"也不给。
     因为现网所有 all 资料都是行李箱语境写的，放行"通用"等于把行李箱卖点当面料的共享知识灌进去。
     新域要资料就自己上传——从 0 开始就该从 0 开始。 */
  /* 新客话术取数：先切域，再切产品线，两刀都在跨域之前落刀。
     刻意取消「本线没有剧本就回退显示全部」这条 2026-10-21 的兜底——那是单产品线时代的承诺，
     跨域后它会把《新客话术·六步（Titan X）》整套借给面料客户，比没话术更糟。
     本域确实一套都没有时返回空，由界面显示"本业务线还没有话术"，绝不外借。 */
  function selectScripts(docs, line) {
    var inDomain = filterShare(docs || []);
    var all = inDomain.filter(function (d) { return d && d.type === "script" && d.steps && d.steps.length; });
    var l = line || "all";
    var picked = (l === "all") ? all : all.filter(function (d) { return d.scope === "all" || d.scope === l; });
    /* 域内回退保留现网语义（2026-10-21 Phil「保证新客一定有话术」：宠物客户没有专属剧本时显示本域其它剧本）。
       回退范围只到"本域全部"为止——绝不跨到别的业务线去借剧本 */
    var fallback = false;
    if (!picked.length && all.length) { picked = all.slice(); fallback = true; }
    return { scripts: picked, fallback: fallback, noneInDomain: all.length === 0 };
  }
  function ownerDomainOfScope(scope) {
    var s = String(scope || "").toLowerCase();
    if (s === "suitcase" || s === "pet") return "e-scooter";
    if (s === "fabric") return "functional-fabric";
    return null; /* all / 空 / 未知 */
  }
  function filterShare(docs) {
    var p = current();
    if (!p) return (docs || []).slice();
    var strict = p.authority !== "master"; /* 学徒域严格隔离；成熟域沿用现网口径 */
    return (docs || []).filter(function (d) {
      if (!d) return false;
      var owner = d.domainId ? d.domainId : ownerDomainOfScope(d.scope);
      if (owner && owner !== currentId) return false;   /* 明确属于别的域 → 一律不给 */
      if (!owner && strict) return false;               /* 无主的历史通用资料 → 学徒域不收 */
      return true;
    });
  }

  /* ---------- 脑层开关 ---------- */
  function brainMode(p) {
    p = p || current();
    if (!p) return { replyDraft: false, statusCard: false, stageDetection: false, riskHints: false, review: false, reason: "未绑定业务域" };
    var on = !!(p.brain && p.brain.repliesEnabled);
    var docs = on && p.brain.mode === "docs_driven";
    return {
      replyDraft: on,
      statusCard: true, stageDetection: true, riskHints: true, review: true,
      /* docs_driven：出稿可以，但必须让业务员一眼看出这不是吴总原话（界面按此打水印） */
      mode: docs ? "docs_driven" : "corpus_driven",
      authority: p.authority || "master",
      unverifiedMark: docs ? (p.markText || "未验证底稿·请先核对再发") : "",
      riskAcceptedBy: (p.brain && p.brain.acceptedRiskBy) || "",
      playbookUnverifiedAllowed: !!(p.brain && p.brain.playbookUnverifiedAllowed),
      gate: p.brain && p.brain.corpusGate ? p.brain.corpusGate.minRealReplies : 0,
      have: corpusCount(p),
      factsReady: (p.facts && p.facts.items || []).some(function (f) { return f.verified; }),
      reason: p.brain ? p.brain.reason : ""
    };
  }

  /* ---------- 阶段 ---------- */
  function stageNames(p) { return ((p || current()) || { stages: [] }).stages.map(function (s) { return s.name; }); }
  function dealStage(p) {
    p = p || current();
    if (!p) return 0;
    for (var i = 0; i < p.stages.length; i++) if (p.stages[i].isDeal) return i;
    return p.stages.length - 1;
  }
  function maxStage(p) { p = p || current(); return p ? p.stages.length - 1 : 0; }
  function quoteStage(p) { p = p || current(); return p ? p.quoteStage : 2; }
  function negotiationStage(p) { p = p || current(); return p ? p.negotiationStage : 3; }
  /* 可为 null：null = 本域不做「字段入库 → 跳需求档」这条兜底 */
  function needsStage(p) { p = p || current(); return p ? (p.needsStage === undefined ? 1 : p.needsStage) : 1; }
  function stagePatterns(p) { p = p || current(); return (p && p.stagePatterns) || null; }
  function isLastStage(p) { return current() ? dealStage() === maxStage() : false; }

  /* ---------- 报价草稿确定性守卫：数值与规格准确性不靠提示词 ----------
     text = 即将发给客户的草稿正文；buyer = 客户档案（context 数组存规格要点） */
  function has(v) { return v != null && String(v).trim() !== "" && String(v).indexOf("[待") !== 0; }
  function specLabelSet(buyer) {
    var s = {};
    ((buyer && buyer.context) || []).forEach(function (c) {
      if (!c) return;
      /* context 条目在现网是 {k,v}，FB 表单扩展要点带 tag，旧数据还有纯字符串——三种都认，
         漏一种就是"档案里明明填了克重，守卫却说缺克重"那种暗雷 */
      var k = typeof c === "string" ? c : (c.k || c.tag || c.label);
      var v = typeof c === "string" ? "" : (c.v != null ? c.v : c.value);
      if (k) s[String(k)] = v;
    });
    return s;
  }
  /* 出稿/发送两个入口共用同一段域提示（含未验证水印），避免"AI 卡有守卫、手动确认卡没有"这种半截子 */
  function draftNotes(p, buyer, text, cls) {
    p = p || current();
    if (!p) return { html: "", blocked: false };
    var c = cls || "sugg-warn";
    var r = guardDraft(p, buyer, text), bm = brainMode(p);
    var block = [], warn = [];
    r.hits.forEach(function (h) { (h.severity === "block" ? block : warn).push(h.message); });
    var out = "";
    if (block.length) out += '<div class="' + c + '" style="color:#b91c1c">⛔ 域守卫：' + esc(block.join("；")) + " — 修完再发</div>";
    if (warn.length) out += '<div class="' + c + '">⚠ 域守卫提示：' + esc(warn.join("；")) + "</div>";
    if (bm.mode === "docs_driven" && bm.unverifiedMark) {
      out += '<div class="' + c + '" style="color:#8a5a2b">◇ ' + esc(bm.unverifiedMark) + "（本域还没有吴总真实底稿，出稿依据是本域资料与棋谱骨架）</div>";
    }
    return { html: out, blocked: block.length > 0, counts: { block: block.length, warn: warn.length } };
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function priceHits(text) {
    var out = [], re = /(?:US\s?\$|USD|RMB|CNY|[$¥￥])\s?[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?\s?(?:美元|美金|元)\s?(?:\/|每|per)?/gi, m;
    while ((m = re.exec(text || ""))) out.push(m[0]);
    /* 单价第二形态：没写币种、直接 "0.32/m" / "3.2 per yard"（面料报价正文里极常见）。
       只认带小数点的数字 + 斜杠/每 + 单位，整数（"1/2 sample"、"3 mo"）不当价，避免误伤行李箱现网文案。
       识别不到 = 无规格报价能蒙混过关，这是漏拦比误拦更贵的一类 */
    var re2 = /\d+\.\d+\s*(?:\/|每|per\s+)(?:m|meter|meters|metre|metres|yd|yds|yard|yards|米|码|KG|kg|台|unit|units|pcs)\b/gi;
    while ((m = re2.exec(text || ""))) out.push(m[0]);
    return out;
  }
  /* 计价单位识别：ASCII 词加词边界并允许复数（"3.2/m"、"per meter"、"205 per unit" 都认；
     不加边界时 "m" 会在 time/term 里误命中，加了中文词不用边界） */
  function unitRe(q) {
    var toks = (q.unitTokens && q.unitTokens.length) ? q.unitTokens : (q.units || [q.unit]);
    var parts = toks.map(function (t) {
      return /^[A-Za-z]/.test(t) ? "\\b" + t + "(?:s|es)?\\b" : t;
    });
    return new RegExp("(?:/|\\/|每|per\\s?)?\\s?(?:" + parts.join("|") + ")", "i");
  }
  function guardDraft(p, buyer, text) {
    p = p || current();
    var hits = [];
    if (!p) return { pass: true, hits: hits };
    var g = p.guards || {}, q = p.quote || {}, body = String(text || "");
    var prices = priceHits(body);
    var spec = specLabelSet(buyer);

    /* docs_driven 开脑的硬约束：本域业务事实一条都没终裁（verified 全 false）时，
       价格/数量承诺一律拦下——AI 可以谈规格、谈工艺、追问需求，但不能替一个还没有价格表的域报价。
       这条就是"零底稿开脑"敢开的理由：闸门不在语料上，在事实是否可写死上。 */
    if (prices.length && p.brain && p.brain.mode === "docs_driven") {
      var ready = ((p.facts && p.facts.items) || []).some(function (f) { return f.verified; });
      if (!ready) hits.push({ id: "facts_pending", severity: "block", message: "本域价格事实尚未终裁（MOQ/价格/有效期都是空位），先补档案再报价，AI 不得替无价格表的域定价" });
    }
    if (g.requireCurrency && prices.length) {
      if (!/(US\s?\$|USD|RMB|CNY|[$¥￥]|美元|美金|人民币)/i.test(body)) hits.push({ id: "currency", severity: "block", message: "含价格但未标币种" });
    }
    if (g.requireUnitMatch && prices.length) {
      if (!unitRe(q).test(body)) {
        hits.push({ id: "unit", severity: "block", message: "价格缺计价单位（应为 " + q.unit + "），单位混用必错总价" });
      }
    }
    if (g.requireSpecInQuote && prices.length) {
      var missing = (q.requiredSpecLabels || []).filter(function (k) { return !has(spec[k]); });
      if (missing.length) hits.push({ id: "spec", severity: "block", message: "无规格报价：客户档案缺 " + missing.join("、") + "，先补齐再报价", missing: missing });
    }
    if (g.requireValidityDays && prices.length) {
      if (!(q.minValidityDays > 0) || !/(valid\s*(until|for|to)?|有效期|有效期至|quote.*valid)/i.test(body)) {
        hits.push({ id: "validity", severity: "block", message: "报价未写有效期（价格随原料与汇率浮动）" });
      }
    }
    /* 阶梯价：仅在该域有真实阶梯表时启用（无表 = 跳过，绝不用估算值拦人） */
    if (prices.length && (q.ladder || []).length) {
      var qty = null, qm = /(\d[\d,]*)\s?(台|pcs|pieces|units|sets|米|码|m\b|yds?)/i.exec(body);
      if (qm) qty = Number(String(qm[1]).replace(/,/g, ""));
      if (qty == null && buyer && buyer.qty) {
        var bm = /(\d[\d,]*)/.exec(String(buyer.qty));
        if (bm) qty = Number(bm[1].replace(/,/g, ""));
      }
      if (qty != null) {
        var band = null;
        q.ladder.forEach(function (b) { if (qty >= b.minQty && (b.maxQty == null || qty <= b.maxQty)) band = b; });
        if (band) {
          var nums = prices.map(function (s) { var n = /([\d,]+(?:\.\d+)?)/.exec(s); return n ? Number(n[1].replace(/,/g, "")) : null; }).filter(function (n) { return n != null; });
          var bad = nums.filter(function (n) { return band.prices.indexOf(n) < 0; });
          if (bad.length) hits.push({ id: "ladder", severity: "block", message: "价格与客户数量档不匹配（" + qty + q.unit + " 应为 " + band.prices.join(" 或 ") + "）", got: bad, allowed: band.prices });
          if (band.requireFormalQuote && !/formal\s+quote|正式报价单|以报价单为准/i.test(body)) {
            hits.push({ id: "formal", severity: "warn", message: "该数量档须注明「以正式报价单为准」" });
          }
        }
      }
    }
    (g.forbiddenClaims || []).forEach(function (ph) {
      if (body.toLowerCase().indexOf(String(ph).toLowerCase()) >= 0) {
        hits.push({ id: "claim", severity: "block", message: "绝对化承诺红线：「" + ph + "」做不到的不得写，给替代方案", matched: ph });
      }
    });
    return { pass: hits.filter(function (h) { return h.severity === "block"; }).length === 0, hits: hits };
  }

  /* ---------- 术语表：中文原文 → 保留行业英文说法，防直译错专业词 ---------- */
  function applyGlossary(p, zhText) {
    p = p || current();
    var out = String(zhText || ""), used = [];
    if (!p) return { text: out, replaced: used };
    (p.glossary || []).forEach(function (g) {
      if (out.indexOf(g.zh) >= 0) { out = out.split(g.zh).join(g.en); used.push(g.zh); }
    });
    return { text: out, replaced: used };
  }

  /* ---------- 界面：域角标 + 禁词自检 ---------- */
  function badge(p) {
    p = p || current();
    if (!p) return null;
    return { text: p.name, color: p.accentColor || "#666", switchable: false };
  }
  function forbiddenTermHits(p, text) {
    p = p || current();
    if (!p || !p.board || !p.board.forbiddenTerms) return [];
    return p.board.forbiddenTerms.filter(function (t) { return String(text || "").indexOf(t) >= 0; });
  }

  window.DealDomain = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    AUTH_KEY: AUTH_KEY,
    readAccount: readAccount,
    bindFromStorage: bindFromStorage,
  entryState: entryState,
  entryId: function () { return window.DEAL_DOMAIN_ENTRY || null; },
  slotLineOf: slotLineOf,
  slotConflict: slotConflict,
    validatePack: validatePack,
    rejected: rejected,
    packs: packs,
    ids: function () { return Object.keys ? Object.keys(packs) : []; },
    get: function (id) { return packs[id] || null; },
    setAccount: setAccount,
    onChange: function (f) { listeners.push(f); },
    current: current,
    currentId: function () { return currentId; },
    of: of,
    filterShare: filterShare,
  ownerDomainOfScope: ownerDomainOfScope,
  selectScripts: selectScripts,
  /* 界面显示产品线名：先查本域产品线，再兜全局表（历史数据可能带跨域线值） */
  scopeLabel: function (scope) {
    var lines = (current() && current().productLines) || [];
    for (var i = 0; i < lines.length; i++) if (lines[i].key === scope) return lines[i].label;
    var g = { suitcase: "电动行李箱", pet: "宠物用品", fabric: "功能性面料", all: "通用" };
    return g[String(scope || "")] || "未定";
  },
  primaryLine: function (p) { p = p || current(); return (p && p.primaryLine) || ""; },
  photoLibrary: function (p) { p = p || current(); return p ? p.photoLibrary !== false : true; },
    brainMode: brainMode,
    stageNames: stageNames,
    dealStage: dealStage,
    maxStage: maxStage,
    quoteStage: quoteStage,
    negotiationStage: negotiationStage,
    needsStage: needsStage,
    stagePatterns: stagePatterns,
    guardDraft: guardDraft,
    draftNotes: draftNotes,
    applyGlossary: applyGlossary,
    badge: badge,
    forbiddenTermHits: forbiddenTermHits,
    skillSet: function (p) { p = p || current(); return p ? (p.skillSet || null) : "scooter"; },
  /* 发给服务端的 x-dealdesk-scope：域声明了 serverLine 就以域为准（面料一律 fabric，
     不给它落进 any 包的机会）；否则沿用客户自己的产品线 */
  serverScope: function (buyer, p) {
    p = p || current();
    if (!p) return (buyer && buyer.scope) || "";
    return p.serverLine || (buyer && buyer.scope) || "";
  },
  /* 该域能否注入团队资料：服务端还没有这条产品线时返回 false（改由 llm.js 发 nodocs:1） */
  docsAllowed: function (p) {
    p = p || current();
    if (!p) return true;
    return p.serverLine ? !!p.serverLineReady : true;
  },
  /* 回合库归属：行李箱之外的域默认没有回合库（未声明即 false），防止吴总回合跨域注入 */
  turnLibrary: function (p) {
    p = p || current();
    return p ? p.turnLibrary === true : true;
  },
  /* 域内定位覆盖块（行李箱域为空串 → 提示词逐字节不变） */
  promptOverrides: function (p) {
    p = p || current();
    return (p && p.promptOverrides) || "";
  },
  authority: function (p) {
    p = p || current();
    return (p && p.authority) || "master";
  },
    productLines: function (p) { p = p || current(); return p ? p.productLines : []; },
    facts: function (p) { p = p || current(); return p ? p.facts : { items: [] }; },
    moq: function (p) { p = p || current(); return p ? p.moq : []; },
    followUp: function (p) { p = p || current(); return p ? p.followUp : { driver: "open_items", coldAfterDays: 30 }; }
  };
})();
