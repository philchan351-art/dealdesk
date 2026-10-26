/* ===== 回合库 v1（Turn Library v1）· 2026-10-26 =====
 * 50 条真实回合：「客户一句 → 吴总一句 + 局面/隐藏目的/换种说法客户会怎样」。
 * 来源：11 个真实成交案例 + Amritpal 12 节点复盘（含老板 3 处红笔，verbatim 存 T01/T02/T03 redpen 字段作校准锚）。
 * 10 条样本经老板 2026-10-26 认可后入库。
 *
 * 注入规则（prompts.js suggest / review.html 同走）：
 *   · 确定性检索（kw 命中 + 阶段匹配）取最相似 ≤3 条真实回合作「底稿参考」
 *   · 只注入 position/stage/pattern/局面/隐藏目的/换种说法（pattern 内数字全是 [占位符]）
 *   · 不注入 buyer/wuzong_raw/redpen/flag——原话存档含案例专属数字（FOB 245、定制色 MOQ 1,000 等旧口径），
 *     注入会污染新客户底稿；业务事实单一来源 = 线上资料库（kb）+ 档案 + 对话
 *   · 检索无命中 → 强制在 diagnosis.blocker 尾标注「（回合库未命中·通用草案，请重点看）」
 */
(function () {
  "use strict";

  var TURNS = [
    { id: "T01", case: "Amritpal_澳洲_广交会", when: "10/21 03:03", stage: "首询", st: ["询盘"], position: "首询定性（B端/C端）",
      buyer: "How much for one",
      wuzong_raw: "你是自己用，还是做生意？",
      kw: ["how much for one","how much is one","price of one","how much is it","how much it is","price for one","cost of one","多少钱","怎么卖","单价多少"],
      pattern: "反问：'自己用，还是做生意？'——不报价、不报参数，只问一句",
      situation: "零售式问法，但他其实是跑展采购，身份还没暴露",
      hidden: "先定 B/C 端（自用=C、做生意=B）。这一问把'一个多少钱'改写成'样品单+批量价'，后面的 MOQ/阶梯价/样品抵货款才立得住",
      counterfactual: "直接报单价 → 他拿零售渠道价格比'一个多少钱'，对话锁死在零售价对比，进不了批量语境",
      redpen: "分析：是在判断是B端还是C端客户，所以这样问；如果是自己用就是C端，做生意就是B端；你的回答太啰嗦。",
      flag: "" },

    { id: "T02", case: "Amritpal_澳洲_广交会", when: "10/21 03:58-04:03", stage: "报价", st: ["报价","需求确认"], position: "报价三件套 + 位置一变整单重算",
      buyer: "At the moment as a sample / Right now im in china guangzhou",
      wuzong_raw: "澳洲 DDP $316（样品 $236 + 海运 $80，含税清关）· 零售 Amazon $599.99 · 海运比空运省；人在广州 → 直接送到酒店，总共 $240",
      kw: ["in china","in guangzhou","in shenzhen","guangzhou","canton fair","i'm in china","im in china","coming to china","in hangzhou","深圳","广州"],
      pattern: "三件套 = [落地总价](含税清关) + [零售锚点] + [更省方案]；位置一变 → 整单重算重新报，不是打折",
      situation: "他已接受'sample'框架，同时人在中国——运费结构整个变了",
      hidden: "①先给市场价/零售价让他知道产品定位——没有价格铺垫，'不收运费'是没感觉的；②捕捉'人在中国'→运费瞬间塌掉，立刻重算——去掉的是不存在的运费，不是让利",
      counterfactual: "只说'送到酒店、不收本地运费'（无锚点、无 DDP 基准）→ 客户没有省的感觉；沿用目的国 DDP 总价 → '人都在中国了还收国际运费？'",
      redpen: "分析：先告诉客户我们这个产品的市场价，澳洲的和零售价，让客户知道我们的产品定位；第二，捕捉到了客户在广州，因此瞬间抓住机会，运费很便宜；你的没有前面的价格的铺垫，直接说不收运费，客户是没感觉的。",
      flag: "" },

    { id: "T03", case: "Amritpal_澳洲_广交会", when: "10/21 04:03-04:09", stage: "信息包", st: ["询盘","报价","需求确认"], position: "'给我目录' = 要决策依据",
      buyer: "Ok / Send me a catalogue if possible please",
      wuzong_raw: "四连发：规格(93.6Wh可拆/8.4kg/120-150kg) + 6条卖点 + 价格/MOQ/颜色 + 零售参考价",
      kw: ["catalogue","catalog","price list","data sheet","datasheet","spec sheet","product sheet","brochure","目录","价目表","product details"],
      pattern: "不发 PDF；当前聊天渠道一次性给全：规格 + 卖点 + 完整价格/MOQ/颜色 + 零售参考价",
      situation: "'给目录' = 要决策依据，不是要收藏",
      hidden: "①客户现在基本不看邮箱，聊天渠道直发他才会看；②一次给全 = '我没有隐藏价'，挤牙膏会让人怀疑还有更低价；③不接'要不要确认样品'——不了解你的人和产品永远不会下单，接了就是废话",
      counterfactual: "'目录已发邮箱请查收' → 大概率没打开；挤牙膏式 → 怀疑隐藏价，或觉得'信息都没有，是不是有问题'",
      redpen: "分析：客户现在基本不收邮箱邮件了，通过whatsapp直接发给他产品资料，他会看，让他进一步了解产品；你的后一句…相当于废话，因为客户在不了解你和你产品的情况下，永远不会下订单。",
      flag: "" },

    { id: "T04", case: "Amritpal_澳洲_广交会", when: "10/21 18:09", stage: "执行", st: ["报价","样品确认"], position: "再问价格 + 暴露行程",
      buyer: "What will be the price if I order a sample here in guangzhou / Swissôtel, next 3 days at Canton Fair",
      wuzong_raw: "①诚实：广州没实体店，深圳有经销商 ②工厂直发酒店 ③$240 送到酒店 ④要收件人信息 ⑤问 RMB/USD ⑥预判：跑展会不会换酒店",
      kw: ["hotel","swisotel","my address","where can you send","deliver to","ship to my","canton fair","days in"],
      pattern: "诚实说没有的 → 立刻给替代（直发）→ 价格 + 收件人信息 + 币种问题 + 主动确认'不换酒店吧'",
      situation: "再确认价格 + 交代行程（酒店、广交会几天）——其实已决定，进入执行阶段",
      hidden: "展会买家行程快，地址变更=发错货高危，主动确认；先问币种 = 支付路径提前铺（币种→账户→户名→用途），省付款环节的往返",
      counterfactual: "不确认酒店 → 他换酒店，货发错，前面 24 小时的信任全废；不问币种 → 付款环节再多一个来回",
      redpen: "",
      flag: "" },

    { id: "T05", case: "Amritpal_澳洲_广交会", when: "10/21 20:45", stage: "执行", st: ["报价","谈判","样品确认"], position: "一口气连问 4 个",
      buyer: "I'll pay in rmb and how much / How this go in plane / We stay same hotel / Give me battery details",
      wuzong_raw: "先答钱：1,580 RMB（最急的放最前），再答登机，再答电池；颜色单独一条问",
      kw: ["how much","battery","plane","alipay","rmb","flight","pay","ship","hotel"],
      minHits: 3,
      pattern: "连发多问 → 按'他最急拍板的那条'排序，不按发送顺序——先答钱",
      situation: "多个问题 = 多个决策块，挡在他前面的是钱",
      hidden: "钱是主线，其余是信心补充；答了钱他才能动付款；反问'您考虑多少数量'（他已说过数量）= 用支线埋主线",
      counterfactual: "'Could you confirm the quantity first?'（AI 版）→ 他已经决定了，多一轮确认 = 拖延 = 他可能去看别家",
      redpen: "",
      flag: "" },

    { id: "T06", case: "Amritpal_澳洲_广交会", when: "10/22 01:49", stage: "砍价（已决定）", st: ["谈判"], position: "'I'll take N' + 'Will you negotiate'",
      buyer: "Will you negotiate / I'll take 2",
      wuzong_raw: "样品价按 MOQ 100 台价定的，单价不能谈；不过运费可更好 → 2 台 1,560/台共 3,120；再送'下次大货多 1 台抵样机'",
      kw: ["negotiate","i'll take","i will take","i want 2","i want 5","i want 10","let's do","let's make a deal","ready to order","i am ready","can you give me a discount","i'll buy","will you discount"],
      pattern: "已决定 + 要砍 → 单价不让（说清'按 MOQ 价定的'），让运费维度一点 + '下次大货 +1 台'锁下一单",
      situation: "客户报了数量 + 问'能谈吗' = 已决定，砍价是面子问题",
      hidden: "面子问题 → 不动价格主线（动了=打开'还能不能更低'的口子）；让非主体（运费）+ 给未来利益（大货抵）= 面子给足 + 下一单锁定",
      counterfactual: "立刻答应砍 → 价掉了，且他觉得本来就有水分；一口拒绝 → 面子挂不住，可能走人",
      redpen: "",
      flag: "" },

    { id: "T07", case: "Amritpal_澳洲_广交会", when: "10/22 01:56", stage: "砍价（已决定）", st: ["谈判"], position: "客户还价（给数字）",
      buyer: "Make 3000 for 2 please",
      wuzong_raw: "'各让一步' → 3,080（只让 1.3%），并给运费成本理由（浙江到广州约 200 元、24kg）",
      kw: ["how about ","can you do ","make 1","make 2","make 3","make 4","make 5","deal at","counter offer","final offer","split the difference","lower the price","reduce the price","% off"," off for","let's settle","i offer"],
      pattern: "还价 → 让幅 ≤ 对方要求的一半 + 物理理由（距离/重量/成本），不凭空让",
      situation: "他已从我们的报价还到更低的数字，在等我们让",
      hidden: "让得少才像'到底'；物理理由把'让步'变成算术题——他没法再往下压",
      counterfactual: "直接答应他的数字 → 下一轮他继续往下压；无理由地让 → 他理解为'本来就有水分'",
      redpen: "",
      flag: "" },

    { id: "T08", case: "Amritpal_澳洲_广交会", when: "10/22 02:09", stage: "交付与时间压力", st: ["样品确认","成交"], position: "期限压力（必须某日到）",
      buyer: "If you send now how long it will take / my friend leaves Sunday morning, bag arrives Saturday",
      wuzong_raw: "①诚实：今天发不了（快递 5 点已取件）②明天发→后天下午/最晚大后天早上 ③我去问最快快递 ④真实原因：广交会+双11次日达不可靠 ⑤建议今天就确认颜色、工厂直送快递站点 ⑥'工人快下班，我还要去仓库拿澳洲插头'",
      kw: ["how long","how soon","by friday","by saturday","by sunday","by tuesday","by monday","before my","deadline","flight","leaves sunday","leaving sunday","must arrive","urgent","when can you ship","i need it by"],
      pattern: "期限要求 → 诚实说做不到什么 + 真实原因 + 最快可执行方案 + 把决策点提前到'今天' + 主动想到他没说的（目的国插头）",
      situation: "限期必须到——这是'成不成'的节点",
      hidden: "全程不拍胸脯——可信度来自前面承认过多少次'不确定'；主动想到他没说的（当地插头/清关件）→ 信任峰值，他当场开始问付款",
      counterfactual: "'明天发快递，肯定到'（AI 版）→ 一旦翻车全单崩，且客户记住'这人会拍胸脯'",
      redpen: "",
      flag: "" },

    { id: "T09", case: "Amritpal_澳洲_广交会", when: "10/22 02:27", stage: "发货前纠错", st: ["样品确认","成交"], position: "客户点颜色（下单时）",
      buyer: "Okok send 2 silver color / And let me know if I alipay you",
      wuzong_raw: "发图指出'这是深灰不是银，第三个才是银'，确认后再发",
      kw: ["send 2","send the sample","color of the","colour of the","in silver","in grey","in gray","in black","silver color","grey color","gray color","black color","photochromic color","dark grey","dark gray"],
      pattern: "客户点颜色 → 先发图指出真实色差（哪个是哪个），确认后再发",
      situation: "他说的颜色名，和我们色卡里的实际颜色是两个东西",
      hidden: "发货前主动纠错 = 省一次售后；跑展/零售的人拿'看着像的'错色在他客户面前展示 = 我们丢脸",
      counterfactual: "照发 → 颜色错 + 退换 + 信任崩（展会场景尤其）",
      redpen: "",
      flag: "" },

    { id: "T10", case: "Amritpal_澳洲_广交会", when: "10/22 02:38", stage: "支付摩擦", st: ["样品确认","成交"], position: "收款户名引发 '?'",
      buyer: "?（看到收款户名'吴秋平'）",
      wuzong_raw: "不慌，一句话解释：银行转账要核对户名，复制粘贴即可；收款后主动汇报'已收到，等快递取件'",
      kw: ["account name","alipay","wechat pay","bank account","transfer to","payment account","收款","户名","rmb account","why the name","the name on the account"],
      pattern: "支付信息上的 '?' → 不慌、不过度解释，一句话（是什么 + 你做什么）；收款后立刻汇报",
      situation: "客户看到个人户名，'?' = 在核对，不是在质疑",
      hidden: "'?' 不是不信任；支付摩擦提前一步铺（币种→账户→户名→用途）；对一个字符的问题回一大段'官方解释' = 把核对变成审计",
      counterfactual: "'这是我们官方业务收款账户…需要的话我发公司注册或银行验证文件'（AI 版）→ 他只是核对一下，被你搞得像要审计",
      redpen: "",
      flag: "" },

    { id: "T11", case: "Amritpal_澳洲_广交会", when: "10/22 05:08", stage: "关系升级", st: ["成交"], position: "成交后纠正称呼",
      buyer: "（一路叫 brother）🤣 Wow / Didn't knew dear / Hi cherry How are you",
      wuzong_raw: "钱到账、货发出后，才说'我是女的，叫 Cherry'",
      kw: ["ok bro","dear","didn't knew","thank you so much","happy to work","great deal","how are you"],
      pattern: "关系升级（称呼纠正/自我暴露）放在成交之后，不放在成交之前——时机是全部",
      situation: "已成交（钱到、货发），信任在峰值",
      hidden: "成交前纠正 = 生分（谈单质感突然变了）；成交后纠正 = 变成玩笑，零成本升级关系称谓",
      counterfactual: "第一条消息就纠正 → 'brother'的信任质感没了，关系资产白放",
      redpen: "",
      flag: "" },

    { id: "T12", case: "Amritpal_澳洲_广交会", when: "10/21 20:45", stage: "执行", st: ["询盘","需求确认","报价"], position: "登机问题（自己带 vs 卖给别人）",
      buyer: "How this go in plane",
      wuzong_raw: "20 寸登机；部分航司 7kg 限重、超重拆电池托运；电池 93.6Wh<100Wh 可手提、可当充电宝；有 UN38.3/MSDS",
      kw: ["plane","airline","flight","carry on","carry-on","check in","checked bag","handbag","hand luggage","on board","board the","battery allowed","lithium","take it with","100wh"],
      pattern: "同题两局：'我自己带'→ 给登机细节（限重/拆电池/证书）；'我卖它、没说要带'→ 压缩成一句'这是品类第一道销售门槛，[电池Wh] 可拆能带上飞机，你可直接写进产品页'",
      situation: "这单他自己要带（朋友飞目的国），给细节合理",
      hidden: "C端局面 → 给对他个人有用的细节；B端局面 → 把规格翻译成他的销售素材，而不是让他背规则",
      counterfactual: "对纯 B 端卖家给全套登机手册 → 信息过载，'能卖'的部分被埋掉",
      redpen: "",
      flag: "" },

    { id: "T13", case: "Ben_Issia_Habib_法国", when: "7/29 01:50", stage: "首询", st: ["询盘","需求确认"], position: "大单首询（自报公司+数量+自有品牌）",
      buyer: "My name is Mr. Ben Issia, and I own the company SBI Paris; I am a wholesaler of suitcases and electric suitcases (branded SBIPARIS). I am interested in your products. I need 4,000 units",
      wuzong_raw: "We are glad to know you already have experience in the electric luggage market. Please feel free to send us the photos and videos you mentioned. We would like to understand your requirements better and see if we can provide the right solution for your SBI Paris brand. We can support OEM customizatio[…截断]",
      kw: ["i need","units","pieces","pcs of","container","wholesaler","we are a","we are importer","importer","distributor","i own the company","big order","interested in your products","monthly order"],
      pattern: "大单首询 → 先肯定他的行业经验 → 要他的资料（照片/视频）→ 确认支持 OEM；这一枪里不报价",
      situation: "他报的数量是柜级项目 + 自有品牌，但具体需求（logo 位、包装）还不清楚",
      hidden: "柜级项目先报价 = 白锁口径；先要他的资料 = 让他投入（发资料 = 他已经进了项目）",
      counterfactual: "直接报大数量价 → 他真实需求是'一部分我们品牌 + 一部分你的 logo'时，第一报价全白给，且价格锚低了",
      redpen: "",
      flag: "" },

    { id: "T14", case: "Ben_Issia_Habib_法国", when: "8/5 03:03-03:11", stage: "大单报价", st: ["需求确认","报价"], position: "柜级报价先问口径",
      buyer: "Please prepare a quote for me as soon as possible so I can place an order for a 40-foot container—the first of five scheduled for the year. I will pay 50% upfront, with the remaining 50% due before the goods are delivered to our freight forwarder in China.",
      wuzong_raw: "For your reference, a 40ft high cube container can load approximately 700–800 units, depending on the final packing arrangement. Could you please confirm whether you need the quotation based on EXW price or FOB price? Once we confirm the container type and price term, we will prepare the quotation for you accordingly.",
      kw: ["40ft","40 ft","40-foot","40hq","20ft","20 ft","20gp","high cube","how many can you load","container of","a container","full container","place an order"],
      pattern: "大单报价 → 先答事实（柜型装 [装柜量] 台）→ 反问口径（EXW 还是 FOB？）→ 口径统一后才报价",
      situation: "'一年的第一个柜' = 年度框架单，但 EXW/FOB 口径未定",
      hidden: "先拿口径再报 = 报价只出一次且准确；直接报一个口径但他要另一个，就要收回一条",
      counterfactual: "直接报一个价 → 口径不对，收回一条 = 专业度掉一条",
      redpen: "",
      flag: "她随后实际报的是柜级档价格，库内以 [阶梯价_大柜档] 占位，数值以资料库为准" },

    { id: "T15", case: "Ben_Issia_Habib_法国", when: "7/30 12:24", stage: "样品制作", st: ["样品确认","谈判"], position: "客户点头后要执行",
      buyer: "Please do the same. Thank you.（看完 logo mockup 后）",
      wuzong_raw: "OK, I will go to a printing shop to make the logo and apply it on the actual sample. Then I will send you a video so you can check the real effect.",
      kw: ["please do the same","go ahead","proceed","yes do","start the sample","make the sample","apply the logo","please arrange","do it"],
      pattern: "不说'好的我们做'→ 说具体动作路径（去哪做 → 做什么 → 发什么给他看）",
      situation: "他认可方向，在等执行",
      hidden: "动作路径可见 = 他知道我们在做什么；'发视频' = 他知道下一个交付物——两个承诺有时间轴",
      counterfactual: "'Noted, we will arrange it.' → 他不知道什么时候有结果，还得自己催",
      redpen: "",
      flag: "" },

    { id: "T16", case: "Ben_Issia_Habib_法国", when: "8/6 01:54", stage: "大单执行", st: ["谈判","样品确认"], position: "模糊请求（repair the part）",
      buyer: "Please repair the part, verify it, and send me a video, and I will handle the payment for the order and all associated costs.",
      wuzong_raw: "Hello, Ben, could you please clarify what you mean by 'repair the part and verify it'? We want to make sure we fully understand your request and handle it correctly.",
      kw: ["repair","verify it","the part","that thing","fix it","not sure if you","could you clarify","what do you mean"],
      pattern: "模糊请求 → 不猜，澄清，并给理由（为了处理对）",
      situation: "客户说的动作没有上下文（修哪个？为什么修？）；且处于大单 + 付款节点",
      hidden: "猜错 = 质量事故 + 信任崩；问的姿态是'认真处理'，不是'不会做'",
      counterfactual: "猜一个执行 → 错的话，返工是小事，'这人听不懂话'是性格问题",
      redpen: "",
      flag: "" },

    { id: "T17", case: "Ben_Issia_Habib_法国", when: "8/10 15:15", stage: "样品运费", st: ["报价","样品确认"], position: "样品运费高于心理预期",
      buyer: "（讨论样品收件方式，原句见案例文件）",
      wuzong_raw: "Since our product contains a lithium battery, it requires special transportation arrangements. Together with the package size, the shipping cost is relatively higher compared with ordinary products. After checking and negotiating with the shipping companies, the estimated shipping cost is around USD 178.",
      kw: ["shipping cost","how much shipping","freight cost","delivery cost","postage","shipping fee","freight","cost to ship","shipping to"],
      pattern: "运费报价 → 先解释成本原因（锂电池=特种运输）→ '多家货代核价并谈过' → 再给价",
      situation: "运费高于他的心理预期",
      hidden: "先说'为什么贵'再报 = 不是宰客；'contacted several shipping companies + negotiating' = 我做过功课，价格是努力的结果",
      counterfactual: "直接甩一个运费数字 → 他只见数字，第一反应是砍",
      redpen: "",
      flag: "" },

    { id: "T18", case: "Ben_Issia_Habib_法国", when: "9/29 09:44", stage: "颜色/定制", st: ["询盘","报价","需求确认"], position: "他的客户要纯黑（我们色卡没有）",
      buyer: "customers at our wholesale store are inquiring about the black color—not just the one in the photo, but the actual suitcase color. Do you have black in your color range? If you do, I'll p[lace]",
      wuzong_raw: "The fifth color does include black, but it's not completely black. At the moment, we don't have a full-black version in our standard color range. If you have a larger quantity in the future, we can discuss customizing a full-black version for you. The MOQ for a customized color is 1,000 pcs. So for now, you can let your customers know that we don't have a full-black version. If the demand grows, w[e...]",
      kw: ["color range","colours","colors","what color","which color","do you have black","do you have","custom color","customized color","full black","other color","in stock"],
      pattern: "先承认差距（没有纯黑）→ 给他对他客户的说法（let your customers know...）→ 留升级路径（量大可做定制，MOQ [定制色MOQ]）",
      situation: "他的客户在要某个颜色，他用'你们能做吗'试我们的定制能力",
      hidden: "他不是为自己买，是在转述他的客户的需求 → 先给他'怎么跟他的客户说' = 帮他处理他的客户；升级路径 = 下一单的钩子",
      counterfactual: "'我们有！' → 他订了发现不对，一次质量纠纷；直接'没有' → 单当场死，没有下文",
      redpen: "",
      flag: "⚠ 原话定制色 MOQ 与常态口径不一致，注入用 [定制色MOQ] 占位，数值以资料库为准" },

    { id: "T19", case: "Ben_Issia_Habib_法国", when: "8/24 00:59", stage: "推迟/拖延", st: ["需求确认","报价"], position: "真实生活事件推迟（婚礼）",
      buyer: "I am very busy with my son's wedding; I'm flying to Paris at the end of the month, and we can talk then. Thanks.",
      wuzong_raw: "Thank you for your reply. I completely understand. Congratulations on your son's wedding! 🎉 I wish your family a wonderful and happy celebration. No worries, we can talk when you are back from Paris at the end of the month. Please take your time and enjoy this special moment with your family.",
      kw: ["wedding","birthday","on vacation","traveling","flying to","end of the month","back in","back next","busy with","family event","funeral"],
      pattern: "客户给出真实推迟理由（家庭大事）→ 祝贺 + 接受他的时间线 + 零催单",
      situation: "真实生活事件，不是托词",
      hidden: "家庭大事 = 关系资产（记住了、道贺了），下次聊天自然有话题；催 = '你更在乎单子还是他家事'",
      counterfactual: "商务口吻'OK, just let me know if anything changes' → 推迟变成降温信号；再追两条 → 他把我们归入'烦人的供应商'",
      redpen: "",
      flag: "" },

    { id: "T20", case: "Ben_Issia_Habib_法国", when: "9/1 01:02", stage: "跟进", st: ["报价","谈判"], position: "主动跟进（他说过'see you soon'但没日期）",
      buyer: "Hello, thanks again—see you very, very soon. I am proud of you.（此前消息）",
      wuzong_raw: "Hi, Ben, I hope you've been doing well recently. Just wanted to say hello and check in with you. 😊 By the way, I was wondering if you've already finalized your schedule for your trip to China. If you have any updates regarding your itinerary, please feel free to let me know. It would be a pleasure to meet you during your visit.",
      kw: ["see you soon","talk soon","i will contact","we can talk then","let me know when","i will get back"],
      pattern: "主动跟进 = 问候 + 一个具体议题（他的行程/计划），不是'how are you / any update'",
      situation: "他说过'很快见'但没给具体日期",
      hidden: "无议题跟进 = 骚扰；'行程定了吗' = 推进一步但给他好答的口子（回'还没'就行）",
      counterfactual: "'Any update on the order?' → 施压式跟进，B 端客户第一反应是再拖",
      redpen: "",
      flag: "" },

    { id: "T21", case: "Ben_Issia_Habib_法国", when: "8/3 15:43 → 8/4 20:30", stage: "断联恢复", st: ["询盘"], position: "平台原因断联后重连",
      buyer: "It is a great pleasure, and I remain at your disposal for any information. I went to Tunisia for a few days, but I am still here, my friend.",
      wuzong_raw: "Hi Ben 😊 Good news, my WhatsApp security verification has been successfully completed, so we can communicate normally again now. By the way, how was your rally competition in Tunisia? How did it go? Did you achieve a good result? 🏆😊",
      kw: ["i went to","was away","been away","still here","back now","missed the","verification","couldn't reach","no reply from you"],
      pattern: "重连 → 先报自己的进展（为什么断的）→ 再问他的近况（他提过的事）→ 不提业务",
      situation: "断联是平台安全验证导致，双方都当对方凉了",
      hidden: "断联原因坦白，不赖他、不赖我；问他提过的事（拉力赛）= 我一直在关注你",
      counterfactual: "重连直接谈业务 → 他可能还当'那个人消失了好几天'",
      redpen: "",
      flag: "" },

    { id: "T22", case: "Ben_Issia_Habib_法国", when: "8/10 00:27", stage: "视频需求", st: ["谈判","样品确认"], position: "客户要求'他品牌的完整营销视频'",
      buyer: "Yes, agreed—send me the video with our SB Paris logo, similar to the video you just sent me.",
      wuzong_raw: "I have already sent you the video through WeChat because videos sent via WhatsApp are usually compressed and the quality becomes blurry. I also sent you several clips, and I noticed that you have already viewed them last week. For your new product with the SB Paris logo, we cannot make a complete marketing video like this at the moment, because it is your new product and brand content. At […截断]",
      kw: ["video with","brand video","marketing video","send me the video","our logo video","featuring our","video of our brand"],
      pattern: "诚实说做不了（完整品牌视频）+ 原因（那是他的品牌内容）+ 立刻给能做的（现渠道高清发 + 他已看过的片段）",
      situation: "客户要'带他品牌 logo 的完整营销视频'，但那是他的品牌内容",
      hidden: "做不了 + 原因 = 专业边界（做不了 ≠ 不愿做）；'你上周已经看过片段' = 有证据，不是空口",
      counterfactual: "'We will make a video for you!' → 后面做不到，一次信任负债",
      redpen: "",
      flag: "" },

    { id: "T23", case: "Ben_Issia_Habib_法国", when: "8/10 00:37", stage: "增值", st: ["报价","谈判"], position: "主动给资源（视频授权）+ 同行案例",
      buyer: "Thanks a lot, everyone—that's very kind of you. I'll be in touch soon.（此前消息）",
      wuzong_raw: "In the future, after we establish a long-term cooperation relationship, if you think our videos are suitable for your market promotion, we can also authorize you to use them. This is one of the ways we support our distributors and dealers. For example, some of our partners in the Middle East and South Africa are already using this kind of cooperation model.",
      kw: ["use the video","video for","promotion video","market the","advertising material","promote with"],
      pattern: "主动给增值（免费视频授权）+ 同行案例（其他地区的伙伴已经这么合作）",
      situation: "单子推进中、没有新话题，客户在'等待模式'",
      hidden: "'some of our partners are already using this model' = 社会证明 + 给他'经销商标准套餐'的想象；主动给 = 他会 reciprocate",
      counterfactual: "干等 → 他停留在等待模式，可能看到别家供应商的方案",
      redpen: "",
      flag: "" },

    { id: "T24", case: "Ben_Issia_Habib_法国", when: "8/5 09:40-17:52", stage: "大单条款", st: ["谈判","样品确认"], position: "'付定金前要先验一台'",
      buyer: "How do we handle verifying a unit before I make the initial 50% payment for our first order? Regarding the remaining 50%, that would be paid when the goods leave your warehouse—as I explained, I need to verify a unit first.",
      wuzong_raw: "For a first cooperation, it is reasonable and important for you to test and confirm the product before moving forward with a larger order. Therefore, we are happy to arrange one sample unit for your testing and verification. According to our factory policy, the sample unit needs to be p[aid…截断] / We fully agree with your payment terms for future bulk orders, and we are happy to support this cooperation arrangement.",
      kw: ["50% upfront","50% deposit","deposit","down payment","before i pay","verify","verification","before the goods leave","payment terms","pay 50","balance before"],
      pattern: "大单'先验后付' → ①先肯定他的要求合理（首单合作，先验是合理的）②给路径（一台样品，按工厂政策付费）③后续大货付款条款 = 同意",
      situation: "他愿意预付，但坚持先验一台——标准 B 端风控动作",
      hidden: "'it is reasonable and important for you' = 站他那边（不对抗他的风控）；样品 = 付费（不破价格红线、不立免费样品先例）；大货条款 = 同意（该给就给）",
      counterfactual: "'不能先验，付了才做' → 大单没了；'免费样品' → 价格红线破了，后面所有客户都要免费样品",
      redpen: "",
      flag: "" },

    { id: "T25", case: "Ben_Issia_Habib_法国", when: "8/6 02:27", stage: "增值", st: ["谈判"], position: "主动让渡客户资源（广告线索转介）",
      buyer: "（无明确触发句，她主动发——上下文为样品讨论期）",
      wuzong_raw: "In the past two days, we have started running advertising campaigns in the European market, and we have received many inquiries from customers who are actively looking for suppliers of electric luggage. For some smaller customers who may not be suitable for direct cooperation with us, we are considering recommending them to your side for further connection and distribution cooperation. I have already mentioned to some customers that we have a strong local partner in Europe... I did not disclose your company name.",
      kw: ["our customers","referral","leads","small customers","other buyers"],
      pattern: "主动让渡资源：我们在他的市场投广告 → 接不住的小客户 → 转介给他（且已对部分客户说'当地有强力伙伴'，未透露他名字）",
      situation: "大单推进期，关系处于'项目级'",
      hidden: "转介 = 把我们的客户池让给他（最硬的资源）；'已跟部分客户说了、没透露你名字' = 已办妥但不越界（给了他面子）；广告投放 = 我们在为你的市场投钱",
      counterfactual: "不说 → 他不知道我们有客户资源，'供应商'定位升不到'伙伴'定位",
      redpen: "",
      flag: "主动发送回合，无触发句" },

    { id: "T26", case: "Ben_Issia_Habib_法国", when: "7/30 00:27", stage: "关系建设", st: ["询盘","需求确认"], position: "客户分享自己的产品",
      buyer: "Ok（分享了自己的产品短视频后）",
      wuzong_raw: "Hi Ben, I watched your short video. Thank you for your trust and for sharing your products with me. I think your choice is very professional and shows a good understanding of the market. From the design and materials, your products are also positioned in the mid-to-high-end market. As someone in the same industry, we really appreciate the quality and design. 👍 I believe combining your products wi[th ours…截断]",
      kw: ["my product","my brand","my store","my company sells","take a look at my","sharing my","here is my"],
      pattern: "客户分享自己的产品 → 先认真评价（专业 + 定位），用'同行'身份说，再谈合作",
      situation: "B 端客户（批发商）主动亮自己的产品 = 在求同行认同，不是在求推销",
      hidden: "'你的定位是中高端' = 我看得懂你的生意，不只是卖你货；'as someone in the same industry' = 我是同行，不是推销员——B 端最要'被当成对等的'",
      counterfactual: "'Thanks for sharing! Our product pairs well with yours!'（直接进推销）→ 他在求认同，你在求成交，时刻浪费",
      redpen: "",
      flag: "" },

    { id: "T27", case: "Ben_Issia_Habib_法国", when: "9/23 01:57", stage: "视频需求", st: ["样品确认"], position: "要用客户样品拍摄（授权问题）",
      buyer: "I would like to see the same video featuring the SBI Paris suitcases before I arrive in China.",
      wuzong_raw: "Sure, no problem. 😊 If you'd like us to feature your SBI Paris suitcase in the video, we would need to use your sample for filming. Normally, samples are brand new, so we can only use them for display and cannot use a customer's sample without authorization. So, we would just need your authorization to use your sample for the video. 😊",
      kw: ["featuring the","before i arrive","use the sample","in the video","film","shoot","authorization"],
      pattern: "规则问题（用客户样品拍摄）→ 讲清规则（样品只能展示、未经授权不能用）+ 立刻给路径（只差你一句授权）",
      situation: "客户想要'他品牌的'视频，素材是我们手里的样品",
      hidden: "规则 + 路径一句说清 = 不是拒绝，是把流程讲明；'just need your authorization' = 动作很轻，他秒同意",
      counterfactual: "'没问题我们拍' → 拍完客户觉得不达标 / 用错样品 = 新的纠纷",
      redpen: "",
      flag: "" },

    { id: "T28", case: "Mackey美国精报价", when: "8/6 02:53", stage: "首询", st: ["询盘","需求确认"], position: "想做自己的品牌",
      buyer: "I wanna make my own luggage brand?",
      wuzong_raw: "Yes, we can support you to build your own luggage brand. We provide OEM/private label service, including your own logo, packaging, and customized details based on your requirements. For our main electric luggage model, OEM MOQ starts from 100 units. The price is: EXW price: USD 222/unit, FOB price: USD 245/unit. This model has already been sold in more than 30 countries.",
      kw: ["own brand","my own luggage","private label","oem","white label","my logo","build a brand","custom brand"],
      pattern: "确认能做 → OEM MOQ → 价格（EXW+FOB 两口径）→ 市场证据一句（已销往 [国家数]+ 国）",
      situation: "想自建品牌，先问'能不能做'",
      hidden: "答'能'的同时直接给可执行三件套（MOQ + 价格），不接'我们全力支持，请告诉我更多'——这类客户要看到数字才动",
      counterfactual: "'Yes! Please share your brand details.'（无数字）→ 再来一轮，他可能同时问了两家",
      redpen: "",
      flag: "⚠ 原话 FOB 与最终价目表口径不一致，注入只用 [FOB价] 占位，数值以资料库为准" },

    { id: "T29", case: "Mackey美国精报价", when: "8/6 13:06", stage: "MOQ/起订", st: ["询盘","需求确认"], position: "两个 MOQ 口径的区别",
      buyer: "What's the difference?",
      wuzong_raw: "The main difference is the branding. If you use our existing brand, the MOQ starts from 50 units. If you want to build your own brand with your own logo, the MOQ starts from 100 units. The product itself is the same main model. The difference is only the brand logo and customization requirements.",
      kw: ["what's the difference","whats the difference","difference between","the difference","which one should","50 and 100","both moq"],
      pattern: "口径问题 → 先一句结论（差别只在 branding）→ 两个 MOQ 数字 → 强调'产品是同一个'",
      situation: "他听到两个 MOQ，想知道该按哪个看",
      hidden: "'the product itself is the same' = 防止他以为高 MOQ 档产品更差；口径清楚了，他才能直接进数量问题",
      counterfactual: "把定制流程解释一大段 → 他更晕，还觉得'高 MOQ 档又贵又次'",
      redpen: "",
      flag: "" },

    { id: "T30", case: "Mackey美国精报价", when: "8/11 20:35", stage: "价格确认", st: ["报价","谈判"], position: "一字确认价格（'222?'）",
      buyer: "222?",
      wuzong_raw: "Yes, our MOQ for your own brand (OEM) is 100 units. If you use your own logo and brand, we can customize the products for you. If you use our factory brand, the MOQ starts from 50 units. Our EXW price is USD 222 per unit, and the FOB price is USD 245 per unit. For the sample order, since it is for testing purposes, we will offer you the same unit price as the 100-unit order quantity.",
      kw: ["is that right","the price is","confirm the price","so 2","ok the price","quote for","just to confirm","is it"],
      pattern: "一字确认 → 重确认 + 两个口径重讲一遍 + 样品按 MOQ 价（不设样品加价）",
      situation: "他在消化价格，单字发回价格 = 确认 + 轻微还价试探",
      hidden: "样品按 MOQ 价 = '眼见为实'的实路径；不另设'样品费'名目（多个名目 = 多一轮砍）",
      counterfactual: "'样品另算，+ [样品加价]/台' → 试机的心理门槛瞬间翻倍",
      redpen: "",
      flag: "⚠ 原话 FOB 与最终价目表口径不一致，注入只用 [FOB价] 占位" },

    { id: "T31", case: "Mackey美国精报价", when: "9/29 12:50", stage: "价格", st: ["报价"], position: "'给我价目表'",
      buyer: "Need a price list guys.",
      wuzong_raw: "QUANTITY & PRICE LIST: 100 PCS EXW 222 / FOB 236（total 23,600）| 300 PCS EXW 215 / FOB 225（total 67,500）| 700 PCS EXW 210 / FOB 218（total 152,600）| 1,000 PCS EXW 205 / FOB 212（total 212,000）. Remarks: Custom Logo; FOB Ningbo Port",
      kw: ["price list","need a price","pricing","tiered","volume price","quantity price","price tiers","价目"],
      pattern: "'要价目表' → 直接给完整阶梯表（四档，EXW+FOB+总额）+ 备注（港口/定制 logo）",
      situation: "首询一个月后突然要价目表 = 进入内部比较/审批环节，需要'拿得出手'的文档",
      hidden: "阶梯表本身就是价格锚：越买越便宜——表在推他往大数量走，不用嘴说'多买便宜'",
      counterfactual: "给一个单价 → 没有对比维度，他拿那个数字去比别家；'量大更优'的钩子也丢了",
      redpen: "",
      flag: "⚠ 本案早期报价与 9/29 价目表 FOB 口径不一致，库以最终价目表为准" },

    { id: "T32", case: "Jorge_Perez加拿大", when: "10/8 03:20", stage: "推迟/拖延", st: ["需求确认","报价"], position: "客户在忙自己的事（带样品）",
      buyer: "As I told you, I have a lot of information and samples to bring; I'd like to first organize a few lines that I've been asked for.",
      wuzong_raw: "Sure, I understand 😊 No worries at all. You have a lot to organize before your trip to Canada, so take your time. We can talk about our product whenever it's convenient for you.",
      kw: ["a lot of information","organize","samples to bring","first organize","take my time","i need to first","before i decide","my lines"],
      pattern: "推迟（真实原因：他有自己的事）→ 接受 + 复述他的原因 + 'whenever convenient'",
      situation: "客户在忙自己的生意（带样品回本国）",
      hidden: "复述他的事 = 我知道你在干什么，不是盲回'好的'；不设'下周联系' = 不制造义务",
      counterfactual: "空洞'OK, let me know when you're ready!' → 他感觉我们不知道他的节奏；设时间点 → 压力",
      redpen: "",
      flag: "" },

    { id: "T33", case: "Jorge_Perez加拿大", when: "9/25 03:34", stage: "样品", st: ["报价","样品确认"], position: "客户要来中国 → 建议自提样品",
      buyer: "Is intesting idea how much（听到'顺带带一台样品'建议后问多少钱）",
      wuzong_raw: "Besides this point, are there any other aspects of our electric luggage that you like? If you think our electric luggage looks good and you're interested in testing it, you could consider taking one sample back with you. That would save you the shipping cost. If we ship the sample separately to Canada, the shipping cost could be around RMB 1,000 or even more.",
      kw: ["bring a sample","take a sample","pick up","pickup","save the shipping","ship the sample separately","sample separately","come to pick"],
      pattern: "建议中国境内自提 → 用'单独寄 [单独运费] 或更多'做对照 → 自提 = 省运费",
      situation: "他要来中国（展会），样品寄回本国运费贵",
      hidden: "对照让'自提'从'帮个忙'变成'你省钱'；而且中国自提 = 多一次见面场景",
      counterfactual: "直接'样品免费，来拿' → 免费 = 贬值，且他不知道省的是什么",
      redpen: "",
      flag: "" },

    { id: "T34", case: "Mehmet丹麦10月广交会样品", when: "9/14 02:06", stage: "首询报价", st: ["询盘","需求确认"], position: "首询同时问价 + MOQ",
      buyer: "whats the price of your luggage and whats your MOQ?（前一条自报公司名 uni-tex.dk，丹麦进口商）",
      wuzong_raw: "Our prices are: • EXW: USD 222/unit • FOB: USD 236/unit MOQ is 50 units for our original brand and 100 units for OEM logo orders. For larger quantities, we can offer appropriate discounts. For the first cooperation, we can also support a small trial order so you can test the market first.",
      kw: ["whats the price","what's the price","your price","price of your","your moq","minimum order","moq?","minimum quantity","start with"],
      pattern: "价格（EXW+FOB 两口径）+ MOQ（两口径）+ '量大更优' + 试单出口——一套齐",
      situation: "首询同时问价 + MOQ = 认真的买家（不是零售）",
      hidden: "主动给低门槛出口（trial order）= 把首单门槛降低；两个价格口径一次给全 = '我没有隐藏价'",
      counterfactual: "只答一个口径的价格 → 他再问另一个口径? 量价? 样品? 好几个来回",
      redpen: "",
      flag: "" },

    { id: "T35", case: "Mehmet丹麦10月广交会样品", when: "9/14 05:10", stage: "样品报价", st: ["报价","样品确认"], position: "样品总成本（含运费清关）",
      buyer: "（问样品怎么寄，原句见案例文件）",
      wuzong_raw: "I've just received the shipping quotation from our freight forwarder. For one sample to Denmark, the shipping and customs clearance cost is €88. The sample cost, based on our 100-unit MOQ price, is €194. So the total cost for one sample is €282, including shipping and customs clearance. If this is acceptable to you, we can proceed with the sample order.",
      kw: ["sample cost","cost of the sample","how much for one sample","sample shipping","total for the sample","shipping and customs","duty","sample to"],
      pattern: "样品报价 = 一个总价（含全部费用）+ 'if this is acceptable, we can proceed'——二选一，不开放",
      situation: "客户在掂量样品总成本",
      hidden: "一个总价 = 他只做一道心算（值不值）；分项报 = 他逐项砍；'acceptable 就 proceed' = 把决定权交给他，不催但设了决策点",
      counterfactual: "分项报（运费 + 样品费）再加'可能还有其他费用' → 他听到'可能还有' = 怕被连续收费",
      redpen: "",
      flag: "" },

    { id: "T36", case: "Mehmet丹麦10月广交会样品", when: "9/14 05:17", stage: "颜色/选品", st: ["报价","样品确认"], position: "客户选样品颜色",
      buyer: "（问颜色，原句见案例文件）",
      wuzong_raw: "Silver and dark grey are currently our two best-selling colors. 😊 The fifth option is our photochromic color-changing version. When exposed to sunlight, the material changes color slightly. This version is particularly popular with some younger customers because of his unique appearance.",
      kw: ["which color","best selling","bestseller","what colors","favorite color","color for"],
      pattern: "不只列颜色 → 给选购建议（哪两个是 best-seller）+ 场景（变色款年轻客户特别喜欢）",
      situation: "客户在选样品颜色",
      hidden: "'best-seller' = 我的建议有数据背书；'popular with younger customers' = 给他卖场的理由（他是进口商，想的是他的客户）",
      counterfactual: "'我们有 N 个颜色，你要哪个？' → 他得自己做功课，'变色款加价'也没有场景",
      redpen: "",
      flag: "原话笔误 'his unique appearance' 应为 its，注入用 pattern 不受影响" },

    { id: "T37", case: "Sunyl澳大利亚5样品_Sharma", when: "10/13 04:01", stage: "首询", st: ["询盘"], position: "一字'Details'",
      buyer: "Details",
      wuzong_raw: "We are a source factory in Zhejiang, China, specializing in R&D and manufacturing. Our product is independently developed, holds two patents, and has been sold in nearly 40 countries worldwide... MOQ & Pricing: 50 pcs with our brand or 100 pcs with your own brand/logo. EXW: USD 222/unit | FOB: [...截断]",
      kw: ["details","more details","tell me about","product details","info about","information about","about the product","参数"],
      pattern: "一字'Details' → 工厂身份 + [专利数] 项专利 + [国家数] 国 + MOQ/价格，一套齐",
      situation: "客户想知道'你是谁 + 多少钱'，不想拼",
      hidden: "'source factory + 专利 + 国家数' = 三个信任事实一次给全，第一枪立住源头厂定位",
      counterfactual: "拆多条发（你是谁/规格/价格/MOQ/颜色）→ 挤牙膏 = 怀疑隐藏价（同 T03 红笔逻辑）",
      redpen: "",
      flag: "" },

    { id: "T38", case: "Sunyl澳大利亚5样品_Sharma", when: "10/13 06:20", stage: "大单报价", st: ["报价","谈判"], position: "大单价格再确认（比价期）",
      buyer: "What was the price for 4k units",
      wuzong_raw: "Today is our first day running ads in Australia, and I hope we'll have the opportunity to build a strong, long-term partnership with you. Our international customers really like the short videos we create to showcase our products. If we establish a partnership, we can authorize you to use these videos for free to promote our products and generate leads in your local market. We can also refer individual customers who contact us through our videos in Australia to you, helping you develop your [...]...[截断]",
      kw: ["price for 4","price for 1000","price for bulk","large order price","wholesale price for","requote","update the price","price for the container"],
      pattern: "大单价格问 → 不立刻重报价，先说'我们正在为你的市场投入'（本地广告开跑）+ 两个具体资源（免费视频授权 + 本地广告客户转介），再谈价",
      situation: "再确认大单价格 = 认真，但也处于比价期",
      hidden: "本地开广告 = 我们已经在为你的市场投钱，你不是 100 个客户之一；视频 + 转介 = 别人给不了的两个资源 → 谈判框从'能便宜多少'变成'这个合作值多少'",
      counterfactual: "立刻重报大单价 → 他拿数字去比，我们的广告投入和转介资源全部隐形",
      redpen: "",
      flag: "" },

    { id: "T39", case: "Sunyl澳大利亚5样品_Sharma", when: "10/13 18:09", stage: "价格", st: ["报价","谈判"], position: "'用你们 logo 更便宜吗'",
      buyer: "If you sell your logo at better price i don't mind your logo",
      wuzong_raw: "Our pricing depends on your order quantity. As we mainly work with overseas wholesalers and importers, our standard MOQ is 50 units under our own brand. However, for your first order, I'm willing to offer you our MOQ-based price even if you'd like to start with a smaller quantity, so you can test the product and evaluate its market potential. Our FOB price is $236 per unit.",
      kw: ["your logo","your brand","without my logo","no logo","better price","your branding ok","stock brand"],
      pattern: "'你们 logo 便宜吗' → 不立刻答'便宜多少'，答：首单即使量不够 MOQ 也按 MOQ 价（I'm willing to offer）",
      situation: "客户在信号'价格敏感、可以放弃定制'",
      hidden: "'I'm willing to offer' = 这是让步（愿意的语气），但让的是'价'不是'MOQ 线'——MOQ 线不破，他的首单门槛却降了；交换条件是'测试产品' = 等后续单",
      counterfactual: "'我们品牌便宜，[低价]' → 价格体系崩（品牌版比定制便宜 = 定制还有什么价值？）",
      redpen: "",
      flag: "" },

    { id: "T40", case: "Sunyl澳大利亚5样品_Sharma", when: "10/13 20:21", stage: "样品", st: ["样品确认"], position: "多台样品（怕两次花钱）",
      buyer: "（决定先试多台样品，原句见案例文件）",
      wuzong_raw: "You can order the 5 samples at our agreed MOQ-based price for testing first. If you place a large bulk order later, we can discuss a more competitive price based on the order quantity. The price difference for the 5 samples can be refunded through your subsequent bulk order. 😊 Do you think this arrangement would work for you?",
      kw: ["5 samples","couple of samples","a few samples","2 samples","3 samples","10 samples","sample order","test with","trial order","few units to test"],
      pattern: "样品 = MOQ 价（不打折），差价在后续大货单里退",
      situation: "客户想先试几台，怕'样品贵 + 大货贵'花两次钱",
      hidden: "'差价大货退' = 样品费不是成本，是下一单的预付款；他的心算从'样品花了钱'变成'已经预支了'",
      counterfactual: "'样品打折 [折后价]' → 打折 = 贬值 + 大货谈判从低锚开始",
      redpen: "",
      flag: "" },

    { id: "T41", case: "Mkuboi法国一月来中国样品广州代理", when: "10/6 03:15", stage: "样品", st: ["样品确认"], position: "付费样品（法语）",
      buyer: "Je viens en chine en janvier mais est ce qu'avant de venir je peux vous demander un échantillon même si je le paie（一月来中国，来之前能不能先要个样品，付费也可以）",
      wuzong_raw: "Oui, bien sûr. 😊 Selon la politique de notre usine, les échantillons sont payants. Comme il s'agit d'un échantillon pour un test à des fins commerciales, nous pouvons vous proposer le prix unitaire basé sur notre MOQ de 100 pièces. Si vous passez ensuite une commande en quantité, nous pourrons vous offrir une unité supplémentaire afin de compenser le coût de l'échantillon. Pour l'expédition d'un seul échantillon vers la France, les frais de transport, de dédouanement et les taxes sont à votr[e charge][截断]",
      kw: ["échantillon","echantillon","je peux vous demander un","even if i pay","paying for the sample","sample fee","paid sample"],
      pattern: "（法语）付费样品 = MOQ 价 + 后续大货 +1 台抵扣 + 单台运费/清关/税自理",
      situation: "客户明说'付费也可以'——付费口径他先让了",
      hidden: "他既然说了付费 → 不再往下让，价格口径保持 B 端标准（MOQ 价、不设样品加价）；'+1 台抵扣' = 样品是下一单的预付款（同 T40 结构，跨客户验证 = 标准动作）",
      counterfactual: "'样品免费，你只付运费' → 付费客户会想'原来有折扣'，价格体系崩",
      redpen: "",
      flag: "" },

    { id: "T42", case: "Newton巴西_Sergio", when: "8/24 17:02", stage: "首询", st: ["询盘","需求确认"], position: "'你是不是工厂'（怕中间商）",
      buyer: "I need to know if we would be dealing directly with the factory—we do not work with resellers, even if they are offices. We also need information regarding warranties and after-sales support; we are focused on market dev[elopment]",
      wuzong_raw: "No problem at all. I completely understand your concern. Many customers prefer to work directly with the manufacturer, especially for products involving technology, batteries, and after-sales service. We are a manufacturer specializing in electric luggage, with our own R&D, design, and production capabilities. Our factory is located in Jinhua, Zhejiang Province, China, and our foreign trade team i[s in...][截断]",
      kw: ["directly with the factory","resellers","reseller","are you the factory","manufacturer or","middleman","trader","agent or factory","deal with the factory","work with resellers","factory or"],
      pattern: "'是不是工厂' → 先接住担心（很多客户都这样，电池产品尤其）→ 身份事实（自有 R&D/设计/生产 + 工厂地址）→ 不说'我们是工厂'就完了",
      situation: "客户明确怕中间商（之前被坑过）",
      hidden: "'especially for products involving technology, batteries, and after-sales' = 说出他的恐惧（电池产品找中间商 = 售后没着落）；地址 = 可核实的事实，比'保证'有说服力",
      counterfactual: "'We are a factory, I promise!' → 对怕被坑的人，'promise' 是最没说服力的词",
      redpen: "",
      flag: "" },

    { id: "T43", case: "Newton巴西_Sergio", when: "8/11 06:58", stage: "推迟/拖延", st: ["需求确认","报价"], position: "'开会了，稍后回' + 大新闻（新基地）",
      buyer: "estou iniciando uma reunião... estamos inaugurando no final de agosto uma base no Texas onde todos nossos parceiros farão parte desse sucesso, te respondo logo mais, pode ser?（葡语：要进会了，月底开新基地，稍后回复）",
      wuzong_raw: "（葡语）Sem problema, fique à vontade para analisar nossa mensagem com calma. Agradeço também por compartilhar essa novidade sobre a nova base no Texas. Parece ser um passo muito importante para o desenvolvimento dos negócios de vocês... Acreditamos que uma boa parceria precisa ser construída com comunicação, confiança e planejamento de longo prazo. Quando você tiver disponibilidade, ficaremos à disposição[...]...[截断]",
      kw: ["in a meeting","iniciando uma reunião","reunion","meeting now","reply later","get back to you later","te respondo","te aviso","vou analisar","depois eu","开会"],
      pattern: "'稍后回' → 不催细节 + 接住他的大新闻（新基地/扩张）+ 立'长期合作'框架（沟通、信任、长期规划）",
      situation: "客户在开会 + 有大新闻（开新基地）",
      hidden: "接住大新闻 = 重视他的大事（这是扩张中的客户，不是小买家）；'long-term planning' = 把这单框成长期关系而不是一锤子",
      counterfactual: "'OK, 今天能回吗？' → 对正在开大会议的人催 = 最低价值的时刻",
      redpen: "",
      flag: "" },

    { id: "T44", case: "Mohammed_Shabbeer阿联酋样品", when: "9/6 08:49", stage: "试探", st: ["报价","谈判"], position: "客户亮功课（'我知道市场价'）",
      buyer: "Perfect. I know the market price, I've done a little research on it",
      wuzong_raw: "You're truly amazing! You never fight a battle without being fully prepared. 😊😊😊",
      kw: ["market price","done research","did some research","i've researched","researched","compared","i know the price","other suppliers","another factory quoted"],
      pattern: "客户亮功课（我查过了）→ 先夸他的动作（不打无准备的仗），不急着报价 / 辩解",
      situation: "他在说'别想糊弄我，我知道市场价' = 试探 + 立谈判地位",
      hidden: "此刻报价 = 他拿查到的价（一定是更低的）来比；夸 = 消解对抗，让他留在'你懂我'模式里，价格稍后用'零售锚点'结构（同 T02 三件套）出",
      counterfactual: "'Our price is very competitive, better than the market!' → 他立刻甩出查到的低价，对话变价格拉锯",
      redpen: "",
      flag: "可复用度低（纯关系回合），作为'应对亮功课试探'的样板" },

    { id: "T45", case: "Mohammed_Shabbeer阿联酋样品", when: "9/17 20:49", stage: "PO/物流", st: ["样品确认","成交"], position: "PO 流程 + 谁管物流",
      buyer: "（PO 细节发在 WhatsApp，原句见案例文件）",
      wuzong_raw: "I haven't received the PO by email yet. However, based on the PO details you shared with me on WhatsApp, I carefully reviewed everything today, so I wanted to give you a quick update from my side first. As we are the factory, international shipping is not actually our strongest area. Most of our larger customers already have their own freight forwarders that the[y use...]...[截断]",
      kw: ["purchase order","the po","our forwarder","freight forwarder","shipping agent","logistics provider","we have our own","consignee","cargo agent"],
      pattern: "没收到正式文件 → 先说'你发的版本我已经仔细看过了'（动作证据）+ 坦白'国际物流不是我们最强项' + 给方案（大客户都有自己的货代）",
      situation: "下单文件流程 + 物流归属",
      hidden: "'I carefully reviewed everything today' = 动作证据，不是空话；坦白弱项 = 不拍胸脯，'工厂管产品、货代管物流'是行业事实，他信",
      counterfactual: "'We handle shipping very well!' → 他一对比自己货代就知道我们说过头了",
      redpen: "",
      flag: "" },

    { id: "T46", case: "Tushar印度样品跟踪_shah", when: "9/6 20:25-21:24", stage: "首询", st: ["询盘"], position: "'给我图片和 best price'（无口径）",
      buyer: "Can u please send the pictures of trolly bag and the best price....",
      wuzong_raw: "Here are some key product details and advantages: Maximum speed: 15 km/h / Driving range: about 8–13 km / Battery: removable 93.6 Wh (below 100 Wh airline limit) / Charging: about 2.5 hours / Load: 120 kg (up to 150 kg at lower speed) / Size: 20-inch, 30L capacity / 另发三件套：EXW 222、FOB 236 + MOQ 50/100；5 色；TikTok $899、Amazon $599.99 零售参考",
      kw: ["pictures","photos of","images","best price","send the photo","catalog photo","product photos"],
      pattern: "'图片 + best price' → 先给参数事实（规格）→ 再给标准三件套（价格/MOQ + 颜色 + 零售锚点）",
      situation: "首询，'best price' 无口径（多少台？EXW 还是 FOB？）",
      hidden: "'best price' 是无法直接答的问（无数量无口径）→ 先给事实（规格）+ 标准报价结构，让他的下一个问题自带数量/口径",
      counterfactual: "直接'best price 是 [X]' → 一个价没锚，他必砍'能不能更低'；只反问'你要多少台' → 没给他信息，又是空转",
      redpen: "",
      flag: "⚠ 原话续航与另一案口径不一致，注入只用 [range] 占位，数值以资料库为准" },

    { id: "T47", case: "Tushar印度样品跟踪_shah", when: "9/6 21:50-21:59", stage: "定性/门槛", st: ["询盘","需求确认"], position: "C 端倾向 / 小单",
      buyer: "First i wanted to try for my own use... If its ok..i can keep in our store... / We are having a gifting and unique store like all gift materials...",
      wuzong_raw: "For small quantities, the shipping cost may not be very favorable, as our electric luggage contains a lithium battery. That's why we mainly work with wholesalers, distributors, importers, and channel partners. You can evaluate whether our product is suitable for your business and local market. If you'd like to test a sample first, that's also possible. We can offer the sample at the same unit price as our 100-unit order, which is USD 222 per unit. The shipping cost would be at your own expense. You're welcome to take some time to evaluate it based on your market. 😊",
      kw: ["own use","personal use","for myself","by myself","small quantity","small order","one piece","1 unit","single unit","just one","gift","try it first","try for my own"],
      pattern: "C 端倾向/小单 → 诚实说'小单运费不划算'（原因：锂电池）+ 说清我们主要服务谁 + 给样品出口（MOQ 价 + 运费自理），不硬成交",
      situation: "他说'先自己用，好就放店里'，店不是我们的主力客口径",
      hidden: "诚实'不适合你' = 立价格和客群线（一分不让、MOQ 价线不破）；'you can take some time to evaluate' = 不催、不断线；样品出口 = 真有意就有路",
      counterfactual: "'没问题，1 台也可以！' → 小单吃掉利润 + 价格体系崩（按 MOQ 买的客户怎么解释？）",
      redpen: "",
      flag: "与 Amritpal T06/T07（已决定）构成'未决定'对照——未决定一分不让" },

    { id: "T48", case: "Tushar印度样品跟踪_shah", when: "9/25 04:14", stage: "交付", st: ["样品确认","成交"], position: "物流期限（他客户航班）",
      buyer: "Ya sure...please confirm with courier.....exactly... Because he is having ticket on tuesday night air cathay flight...",
      wuzong_raw: "I've already confirmed the delivery time with the courier. If I ship it tomorrow, the regular service can guarantee delivery to Guangdong by next Tuesday, but they cannot guarantee the exact delivery time. It could arrive before noon or later in the day. So, if you need to make sure the package arrives before noon next Tuesday, we would have to use a faster and more expensive courier service.",
      kw: ["ticket on","cathay","confirm with courier","delivery time","arrives","when will it arrive","arrive by","need it by","flight on"],
      pattern: "期限要求 → 先说'已确认过'（动作）→ 常规服务能/不能保证的讲清楚 → 要确定 = 加钱（更快的快递）",
      situation: "他的客户有确定航班，样品必须某日到",
      hidden: "'cannot guarantee the exact delivery time' = 提前免责（不拍胸脯）；'faster and more expensive' = 时间是要买的东西，他选，不是我承诺",
      counterfactual: "'肯定到！' → 晚一天 = 全单崩（同 T08 结构）",
      redpen: "",
      flag: "" },

    { id: "T49", case: "Tushar印度样品跟踪_shah", when: "9/19 06:53-06:54", stage: "⚠ 负例", st: [], position: "连发两问答案错位（禁抄）",
      buyer: "Is there any warranty for product?（紧接：After removing the battery, we can use in Thai airways?）",
      wuzong_raw: "（质保答案发到了航司问题上：'At the moment, Thai Airways does not allow electric luggage on board... We still recommend checking with your airline before traveling.'）",
      negative: true,
      kw: [],
      pattern: "⚠ 负例：正确答案（1 年质保 + 随时联系 + 主销市场列表）错位发到了另一问上。正确模板 = [质保期] + 随时联系 + 主销市场",
      situation: "连发两问（质保 / 航司），回答错位",
      hidden: "教训不在内容在顺序——连发多问要按条编号回答或答一条确认一条，不能凭感觉答",
      counterfactual: "（实际事故，非假设）",
      redpen: "",
      flag: "⚠ 负例：禁止照抄顺序，只可照抄内容" },

    { id: "T50", case: "Tushar印度样品跟踪_shah", when: "9/6 22:01-22:08", stage: "跟进", st: ["询盘","需求确认","报价"], position: "客户说常来中国",
      buyer: "I and my cousin brother regularly visits china... Will inform u once i reach china... Then we can arrange for sample and plan accordingly.... Can u please share ur address and contact no...",
      wuzong_raw: "OK. When you come to China, please feel free to contact me. You can reach me anytime via WhatsApp, or call me at +86 189 6909 2018. I'm based in Hangzhou, Zhejiang, China. Looking forward to meeting you! 😊 / When you come to China, do you usually visit Zhejiang, or Guangdong?",
      kw: ["visit china","visits china","coming to china","come to china","reach china","i will come to china","travel to china","来中国","到广州","到上海"],
      pattern: "客户说来中国 → 立刻给联系方式（WhatsApp + 电话 + 城市）+ 主动问'去浙江还是广东？'",
      situation: "'不适合我们'的小客户，但常来中国——可以留活的线",
      hidden: "'去浙江还是广东？' = 位置感知（同 T02 捕捉位置）：他去哪决定服务方案（近水楼台 / 安排机场送达）",
      counterfactual: "只'OK 来联系'（不问位置）→ 他去了哪我们不知道，见面场景错过",
      redpen: "",
      flag: "raw 含电话号码，存档用，不进对外模板" }
  ];

  /* ===== 确定性检索：kw 命中为主，阶段匹配加分 ===== */
  function pickFor(msg, stageName) {
    var m = String(msg || "").toLowerCase();
    if (!m) return [];
    /* 裸 '?'（客户对收款户名/支付信息发问号）= 支付摩擦回合，kw 匹配不了单字符，直接命中 T10 */
    if (/^[?？]{1,2}$/.test(m.trim())) {
      var t10 = byId("T10");
      if (t10) return [t10];
    }
    var out = [];
    for (var i = 0; i < TURNS.length; i++) {
      var t = TURNS[i];
      if (t.negative || !t.kw || !t.kw.length) continue;
      var hits = 0;
      for (var j = 0; j < t.kw.length; j++) {
        if (m.indexOf(t.kw[j]) >= 0) hits++;
      }
      var minH = t.minHits || 1;
      if (hits < minH) continue;
      var s = hits * 2;
      if (stageName && t.st) {
        for (var k = 0; k < t.st.length; k++) {
          if (t.st[k] === stageName) { s += 1; break; }
        }
      }
      out.push({ t: t, s: s });
    }
    out.sort(function (a, b) {
      if (b.s !== a.s) return b.s - a.s;
      return a.t.id < b.t.id ? -1 : 1; /* 同分按 id，稳定 */
    });
    return out.slice(0, 3).map(function (x) { return x.t; });
  }

  /* ===== 提示词块：命中 ≤3 条 → 底稿参考块；无命中 → 通用草案强制标注 ===== */
  function byId(id) {
    for (var i = 0; i < TURNS.length; i++) if (TURNS[i].id === id) return TURNS[i];
    return null;
  }

  function blockFor(buyer, msg) {
    var stageName = (window.Mock && Mock.STAGES) ? (Mock.STAGES[buyer.stage] || "") : "";
    var picked = pickFor(msg, stageName);
    if (!picked.length) {
      return "\n【回合库·未命中】回合库（" + TURNS.length + " 条真实回合）中没有与客户当前局面相似的回合——本次 3 条草案都是通用草案：必须在 diagnosis.blocker 尾部追加'（回合库未命中·通用草案，请重点看）'，让业务员一眼分得出底稿与通用。\n";
    }
    var s = "\n【回合库·底稿参考（真实回合，最高优先级参照）】以下是团队 50 个真实成交案例中与客户当前这句话最相似的 " + picked.length + " 个回合（客户一句 → 她当时怎么回 + 为什么）。用法：\n" +
      "1) 先看每条的「局面」：与客户当前局面吻合的，以「她的招」（可复用句式）为底稿改写，只替换事实（客户名/产品/数字/国家/渠道）；句式里的 [占位符] 必须用档案/资料/对话里的真实值填，禁止照抄其他案例的数字。\n" +
      "2) 出招要顺着每条的「隐藏目的」想；「换种说法客户会怎样」是失败模式，严禁写进去。\n" +
      "3) 全部不吻合 → 全部弃用自拟，并在 diagnosis.blocker 尾部追加'（回合库未命中·通用草案，请重点看）'。\n";
    for (var i = 0; i < picked.length; i++) {
      var t = picked[i];
      s += "\n── 回合 · " + t.position + "（" + t.case + " " + t.when + "）──\n";
      s += "局面：" + t.situation + "\n";
      s += "她的招：" + t.pattern + "\n";
      s += "隐藏目的：" + t.hidden + "\n";
      s += "换种说法客户会怎样：" + t.counterfactual + "\n";
    }
    return s;
  }

  window.TURNS = { list: TURNS, pickFor: pickFor, blockFor: blockFor };
})();
