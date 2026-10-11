/* ===== Mock 数据层 =====
 * 模拟后端 API 返回。真实产品接入时：
 * 1. 用 fetch 数据源整体替换本文件，保持导出字段一致即可；
 * 2. 或在 app.js 之前注入 window.Mock 的代理实现，页面层零改动。
 */
(function () {
  "use strict";

  var STAGES = ["询盘", "需求确认", "报价", "谈判", "样品确认", "成交"];

  var buyers = [
    {
      id: "b1", name: "Marcus Weber", company: "GreenGarden GmbH", country: "德国", cc: "DE",
      product: "太阳能庭院灯 S-320", qty: "500 件", amount: 12600, currency: "€",
      intent: 88, stage: 3, followIn: -1, lastActive: "1 小时前", unread: 2,
      tags: ["要 CE 认证", "欧盟市场", "12 月交期"], quoteNo: "Q-2026-101", daysInStage: 2,
      wa: "+49 170 4451 882",
      profile: {
        address: "首次 Mr. Weber，熟后 Marcus",
        style: "直接、重数据，给明确日期，不寒暄",
        tip: "守价时给书面理由和替代方案，别说 \"as soon as possible\""
      },
      context: [
        { k: "目标价", v: "€23 / 件" },
        { k: "交期", v: "12 月底（圣诞季）" },
        { k: "认证", v: "CE" },
        { k: "市场", v: "欧盟 · 德国" },
        { k: "顾虑", v: "价格偏高，竞对 €23" }
      ],
      compare: {
        intent: "客户嫌贵（目标 €23），想守住利润，给他一个能接受的方案。",
        literal: "Dear Marcus, We are sorry for the price. Our factory is very strong, please trust us. We can give you a good price if you order soon. Please reply as soon as possible. Thanks a lot!",
        local: "Hi Marcus, I hear you on price. Two options that still hit your Dec 20 cutoff: (1) 500 pcs at €24.2/pc FOB, CE + 2-year warranty included; (2) 800 pcs at €23.8/pc, one shipment in October. Either way, I'll have the PI to you by Friday.",
        notes: [
          "去掉自我吹嘘——德国买家要证据和选项，不要形容词",
          "\"尽快回复\" 换成明确日期 Friday，并绑定交付物 PI",
          "两个选项都锚定他的硬约束（12 月 20 日前到）"
        ]
      },
      options: {
        text: "为赶圣诞季，您选哪个出运方案？回复 1 或 2",
        items: [
          { t: "1 · 500 件，11 月首批 300 件到港", reply: "Option 2 — the 800-pc slot in October works best for us. Please send the PI.", note: "客户选择 800 件方案，已沉淀" },
          { t: "2 · 800 件，10 月一次性出运（€23.8）", reply: null, note: null }
        ]
      },
      messages: [
        { from: "me", time: "昨天 14:20", text: "Hi Marcus, 500 pcs at €25.2/pc FOB Shanghai, CE included, 2-year warranty. Shall we proceed?" },
        { from: "buyer", time: "今天 08:32", text: "Hi, the price is higher than my target. Competitors quote around €23. Can you do €23.5?", zh: "价格高于我的目标。竞对报价在 €23 左右，你们能做到 €23.5 吗？" },
        { from: "buyer", time: "今天 08:33", text: "We need 300 pcs by end of December for holiday season. Can you split into two shipments?", zh: "圣诞季前 12 月底需要 300 件。能分两批出运吗？" }
      ]
    },
    {
      id: "b2", name: "Sofia Alvarez", company: "Lumina Import SA", country: "墨西哥", cc: "MX",
      product: "LED 投光灯 300W", qty: "2000 件", amount: 9800, currency: "$",
      intent: 92, stage: 2, followIn: 0, lastActive: "今天 09:12", unread: 1,
      tags: ["价格敏感", "要 NOM 认证"], quoteNo: "Q-2026-102", daysInStage: 1,
      wa: "+52 1 55 4021 9937",
      profile: {
        address: "Sofia（西语市场，商务英文沟通）",
        style: "热情、关系驱动，节日问候是加分项",
        tip: "让价要绑定明确交换条件（量/年约/试单拆分）"
      },
      context: [
        { k: "预算", v: "$4.5 / 件" },
        { k: "认证", v: "NOM（驱动器需带证）" },
        { k: "数量", v: "2,000 件" }
      ],
      messages: [
        { from: "me", time: "昨天 10:05", text: "Hi Sofia, quote Q-2026-102 sent: $4.9/pc for 2,000 pcs, 30-day lead time. NOM test report attached." },
        { from: "buyer", time: "今天 09:12", text: "Thanks. Our budget is around $4.5/pc. Also the NOM certification must be on the driver, not just the lamp. Can you confirm?", zh: "谢谢。我们的预算在 $4.5/件 左右。另外 NOM 认证必须在驱动器上，不能只有灯体，请确认。" }
      ]
    },
    {
      id: "b3", name: "Priya Sharma", company: "SolarBridge Energy", country: "印度", cc: "IN",
      product: "太阳能路灯 45W", qty: "500 件", amount: 18500, currency: "$",
      intent: 81, stage: 3, followIn: -2, lastActive: "昨天 16:40", unread: 0,
      tags: ["大单", "账期要求"], quoteNo: "Q-2026-097", daysInStage: 4,
      wa: "+91 98 2210 4455",
      profile: {
        address: "Priya 女士 / Mr. Sharma",
        style: "谈判周期长，账期敏感，内部决策链多层",
        tip: "账期别直接拒绝，给 OA+保函 / 定金尾款 两套替代"
      },
      context: [
        { k: "账期", v: "要求 Net 30" },
        { k: "量级", v: "500 件 · 长期供应意向" }
      ],
      messages: [
        { from: "me", time: "周三 11:20", text: "Hi Priya, our standard term is 30% deposit, 70% before shipment. Happy to discuss alternatives for bigger orders." },
        { from: "buyer", time: "昨天 16:40", text: "Net 30 credit is mandatory per our procurement policy. Without it, we may have to consider other vendors. Please confirm.", zh: "按我司采购政策，Net 30 账期是必须的。如果没有，我们可能要考虑其他供应商。请确认。" }
      ]
    },
    {
      id: "b4", name: "Amira Hassan", company: "DesertView Trading", country: "阿联酋", cc: "AE",
      product: "太阳能步道灯", qty: "3000 件", amount: 14200, currency: "$",
      intent: 71, stage: 4, followIn: 3, lastActive: "3 天前", unread: 0,
      tags: ["样品已出"], quoteNo: "Q-2026-089", daysInStage: 3,
      wa: "+971 50 882 3310",
      profile: {
        address: "Amira 女士（注意宗教节日假期）",
        style: "先关系后生意，耐心，重信任与口碑",
        tip: "斋月/开斋节前后不催单，主动问候是投资"
      },
      context: [
        { k: "样品", v: "3 台已签收，本周现场测试" }
      ],
      messages: [
        { from: "me", time: "5 天前", text: "Hi Amira, 3 sample units shipped today, DHL to Dubai (4-5 days). Tracking: DX456789012." },
        { from: "buyer", time: "3 天前", text: "Great, we will test the brightness on site this week and come back to you.", zh: "好的，我们这周在现场测试亮度，测完联系您。" }
      ]
    },
    {
      id: "b5", name: "Kenji Sato", company: "Nikko Lighting K.K.", country: "日本", cc: "JP",
      product: "太阳能壁灯", qty: "1000 件", amount: 5400, currency: "$",
      intent: 64, stage: 1, followIn: 1, lastActive: "昨天 11:05", unread: 0,
      tags: ["规格确认中"], quoteNo: "Q-2026-104", daysInStage: 1,
      wa: "+81 90 5521 7734",
      profile: {
        address: "佐藤様（Sato-sama）",
        style: "敬语、委婉，不直接说 No，重细节与依据",
        tip: "对方说\"考虑一下\"= 需要更多材料，别追问，改送规格书/测试报告"
      },
      compare: {
        intent: "客户要求确认 IP 等级，想推动本周五定下 BOM。",
        literal: "Dear Mr. Sato, We confirmed IP65. Our product is very good, best quality, no problem. We hope you can decide this Friday. Thank you very much!",
        local: "Hello Mr. Sato, thank you for the details on the IP rating. Both are confirmed: IP65 (tested per JIS C 0900) and 800 lm per unit. I have attached the full spec sheet for your review. Would it be possible to check the BOM by this Friday? Happy to answer any questions in the meantime.",
        notes: [
          "敬称与委婉语域（对应日语 敬語 的商务表达）",
          "给测试标准 JIS C 0900——日本买家重依据，轻断言",
          "\"希望周五决定\" 改为 \"是否方便本周五确认\" 的征询句式"
        ]
      },
      options: {
        text: "壁灯规格确认，回复 1 或 2",
        items: [
          { t: "1 · IP65 · 800lm · 周五定 BOM", reply: "Option 1. Please send the BOM and spec sheet — we finalize on Friday.", note: "IP65/800lm 规格已确认沉淀" },
          { t: "2 · 先寄一台 IP65 样品（下周一 DHL）", reply: null, note: null }
        ]
      },
      messages: [
        { from: "buyer", time: "昨天 11:05", text: "Please confirm the IP rating — for outdoor wall lamps we need at least IP65. What are the lumens per unit?", zh: "请确认 IP 等级——户外壁灯至少要 IP65。单台流明是多少？" },
        { from: "me", time: "昨天 11:40", text: "Hi Kenji, IP65 confirmed and 800 lm per unit. I will send the full spec sheet today." }
      ]
    },
    {
      id: "b6", name: "Chloe Martin", company: "Lumière Décor", country: "法国", cc: "FR",
      product: "太阳能仙光灯", qty: "5000 件", amount: 7600, currency: "$",
      intent: 59, stage: 2, followIn: 2, lastActive: "2 天前", unread: 0,
      tags: ["定制包装"], quoteNo: "Q-2026-103", daysInStage: 2,
      wa: "+33 6 12 40 87 22",
      profile: {
        address: "Chloe 女士",
        style: "重品质与审美，表达讲究，反感粗线条",
        tip: "包装/设计类话题给足专业细节和视觉材料"
      },
      context: [
        { k: "包装", v: "定制彩盒 · 法语标签 · CE 可见" }
      ],
      messages: [
        { from: "me", time: "2 天前", text: "Hi Chloe, custom color box mockup with French labeling will be ready tomorrow. I will share the PDF." },
        { from: "buyer", time: "2 天前", text: "Perfect. One note: the French text must keep the CE marking visible on the back panel.", zh: "没问题。注意一点：法语标签要保留背板上可见的 CE 标志。" }
      ]
    },
    {
      id: "b7", name: "Liam O'Connor", company: "Emerald Outdoor", country: "爱尔兰", cc: "IE",
      product: "庭院灯套装", qty: "800 套", amount: 3200, currency: "$",
      intent: 38, stage: 0, followIn: 5, lastActive: "4 天前", unread: 0,
      tags: ["首次询盘"], quoteNo: "—", daysInStage: 4,
      wa: "+353 87 220 4163",
      profile: {
        address: "Liam",
        style: "英式克制，简洁直接，讨厌推销腔",
        tip: "首触别推销，先给可对比的规格与价格资料"
      },
      messages: [
        { from: "buyer", time: "4 天前", text: "Hello, we are comparing three suppliers for the solar garden light set. What is your MOQ and lead time?", zh: "你好，我们正在对比三家供应商的太阳能庭院灯套装。你们的起订量和交期是多少？" }
      ]
    },
    {
      id: "b8", name: "Tom Becker", company: "Veldgroen BV", country: "荷兰", cc: "NL",
      product: "LED 投光灯 150W", qty: "1500 件", amount: 2900, currency: "$",
      intent: 33, stage: 0, followIn: 7, lastActive: "5 天前", unread: 0,
      tags: ["比价中"], quoteNo: "—", daysInStage: 5,
      wa: "+31 6 2214 7890",
      profile: {
        address: "Tom",
        style: "直率，讲效率，喜欢直接比数字",
        tip: "给逐项数字对比（价格/保修/驱动寿命），别绕弯"
      },
      messages: [
        { from: "buyer", time: "5 天前", text: "Your quotation is about 8% above another supplier. Can you match their price?", zh: "你们的报价比另一家供应商高约 8%。能匹配他们的价格吗？" }
      ]
    },
    {
      id: "b9", name: "Manoel Dos Passos", company: "Sp industria", country: "巴西", cc: "BR",
      product: "电动行李箱 / 学生书包", qty: "50–200 件/月", amount: 0, currency: "$",
      intent: 82, stage: 2, followIn: -12, lastActive: "12 天未回复", unread: 0,
      tags: ["箱包批发商", "自有报关行", "只找工厂", "社媒广告来客"], quoteNo: "价目表已发", daysInStage: 12,
      wa: "+55 84 98177-0012",
      profile: {
        address: "Manoel（他先称 meu amigo / irmão，可以跟进）",
        style: "热情直接、关系驱动，晚上活跃（巴西时间 19–21 点）",
        tip: "承诺的视频/报价当日兑现；别向客户抱怨清关"
      },
      context: [
        { k: "身份", v: "箱包批发 / 分销商" },
        { k: "规模", v: "自称 20 柜/月（待核实）" },
        { k: "选品", v: "15,000 只书包选型中" },
        { k: "需求", v: "电动行李箱 50–200 件/月 · 稳定补货" },
        { k: "物流", v: "自有报关行 · FOB 即可" },
        { k: "卡点", v: "承诺的书包视频未发 · 报价后无回音" }
      ],
      compare: {
        intent: "客户看着屏幕上的学生书包说 \"Quero essas\"（我要这些），想确认用途并给他书包视频。",
        literal: "É principalmente para estudantes? Obter bolsas de estudo. Somos uma combinação de eletrônicos e embalagens.",
        local: "Essas mochilas escolares estão dentro da sua seleção de 15 mil unidades, certo? É a linha que mais embarcamos para o Brasil. Segue o vídeo da linha escolar — me diz: prioriza volume 20L ou 30L?",
        notes: [
          "bolsa de estudo = 奖学金；书包 = mochila escolar——直译让客户以为在聊留学",
          "箱包 = linha de malas / mochilas，不是 embalagens（包装材料）",
          "把\"确认用途\"改成带选项的具体问题（20L/30L），直接接住他的 15,000 只选型"
        ]
      },
      options: {
        text: "下一步怎么走？回复 1 或 2",
        items: [
          { t: "1 · 先补发学生书包视频 + 3–5 个选型方案（接 15,000 只）", reply: "Perfeito, manda o vídeo das mochilas que eu passo para a equipe ainda hoje.", note: "客户确认先推进书包线，已沉淀" },
          { t: "2 · 电动行李箱试单 200 件 / 20GP，本周五发 PI", reply: null, note: null }
        ]
      },
      messages: [
        { from: "buyer", time: "7/23 18:54", text: "Olá! Preenchi seu formulário: Luggage wholesaler / Distributor, 50–200 units (stable monthly restock), Factory FOB price list.", zh: "你好！我填了表单：箱包批发/分销商，每月稳定补货 50–200 件，要工厂 FOB 价目表。" },
        { from: "buyer", time: "7/23 19:26", text: "Importamos muito da China. Tenho despachante de cargas.", zh: "我们从中国进口很多，有货运报关行。" },
        { from: "buyer", time: "7/23 19:37", text: "Compramos 20 contêiner/mês na China.", zh: "我们每月从中国采购 20 个柜。" },
        { from: "me", time: "7/23 19:45", text: "Bagagens elétricas atualmente são um mercado inexplorado na América do Sul.", zh: "电动行李箱目前在南美还是空白市场。" },
        { from: "buyer", time: "7/23 19:46", text: "Ainda vende pouco. Acho que podemos fazer grandes negócios.", zh: "（这个品类）目前还卖得少。我觉得我们可以做大生意。" },
        { from: "me", time: "7/28 06:57", text: "É principalmente para estudantes? Obter bolsas de estudo.", zh: "（直译腔）主要是学生用？为了获取奖学金。" },
        { from: "buyer", time: "7/28 06:57", text: "Quero essas. Pode mandar um vídeo da suas bolsas que já converso com a equipe.", zh: "我要这些。把书包视频发我，我就跟团队对接。" },
        { from: "buyer", time: "7/28 07:02", text: "Qual o preço? Cabe quantas no contêiner?", zh: "价格多少？一个柜能装多少？" },
        { from: "me", time: "7/28 07:13", text: "20GP: cerca de 300 peças / 40HQ: cerca de 700 peças.", zh: "20GP：约 300 件 / 40HQ：约 700 件。" },
        { from: "me", time: "8/16 20:27", text: "Irmão, ouvi dizer que o despacho aduaneiro no Brasil é bastante complicado. Isso é realmente um aborrecimento.", zh: "（最后一条，客户此后 12 天未回复）兄弟，听说巴西清关挺复杂的……" }
      ]
    }
  ];

  var suggestions = {
    b1: [
      { style: "阶梯报价 · 守住利润", text: "Hi Marcus, for 500 pcs in one batch we can offer €24.2/pc FOB (CE + 2-year warranty included). Two shipments are fine: 300 pcs in Nov, 200 in Dec. Shall I send the PI today?", zh: "给 Marcus 报价：500 件一批，FOB €24.2/件（含 CE 认证 + 2 年质保）。分两批出货没问题：11 月 300 件、12 月 200 件。要不要今天就把形式发票（PI）发给你？" },
      { style: "以量换价 · 促大单", text: "Hi Marcus, I can meet €23.5 if we move to 800 pcs (the 500-pc tier would be €23.8). Holiday demand is strong this year — locking the November slot now secures your delivery window.", zh: "给 Marcus：如果量加到 800 件，我可以做到 €23.5（500 件档是 €23.8）。今年节日季需求很旺，现在锁定 11 月产能才能保证你的交期。" }
    ],
    b2: [
      { style: "守住价格 · 强调认证", text: "Hi Sofia, our $4.9/pc includes NOM-certified drivers and 3-year warranty; uncertified drivers often fail NOM inspection. For 2,000 pcs we can offer $4.72 with a signed annual re-order plan.", zh: "给 Sofia：我们 $4.9/件 已经包含有 NOM 认证的驱动电源和 3 年质保，没有认证的驱动经常过不了 NOM 检测。如果 2,000 件 + 签年度返单协议，可以给到 $4.72。" },
      { style: "拆单试水 · 降低门槛", text: "Hi Sofia, to start we can do 500 pcs at $4.85 with full NOM documents. If quality checks out, the remaining 1,500 lock today's price for Q1 delivery.", zh: "给 Sofia：先做 500 件试单，$4.85/件，NOM 全套文件齐全。如果质量过关，剩下 1,500 件按今天的价格锁定，一季度内交付。" }
    ],
    b3: [
      { style: "账期置换 · 银行保函", text: "Hi Priya, we support Net 30 via open account after 2 confirmed orders, or a 1% bank guarantee for this order. Alternatively: 30% deposit + 70% against B/L copy — which works better for your procurement team?", zh: "给 Priya：完成 2 单之后我们支持月结 30 天（Net 30 赊销），或者本单提供 1% 银行保函。也可以：30% 定金 + 70% 见提单副本付尾款——哪种更符合你们采购部的流程？" },
      { style: "分批交付 · 快速锁定", text: "Hi Priya, we can ship 300 units within 25 days under deposit terms and move to OA on the balance — this keeps your stock live without a policy exception.", zh: "给 Priya：可以先按定金条款 25 天内发 300 台，后续货款转月结（OA）——这样不用走你们的特批流程，库存也能先转起来。" }
    ],
    b4: [
      { style: "验样邀约", text: "Hi Amira, glad the samples arrived! Shall we set a 20-minute video check this week? After approval, mass production of 3,000 units starts within 2 days.", zh: "给 Amira：样品收到了吧？这周约个 20 分钟视频验样吗？确认后 3,000 台量产 2 天内就开工。" },
      { style: "交期承诺", text: "Hi Amira, confirmed: 3,000 units in 30 days, 2-year warranty, 2% free spare drivers. I will include the QC checklist in the PI for your team.", zh: "给 Amira：确认一下——3,000 台 30 天交完，2 年质保，另送 2% 的备用驱动电源。质检清单（QC checklist）我会放进 PI 里给你们团队。" }
    ],
    b5: [
      { style: "规格确认", text: "Hi Kenji, confirmed IP65 (tested per JIS C 0900) and 800 lm per unit, with 220V AC + solar hybrid option. Spec sheet attached — can we finalize the BOM this Friday?", zh: "给 Kenji：确认规格——IP65 防护（按 JIS C 0900 标准测试）、单台 800 流明，支持 220V 交流 + 太阳能混合供电。规格书已附上，这周五能把 BOM（物料清单）定下来吗？" },
      { style: "样品推进", text: "Hi Kenji, to speed things up we can ship one IP65 sample next Monday by DHL (3-4 days to Japan). Shall I arrange it?", zh: "给 Kenji：为了加快进度，下周一可以走 DHL 发一台 IP65 样品（到日本 3–4 天）。需要我来安排吗？" }
    ],
    b6: [
      { style: "包装确认", text: "Hi Chloe, the color box mockup with French labeling and CE marking on the back panel is ready — please check the attached PDF. Once approved, we start the 5,000-unit run.", zh: "给 Chloe：彩盒打样做好了，带法语标签、背板印 CE 标志，请看附件 PDF。确认后 5,000 台就可以开做。" },
      { style: "交期 + 价格双确认", text: "Hi Chloe, 5,000 units at $1.52/pc FOB with custom boxes, 35-day lead time. Ordering 10% earlier gets you the Q3 production slot.", zh: "给 Chloe：5,000 台、定制彩盒，FOB $1.52/件，交期 35 天。如果提前 10% 下单，可以排进 Q3（三季度）的产能档期。" }
    ],
    b7: [
      { style: "MOQ 破冰", text: "Hi Liam, our MOQ for the garden light set is 200 sets, mixed SKUs accepted. Would you like the full spec sheet and price list for comparison?", zh: "给 Liam：庭院灯套装的起订量（MOQ）是 200 套，可以混 SKU。需要我把完整规格书和价目表发给你对比一下吗？" },
      { style: "免费样品", text: "Hi Liam, happy to send 2 sample units free (courier collect) so you can compare build quality directly against the other two quotes.", zh: "给 Liam：可以免费发 2 台样品（运费到付），方便你直接跟另外两家的报价对比做工质量。" }
    ],
    b8: [
      { style: "价值对比", text: "Hi Tom, our units carry a 3-year warranty and 20,000-hour rated LED driver — the 8% gap usually disappears after the first replacement cycle. Happy to share the test reports.", zh: "给 Tom：我们的货带 3 年质保，LED 驱动寿命额定 20,000 小时——那 8% 的价差一般在第一次换货周期后就抹平了。需要的话测试报告可以发给你。" },
      { style: "直配价促成交", text: "Hi Tom, if you confirm the 1,500-unit order by Friday, I can match $3.1/pc for this batch as a first-order goodwill price.", zh: "给 Tom：如果周五前确认 1,500 台的订单，这批我可以按 $3.1/件 的诚意首单价配给你。" }
    ]
  };

  var followups = [
    { id: "f7", buyerId: "b9", action: "兑现承诺：发学生书包视频 + 3–5 个选型方案（客户 15,000 只）", dueIn: -12, done: false },
    { id: "f1", buyerId: "b3", action: "发 PI 草稿给 Priya，确认 30% 定金 + 70% 发货前账期", dueIn: -2, done: false },
    { id: "f2", buyerId: "b1", action: "回复 Marcus 降价要求，给出阶梯价 + 分批出运方案", dueIn: -1, done: false },
    { id: "f3", buyerId: "b2", action: "跟进 Sofia 对 Q-2026-102 报价的反馈", dueIn: 0, done: false },
    { id: "f4", buyerId: "b5", action: "与 Kenji 确认壁灯防水等级与 BOM 细节", dueIn: 1, done: false },
    { id: "f5", buyerId: "b6", action: "发送 Chloe 定制彩盒包装效果图", dueIn: 2, done: false },
    { id: "f6", buyerId: "b4", action: "跟踪 Amira 样品签收，预约视频验样", dueIn: 3, done: false }
  ];

  var week = {
    labels: ["一", "二", "三", "四", "五", "六", "日"],
    values: [6, 8, 5, 9, 7, 10, 4],
    todayIdx: 4
  };

  var kpis = [
    { label: "本周新增询盘", value: 49, delta: "+18% 环比" },
    { label: "24h 回复率", value: 94, suffix: "%", delta: "+2pp 环比" },
    { label: "进行中谈单", value: 9, sub: "3 笔谈判 · 3 笔报价" },
    { label: "本月成交额", value: 36400, prefix: "$", delta: "+26% 环比" }
  ];

  function getBuyer(id) {
    for (var i = 0; i < buyers.length; i++) if (buyers[i].id === id) return buyers[i];
    return null;
  }

  window.Mock = {
    STAGES: STAGES,
    buyers: buyers,
    suggestions: suggestions,
    followups: followups,
    week: week,
    kpis: kpis,
    getBuyer: getBuyer
  };
})();
