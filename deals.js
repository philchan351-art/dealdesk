/* ===== 页面：谈单 / 报价跟踪 ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  window.Screens.deals = {
    title: "谈单跟踪",

    render: function () {
      var deals = Mock.buyers.filter(function (b) { return b.stage < 5; });
      /* M1 修复：空列表 0/0 = NaN，界面上会显示"NaN 天" */
      var avg = deals.length ? Math.round(deals.reduce(function (s, b) { return s + b.daysInStage; }, 0) / deals.length) : 0;
      var neg = deals.filter(function (b) { return b.stage === 3; }).length;

      var groups = Mock.STAGES.slice(0, 5).map(function (s, i) {
        return { stage: i, name: s, items: deals.filter(function (b) { return b.stage === i; }) };
      }).filter(function (g) { return g.items.length > 0; });

      function card(b) {
        var fu = U.getFollowupByBuyer(b.id);
        var dots = Mock.STAGES.map(function (_, i) {
          return '<i class="' + (i < b.stage ? "on" : i === b.stage ? "cur" : "") + '"></i>';
        }).join("");
        return '<div class="card dcard" data-id="' + b.id + '">' +
          '<div class="drow1"><b>' + (b.amount ? U.money(b.amount, b.currency) : "待报价") + '</b><span class="stage-tag">' + Mock.STAGES[b.stage] + '</span><span class="dno">' + escHtml(b.quoteNo) + "</span></div>" +
          '<div class="drow2">' + escHtml(b.name) + '<span class="co">' + escHtml(b.company) + "</span></div>" +
          '<div class="dprod">' + escHtml(b.product) + " · " + escHtml(b.qty) + "</div>" +
          '<div class="tdots">' + dots + "</div>" +
          (fu ? '<div class="dnext"><span>' + escHtml(fu.action) + "</span>" + U.dueBadge(fu.dueIn) + "</div>" : "") +
          "</div>";
      }

      return UI.topbar("谈单", deals.length + " 笔进行中 · " + neg + " 笔谈判阶段") +
        '<div class="pipe stagger">' +
        "<div><b>≈ " + U.money(U.openPipeline()) + "</b><span>在谈总额</span></div>" +
        "<div><b>" + avg + " 天</b><span>平均阶段停留</span></div>" +
        "<div><b>" + neg + " 笔</b><span>谈判阶段</span></div>" +
        "</div>" +
        groups.map(function (g) {
          return '<div class="dgroup"><div class="sec-title"><h2>' + g.name + '</h2><span class="sec-more">' + g.items.length + " 笔</span></div>" +
            '<div class="stagger">' + g.items.map(card).join("") + "</div></div>";
        }).join("");
    },

    init: function (param, root) {
      root.querySelectorAll(".dcard").forEach(function (el) {
        el.addEventListener("click", function () { App.go("buyer", el.dataset.id); });
      });
    }
  };
})();
