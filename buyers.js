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
      /* 2026-10-21（Phil）深链：看板「待我回复」→ #/buyers/waiting；2026-10-22：意向分布图例 → #/buyers/A|B|C
         统一预选对应筛选芯片 */
      var preK = param === "waiting" ? "unread" : (param === "A" || param === "B" || param === "C" ? param : "all");
      var state = { k: preK, q: "" };
      if (preK !== "all") {
        root.querySelectorAll("#intentChips .chip").forEach(function (c) { c.classList.toggle("active", c.dataset.k === preK); });
      }
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
            '<div class="bright"><button class="bcard-del" data-act="del" data-id="' + escHtml(b.id) + '" data-name="' + escHtml(b.name) + '" title="删除客户">⋯</button><b>' + U.quoteLabel(b) + "</b>" + U.dueBadge(U.buyerFollowDays(b)) + "</div>" +
           "</div>";
       }

      /* 2026-10-21（Phil）：「待回复」口径与看板「待我回复」完全一致——
         进行中谈单（stage<5）且最后一条消息来自客户（旧口径 b.unread>0 在记一条时从不累加，实际恒为空） */
      function waitingFor(b) {
        if (b.outcome || b.stage >= 5) return false; /* 已成交/已流失不算"待我回复"（2026-10-22 口径统一） */
        var ms = b.messages || [];
        return ms.length && ms[ms.length - 1].from === "buyer";
      }
      /* 搜索分层：0=名字以 q 开头（am→amitat）1=名字含 q（tamrta）2=仅公司/产品/国家含 q；
         名字首字母命中永远排在中间命中之前（Phil 10-21） */
      function tierOf(b, q) {
        var nm = String(b.name || "").toLowerCase();
        if (nm.indexOf(q) === 0) return 0;
        if (nm.indexOf(q) !== -1) return 1;
        return 2;
      }

      function draw() {
        var q = state.q ? state.q.toLowerCase() : "";
        var arr = Mock.buyers.filter(function (b) {
          if (state.k === "unread") return waitingFor(b);
          if (state.k === "A" || state.k === "B" || state.k === "C") return U.grade(b.intent) === state.k;
          return true;
        });
        if (q) {
          arr = arr.filter(function (b) {
            return (b.name + b.company + b.product + b.country).toLowerCase().indexOf(q) !== -1;
          });
        }
        /* 2026-10-21（Phil）：自然顺序=对话时间先后（最近活跃在前）；搜索时先按命中层级，层内仍按对话时间 */
        arr.sort(function (x, y) {
          if (q) {
            var tx = tierOf(x, q), ty = tierOf(y, q);
            if (tx !== ty) return tx - ty;
          }
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

      /* 2026-10-22（「客户进不去了」防御）：空值守卫——元素缺失不能崩 init（崩了后面所有绑定都死，按钮全变死按钮） */
      var bsInp = root.querySelector("#buyerSearch");
      if (bsInp) bsInp.addEventListener("input", function (e) {
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
