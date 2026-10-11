/* ===== 页面：买家管理（意向分级 / 筛选 / 搜索） ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  window.Screens.buyers = {
    title: "买家管理",

    render: function () {
      return UI.topbar("买家", Mock.buyers.length + " 位活跃买家 · " + U.unreadTotal() + " 条未读消息", '<button class="topbar-add" data-act="new">＋ 新增</button>') +
        '<div class="search-wrap"><div class="search">' +
        '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/></svg>' +
        '<input id="buyerSearch" placeholder="搜索买家 / 公司 / 产品"/></div></div>' +
        '<div class="chips" id="intentChips">' +
        '<button class="chip active" data-k="all">全部</button>' +
        '<button class="chip" data-k="A">A 高意向</button>' +
        '<button class="chip" data-k="B">B 中意向</button>' +
        '<button class="chip" data-k="C">C 低意向</button>' +
        '<button class="chip" data-k="unread">待回复</button>' +
        "</div>" +
        '<div class="blist stagger" id="buyerList"></div>';
    },

    init: function (param, root) {
      var state = { k: "all", q: "" };
      var listEl = root.querySelector("#buyerList");
      var newBtn = root.querySelector('[data-act="new"]');
      if (newBtn) newBtn.addEventListener("click", function () {
        if (window.BuyerSheet) BuyerSheet.open();
      });

      function card(b) {
        var g = U.grade(b.intent);
        return '<div class="bcard card' + (b.unread ? " unread" : "") + '" data-id="' + b.id + '">' +
          U.avatar(b) +
          '<div class="bmid">' +
          '<div class="bmid-top"><b>' + b.name + '</b><span class="intent intent-' + g + '"><b>' + g + "</b>" + b.intent + "</span></div>" +
          '<div class="bmid-sub">' + b.product + " · " + b.qty + (b.tags && b.tags.length ? " · " + b.tags[0] : "") + "</div>" +
          '<div class="bmid-meta"><span class="stage-tag">' + Mock.STAGES[b.stage] + '</span><span class="wa-badge">WhatsApp</span><span>' + b.lastActive + "</span></div>" +
          "</div>" +
          '<div class="bright"><b>' + (b.amount ? U.money(b.amount, b.currency) : "待报价") + "</b>" + U.dueBadge(b.followIn) + "</div>" +
          "</div>";
      }

      function draw() {
        var arr = Mock.buyers.filter(function (b) {
          if (state.k === "unread") return b.unread > 0;
          if (state.k === "A" || state.k === "B" || state.k === "C") return U.grade(b.intent) === state.k;
          return true;
        });
        if (state.q) {
          var q = state.q.toLowerCase();
          arr = arr.filter(function (b) {
            return (b.name + b.company + b.product + b.country).toLowerCase().indexOf(q) !== -1;
          });
        }
        listEl.innerHTML = arr.length ? arr.map(card).join("") : '<div class="empty">没有匹配的买家</div>';
        listEl.querySelectorAll(".bcard").forEach(function (el) {
          el.addEventListener("click", function () { App.go("buyer", el.dataset.id); });
        });
      }

      root.querySelector("#buyerSearch").addEventListener("input", function (e) {
        state.q = e.target.value.trim();
        draw();
      });
      root.querySelectorAll("#intentChips .chip").forEach(function (ch) {
        ch.addEventListener("click", function () {
          root.querySelectorAll("#intentChips .chip").forEach(function (c) { c.classList.remove("active"); });
          ch.classList.add("active");
          state.k = ch.dataset.k;
          draw();
        });
      });

      draw();
    }
  };
})();
