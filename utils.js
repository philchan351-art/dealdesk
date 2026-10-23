/* ===== 工具层：格式化 / 分级 / SVG 图表构件 ===== */
(function () {
  "use strict";

  var AV_COLORS = ["#B97516", "#B4633A", "#41597A", "#5C7A3E", "#8A5A2B", "#2F6B7A"];

  /* P0（XSS 修复）：全应用统一 HTML 转义。所有来自客户消息/AI 输出/导入数据的文本
     拼进 innerHTML 前必须过这个函数（防 <img onerror> 一类存储型注入偷会话） */
  window.escHtml = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  function grade(score) { return score >= 80 ? "A" : score >= 55 ? "B" : "C"; }

  function money(v, cur) {
    cur = cur || "$";
    return (cur === "$" ? "$" : cur) + Number(v).toLocaleString("en-US");
  }

  function sum(arr) { return arr.reduce(function (s, v) { return s + v; }, 0); }

  function dueLabel(d) {
    if (d < 0) return { text: "逾期 " + (-d) + " 天", cls: "hot" };
    if (d === 0) return { text: "今天", cls: "today" };
    if (d === 1) return { text: "明天", cls: "later" };
    return { text: d + " 天后", cls: "later" };
  }

  function dueBadge(d) {
    var l = dueLabel(d);
    return '<span class="due due-' + l.cls + '">' + l.text + "</span>";
  }

  function avatar(b, size) {
    var nm = String(b.name || "");
    var parts = nm.split(" ");
    var initials = (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
    var h = 0;
    for (var i = 0; i < nm.length; i++) h += nm.charCodeAt(i);
    return '<div class="avatar' + (size ? " lg" : "") + '" style="--av:' + AV_COLORS[h % AV_COLORS.length] + '">' +
      "<span>" + escHtml(initials) + '</span><i class="av-cc">' + escHtml(b.cc) + "</i></div>";
  }

  function intentBadge(score) {
    var g = grade(score);
    return '<span class="intent intent-' + g + '"><b>' + g + "</b>" + score + "</span>";
  }

  /* 六阶段横向跟踪器 */
  function stageTracker(cur) {
    var html = '<div class="tracker">';
    Mock.STAGES.forEach(function (s, i) {
      var cls = i < cur ? "done" : i === cur ? "now" : "";
      html += '<div class="t-step ' + cls + '"><div class="t-dot">' + (i < cur ? "✓" : i + 1) +
        '</div><div class="t-label">' + s + "</div></div>";
      if (i < Mock.STAGES.length - 1) html += '<div class="t-conn"></div>';
    });
    return html + "</div>";
  }

  /* 意向评分环 */
  function intentRing(score) {
    var r = 30, c = 2 * Math.PI * r, g = grade(score);
    var filled = (score / 100) * c;
    return '<svg viewBox="0 0 76 76" class="ring">' +
      '<circle cx="38" cy="38" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="38" cy="38" r="' + r + '" class="ring-fg ring-' + g + '" ' +
      'stroke-dasharray="' + filled + " " + (c - filled) + '" transform="rotate(-90 38 38)"/>' +
      '<text x="38" y="43" text-anchor="middle" class="ring-num">' + score + "</text>" +
      "</svg>";
  }

  /* 柱状图（近 7 日询盘） */
  function barChart(values, labels, todayIdx) {
    var w = 340, h = 132, top = 18, bottom = 22;
    var plotH = h - top - bottom;
    var max = Math.max.apply(null, values);
    var slot = (w - 16) / values.length;
    var bw = Math.min(26, slot * 0.52);
    var s = "";
    values.forEach(function (v, i) {
      var x = 8 + i * slot + (slot - bw) / 2;
      var bh = Math.max(4, (v / max) * plotH);
      var y = top + plotH - bh;
      s += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="5" class="' +
        (i === todayIdx ? "bar bar-hot" : "bar") + '"/>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (y - 6) + '" class="bar-num" text-anchor="middle">' + v + "</text>";
      s += '<text x="' + (x + bw / 2) + '" y="' + (h - 8) + '" class="bar-label" text-anchor="middle">' + labels[i] + "</text>";
    });
    return '<svg viewBox="0 0 ' + w + " " + h + '" class="chart-svg">' + s + "</svg>";
  }

  /* 环形图（意向分布） */
  function donut(parts) {
    var total = sum(parts.map(function (p) { return p.value; }));
    var r = 48, c = 2 * Math.PI * r, off = 0, s = "";
    parts.forEach(function (p) {
      var len = (p.value / total) * c;
      s += '<circle cx="65" cy="65" r="' + r + '" fill="none" stroke="' + p.color + '" stroke-width="16" ' +
        'stroke-dasharray="' + len + " " + (c - len) + '" stroke-dashoffset="' + (-off) +
        '" transform="rotate(-90 65 65)"/>';
      off += len;
    });
    s += '<text x="65" y="62" text-anchor="middle" class="donut-num">' + total + "</text>";
    s += '<text x="65" y="78" text-anchor="middle" class="donut-cap">买家总数</text>';
    return '<svg viewBox="0 0 130 130" class="chart-svg">' + s + "</svg>";
  }

  /* 数字滚动 */
  function countUp(el, target, opt) {
    opt = opt || {};
    var dur = opt.dur || 900, prefix = opt.prefix || "", suffix = opt.suffix || "";
    var t0 = performance.now();
    function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
      el.textContent = prefix + v.toLocaleString("en-US") + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function unreadTotal() {
    return sum(Mock.buyers.map(function (b) { return b.unread; }));
  }

  function getFollowupByBuyer(id) {
    for (var i = 0; i < Mock.followups.length; i++) if (Mock.followups[i].buyerId === id) return Mock.followups[i];
    return null;
  }

  /* 2026-10-22（Phil：跟进到期日要每日滚动，"1 天后"不能永远是"1 天后"）：
     到期以 dueDate（具体日历日）为准算"还差几天"，负数=已逾期；
     老数据没有 dueDate 时回退静态 dueIn（store.js 启动时一次性迁移补 dueDate） */
  function daysUntilDay(dayStr) {
    if (!dayStr) return null;
    var p = String(dayStr).split("-");
    if (p.length !== 3) return null;
    var t = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(t.getTime())) return null;
    var n = new Date();
    var t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    return Math.round((t.getTime() - t0) / 86400000);
  }

  function followDays(f) {
    if (f && f.dueDate) {
      var d = daysUntilDay(f.dueDate);
      if (d !== null) return d;
    }
    return f && typeof f.dueIn === "number" ? f.dueIn : 0;
  }

  /* 客户卡上的跟进徽章：取该客户未完成任务里最先到期的那条；没有任务才退回档案静态 followIn */
  function buyerFollowDays(b) {
    var best = null;
    (Mock.followups || []).forEach(function (f) {
      if (f.buyerId !== b.id || f.done) return;
      var d = followDays(f);
      if (best === null || d < best) best = d;
    });
    return best === null ? (b.followIn || 0) : best;
  }

  /* ===== 2026-10-22（Phil：阶段判定"表面"——有实际成交都没判）：机械硬信号扫描 =====
     六阶段：0 询盘 1 需求确认 2 报价 3 谈判 4 样品确认 5 成交
     只认"已发生的硬事实"（付款/PI、样品、议价、报价、数量+单位），命中即成立，不靠语气猜；
     方向无关——"记一条"可能记客户话也可能记我方动作（"已报价 EXW 222"），信号按事实本身判。
     3 谈判要求已报价（stage>=2）：没报过价的"what's your best price"是索要报价，不是议价 */
  var STAGE_PATTERNS = [
     /* 2026-10-22（Phil：我方说"已收到款项"也要判成交信号）：收款方视角表述并入付款硬信号。
        2026-10-23（Phil：收紧）：付款方词族只认完成时态——"已付款/付了款/款付了/已付定金/
        已付50%定金"触发；裸"付款/付定金"（如"安排下周付款/他会付款/付款条件"）不再误报。
        "收到样品费"不命中（样品费不在词表，仍走 4 档样品信号）；残余假阳性由"还没成·忽略"人工兜底 */
      /* 2026-10-23（二轮，Phil「关键词出现也识别不到」）：英文付款完成式补齐——"paid"（买家说已付款最常用的词）
         原词表缺失，上轮收紧只处理了中文词族。本次新增：
         ① \bpaid\b（"I have paid/paid the deposit/he paid full"；样品费语境排除，仍归 4 档）
         ② money/funds/payment/advance/deposit/balance + sent/transferred/wired/remitted/paid/done（双向语序，
            "money sent" 与 "sent the payment" 都认；"sent the payment terms" 排除——那是条款不是付款）
         ③ payment of N done；中文打款动词族：转账了/打款了/已打款/已转账/汇了款/付过款/付完款/全款转了
         ④ 收款方补"收到付款/收到转账"（"收到付款条件"不误报）
         保持 Phil 口径：将来时（will pay/going to pay/会付/打算付）不触发，"打款条件"不误报
         2026-10-23（现场实锤，Amritpal 单）："I've received your payment" 漏判——received 后限定词
         只认 the 不认 your/a/my，最标准的收款表述反而漏。v1.5.1 起 the/your/a/my 全认 */
      { to: 5, why: "付款/PI/收款硬信号", re: /(proforma|形式发票|\bPI\b|invoice).{0,30}(sign|签|ok|confirm|received|已发|sent)|\bpaid\b(?!.{0,16}(sample|样品))|(已付(了)?|付了)(款|定金|尾款|全款)|(款|钱)付了|付(出|齐|过|完)(定金|尾款|全款|款|钱)|已付\s*\d{0,3}\s*%?\s*(款|定金|尾款)|全款已|定金已(付|打)|payment\s+(sent|made|received|done|transferred)|payment\s+(of\s+)?[\d,]+\s*(done|complete|completed)|wire\s+transfer|T\/T\s+(sent|made|done)|bank\s+transfer|(money|funds?|advance|down\s*payment|deposit|balance)\s+(sent|transferred|wired|remitted|paid|done)|(sent|transferred|wired|remitted)\s+(the\s+|a\s+)?(money|funds?|payment|deposit|advance|balance)(?![\s]*(terms|条件|plan|计划))|50\s*%\s*(deposit|advance|paid|sent)|deposit\s+(sent|paid|received|made)|\bE\.?\.C\.?T\.?\b.{0,10}(已|done|sent)|收到(了)?(货款|款项|全款|尾款|定金|付款|转账)(?!条件)|款(项)?已收|(货款|款项|尾款)已?到账|received\s+(the\s+|your\s+|a\s+|my\s+)?(payment|funds?|money|deposit|full\s+amount)|转(账|款)(了|过去|完|好了)|已转(账|款)(?![号])|已?(打|汇)(了)?(款|钱|过去)(?!条件)|全款(已)?(打|转|汇)/i },
    { to: 4, why: "样品信号", re: /(要|need|request|send|寄|发|ship|收到|确认|approve|okay|ok|paid).{0,24}(sample|样品)|(sample|样品).{0,14}(fee|cost|charge|寄|发|收到|确认|同意|ok|okay|paid|approval)|样品费|sample\s+(fee|charge|cost|order|approval|confirmed)/i },
    { to: 3, why: "议价/条款信号", needStage: 2, re: /(discount|折[扣惠]?|再?便宜|cheaper|lower\s+price|reduce\s+(the\s+)?price|price\s+(is\s+)?(too\s+)?high|降(价|到|至)|还(能|可以)?(少|降|让)|还价|counter\s*offer|net\s+(15|30|60|90)|账期|payment\s+terms|付款条件|installment|分期|\d+\s*%\s*off|start with \d+|another\s+(supplier|factory|vendor).{0,20}(cheap|low|less|better|offered|quoted)|(offered|quoted)\s+\$?\s?\d+|别家|友商|竞[品争]价)/i },
    /* 2026-10-23（二次审计，Phil「报过价还显示未报价」）：报价数字写法补齐——原式要求数字紧跟 Incoterm，
       实际写法 "EXW RMB 1,380"（中间夹货币词）与 "22美元一台"（中文每台）都不被识别。现覆盖：
       Incoterm+货币词+数字（带不带千分位）、$N per/台、货币词+N+每单位、N+货币+每单位（含"一/每"） */
    { to: 2, why: "报价信号", re: /(已|刚)?报了?价|price\s+list|quote\s+(sent|attached|here|is)|\b(EXW|FOB|CIF|DDP)\b[\s:：]*(?:USD|US\$|RMB|CNY|人民币|美元|美金)?\s?\$?\s?[\d,]{2,}|\$\s?[\d,]{2,6}\s?(per|\/|each|unit|pcs|pieces|台|个|只)|\b(USD|RMB|CNY|美元|美金|人民币)\s?\$?\s?[\d,]{2,6}\s?(?:一|每)?\s?(per|\/|each|unit|pcs|台|个|只|件)|[\d,]{2,6}\s?(美元|美金|元|RMB|USD)\s?(?:一|每)?\s?(per|\/|each|unit|pcs|台|个|只|件)/i },
    { to: 1, why: "需求信号（数量/规格）", re: /\d{2,}\s*(pcs|pieces|units|sets|台|只|个|箱|boxes|cartons|containers?|20ft|40ft|40hq|柜)|quantity\s+of\s+\d+|need\s+\d{2,}|要\s?\d{2,}/i }
  ];

  function stageScan(buyer, text) {
    var s = String(text || "");
    if (!s) return null;
    for (var i = 0; i < STAGE_PATTERNS.length; i++) {
      var p = STAGE_PATTERNS[i];
      if (p.needStage && buyer.stage < p.needStage) continue;
      if (p.re.test(s)) return { to: p.to, why: p.why };
    }
    return null;
  }

  /* 阶段推进唯一写入口：只进不退（回退=误判，走手动调阶段）、留痕 stageLog（可审计）、
     已流失客户不推进；已成交客户仅 allowWon 时允许补 5（标记成交/存量迁移两条路径） */
  function applyStage(b, to, why, src, evidence, allowWon) {
    to = Math.round(Number(to) || 0);
    if (isNaN(to) || to < 0 || to > 5) return false;
    if (b.outcome) { if (b.outcome.status === "lost" || !allowWon) return false; }
    if (to <= b.stage) return false;
    var from = b.stage;
    b.stage = to;
    b.stageLog = b.stageLog || [];
    b.stageLog.push({ from: from, to: to, at: new Date().toISOString(), why: String(why || "").slice(0, 24), src: src || "ai", evidence: String(evidence || "").slice(0, 80) });
    if (b.stageLog.length > 20) b.stageLog = b.stageLog.slice(-20);
    return true;
  }

  function openPipeline() {
    /* 2026-10-22（口径统一）：已标成交/流失的客户不计入进行中管道金额 */
    return sum(Mock.buyers.filter(function (b) { return b.stage < 5 && !b.outcome; }).map(function (b) { return b.amount; }));
  }

  /* 2026-10-23（Phil「很多客户已经报过价、甚至成交了，还显示待报价」）：报价状态按证据判，不再看金额字段。
     旧逻辑 b.amount ? money : "待报价" —— 而 amount 没有任何录入入口、恒为 0，于是所有真实客户永远"待报价"。
     新口径（三页统一）：有金额→金额；已成交→已成交；stage≥2（报价硬信号/AI 研判/手动调档都算报价证据）→已报价；否则→未报价 */
  function quoteLabel(b) {
    if (b.amount) return money(b.amount, b.currency);
    if (b.outcome && b.outcome.status === "won") return "已成交";
    if ((b.stage || 0) >= 2) return "已报价";
    return "未报价";
  }

  /* 2026-10-22（Phil「客户进不去了」微信真机）：微信内置浏览器静默拦截 window.open(_blank)，
     点「直达对话/发 WhatsApp」什么都没打开但 toast 还说"已打开"。先试新窗口，被拦截就当前窗口
     导航（wa.me 页引导打开 WhatsApp App；微信里弹"离开微信"确认，允许即跳）。返回 false=走了兜底 */
  function openExternal(url) {
    var w = null;
    try { w = window.open(url, "_blank"); } catch (e) { w = null; }
    if (!w) { location.href = url; return false; }
    return true;
  }

  function waDisplay(num) {
    var s = String(num || "").trim();
    if (!s) return "";
    return s.replace(/^\++/, "+");
  }

  window.U = {
    esc: escHtml,
    grade: grade, money: money, sum: sum,
    dueLabel: dueLabel, dueBadge: dueBadge,
    avatar: avatar, intentBadge: intentBadge,
    stageTracker: stageTracker, intentRing: intentRing,
    barChart: barChart, donut: donut, countUp: countUp,
    unreadTotal: unreadTotal, getFollowupByBuyer: getFollowupByBuyer, openPipeline: openPipeline,
    followDays: followDays, buyerFollowDays: buyerFollowDays,
    stageScan: stageScan, applyStage: applyStage,
    /* 2026-10-22（Phil「客户进不去了」微信真机）：微信内置浏览器静默拦截 window.open(_blank)，
       点「直达对话/发 WhatsApp」什么都没打开。兜底改当前窗口导航——wa.me 页会引导打开 WhatsApp App
       （微信里弹"离开微信"确认，允许即跳转）。返回 false 表示走了兜底，调用方在 toast 里补提示 */
    openExternal: openExternal,
    /* 号码展示归一：录入多打的 "++86189…" / 没打 "+" 的 "86189…" → 统一显示单个 + */
    waDisplay: waDisplay,
    /* 2026-10-23：报价状态标签（金额/已成交/已报价/未报价）——替代恒为"待报价"的旧判断 */
    quoteLabel: quoteLabel
  };
})();
