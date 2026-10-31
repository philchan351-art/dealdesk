/* ===== LLM 客户端：OpenAI 兼容接口（百炼工作区） =====
 * W2 直连模式：Key 存于本机 localStorage（设置页配置），不进代码库。
 * W3 团队规模化后可切 FC 代理模式（接口不变，换 endpoint）。
 */
(function () {
  "use strict";

  var MODELS = ["qwen-flash", "qwen-plus", "qwen3.8-flash", "qwen3.8-max-0902"]; /* 2026-10-18（Phil）：便宜快模型排默认位 */

  function cfg() {
    var s = Store.getSettings() || {};
    var c = s.llm || {};
    var cl = s.cloud || {};
    if (!c.proxyUrl && cl.proxyUrl) { c.proxyUrl = cl.proxyUrl; c.token = cl.token; }
    return c;
  }

  /* 参数红线（2026-10-14 真实反馈修复）：业务员实测 AI 会编造产品参数
     （客户问产品要素，AI 自己编出"20-30km 续航/USB/TSA 锁"，而公司实际做的是通品）。
     规则随每次生成注入系统提示，优先级高于所有其他要求。 */
  function factRule(hasDocs) {
    var s = "\n【参数红线（最高优先级，压过其他所有要求）】";
    s += "\n1. 产品参数（续航/电池/充电/认证/重量/容量/MOQ/价格/产能/交货期等）只能引用【资料】或客户档案/长期记忆里明确写过的内容。";
    s += "\n2. 资料与档案里没写明的参数：禁止写任何具体数值，禁止编造认证、奖项、合作客户、成立年份。只允许三种处理：①不提该参数；②反问客户他需要什么规格/数量；③说\"具体参数需与研发/QC 确认后发你\"。";
    s += "\n3. 币种与状态卡优先（10/30 裁定）：客户档案/对话里已报给该客户的数字（样品价、运费、总额等）优先于资料的默认数字；档案写 RMB 就按 RMB 答、写 USD 就按 USD 答，严禁跨币种折算（RMB→USD 或反向自折合）。";
    if (!hasDocs) s += "\n4. 当前账号还没有上传任何训练资料：涉及具体产品参数时，一律用\"省略/反问/确认后回复\"，绝不允许用行业常见值填充。宁可回复短一点，也不准编。";
    return s;
  }

  /* ===== 2026-10-30 考题病灶修复：确定性闸门层（F1 局面路由 / F3 跟进钩子 / F4 后置校验） =====
     Prompt 层红线（CONCRETE/铁律）已有但靠模型自觉；10/29 考题 13 节点要求确定性闸门：
     F1 生成前机械判局面（棋谱 v11 十四局面识别行，机制同 U.stageScan），模型只用命中局面的招 → 治「招移植」；
     F3 跟进必须带新信息钩子，否则 HOLD → 治纯催问（Philip 9 次跟进 5 次纯问候的历史病灶）；
     F4 后置校验：数字白名单 + 红线词 + MOQ 共现 + ≥1,000 台档位措辞，命中打标拦截 → 治数字失配与作废数字复犯。 */
  var SITUATIONS = [
    { n: 14, name: "时间压力 / 急单", rx: /\bflight|leaving on|need it by|by (next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|can it (reach|arrive)[^.]{0,20}(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|how long it will take|when will.*arrive|urgent|asap/i },
    { n: 12, name: "大单 / 整柜", rx: /container|40hq|20gp|big order|full load|\b(4,?000|5,?000|10,?000)\s*units/i },
    { n: 9, name: "设计与合规冲突", rx: /battery cover|logo on the (wheels|bottom|frame)|change (the )?structure|replace (the )?battery|add (some )?decor|lighter (version|model|one)|reduce (the )?weight|make (it )?lighter/i },
    { n: 6, name: "客户在中国 / 有代理", rx: /i'?m (in|coming to|arriving) (china|guangzhou|shenzhen)|my agent|friend in (guangzhou|shenzhen)/i },
    { n: 7, name: "认证 / 资质 / 工厂核验", rx: /\bce\b|un38\.3|msds|reach|\bfcc\b|rohs|certific|factory or trading|are you (a )?factory/i },
    { n: 8, name: "定制色 / 变色款", rx: /photochromic|color.?chang|custom color/i },
    { n: 5, name: "样品费 / 运费争议", rx: /sample (fee|cost|price)|shipping (cost|fee|too expensive)|free sample|delivery free|shipping.*how much|how much.*shipping/i },
    { n: 3, name: "砍价 / 比价", rx: /too expensive|discount|best (price|rate)|lower (the )?price|price lower|another (supplier|factory)|similar rates|try to arrange|\$1[0-9]{2}\b|rmb\s*1[,.]?[0-9]{3}|\bcheaper\b|for less|why should i pay/i },
    { n: 4, name: "小量试单 / 砍 MOQ", rx: /start (small|with)|trial order|lower (the )?moq|small (quantity|batch|order)|first order/i },
    { n: 2, name: "OEM / 自有品牌", rx: /own (brand|luggage)|private label|\boem\b|my logo|our logo/i },
    { n: 11, name: "客户进展通报", rx: /new warehouse|exhibition|canton fair|fundrais|got married|my son|we (are |will )?(open|launch)/i },
    { n: 13, name: "关系升级", rx: /\bbro(ther)?\b|\bdear\b|my friend/i },
    { n: 1, name: "首询 / 即问价", rx: /how much|\bprice\b|\bmoq\b|quote|catalog(ue)?|enquir|interested in/i }
  ];
  function lastBuyerMsg(buyer) {
    var ms = ((buyer && buyer.messages) || []).filter(function (m) { return m.from === "buyer"; });
    return ms.length ? String(ms[ms.length - 1].text || "") : "";
  }
  function situationScan(buyer, text) {
    var isFollow = false;
    if (text == null) {
      var ms0 = (buyer.messages || []).filter(function (m) { return m.from === "buyer"; });
      var allMs = buyer.messages || [];
      var lastAny = allMs.length ? allMs[allMs.length - 1] : null;
      /* 客户无新消息、且对话最后一条是我方发的 = 跟进回合（2026-10-30 考题 N12 修复：
         原实现只认「客户从没发过消息」，真实跟进形态「我发过问候、客户沉默」被当普通回合漏掉） */
      if (ms0.length && lastAny && lastAny.from !== "buyer") isFollow = true;
      text = ms0.length ? String(ms0[ms0.length - 1].text || "") : "";
    }
    if (!String(text).trim() || isFollow) {
      /* 跟进回合：按沉默时长 + 状态卡分档（F3 触发条件） */
      var ms2 = (buyer.messages || []).filter(function (m) { return m.from === "buyer"; });
      var lastM = ms2.length ? ms2[ms2.length - 1] : null;
      var t0 = lastM ? Number(lastM.time || 0) : 0;
      var days = t0 ? (Date.now() - t0) / 864e5 : 7; /* 无时间戳按 7 天（温）处理，不误判冷 */
      var facts = (buyer.context || []).map(function (c) { return c.k + " " + c.v; }).join(" ") + " " + String(buyer.memory || "");
      if (/(sample|shipped|tracking|paid|payment|样品|付款)/i.test(facts) && days <= 3) return { n: null, follow: "hot", why: "样品/付款在途，客户沉默 " + Math.max(0, Math.round(days)) + " 天" };
      if (days > 14) return { n: null, follow: "cold", why: "客户超过 2 周无回复（" + Math.round(days) + " 天）" };
      return { n: null, follow: "warm", why: "客户 3–14 天无回复（" + Math.round(days) + " 天）" };
    }
    var hits = [];
    for (var i = 0; i < SITUATIONS.length; i++) if (SITUATIONS[i].rx.test(text)) hits.push(SITUATIONS[i]);
    if (!hits.length) return { n: null, why: "无硬信号" };
    return { n: hits[0].n, name: hits[0].name, all: hits.map(function (h) { return "局面 " + h.n; }).join("、") };
  }
  function scanLineOf(scan, buyer) { /* buyer（可选）：费用争议纪律行需读最近对话判「客户是否明确索要免费」 */
    if (!scan) return "";
    var s = "\n【机械扫描·局面路由（确定性硬信号，命中即成立）】";
    if (scan.follow) {
      s += "客户无新消息，本回合是跟进回合（" + scan.follow + "：" + scan.why + "）。";
      if (scan.follow === "cold") s += "冷线索纪律：人情关怀 + 恰好 1 条新信息，不推销；12 月底仍无回复 → 转冷归档，停止主动跟进（仅客户主动回复或新年/广交会等大节点唤醒）。";
      else if (scan.follow === "warm") s += "跟进节奏：1–2 周一次，必须带新信息。";
      else s += "热跟进：按状态卡阶段推进（报价→样品→付款→签收），1–2 天一次。";
      s += "【F3 铁律】草稿必须含 ≥1 条尚未发过的新信息（新素材/新认证/匿名案例/节点/新档位价）；纯催问（any update / just checking in / 还在吗）严格禁止；无可用新信息 → 3 条 text 一律 HOLD（今日不建议发 + 原因 + 下次触发条件建议）。每天最多 1 条跟进。";
      return s;
    }
    if (scan.n) {
      s += "命中" + scan.all + "，执行局面 " + scan.n + " · " + (scan.name || "") + " → 先判局面再出招：move 与 3 条建议必须全部取自该局面在棋谱里的打法与禁忌；严禁跨局面移植招式（如首询用跟进招、冷线索给降价、已决定才砍价用「一分不让」）。判定错误可以纠正，但必须在 blocker 里写明理由。";
      var cmpSig = /another (supplier|factory)|why should i (pay|buy)|selling similar|for less|\bcheaper\b|similar rates|competing|competitor/i.test(lastBuyerMsg(buyer));
      if (scan.n === 3 && cmpSig) s += " 本局面专业性立论（10/30 大哥裁定）＝讲得清「为什么别人的电动行李箱便宜、我们的贵」，从三个角度立论：① 产品不一样（按棋谱/资料给出与便宜货的本质区别，只引支撑立论的关键参数，不堆规格表）② 服务不一样（经销商在我们这得到别人给不到的服务，以资料为准）③ 服务态度和理念不一样（我们怎么做生意：负责、不空口承诺、主动提示风险、帮他想到他没想到的）。不只要守价、不要只说「我们质量好」。";
      if (scan.n === 14) s += " 时效局面纪律（棋谱局面 14 六步，逐条执行）：① 诚实说做不到什么（截止点/取件时间等事实）② 给可得的最优方案 ③ 去查去争最快的（快递/排产）④ 真实原因（不编）⑤ 流程压缩（把能并的并）⑥ 超额付出说出来（我多跑一趟/我盯到几点）；必须把决策点提前到「今天」；严禁承诺「某日一定到」或「放心」式拍胸脯，安抚类句式（放心/最高优先级/会持续更新）不算步骤完成。草稿必须引用状态卡里 [时效/快递/待办/已承诺] 字段的至少 2 条具体事实（取件截止点、运输天数、直送方式等）放在消息前段；状态卡有 [已承诺/大货] 字段的，本回合必须重申一遍（承诺是拿来兑现的，重提 = 可靠）。";
      var freeAsk = !!buyer && /(free\s+(shipping|delivery|sample)|delivery\s+free|no\s+(shipping|delivery)\s+(fee|cost)|make.{0,20}(delivery|shipping)\s+free)/i.test((buyer.messages || []).slice(-5).map(function (m) { return m.text; }).join(" "));
      if (scan.n === 5 || (scan.n === 14 && freeAsk)) s += " 费用争议纪律：客户明确索要免运费/免样品时，必须直接答「拒绝 + 实付成本理由」（运费是付给物流公司的实付成本，不能吸收），跳过客户的明确诉求 = 跑题；拒绝后立即给可执行替代（升级选项/大货抵扣等）。";
      return s;
    }
    s += "无局面硬信号命中 → 自行在棋谱里找局面；找不到就在 blocker 注明「棋谱无对应局面」。";
    return s;
  }
  var F4_CONSTANTS = [8.4, 93.6, 100, 15, 20, 22, 30, 36, 40, 50, 120, 130, 150, 200, 500, 1000, 899, 599.99, 222, 236, 215, 225, 210, 218, 205, 212, 10000, 100000, 299, 300, 699, 700, 999, 9.3]; /* 2026-10-30 考试复跑：补阶梯价四档数量边界（100–299/300–699/700–999）——标准档位表述，误拦 12 条「100–299 units」的根因；9.3=deck 市场均重（10/30 大哥裁定登记，N9 误拦修复） */
  function f4Numbers(text) {
    var out = [], m = String(text || "").match(/\d+(?:[.,]\d+)?/g) || [];
    for (var i = 0; i < m.length; i++) out.push(m[i].replace(/,/g, ""));
    return out;
  }
  /* 10/30 第九跑（N3「2×222=444」「444+100=544」根因修复）：透明算术检查——X 若可分解为 a±b/a×b
     且 a、b 均出现在草稿里（客户可当场验证算术）、且每个操作数真实（白名单/1–99/状态卡/对话）
     或本身再一层透明分解（两层封顶，防连环造数），则放行。不透明算术（操作数没写进草稿）仍拦。 */
  function arithSupported(x, text, supSet) {
    var tn = f4Numbers(text);
    var real = function (n) {
      if (F4_CONSTANTS.indexOf(n) >= 0) return true;
      if (Number.isInteger(n) && n >= 1 && n <= 99) return true;
      if (supSet.indexOf(String(n)) >= 0) return true;
      return false;
    };
    var cache = {};
    var oneStep = function (n) {
      if (cache[n] != null) return cache[n];
      if (real(n)) { cache[n] = true; return true; }
      for (var i = 0; i < tn.length; i++) for (var j = 0; j < tn.length; j++) {
        var a = Number(tn[i]), b = Number(tn[j]);
        if (!real(a) || !real(b)) continue;
        if (a + b === n || (a > b && a - b === n) || (a > 1 && b > 1 && a * b === n)) { cache[n] = true; return true; }
      }
      cache[n] = false; return false;
    };
    for (var i = 0; i < tn.length; i++) for (var j = 0; j < tn.length; j++) {
      var a = Number(tn[i]), b = Number(tn[j]);
      if (!oneStep(a) || !oneStep(b)) continue;
      if (a + b === x || (a > b && a - b === x) || (a > 1 && b > 1 && a * b === x)) return true;
    }
    return false;
  }
  function postcheck(text, buyer) {
    text = String(text || "");
    var blocks = [];
    var lastB = lastBuyerMsg(buyer);
    var support = (buyer.context || []).map(function (c) { return c.k + " " + c.v; }).join(" ") + " " + String(buyer.memory || "") + " " + (buyer.messages || []).slice(-5).map(function (m) { return m.text; }).join(" ");
    /* 1) 数字白名单：草稿里任何数字必须 ∈ 常量 / 1–99 普通计数 / 年份 / 状态卡 / 最近对话（含千分位写法），否则拦截 */
    var seen = {};
    var supSet = f4Numbers(support); /* 2026-10-30 考试复跑修复：tokenize 后精确匹配——原 indexOf 子串让 308 命中 "3,080" 前缀漏网（N5 失配根因） */
    f4Numbers(text).forEach(function (num) {
      if (seen[num]) return;
      seen[num] = 1;
      var v = Number(num);
      if (F4_CONSTANTS.indexOf(v) >= 0) return;
      if (v >= 2020 && v <= 2099) return;
      if (Number.isInteger(v) && v >= 1 && v <= 99) return;
      if (supSet.indexOf(num) >= 0) return;
      if (arithSupported(v, text, supSet)) return; /* 10/30 第九跑：透明算术派生数（见 arithSupported） */
      blocks.push({ why: "数字 " + num + " 不在事实源（白名单/状态卡/对话）" });
    });
    /* 2) 红线词表（上下文条件） */
    var B = [
      [/\bFOB\s*245\b|\b245\b\s*\/\s*unit/i, "FOB 245（作废数字）"],
      [/1[,.]?380|1[,.]?480/, "RMB 1,380/1,480（作废口头报价）"],
      [/8\.5\s?kg/i, "8.5 kg（旧错值，10/29 裁定 8.4）"],
      [/free\s+sample|free\s+shipping|free\s+tooling|no\s+(mold|tooling)\s+fee|mold\s+fee\s+is\s+free|sample.{0,20}is\s*free/i, "免费承诺红线（10/30 裁定：打样费客户承担；样品=100 台档价）"],
      [/make\s+it\s+lighter|lighter\s+version|can\s+make.{0,20}lighter/i, "承诺改轻（澳洲 7kg 红线）"]
    ];
    if (!/\bben\b/i.test(String(buyer.name || ""))) B.push([/\bsbi\s?paris\b|\bsbiparis\b|\bben\b/i, "他人客户名（保密红线）"]);
    for (var i = 0; i < B.length; i++) if (B[i][0].test(text)) blocks.push({ why: B[i][1] });
    var m7 = text.match(/[^.!?]{0,60}\b7(\.5)?\s?kg\b[^.!?]{0,60}/gi) || [];
    for (var m7i = 0; m7i < m7.length; m7i++) if (!/carry.?on|cabin|airline|limit|hand.?bag/i.test(m7[m7i])) { blocks.push({ why: "7 kg 当产品重量（只许用于航司手提限重语境）" }); break; }
    var lowPrice = (buyer.messages || []).slice(-5).some(function (m) { return m.from === "buyer" && /\$\s?\d{2,3}\b/.test(String(m.text || "")); });
    if (/\$130\b|USD\s*130\b/i.test(text) && !lowPrice) blocks.push({ why: "$130 = 竞品锚点，客户近期报过低价才可用，不主动提" });
    /* 3) 动作幻觉（F2）：完成态动作必须有状态卡/对话事实支撑，否则拦截 */
    if (/(i\s*(have|'ve)\s+sent|i\s+sent|we\s*(have|'ve)\s+sent|already\s+sent|already\s+shipped|(?:we|i)[^\n.!?]{0,30}?\bshipped\b|(?:we|i)\s*(have|'ve)\s+(prepared|made|set up)|successfully\s+delivered|confirmed\s+with\s+(the\s+)?courier|已发|已安排|已确认|已和快递确认)/i.test(text) && !/(sent|shipped|tracking|booked|arranged|已发|已安排|单号)/i.test(support)) { /* 支撑不含 prepared/已备：备样是内部动作，「已备」不得自动背书「已为你做成」（考试 N13A 陷阱） */
      blocks.push({ why: "动作幻觉：完成态动作无状态卡/对话事实支撑（F2，改提议态）" });
    }
    /* 4) MOQ 共现 */
    if (/photochromic|color.?chang/i.test(text) && /moq|minimum|order of/i.test(text) && !/200/.test(text) && !/100/.test(text)) blocks.push({ why: "变色款 MOQ 必须伴随 200（历史例外档案 100）" });
    if (/custom\s+color/i.test(text) && /moq|minimum/i.test(text) && !/500/.test(text)) blocks.push({ why: "定制色 MOQ 必须伴随 500" });
    if (/labeling|private\s+label/i.test(text) && /moq|minimum/i.test(text) && !/100/.test(text)) blocks.push({ why: "贴标 MOQ 必须伴随 100" });
    /* 5) ≥1,000 台档位措辞：深折价必须伴随「特殊优惠/负责人确认」 */
    if (/\b1[,.]?000\b|40hq|container/i.test(text)) {
      var pm = text.match(/\$(19[0-9]|20[0-4])\b|USD\s*(19[0-9]|20[0-4])\b|\b(19[0-9]|20[0-4])\s*\/?\s*unit/i) || [];
      if (pm.length && !/special offer|manager|confirm|apply/i.test(text)) blocks.push({ why: "1,000 台以上深折数必须伴随「特殊优惠/负责人确认」措辞" });
    }
    /* 6) F3 无钩子不发（确定性子集，2026-10-30 考试复跑补）：跟进回合（最后一条是我方）+ 客户沉默 >14 天（冷）
       + 草稿命中纯催问句式 → 拦截。F3 全量逻辑（必须含 ≥1 条未发过的新信息）靠 scanLine 提示词层执行，
       此处只拦确定性可判的「纯催问」（N12 漏网根因）。热/温跟进不受影响，误伤面最小。 */
    var allMsF = buyer.messages || [];
    var lastAnyF = allMsF.length ? allMsF[allMsF.length - 1] : null;
    if (lastAnyF && lastAnyF.from !== "buyer") {
      var msBF = allMsF.filter(function (m) { return m.from === "buyer"; });
      var tBF = msBF.length ? Number(msBF[msBF.length - 1].time || 0) : 0;
      var dF = tBF ? (Date.now() - tBF) / 864e5 : 0;
      if (dF > 14 && /\bany update\b|just checking in|just following up|\bstill there\b|any news|just wanted to check/i.test(text)) {
        blocks.push({ why: "纯催问（F3：冷线索跟进必须带 ≥1 条未发过的新信息，纯催问严格禁止）" });
      }
    }
    /* 7) 一客一档 MOQ（2026-10-30 考试 N10B 根因修复）：状态卡对该客户记了变色款 MOQ（Naseer 兑现 100 台 / 新客户 200 台）
       → 草稿出现变色 + 不同的 MOQ 数即拦截。每客口径以状态卡为唯一来源（不读客户消息，防对方报价数字污染）。 */
    var mctx2 = (buyer.context || []).map(function (c) { return c.k + " " + c.v; }).join(" ") + " " + String(buyer.memory || "");
    /* 变色词与数量之间的窗口含 +/、/;/标准色 等品类切换符 → 该数属于别的品类（如「标准色 50 台 + 变色款 200 台」），拒收。
       分两轮：先正向（变色词→数字，不吞变色词），后反向（数字→变色词）。两个正则都带 /g：while(exec) 靠 lastIndex 推进，漏 g 首个匹配被拒即死循环（10/30 实测） */
    var promMq = null, mmq;
    var mqFwd = /(?:photochromic|color.?chang(?:e|ing)?|变色)([^。;\n]{0,60}?)(\d{2,4})\s*(?:units?|台)/gi;
    while ((mmq = mqFwd.exec(mctx2)) !== null) {
      if (!/[+,、；,;]|standard|标准|另|other/i.test(mmq[1] || "")) {
        var pvq1 = Number(mmq[2]);
        if (pvq1 >= 20 && pvq1 <= 1000) { promMq = pvq1; break; }
      }
      if (mqFwd.lastIndex === mmq.index) mqFwd.lastIndex++;
    }
    if (promMq == null) {
      var mqRev = /(\d{2,4})\s*(?:units?|台)([^。;\n]{0,40}?)(?:photochromic|color.?chang(?:e|ing)?|变色)/gi;
      while ((mmq = mqRev.exec(mctx2)) !== null) {
        if (!/[+,、；,;]|standard|标准|另|other/i.test(mmq[2] || "")) {
          var pvq2 = Number(mmq[1]);
          if (pvq2 >= 20 && pvq2 <= 1000) { promMq = pvq2; break; }
        }
        if (mqRev.lastIndex === mmq.index) mqRev.lastIndex++;
      }
    }
    if (promMq != null && /photochromic|color.?chang(?:e|ing)?|变色/i.test(text)) {
      var dms2 = String(text).match(/\d{2,4}\s*(?:units?|台)/gi) || [];
      for (var mqI = 0; mqI < dms2.length; mqI++) {
        var dn2 = Number(String(dms2[mqI]).replace(/\D/g, ""));
        if (dn2 >= 20 && dn2 <= 1000 && dn2 !== promMq && dn2 !== 50) { /* 50 = 标准色台阶（考题集规定台阶数，与变色句同现合法）；变色款 50 台 MOQ 由规则 4 的 MOQ 共现拦截 */
          blocks.push({ why: "变色款 MOQ 与该客户口径不符（状态卡 " + promMq + " 台，一客一档）" });
          break;
        }
      }
    }
    /* 8) 跨币种替换（10/30 第九跑 N4 根因修复，参数红线 3 闸门化）：状态卡对该客户只报过一种币种，
       草稿却用另一种币种的价 = 状态卡数字被换币（客户报过 RMB 1,500，草稿用 USD 236 档价），拦截；
       状态卡两币种都在（如「USD 240 / RMB 1,580」）不触发。 */
    var rmbInCtx = /RMB\s*[\d,]+|\d[\d,]*\s*yuan\b/i.test(mctx2);
    var usdInCtx = /USD\s*[\d,]+|\$\s?\d{1,3}(?:,\d{3})+|\$\s?\d{2,4}\b/i.test(mctx2);
    if (rmbInCtx && !usdInCtx && /USD\s*[\d,]+|\$\s?\d{1,3}(?:,\d{3})+|\$\s?\d{2,4}\b/i.test(text)) blocks.push({ why: "跨币种替换：状态卡报 RMB（参数红线 3），草稿用 USD 价" });
    if (usdInCtx && !rmbInCtx && /RMB\s*[\d,]+|\d[\d,]*\s*yuan\b/i.test(text)) blocks.push({ why: "跨币种替换：状态卡报 USD（参数红线 3），草稿用 RMB 价" });
    return { ok: !blocks.length, blocks: blocks };
  }

  /* 团队公共资料注入（2026-10-15 P0 起由 FC 服务端完成）：
     资料正文对业务员保密（/shared 只回元数据），AI 生成时由 /llm 服务端直接注入
     最新 3 份团队资料（各 6000 字）+ 最新 3 份本人训练资料（各 3000 字）。
     前端不再拉取正文，因此这里不再有 _sharedCache/getSharedDocs。 */

  /* 团队话术剧本（2026-10-15）：业务员在客户页一步步发给客户的固定剧本。
     注入 AI 上下文的目的：AI 报价/介绍时与剧本口径一致，并知道哪些步已经发过（不重复整段发）。
     按客户产品线过滤（suitcase/pet/all），5 分钟缓存与公共资料同策略。 */
  var _scriptCache = { at: 0, docs: [] };
  function getSharedScripts() {
    var now = Date.now();
    if (now - _scriptCache.at < 5 * 60 * 1000) return Promise.resolve(_scriptCache.docs);
    if (!window.Sync || !Sync.enabled()) return Promise.resolve(_scriptCache.docs);
    return Sync.sharedAll().then(function (j) {
      _scriptCache = { at: Date.now(), docs: ((j && j.docs) || []).filter(function (d) { return d.type === "script"; }) };
      return _scriptCache.docs;
    }).catch(function () { return _scriptCache.docs; });
  }
  /* 2026-10-17 话术换版（五步→六步，插入「三 未报价收尾」）：docKey 变了，把旧 key 进度带到新 key。
     插入点在第 3 步，旧进度第 3 步起与新内容不对应 → cap=2（只认「一 开场/二 产品卖点」已发）。
     当天二次修正换版（标题改回「未报价收尾」、正文恢复原文弯引号）→ key 98ba0e2f 也视为旧 key，多个旧 key 取 max。
     业务员在新版再发任一步后，新 key 进度接管，旧 key 数据自然失效。
      2026-10-20 第四步文案更新（价格/颜色 MOQ 调整）+ 乱码修复换版 → 16722a14。
      10-20 夜间乱码排查核实：云端现行 key 为 f0daad5c（内容与 16722a14 完全一致，均为新第四步干净文本）
      → 全部旧 key 改指向 f0daad5c：f47eb318/98ba0e2f cap=2（插入位移）；31eedc36 cap=3（第四步文案分歧）；
      369246e3/16722a14 cap=6（内容一致）。 */
   /* 2026-10-21 第四次换版：第四步颜色 MOQ 统一 500 台（Phil 最终定夺；感光变色款与定制色同为 500 台，1,000/100 口径均作废）。
      第四步正文变化 → 所有历史 key 一律 cap=3（一/二/三 三步已发仍算数，第四步起需按新文案重发）。 */
   /* 2026-10-28 第五次换版：变色款对外起订 500 → 200 台（Phil 补充表裁定；定制色维持 500）。
       第四步正文再次变化 → 全部历史 key（含 ca06b323 / e5645418）指向 75ecc8d1，cap 维持原值（cap=2 的两把保持 2）。 */
    /* 2026-10-29 第六次换版：第四步 MOQ 定制细化（灯条 logo 50 台 / 贴标 100 台，Phil 裁定）→ 全部历史 key（含 75ecc8d1）指向 a2ae39b8，cap 维持原值。 */
   var SCRIPT_KEY_MIGRATION = { "f47eb318-mvazd29i": { to: "a2ae39b8-mvtdwpnl", cap: 2 }, "98ba0e2f-mvc6rf66": { to: "a2ae39b8-mvtdwpnl", cap: 2 }, "31eedc36-mvc6xdi7": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "369246e3-mvg5888z": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "16722a14-mvga8l75": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "f0daad5c-mvgbye8l": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "ca06b323-mvj32bx1": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "e5645418-mvszfxn9": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "75ecc8d1-mvszghst": { to: "a2ae39b8-mvtdwpnl", cap: 3 } };
  function scriptProgOf(buyer, d) {
    var prog = buyer.scriptProg || {};
    var p = Number(prog[d.key] || 0);
    if (!p) {
      for (var ok in SCRIPT_KEY_MIGRATION) {
        if (SCRIPT_KEY_MIGRATION[ok].to === d.key) p = Math.max(p, Math.min(Number(prog[ok] || 0), SCRIPT_KEY_MIGRATION[ok].cap));
      }
    }
    return Math.min(p, d.steps.length);
  }
  function scriptLine(buyer) {
    return getSharedScripts().then(function (docs) {
      var line = ["suitcase", "pet", "all"].indexOf(buyer.scope) >= 0 ? buyer.scope : "all";
      /* 通用客户（或未设产品线）→ 全部剧本；指定产品线 → 该产品线 + 通用 */
      var hits = docs.filter(function (d) { return line === "all" || d.scope === "all" || d.scope === line; });
      if (!hits.length) return "";
      var parts = [];
      for (var i = 0; i < hits.length; i++) {
        var d = hits[i];
        if (!d.steps || !d.steps.length) continue;
        var sent = scriptProgOf(buyer, d);
        var s = "\n【团队话术剧本·" + (d.name || "剧本") + "（已发 " + sent + "/" + d.steps.length + " 步）】\n";
        for (var k = 0; k < d.steps.length; k++) {
          s += (k + 1) + ". " + (d.steps[k].title || "") + (k < sent ? "（已发）" : "") + "：\n" + String(d.steps[k].text || "") + "\n";
        }
        parts.push(s);
      }
      if (!parts.length) return "";
      var s2 = parts.join("");
      if (s2.length > 6000) s2 = s2.slice(0, 6000) + "\n（剧本过长已截断，以档案与资料为准）";
      return s2 + "\n与客户沟通时，产品参数/价格/MOQ 必须与上述团队话术剧本保持一致，不得另报；已标记（已发）的步骤不要整段重发，只针对客户当前的问题回答。\n";
    });
  }

  /* 训练资料注入（2026-10-15 P0 改版）：
     · 云代理模式：资料全部由 FC 服务端注入（/llm 内 buildDocsBlock），前端不拉正文、不拼提示词
     · 本地直连模式（个人 Key）：只能附"本人"训练资料（自己的数据，无保密问题）；
       团队资料不在此模式可用（正文保密规则） */
  function withDocs(system) {
    var c = cfg();
    if (c && c.proxyUrl) return Promise.resolve(system);
    var p = Store.getPersona ? Store.getPersona() : null;
    var docs = (p && p.docs) || [];
    docs = docs.slice().sort(function (a, b) { return String(b.updated || "") > String(a.updated || "") ? 1 : -1; }).slice(0, 3);
    var hasPersonal = docs.length && window.Sync && Sync.enabled();
    if (!hasPersonal) return Promise.resolve(system);
    return Promise.all(docs.map(function (d) {
      return (d && d.content != null ? Promise.resolve(d.content) : Sync.docFetch(d.key))
        .then(function (v) { return String((v && v.content) || "").slice(0, 3000); })
        .catch(function () { return ""; });
    })).then(function (personal) {
      var out = "";
      for (var j2 = 0; j2 < docs.length; j2++) {
        if (personal[j2]) out += "\n【资料·" + (docs[j2].name || "文件") + "】\n" + personal[j2];
      }
      return system + out + factRule(out.length > 0);
    });
  }

  /* 完整系统提示 = 档案上下文 + 资料 + 参数红线 + 团队话术剧本 */
  function fullSystem(buyer) {
    return withDocs(ctx(buyer)).then(function (sys) {
      return scriptLine(buyer).then(function (sl) { return sys + sl; });
    });
  }

  function chat(system, user, opt) {
    opt = opt || {};
    var c = cfg();
    if (!c || !(c.key || c.proxyUrl)) return Promise.reject(new Error("LLM 未配置（设置里填 Key 或云代理地址）"));
    /* 2026-10-18（Phil 成本指令："目前暂时不要用贵的"）：全部 AI 调用走便宜快模型 qwen-flash，
       期间忽略设置里选中的模型（防手机已存过 qwen-plus 继续走贵的）。
       恢复贵模型时改回：opt.model || c.model || "qwen-plus" */
    var model0 = opt.model || "qwen-flash";
    function one(model) {
    var payload = {
      model: model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: opt.temp != null ? opt.temp : 0.4,
      max_tokens: opt.max_tokens || 600
    };
    if (c.proxyUrl) {
      var proxy = c.proxyUrl.replace(/\/+$/, "") + "/llm";
      var pheaders = { "Content-Type": "application/json" };
      var _ddau = window.Auth && Auth.get();
      if (_ddau && _ddau.session) pheaders["x-dealdesk-session"] = _ddau.session;
       /* 2026-10-16：把当前客户的产品线传给服务端，团队资料按线注入（行李箱客户不吃宠物资料） */
       if (opt.scope) pheaders["x-dealdesk-scope"] = opt.scope;
       /* 2026-10-18（Phil）：翻译等轻量调用跳过服务端资料注入（prompt 数万字符→百余字符，目标 2 秒内出译文）；
          旧版 FC 不识别该头会忽略，无副作用 */
       if (opt.nodocs) pheaders["x-dealdesk-nodocs"] = "1";
      var useStream = !!opt.onChunk;
      if (useStream) payload.stream = true;
      function streamParse(resp) {
        /* 读 DashScope SSE：每包 data: {"choices":[{"delta":{"content":"..."}}]}；累计全文并逐包上报 onChunk */
        var reader = resp.body.getReader();
        var dec = new TextDecoder("utf-8");
        var buf = "", full = "";
        function pump() {
          return reader.read().then(function (p) {
            if (p.done) return full;
            buf += dec.decode(p.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop() || "";
            for (var i = 0; i < lines.length; i++) {
              var ln = lines[i].replace(/^\s+/, "");
              if (ln.indexOf("data:") !== 0) continue;
              var data = ln.slice(5).replace(/^\s+/, "");
              if (data === "[DONE]") continue;
              try {
                var sj = JSON.parse(data);
                var d = sj.choices && sj.choices[0] && sj.choices[0].delta && sj.choices[0].delta.content;
                if (d) { full += d; opt.onChunk(full, d); }
              } catch (e) { /* 半包，等下一段拼齐 */ }
            }
            return pump();
          });
        }
        return pump();
      }
      return fetch(proxy, { method: "POST", headers: pheaders, body: JSON.stringify(payload) })
        .then(function (r) {
          var ct = String(r.headers.get("content-type") || "");
          if (useStream && r.ok && ct.indexOf("text/event-stream") >= 0) return streamParse(r);
          /* 非流式，或服务端未走流式（降级）：整包 JSON */
          return r.text().then(function (t) {
            if (!r.ok) throw new Error("API " + r.status + "：" + t.slice(0, 160));
            var j = JSON.parse(t);
            if (j.error) throw new Error(j.error);
            var content = j.content || "";
            if (useStream && content) opt.onChunk(content, content);
            return content;
          });
        });
    }
    return fetch(c.baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.key },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error("API " + r.status + "：" + t.slice(0, 160));
        var j = JSON.parse(t);
        return (j.choices && j.choices[0] && j.choices[0].message.content) || "";
      });
    });
    }
    /* 2026-10-18：快模型（qwen-flash）在当前端点不可用（404/未开通/403）时自动降级主模型，不阻塞业务员 */
    return one(model0).catch(function (e) {
      if (opt.fallbackModel && /404|403|not exist|denied|model/i.test(String((e && e.message) || e))) return one(opt.fallbackModel);
      throw e;
    });
  }

  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) {}
    var m = String(text).match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }

  /* 该业务员自己训练的个人风格：AI 生成回复/翻译时贴近她的思路和常用话术（按账号隔离，互不串味） */
  function personaLine() {
    var p = (window.Store && Store.getPersona) ? Store.getPersona() : null;
    if (!p || (!p.thoughts && !p.scripts)) return "";
    var s = "\n本账号业务员的个人风格（生成内容必须贴近这种思路与语气，不要套用别的风格）：";
    if (p.thoughts) s += "\n谈单思路：" + p.thoughts;
    if (p.scripts) s += "\n常用话术/语气示例：" + p.scripts;
    return s;
  }

  function ctx(buyer) {
    var last5 = (buyer.messages || []).slice(-5).map(function (m) {
      return (m.from === "me" ? "卖家" : "客户") + "：" + m.text;
    }).join("\n");
    /* 显式负信息：档案没记录认证时写出来，防模型"做欧洲市场→肯定有CE"式推理幻觉 */
    var hasCert = (buyer.context || []).some(function (c) {
      return /认证|证书|检测报告|test report|\bCE\b|RoHS|REACH|\bUL\b|FDA|UKCA/i.test(String(c.k) + String(c.v));
    });
    var certNeg = hasCert ? "" : "；认证/检测报告=档案未记录，即状态未知：声称\"有\"和断言\"肯定没有\"都禁止，唯一允许的说法是\"让 QC 核实状态后回你\"";
    /* v1.2.12「读→定」：最近一次态势研判进简报，suggest/expand/localize/extract 全部吃到 */
    var readLine = (buyer.lastRead && buyer.lastRead.posture)
      ? "\n最近研判：" + buyer.lastRead.posture +
        (buyer.lastRead.concern ? "｜在意：" + buyer.lastRead.concern : "") +
        (buyer.lastRead.warm && buyer.lastRead.warm !== "持平" ? "｜温度：" + buyer.lastRead.warm : "") +
        (buyer.lastRead.evidence ? "｜依据：「" + buyer.lastRead.evidence + "」" : "")
      : "";
    return "客户：" + buyer.name + "（" + buyer.country + "，" + buyer.company + "）" +
      "｜谈单阶段：" + Mock.STAGES[buyer.stage] + "｜意向分：" + buyer.intent + readLine +
      "\n档案：" + (buyer.context || []).map(function (c) { return c.k + "=" + c.v; }).join("；") + certNeg +
      (buyer.profile ? "\n国家画像：" + buyer.profile.address + " / " + buyer.profile.style : "") +
       (buyer.memory ? "\n客户长期记忆（来自导入的过往聊天记录总结，重要背景，回答涉及这些话题时必须一致）：" + buyer.memory.slice(0, 800) : "") +
      "\n最近对话：\n" + last5 + personaLine();
  }

  /* ===== F5 语言闸门（2026-10-30 Phil「选了葡萄牙语依然出英语」·整个修复） =====
     提示词铁律A 只"要求"目标语言，模型被英语对话史+英语回合底稿锚住会照吐英语，
     而旧纠正只查中文泄漏——英语输出无声通过。现加机械闸门：
     ① 确定性检测：目标非英语而输出是英语（无变音符号+英语功能词≥2）/ 目标文字系统缺失（日韩俄阿土）
     ② 命中 → 强纠正重试一次（对话与底稿逐句翻译成目标语言）
     ③ 仍错 → suggest/expand 打 ⛔ 标（人工改完再发）、localize 显式报错——绝不静默放行英语 */
  var LATIN_DIACRITICS = /[àáâãäçèéêëìíîïðñòóôõöøùúûüýœ]/;
  var EN_FUNC = /\b(the|you|your|we|our|is|are|was|were|for|with|can|will|would|that|this|these|it|its|if|not|please|thank|thanks|hello|ok|okay|fine|good|sure|right|now|price|units?|order|sample|factory|shipping|delivery|product|start|need|want|get)\b/i;
  function isEnglishLike(t) {
    t = String(t || "");
    if (!/[a-zA-Z]/.test(t)) return false;
    if (LATIN_DIACRITICS.test(t)) return false; /* 带变音符号 ≠ 纯英语 */
    var hits = t.match(new RegExp(EN_FUNC.source, "gi")) || [];
    return hits.length >= 2; /* 阈值 2：单词误伤（如葡语里的 "ok"）不算英语 */
  }
  function wrongLang(text, target) {
    target = String(target || "").replace(/（[^）]*）/g, ""); /* 归一：葡萄牙语（巴西）→ 葡萄牙语 */
    if (!target || target === "英语") return false; /* 英语=兜底语言，不拦 */
    var t = String(text || "");
    if (!t.trim()) return false;
    if (isEnglishLike(t)) return true; /* 目标非英语却输出英语——Phil 实锤场景（含目标中文出英语） */
    if (target === "日语" && !/[\u3040-\u30ff]/.test(t)) return true;
    if (target === "韩语" && !/[\uac00-\ud7a3]/.test(t)) return true;
    if (target === "阿拉伯语" && !/[\u0600-\u06ff]/.test(t)) return true;
    if (target === "俄语" && !/[\u0400-\u04ff]/.test(t)) return true;
    if (target === "土耳其语" && !/[ığşöüİĞŞ]/.test(t)) return true;
    return false; /* 西/法/德/意：拉丁语系互混无法机械区分，isEnglishLike 是主闸 */
  }

  window.LLM = {
    MODELS: MODELS,
    chat: chat, /* 2026-10-17 导出：供 FB 表单识别等轻量结构化任务复用 */
    wrongLang: wrongLang, /* 2026-10-30 导出：F5 语言闸门，测试回归用 */
    isEnglishLike: isEnglishLike,
    situationScan: situationScan, /* 2026-10-30 导出：考试回归用（F1 局面路由） */
    scanLineOf: scanLineOf, /* 2026-10-30 导出：考试回归用（F1 扫描行文本） */
    postcheck: postcheck, /* 2026-10-30 导出：考试回归用（F4 后置校验） */
    F4_CONSTANTS: F4_CONSTANTS, /* 2026-10-30 导出：考试数字对账用（同一份白名单常量） */
    arithSupported: arithSupported, /* 10/30 第九跑导出：考试 ③ 同口径透明算术 */
    configured: function () {
      var c = cfg();
      return !!(c && ((c.key && c.baseUrl) || c.proxyUrl));
    },
    test: function () {
      var c = cfg();
      if (!c || !(c.key || c.proxyUrl)) return Promise.reject(new Error("请先填写 API Key 或云代理地址"));
      return chat("你是测试助手。", "Reply with the single word OK.", { max_tokens: 8, model: c.model });
    },
      translate: function (text, buyer) {
       /* 2026-10-18（Phil）：「记一条」中文对照 ~1 秒内 —— 轻系统提示（纯翻译不需要档案/剧本上下文）
          + nodocs 跳过服务端资料注入 + qwen-flash（热态实测 0.75-0.77s）。
          Phil 成本指令：暂时不用贵模型 → 快模型不可用不再静默降级 qwen-plus，直接报错（autoZh 弹 toast，业务员看得见） */
       /* 2026-10-19：中英混合输入（客户信息表单/带中文标注）也要译——保留中文原样、只译外文部分 */
       return chat("你是外贸翻译。把客户消息译成自然的商务中文：数字、品牌名、型号、证书名、货币单位保留原文；过度客套可简化；若消息里已含中文，保留中文原样、只把外文部分译成中文；不要解释，只输出一个 JSON：{\"zh\":\"译文\"}", String(text || ""), { max_tokens: 2500, temp: 0.2, nodocs: true, model: "qwen-flash" })
        .then(function (t) {
          var o = parseJSON(t);
          if (o && o.zh) return String(o.zh);
          /* 2026-10-19（Phil「返回空译文」截图定位）：长消息译文被 max_tokens=300 截断 → JSON 不完整 → 解析为空 → 报"空译文"。
             上限已提至 2500；这里再做截断容错：被截断/被代码围栏包裹/纯文本时尽力提取，长译文中途截断也比整条报错强 */
          var s = String(t || "").replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
          var m = s.match(/"zh"\s*:\s*"/);
          if (m) {
            var rest = s.slice(m.index + m[0].length);
            var q = rest.lastIndexOf('"');
            if (q >= 0) rest = rest.slice(0, q);
            rest = rest.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
            if (rest) return rest;
          }
          return /[一-龥]/.test(s) ? s : null;
        });
    },
      extract: function (text, buyer) {
      return fullSystem(buyer).then(function (sys) {
        return chat(sys, Prompts.extract + "\n\n消息：" + text, { max_tokens: 400, temp: 0.2, scope: buyer.scope });
      }).then(function (t) {
        var o = parseJSON(t);
        return (o && o.fields) || [];
      });
    },
    /* v1.2.12「读」：原 intentDelta 升级为态势研判。delta 兼容原意向分管线；
       nodocs＝读只看客户原话和档案简报，跳过服务端资料注入（省一整轮 bundle 注入的延迟与费用） */
    readMsg: function (text, buyer) {
      /* 2026-10-22（阶段严格判定）：机械硬信号先确定性扫描一遍注入提示词——
         信号命中时 AI 不得低于命中档（除非写明理由），防止"表面读"漏掉硬事实 */
      var scan = (window.U && U.stageScan) ? U.stageScan(buyer, text) : null;
      var scanLine = scan
        ? "\n机械扫描（确定性硬信号，命中即成立）：" + scan.why + " → 阶段 " + scan.to + (scan.to >= 5 ? "（成交信号，stage 给 5，等待人工确认标记）" : "")
        : "\n机械扫描：无阶段硬信号（阶段判定纯靠消息事实）。";
      return chat(ctx(buyer), Prompts.read + scanLine + "\n\n消息：" + text, { max_tokens: 260, temp: 0.2, nodocs: true })
        .then(function (t) {
          var o = parseJSON(t);
          if (!o || typeof o.delta !== "number") return null;
          o.delta = Math.max(-15, Math.min(15, Math.round(o.delta)));
          var POST = { "砍价": 1, "比价": 1, "拖延": 1, "试探": 1, "推进": 1, "追问": 1, "正常": 1 };
          var WARM = { "升温": 1, "持平": 1, "降温": 1 };
          if (!POST[o.posture]) o.posture = "";
          if (!WARM[o.warm]) o.warm = "";
          o.reason = String(o.reason || "").slice(0, 16);
          o.concern = String(o.concern || "").slice(0, 24);
          o.evidence = String(o.evidence || "").slice(0, 40);
          /* stage：null=无阶段证据；只收 0-5 整数，越界/非数字一律当 null（宁缺毋滥） */
          o.stage = (o.stage === null || o.stage === "" || o.stage === "null") ? null : Math.round(Number(o.stage));
          if (o.stage === null || isNaN(o.stage) || o.stage < 0 || o.stage > 5) o.stage = null;
          o.stageWhy = String(o.stageWhy || "").slice(0, 16);
          return o;
        });
    },
     /* onChunk（可选）：流式生成时逐包回调（full, delta）；AI 代写「重新生成」用它做打字机预览 */
     suggest: function (buyer, onChunk) {
       var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(buyer) : "英语";
      var needForeign = lang !== "中文";
      function hasCjk(s) { return /[一-龥]/.test(String(s || "")); }
      function leak(list) {
        if (!needForeign || !list) return false;
        for (var i = 0; i < list.length; i++) if (hasCjk(list[i].text)) return true;
        return false;
      }
      function parse(t) {
        var o = parseJSON(t);
        return { diagnosis: (o && o.diagnosis) || null, list: (o && o.suggestions) || null };
      }
       function call(promptText) {
          /* temp 0.25：编造认证/年份类红线比多样性更要紧，压低随机性；
             max_tokens 1300→900（2026-10-14 提速）：3 条≤50词+诊断实际用不到 1300，砍掉无效尾段 */
          return fullSystem(buyer).then(function (sys) {
            /* F1（2026-10-30）：局面路由——生成前确定性扫描，命中局面只许用该局面的招 */
            return chat(sys + scanLineOf(situationScan(buyer, null), buyer), promptText, { max_tokens: 900, temp: 0.25, onChunk: onChunk, scope: buyer.scope });
          }).then(function (t) {
            var r = parse(t);
            /* F4（2026-10-30）：后置校验——命中打标 blocked（UI 出原因，人工改后发） */
            if (r.list) for (var pi = 0; pi < r.list.length; pi++) {
              var pc = postcheck(r.list[pi].text, buyer);
              if (pc.blocks.length) { r.list[pi].blocked = true; r.list[pi].blockReasons = pc.blocks.map(function (x) { return x.why; }); }
            }
            return r;
          });
       }
       /* F5（2026-10-30）：语言闸门——中文泄漏与"该 X 语却出英语"同闸处理：
          命中强纠正重试一次；重试仍错 → 逐条打 ⛔ 标（界面出原因，人工改完再发），不静默放行 */
       function badReasons(list) {
         var r = [];
         if (leak(list)) r.push("text 字段出现了中文");
         if (list) for (var i = 0; i < list.length; i++) if (wrongLang(list[i].text, lang)) { r.push("输出仍是英语（应为" + lang + "）"); break; }
         return r;
       }
       return call(Prompts.suggest(buyer)).then(function (r) {
         var bad = badReasons(r.list);
         if (!bad.length) return r;
         return call(Prompts.suggest(buyer) + "\n\n[纠正] " + bad.join("，") + "，都是错误的。text 必须全部用" + lang + "书写——对话记录和底稿如果是英语，必须逐句翻译成" + lang + "再改写，严禁保留任何英语句子；只有 zh 字段允许中文。").then(function (r2) {
           if (r2 && r2.list) for (var i = 0; i < r2.list.length; i++) {
             var it = r2.list[i];
             var probs = [];
             if (leak([it])) probs.push("含中文");
             if (wrongLang(it.text, lang)) probs.push("仍是英语（应" + lang + "）");
             if (probs.length) { it.blocked = true; it.blockReasons = (it.blockReasons || []).concat(probs); }
           }
           return r2;
         });
       });
    },
    localize: function (text, buyer) {
      var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(buyer) : "英语";
      var needForeign = lang !== "中文";
      var user = Prompts.localize(buyer) + "\n\n中文原文：" + text;
      /* F5（2026-10-30）：直译也过语言闸门——仍错显式报错（toast 出原因），不静默给英语 */
      function settled(t) {
        if (needForeign && /[一-龥]/.test(String(t || ""))) throw new Error("语言未生效：译文含中文（目标" + lang + "）");
        if (wrongLang(t, lang)) throw new Error("语言未生效：输出仍是英语（目标" + lang + "），点重试或换按意图扩充");
        return t;
      }
      return fullSystem(buyer).then(function (sys) {
        return chat(sys, user, { max_tokens: 400, temp: 0.3, scope: buyer.scope })
          .then(function (t) {
            try { return settled(t); } catch (e) {
              var why = String(e.message).indexOf("含中文") >= 0 ? "上一次输出含中文" : "上一次输出仍是英语";
              return chat(sys, Prompts.localize(buyer) + "\n\n【纠正】" + why + "，错误。正文必须全部用纯" + lang + "书写（英语上下文也要逐句转写成" + lang + "），不得出现中文。\n\n中文原文：" + text, { max_tokens: 400, temp: 0.2, scope: buyer.scope })
                .then(settled);
            }
          });
      });
    },
     /* 按意图扩充：返回 {text, zh}；F5 语言闸门——重试仍错打 wrongLang 标（界面红字，人工改完再发） */
     expand: function (text, buyer) {
       var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(buyer) : "英语";
       var needForeign = lang !== "中文";
       var base = Prompts.expand(buyer) + "\n\n卖家写的意图：" + text;
       function settle(o) {
         if (!o || !o.text) throw new Error("扩充结果无法解析");
         if (needForeign && /[一-龥]/.test(String(o.text))) throw new Error("含中文");
         if (wrongLang(o.text, lang)) throw new Error("仍是英语");
         return o;
       }
       return fullSystem(buyer).then(function (sys) {
         return chat(sys, base, { max_tokens: 500, temp: 0.4, scope: buyer.scope })
           .then(function (t) {
             var o = parseJSON(t);
             try { return settle(o); } catch (e1) {
               var why = String(e1.message) === "含中文" ? "上一次 text 字段含中文" : (String(e1.message) === "仍是英语" ? "上一次输出仍是英语" : "");
               if (!why) throw e1; /* 解析类错误不重试，直接抛 */
               return chat(sys, base + "\n\n【纠正】" + why + "，错误。text 必须全部用纯" + lang + "书写（英语上下文也要逐句转写成" + lang + "），只有 zh 允许中文。", { max_tokens: 500, temp: 0.2, scope: buyer.scope })
               .then(function (t2) {
                 var o2 = parseJSON(t2);
                 if (!o2 || !o2.text) throw new Error("扩充结果无法解析");
                 if (needForeign && /[一-龥]/.test(String(o2.text))) o2.wrongLang = "含中文";
                 else if (wrongLang(o2.text, lang)) o2.wrongLang = "仍是英语（应" + lang + "）";
                 return o2;
               });
             }
           });
       });
     }
  };
})();

