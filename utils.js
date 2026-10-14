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

  function openPipeline() {
    return sum(Mock.buyers.filter(function (b) { return b.stage < 5; }).map(function (b) { return b.amount; }));
  }

  window.U = {
    esc: escHtml,
    grade: grade, money: money, sum: sum,
    dueLabel: dueLabel, dueBadge: dueBadge,
    avatar: avatar, intentBadge: intentBadge,
    stageTracker: stageTracker, intentRing: intentRing,
    barChart: barChart, donut: donut, countUp: countUp,
    unreadTotal: unreadTotal, getFollowupByBuyer: getFollowupByBuyer, openPipeline: openPipeline
  };
})();
