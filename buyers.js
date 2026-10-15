/* ===== 页面：买家管理（意向分级 / 筛选 / 搜索） ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  window.Screens.buyers = {
    title: "买家管理",

    render: function () {
      return UI.topbar("买家", Mock.buyers.length + " 位活跃买家 · " + U.unreadTotal() + " 条未读消息", '<button class="topbar-add" data-act="new">＋ 新增客户</button>') +
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

        function intentArrow(b) {
          var lg = b.intentLog && b.intentLog.length ? b.intentLog[b.intentLog.length - 1] : null;
          if (!lg || !lg.d) return "";
          return lg.d > 0 ? '<i class="i-up">▲</i>' : '<i class="i-dn">▼</i>';
        }

        function card(b) {
          var g = U.grade(b.intent);
          var oc = b.outcome ? '<span class="b-outcome ' + (b.outcome.status === "won" ? "won" : "lost") + '">' + (b.outcome.status === "won" ? "已成交" : "已流失") + "</span>" : "";
          return '<div class="bcard card' + (b.unread ? " unread" : "") + '" data-id="' + b.id + '">' +
            U.avatar(b) +
            '<div class="bmid">' +
             '<div class="bmid-top"><b>' + escHtml(b.name) + "</b>" + (b.country ? ' <span class="b-country">' + escHtml(b.country) + "</span>" : "") + oc + '<span class="intent intent-' + g + '" data-bid="' + escHtml(b.id) + '" title="点一下看最近一次升降依据"><b>' + g + "</b>" + b.intent + intentArrow(b) + "</span></div>" +
            '<div class="bmid-sub">' + escHtml(b.product) + " · " + escHtml(b.qty) + (b.tags && b.tags.length ? " · " + escHtml(b.tags[0]) : "") + "</div>" +
            '<div class="bmid-meta"><span class="stage-tag">' + Mock.STAGES[b.stage] + '</span><span class="wa-badge">WhatsApp</span><span>' + escHtml(b.lastActive) + '</span></div>' +
            "</div>" +
            '<div class="bright"><button class="bcard-del" data-act="del" data-id="' + escHtml(b.id) + '" data-name="' + escHtml(b.name) + '" title="删除客户">⋯</button><b>' + (b.amount ? U.money(b.amount, b.currency) : "待报价") + "</b>" + U.dueBadge(b.followIn) + "</div>" +
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
         /* P2：默认按意向分 + 最近活跃排序，热的单永远在最上面 */
          arr.sort(function (x, y) {
            if (y.intent !== x.intent) return y.intent - x.intent;
            /* P0：updatedAt 统一 ISO 字符串后不能数值相减（得 NaN），用 Date.parse */
            return (Date.parse(y.updatedAt || 0) || 0) - (Date.parse(x.updatedAt || 0) || 0);
          });
         listEl.innerHTML = arr.length ? arr.map(card).join("") : '<div class="empty">没有匹配的买家</div>';
         listEl.querySelectorAll(".bcard").forEach(function (el) {
           el.addEventListener("click", function () { App.go("buyer", el.dataset.id); });
         });
         /* P2：点意向徽章 → 看最近一次升降的一句依据 */
         listEl.querySelectorAll(".intent").forEach(function (el) {
           el.addEventListener("click", function (ev) {
             ev.stopPropagation();
             var bb = Mock.getBuyer(el.dataset.bid);
             var lg = bb && bb.intentLog && bb.intentLog.length ? bb.intentLog[bb.intentLog.length - 1] : null;
             if (!lg) { App.toast("还没有意向变化记录——记一条客户回复后，AI 会自动升降并给依据"); return; }
             App.toast("意向 " + lg.from + "→" + lg.to + (lg.d >= 0 ? " +" : " ") + lg.d + " · " + (lg.r || "客户消息信号"));
           });
         });
        listEl.querySelectorAll('[data-act="del"]').forEach(function (btn) {
          btn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            if (!confirm("删除客户「" + btn.dataset.name + "」？删除会同步到云端，不可恢复。")) return;
            if (window.Store) Store.removeBuyer(btn.dataset.id);
            App.toast("已删除");
            App.refresh();
          });
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
