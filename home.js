/* ===== 页面：首页 · 数据看板 ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  /* ===== ② 风格自动学习：原话配对（raw=业务员自己写的中文意图，text=实际发给客户的英文）攒够后，
     一键让 AI 从中提炼「谈单思路 + 常用话术」存进 persona（云端按账号隔离），
     之后所有 AI 生成自动贴近本人风格；结果在 设置→我的思路与话术 里可看可改 ===== */
  var AUTO_MARK = "【AI 自动学习";
  var MANUAL_MARK = "【本人补充】";

  function collectPairs() {
    var pairs = [], seen = {};
    Mock.buyers.forEach(function (b) {
      (b.aiEvents || []).forEach(function (e) {
        if (e.t !== "sent" || !e.raw) return;
        var k = String(e.raw) + "" + String(e.text || "");
        if (seen[k]) return;
        seen[k] = 1;
        pairs.push(e);
      });
    });
    return pairs.slice(-60);
  }

  function parseObj(t) {
    try { return JSON.parse(t); } catch (e) {}
    var m = String(t).match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }

  /* 合并旧 persona：剥掉上一轮的自动学习块，只保留手写部分拼在后面 */
  function mergeOld(old) {
    old = String(old || "");
    var iSup = old.indexOf(MANUAL_MARK);
    var iAuto = old.indexOf(AUTO_MARK);
    if (iSup >= 0) return old.slice(iSup + MANUAL_MARK.length).trim();
    if (iAuto >= 0) return "";
    return old.trim();
  }

  function runLearn(btn) {
    var pairs = collectPairs();
    if (pairs.length < 30) { App.toast("还差 " + (30 - pairs.length) + " 条原话配对才够学习门槛"); return; }
    btn.disabled = true;
    btn.textContent = "学习中…（约 10 秒）";
    var lines = pairs.map(function (e, i) {
      return (i + 1) + ". 我的原话（中文意图）：" + String(e.raw).slice(0, 120) + "\n   实际发给客户：" + String(e.text || "").slice(0, 220);
    }).join("\n");
    LLM.chat(
      "你是外贸业务员风格分析师。下面是一批真实记录，每条=「我的原话」（业务员自己写的中文意图）+「实际发给客户」（最终被业务员接受并发出的英文消息）。请提炼这位业务员的谈单思路和他真实常用的话术，供 AI 以后模仿他的风格。只输出严格 JSON：{\"thoughts\":\"...\",\"scripts\":\"...\"}。要求：thoughts 300 字以内，写他的谈单节奏与习惯（先做什么、后做什么、怎么推进）；scripts 600 字以内，从「实际发给客户」里摘取他常用的开头、报价、催单、跟进句式，贴近原文，禁止编造他没出现过的说法。",
      lines,
      { max_tokens: 1200, temp: 0.3 }
    ).then(function (t) {
      var o = parseObj(t);
      if (!o || (!o.thoughts && !o.scripts)) throw new Error("学习结果无法解析");
      var p = Store.getPersona();
      var date = new Date().toLocaleDateString("zh-CN");
      var autoT = AUTO_MARK + " · " + date + "】\n" + String(o.thoughts || "").trim();
      var autoS = AUTO_MARK + " · " + date + "】\n" + String(o.scripts || "").trim();
      var manualT = mergeOld(p.thoughts), manualS = mergeOld(p.scripts);
      var newT = autoT + (manualT ? "\n\n" + MANUAL_MARK + "\n" + manualT : "");
      var newS = autoS + (manualS ? "\n\n" + MANUAL_MARK + "\n" + manualS : "");
      Store.savePersona(newT.slice(0, 4000), newS.slice(0, 6000));
      App.toast("已学会你的风格 · 以后 AI 都按你的方式说话（设置里可改）");
      App.refresh();
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = "✦ 开始风格自动学习";
      App.toast("学习失败：" + String((err && err.message) || err).slice(0, 40));
    });
  }

  window.Screens.home = {
    title: "谈单看板",

    render: function () {
      var K = Mock.kpis.slice(), W = Mock.week;
      var open = Mock.buyers.filter(function (b) { return b.stage < 5; });
      var neg = open.filter(function (b) { return b.stage === 3; }).length;
      var qte = open.filter(function (b) { return b.stage === 2; }).length;
      K[2] = { label: "进行中谈单", value: open.length, sub: neg + " 笔谈判 · " + qte + " 笔报价" };

      var dist = [
        { label: "A · 高意向 (80+)", color: "#128A5F", value: Mock.buyers.filter(function (b) { return U.grade(b.intent) === "A"; }).length },
        { label: "B · 中意向 (55+)", color: "#C77F1B", value: Mock.buyers.filter(function (b) { return U.grade(b.intent) === "B"; }).length },
        { label: "C · 低意向", color: "#8A968F", value: Mock.buyers.filter(function (b) { return U.grade(b.intent) === "C"; }).length }
      ];

      var due = Mock.followups
        .filter(function (f) { return f.dueIn <= 0 && !f.done; })
        .sort(function (a, b) { return a.dueIn - b.dueIn; })
        .slice(0, 3);

      var overdueCnt = Mock.followups.filter(function (f) { return f.dueIn < 0 && !f.done; }).length;

      var kpiHtml = K.map(function (k) {
        return '<div class="card kpi">' +
          '<div class="kpi-label">' + k.label + "</div>" +
          '<div class="kpi-value" data-count="' + k.value + '" data-prefix="' + (k.prefix || "") + '" data-suffix="' + (k.suffix || "") + '">0</div>' +
          (k.delta ? '<div class="kpi-delta up">' + k.delta + "</div>" : '<div class="kpi-delta sub">' + (k.sub || "") + "</div>") +
          "</div>";
      }).join("");

      var dueHtml = due.map(function (f) {
        var b = Mock.getBuyer(f.buyerId);
        return '<div class="row-item" data-id="' + b.id + '">' + U.avatar(b) +
          '<div class="row-main"><b>' + escHtml(f.action) + '</b><div class="row-sub">' + escHtml(b.name) + " · " + Mock.STAGES[b.stage] + "</div></div>" +
          U.dueBadge(f.dueIn) + "</div>";
      }).join("") || '<div class="empty">太棒了，暂无逾期或今日跟进</div>';

      var now = new Date();
      var hour = now.getHours();
      var greet = hour < 11 ? "早上好" : hour < 13 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
      var dStr = (now.getMonth() + 1) + "月" + now.getDate() + "日 " + ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
      var myName = (Store.getSettings() || {}).name || "Cherry";
      /* AI 学习进度：统计本账号真实消息里的原话配对（sent 且带 raw），用于提示离 ②/④ 的门槛还差多少 */
      var learned = Mock.buyers.reduce(function (s, b) { return s + (b.aiEvents || []).filter(function (e) { return e.t === "sent" && e.raw; }).length; }, 0);
      var pNow = (window.Store && Store.getPersona) ? Store.getPersona() : null;
      var trained = !!(pNow && pNow.updated && String(pNow.thoughts || "").indexOf(AUTO_MARK) >= 0);
      var llmOn = !!(window.LLM && LLM.configured());
      var bannerBase = '<div style="margin:0 16px 12px;padding:10px 12px;border-radius:10px;background:#EAF5F0;border:1px solid #CDE7DC;color:#0F5138;font-size:13px;line-height:1.5">';
      var learnHtml;
      if (!llmOn) {
        learnHtml = bannerBase + "<b>AI 学习进度</b> · 已积累 <b>" + learned + "</b> 条原话配对 · 去「设置 → 智能引擎」配置 AI 后，这里可一键学会你的风格</div>";
      } else if (learned < 30) {
        learnHtml = bannerBase +
          "<b>AI 学习进度</b> · 已积累 <b>" + learned + "</b> 条原话配对（满 30 条解锁「风格自动学习」，满 1 周出「教练周报」）" +
          '<div style="margin-top:4px;font-size:11.5px;opacity:.8">攒法：在客户详情页写中文意图 → AI 扩充/翻译 → 发送，每发一条自动记一条</div></div>';
      } else {
        var btnLabel = trained ? "再学一次（用新消息刷新）" : "✦ 开始风格自动学习";
        learnHtml = bannerBase +
          "<b>AI 学习进度</b> · " + (trained ? "已学会你的风格 · 累计 <b>" + learned + "</b> 条原话配对" : "已攒够 <b>" + learned + "</b> 条原话配对") +
          '<div style="margin-top:8px"><button type="button" data-act="start-learn" style="background:#0E5E4A;color:#fff;border:0;border-radius:999px;padding:8px 16px;font-size:13px;font-weight:700">' + btnLabel +
          '</button><span style="font-size:11px;opacity:.75;margin-left:8px">学完存进「设置 → 我的思路与话术」，可看可改</span></div></div>';
      }
      return UI.topbar(greet + "，" + escHtml(myName), dStr + " · " + due.length + " 笔跟进待处理，其中 " + overdueCnt + " 笔已逾期", UI.bell + UI.gear) +
        '<div class="kpis stagger">' + kpiHtml + "</div>" +
        learnHtml +
        '<div class="home-row stagger">' +
        '<div class="card chart-card"><div class="chart-head"><b>近 7 日询盘</b><span>合计 ' + U.sum(W.values) + " 条</span></div>" +
          U.barChart(W.values, W.labels, W.todayIdx) + "</div>" +
        '<div class="card donut-card"><div class="chart-head"><b>意向分布</b></div>' +
          U.donut(dist) +
          '<div class="legend">' + dist.map(function (d) {
            return "<div><i style='background:" + d.color + "'></i>" + d.label + "<b>" + d.value + "</b></div>";
          }).join("") + "</div>" +
        "</div>" +
        "</div>" +
        '<div class="wa-banner"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1l.8-.9c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.5-.1 1.1Z"/></svg><div><b>WhatsApp 过渡模式已开启</b><span>走官方通道 · 客户零感知；信息自动沉淀，报价与提醒一键交接发送</span></div></div>' +
        '<div class="sec-title"><h2>今日待跟进</h2><span class="sec-more" data-act="goto-followup">全部跟进 ›</span></div>' +
        '<div class="stagger">' + dueHtml + "</div>";
    },

    init: function (param, root) {
      root.querySelectorAll("[data-count]").forEach(function (el) {
        U.countUp(el, Number(el.dataset.count), { prefix: el.dataset.prefix || "", suffix: el.dataset.suffix || "" });
      });
      root.querySelectorAll(".row-item[data-id]").forEach(function (el) {
        el.addEventListener("click", function () { App.go("buyer", el.dataset.id); });
      });
      var more = root.querySelector('[data-act="goto-followup"]');
      if (more) more.addEventListener("click", function () { App.go("followup"); });
      var learnBtn = root.querySelector('[data-act="start-learn"]');
      if (learnBtn) learnBtn.addEventListener("click", function () { runLearn(learnBtn); });
      var gear = root.querySelector('[data-act="settings"]');
      if (gear) gear.addEventListener("click", function () { App.go("settings"); });
    }
  };
})();
