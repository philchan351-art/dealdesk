/* ===== 页面：首页 · 数据看板 ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

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
      return UI.topbar(greet + "，" + escHtml(myName), dStr + " · " + due.length + " 笔跟进待处理，其中 " + overdueCnt + " 笔已逾期", UI.bell + UI.gear) +
        '<div class="kpis stagger">' + kpiHtml + "</div>" +
        '<div style="margin:0 16px 12px;padding:10px 12px;border-radius:10px;background:#EAF5F0;border:1px solid #CDE7DC;color:#0F5138;font-size:13px;line-height:1.5"><b>AI 学习进度</b> · 已从你的真实消息学到 <b>' + learned + '</b> 条原话配对（满 30 条可开启「风格自动学习」，满 1 周可出「教练周报」）</div>' +
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
      var gear = root.querySelector('[data-act="settings"]');
      if (gear) gear.addEventListener("click", function () { App.go("settings"); });
    }
  };
})();
