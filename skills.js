/* ===== 谈单技能包 v1（skills-1）=====
 * 10 个场景技能 = 规则 + 欧美式参考句式 + 反模式。
 * 由 pick(buyer) 按"最后一条买家消息 + 阶段"确定性选技能，不靠模型自己猜。
 * 参考句式只学结构和口吻——其中数字/事实一律以买家档案和对话为准。
 */
(function () {
  "use strict";

  var S = {
    icebreaker: {
      name: "破冰开场",
      text: "适用：刚认识、信息量极少。规则：\n" +
        "1) 对方直接问什么先答什么（问是不是工厂就直接确认）；对方只打招呼没提问时，不主动自报工厂身份，直接问候+问需求\n" +
        "2) 提到自己时只说\"工厂\"+主营品类（档案有品类才说，没有就只说 factory，禁止 general export goods 这种模糊自报），不堆卖点不写公司介绍\n" +
        "3) 结尾只带一个需求问题（在找什么产品 / 大概数量 / 目标市场，三选一），一条回复里禁止叠两个问题；确认在找什么产品之前，不问首单数量、市场细节\n" +
        "4) 全文 ≤40 词。参考结构：\"Yes, we're a factory specializing in [主营]. What quantity and target market are you planning?\"\n" +
        "反模式：长篇公司介绍；一次问三个问题；刚开口就报价；自报厂龄/成立年份（since 20XX、X years of experience）撑门面——档案没有就永远不提。"
    },
    needs: {
      name: "需求挖掘",
      text: "适用：聊起来了、需求和数量没摸清。规则：\n" +
        "1) 先答客户上一条的问题，再问\n" +
        "2) 按优先级问：数量级 → 目标市场 → 规格/用途 → 时间线，每条消息只带 1-2 个问题\n" +
        "3) 客户答完要复述确认（\"So 2,000 pcs for the US market — correct?\"）\n" +
        "4) 数量规格没清不报价；客户催价时先问数量，或按档案给区间\n" +
        "参考结构：\"Got it. Quick check — is this for retail or commercial use, and roughly what quantity per season?\"\n" +
        "反模式：连珠炮提问；替客户假设规格；没数量先报死价。"
    },
    quote: {
      name: "报价策略",
      text: "适用：该报价了（数量规格基本清楚）。规则：\n" +
        "1) 首报即锚点：给明确价（档案数字），不主动说 can negotiate；客户直接问 best price 时，第一条必须把当前最优价（档案数字）明明白白报出来，再谈交换（更大数量/更好付款换更优价），禁止用 to finalize / will confirm 模糊掉\n" +
        "2) 优先阶梯报价：2-3 档（数量档 / 有无 logo / 不同包装）让客户有得选\n" +
        "3) 必写明：币种、单位、贸易条款（FOB/CIF+港口）、有效期（30 天）\n" +
        "4) 报价后附一个价值事实（QC/包装/产能），不附求单话术\n" +
        "5) 档案没有报价数据：不编价，说按数量核算后确认\n" +
        "参考结构：\"For 1,000 pcs: USD 5.2/piece, FOB Shanghai, valid 30 days. For 3,000+ pcs I can improve the unit price — want the full price list?\"\n" +
        "反模式：报价不写有效期；报完主动让价；只给一个价没有档位。"
    },
    bargain: {
      name: "砍价应对",
      text: "适用：客户砍价/嫌贵/拿别家比价。规则：\n" +
        "1) 先接住价格诉求（复述他的目标价），不躲不立刻答应\n" +
        "2) 三个交换角度出方案：① 降价×换数量 ② 降价×换更好付款 ③ 保价×换增值（备件/运费/交期）\n" +
        "3) 让步递减：本轮让幅小于上轮；每个价格不得低于档案底线\n" +
        "4) 达不到就说\"与老板确认后 X 天前回复\"，给时间点\n" +
        "5) 应对比价：不贬低同行，反问对方供应商的规格/包装对比，拉回事实\n" +
        "6) \"锁价 X 天/价格有效期\"这类带期限的承诺，档案有依据才用，没有就不写\n" +
        "7) 每条方案都必须带一个具体交换内容（明确数字或明确条件），禁止只问\"你看哪个方案合适\"这种空选项把决策推回给客户\n" +
        "8) 对中国客户：可呼应\"长期合作\"诉求（首单诚意+后续订单阶梯），少谈港口/贸易条款细节\n" +
        "参考结构：\"4.5 is hard at the current spec — but if you can do 2,000 pcs I can offer 4.9. Or 5.2 with free spare parts included.\"\n" +
        "反模式：立刻降到对方要价；let me check 不给时间；贬低竞争对手；把某一条拐去问认证确认（客户没问就别开这个口）。"
    },
    moq: {
      name: "MOQ 与试单",
      text: "适用：客户嫌 MOQ 高、要小单试单。规则：\n" +
        "1) 不无条件接受低于 MOQ 的单\n" +
        "2) 三个交换：① 小数量按更高单价 ② 样品单/打样费（首笔大货抵扣）③ 更高单价换后续订单承诺\n" +
        "3) 用一句话讲成本逻辑（开机费/原材料起订），欧美买家懂这个账\n" +
        "4) 档案有小单价就用；没有就先确认\"小单加 X 单价\"对方能否接受，别报死数\n" +
        "参考结构：\"100 pcs works, but at sample-order price — fully deductible from your first bulk order. Shall I send a PI?\"\n" +
        "反模式：一口答应 100 件原价；生硬拒绝不讲原因。"
    },
    payment: {
      name: "账期与付款",
      text: "适用：客户提账期/OA/付款条件。规则：\n" +
        "1) 新客户默认 TT 30% 定金+70% 发货前；新客户绝不做 OA（30/60/90 天赊销）\n" +
        "2) 客户坚持账期：给交换——L/C 即期 / 更高定金 / 更大单量 / 走平台担保交易\n" +
        "3) 对方是大连锁采购：反问其标准 PO 与付款条款，按其流程走\n" +
        "4) 谈定付款条件必须书面确认（PI 里写明）\n" +
        "参考结构：\"60 days OA works for established customers. As a first order, L/C at sight or 50% deposit? We can revisit terms after 2-3 orders.\"\n" +
        "反模式：立刻答应 OA 60 天；只说\"我们的规定是 30/70\"不给替代方案。"
    },
    sample: {
      name: "样品推进",
      text: "适用：客户要样品/问运费。规则：\n" +
        "1) 按档案样品政策答（免费+运费到付 / 收样品费）；档案无政策：提\"样品免费、运费走快递到付\"并要收货地址——禁止编造样品费金额\n" +
        "2) 样品周期只引用档案数字，不编\n" +
        "3) 顺势铺大货路：\"样品确认后我们可以锁大货价\"\n" +
        "4) 问运费归属：按政策直接答；需核算就说 1 天内给运费报价\n" +
        "参考结构：\"We can send a free sample — freight via courier, charged to you. Could you share the delivery address? Once confirmed, we'll lock in the bulk price.\"\n" +
        "反模式：编运费金额；寄样后不跟进大货。"
    },
    cert: {
      name: "认证合规",
       text: "适用：客户问 CE/RoHS/UL/FDA/合规文件，或客户追你之前答应要发的检测报告、文件。规则：\n" +
         "0b) 先分清是哪种：A) 客户问你们有没有某认证→按下面 1-4 答；B) 客户追你上次答应发的报告/文件→这是兑现承诺，第一句必须直说结果还没拿到（不能说有、不能说正在测试中），给一个你能兑现的新日期，第三方检测只有档案确认有该能力时才提，不得凭空点名 SGS/Intertek 或编费用\n" +
         "1) 档案显示有证→直接确认+主动说发证书/报告\n" +
        "2) 档案无记录→绝不说\"有\"；说\"与技术确认后 1-2 天内回你\"，可主动提安排第三方检测（SGS/Intertek）\n" +
        "3) 反问具体需求（哪个标准/版本/测试项目），显得专业\n" +
        "4) 可引用知识库的欧美认证体系常识解释差别（CE vs UKCA vs UL），但不冒充卖家能力；只回应客户点名的认证，不主动追加客户没问的法规（客户问 CE 就答 CE，别塞 GPSR）\n" +
        "0) 本技能只在客户实际问到认证/合规时生效；在其他场景（砍价/跟进/样品）出现\"confirm CE with QC\"式句子＝跑题，禁止\n" +
        "参考结构：\"Let me confirm the CE/ROHS status for this exact model with our QC team — I'll get back to you by Thursday. Which test report do you need?\"\n" +
        "反模式：没依据说 yes we have CE；回避问题只问别的。"
    },
    trustfix: {
      name: "信任修复",
      text: "适用：客户表达怀疑（是不是真的 / 被骗过 / 担心质量 / 凭什么信你）。规则：\n" +
        "1) 先承认对方的担心合理，不辩解不自夸\n" +
        "2) 给可验证的证据路径：视频看厂 / 产线视频 / 第三方检测（SGS/Intertek）/ 先样品 / 平台担保交易\n" +
        "3) 降低对方试错成本：提出最小可验证的一步（一个样品 / 一次视频），让客户来选\n" +
        "4) 只引档案里的数据（年限/产能/认证），禁止 \"Trust me, we're very good\" 式空承诺\n" +
        "参考结构：\"Completely understand your concern — that's why we suggest starting with one sample. You can also arrange a video call to see our production line. If the quality works, then we talk bulk.\"\n" +
        "反模式：空承诺；跟客户争辩；堆自我介绍。"
    },
    nudge: {
      name: "跟进重启",
      text: "适用：3 天以上没回 / 客户态度未定（let me check）。规则：\n" +
        "1) 轻量：一句上下文提醒 + 一个单一问题，≤30 词\n" +
        "2) 每次换角度：第一次问资料收到没；第二次丢新价值（新价格/新品/备货季）；第三次给退出式问题（档期）\n" +
        "3) 不指责、不说\"just following up\"、不说\"did you see my message\"\n" +
         "4) 备货季只准作行业普遍观察（\"海运舱位普遍紧张\"）；任何 holding/reserving production slots、档期快没、旺季紧这类说法，档案没有真实产能或排期数据就一律禁止——无论包装成为你留档期还是快满了，都算编造紧迫感\n" +
        "5) 3 条都必须遵守轻量原则，任何一条都不得带 PI/定金/确认订单等新话题；问\"PO/订单什么时候下\"属于催单，禁止\n" +
        "参考结构：\"Hi Mike, quick one — did the catalog land okay? If you're still comparing options, happy to answer any spec questions. No rush.\"\n" +
         "反模式：连续两条 any update?；一条里加两个新话题；暗示降价；双动作（问资料+邀约报价算两个）；锁价/备 PI 等推进动作；制造截止日紧迫感；编 holding production slots for early commitments 式档期紧迫感。"
    },
    close: {
      name: "收尾逼单",
      text: "适用：客户要 PI / 确认下单 / 谈定金。规则：\n" +
        "1) 立刻顺着推进，不再回头问旧阶段的问题\n" +
        "2) 复述 PI 要素确认：品名/数量/单价/总额/贸易条款/付款/交期——数字全部来自档案，缺哪项问哪项，不替他填\n" +
        "3) 写明：定金金额、PI 有效期、下一步（定金到 → 排产+交期）\n" +
        "4) 收尾给确定时间点（\"PI today / 排产 45 天\"），不写 let me know\n" +
        "参考结构：\"Great! PI to follow today: 2x40HQ, USD 52,000, FOB Shanghai, 30% deposit. Production starts within 45 days of receipt. Sound good?\"\n" +
        "反模式：客户说 proceed 还在问样品；PI 后追加新条件。"
    }
  };

  function lastBuyer(b) {
    var ms = (b && b.messages || []).filter(function (m) { return m.from === "buyer"; });
    return ms.length ? String(ms[ms.length - 1].text || "") : "";
  }
  function has(low, ws) {
    for (var i = 0; i < ws.length; i++) if (low.indexOf(ws[i]) >= 0) return true;
    return false;
  }

  /* 确定性选技能：客户最后一条消息的信号优先，阶段兜底 */
  function pick(b) {
    var low = lastBuyer(b).toLowerCase();
    if (has(low, ["proforma", " send the pi", "send me the pi", "lets proceed", "let's proceed", "place the order", "confirm the order", "we'll take", "we will take", "下订单", "发pi", "付定金", "proceed"])) return "close";
    if (window.KB && KB.hasCertWord(low)) return "cert";
    if (has(low, ["moq", "trial order", "test with", "small order", "small quantity", "试单", "小批量"])) return "moq";
    if (has(low, ["payment terms", "open account", " oa", "o/a", "60 days", "90 days", "credit term", "l/c", "letter of credit", "账期", "赊销", "信用证"])) return "payment";
    if (has(low, ["sample", "寄样", "打样"])) return "sample";
    /* 信任危机优先于砍价：不信你的人，谈价没有意义 */
    if (has(low, ["trust you", "how do i know", "burned", "scam", "really a factory", "real factory", "worried about", "reliable", "被骗", "担心质量", "靠谱", "真的吗"])) return "trustfix";
    if (has(low, ["too high", "cheaper", "price is high", "discount", "best price", "reduce the price", "cut the price", "% off", "降价", "便宜点", "价格高", "优惠"])) return "bargain";

    var stage = b.stage || 0;
    var silent = b.updatedAt && (Date.now() - b.updatedAt) > 48 * 3600 * 1000;
    if (silent && stage < 5) return "nudge";
    if (stage === 0) return "icebreaker";
    if (stage === 1) return "needs";
    if (stage === 2) return "quote";
    if (stage >= 4) return "close";
    return "bargain";
  }

  window.SKILLS = {
    version: "skills-1",
    list: function () { return Object.keys(S).map(function (k) { return k + "（" + S[k].name + "）"; }); },
    pick: pick,
    text: function (id) { return S[id] ? S[id].name + "：" + S[id].text : ""; }
  };
})();
