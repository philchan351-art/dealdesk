/* ===== 页面：沟通记录与跟进提醒 ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  /* 2026-10-22（Phil）：分组/排序/标签全部按"有效天数"算（dueDate 日历日逐日滚动），
     不再读静态 dueIn——旧逻辑"1 天后"的任务永远不会进"今天"和"已逾期" */
  var GROUPS = [
    { name: "已逾期", test: function (f) { return U.followDays(f) < 0; } },
    { name: "今天", test: function (f) { return U.followDays(f) === 0; } },
    { name: "后续安排", test: function (f) { return U.followDays(f) > 0; } }
  ];

  var NEW_DAYS = [
    { d: 0, t: "今天" },
    { d: 1, t: "明天" },
    { d: 3, t: "3 天后" },
    { d: 7, t: "1 周后" }
  ];

  function newTaskHtml(preBuyerId) {
    var hasBuyers = Mock.buyers.length > 0;
    var opts = Mock.buyers.map(function (b) {
      return '<option value="' + escHtml(b.id) + '"' + (b.id === preBuyerId ? " selected" : "") + ">" +
        escHtml(b.name) + " · " + Mock.STAGES[b.stage] + "</option>";
    }).join("");
    var days = NEW_DAYS.map(function (x) {
      return '<button type="button" class="fu-day' + (x.d === 1 ? " active" : "") + '" data-d="' + x.d + '">' + x.t + "</button>";
    }).join("");
    return '<div class="card fu-new" id="fuNew"' + (preBuyerId ? "" : ' style="display:none"') + ">" +
      '<div class="fu-new-h">＋ 新建跟进任务<span class="fu-new-x" data-act="fu-new-x" title="收起">✕</span></div>' +
      (hasBuyers
        ? '<label class="fu-new-l">客户</label><select id="fuNewBuyer" class="set-inp">' + opts + "</select>" +
          '<label class="fu-new-l">要做什么</label><input id="fuNewAction" class="set-inp" maxlength="80" placeholder="如：发工厂视频 / 确认 PI / 寄样品跟踪单号"/>'
        : '<div class="empty" style="padding:10px 0">还没有客户——先去「买家」页建一个，再给他排跟进</div>') +
      '<label class="fu-new-l">什么时候到</label><div class="fu-days">' + days + "</div>" +
      '<button type="button" class="fu-new-save" data-act="fu-new-save">保存提醒</button>' +
      "</div>" +
      '<button type="button" class="fu-new-open" data-act="fu-new-open"' + (preBuyerId ? ' style="display:none"' : "") + ">＋ 新建跟进任务</button>";
  }

  window.Screens.followup = {
    title: "跟进提醒",

    render: function (param) {
      /* 客户页「🔔 跟进」深链：#/followup/new/<buyerId> → 表单直接打开并预选该客户 */
      var preBuyer = (param && param.indexOf("new/") === 0) ? param.slice(4) : "";
      if (preBuyer && !Mock.getBuyer(preBuyer)) preBuyer = "";

      var sections = GROUPS.map(function (g) {
        var items = Mock.followups
          .filter(g.test)
          .sort(function (a, b) { return U.followDays(a) - U.followDays(b); })
          .map(function (f) {
            var b = Mock.getBuyer(f.buyerId);
            if (!b) return ""; /* 2026-10-18（A2）：客户已删除 → 跳过该任务；旧版直接读 null 字段，整页白屏 */
            return '<div class="fitem' + (f.done ? " done" : "") + '" data-fid="' + f.id + '" data-go="' + b.id + '">' +
              '<span class="fbx">✓</span>' +
              '<div class="fmain"><b>' + escHtml(f.action) + "</b>" +
              '<div class="fsub">' + escHtml(b.name) + " · " + Mock.STAGES[b.stage] + " · " + U.dueLabel(U.followDays(f)).text + "</div></div>" +
              '<button class="fgo">去谈</button>' +
              "</div>";
          }).join("");
        if (!items) return "";
        return '<div class="sec-title"><h2>' + g.name + '</h2><span class="sec-more">' + (items.split("fitem").length - 1) + " 项</span></div>" +
          '<div class="stagger">' + items + "</div>";
      }).join("");

      /* H1 修复：旧版写死演示 ID，新账号/删客户后 getBuyer 返回 null 直接抛错，
         整个"跟进"页打不开（甚至刷新白屏）。改为从真实数据取最近 5 条有消息的客户 */
      var feed = Mock.buyers
        .filter(function (b) { return b && b.messages && b.messages.length; })
        .slice(0, 5)
        .map(function (b) {
          var m = b.messages[b.messages.length - 1];
          return '<div class="feed-item" data-go="' + escHtml(b.id) + '">' + U.avatar(b) +
            '<div class="feed-txt"><b>' + escHtml(b.name) + "</b><p>" + escHtml(m.text) + "</p></div>" +
            '<span class="feed-time">' + escHtml(m.time) + "</span></div>";
        }).join("");

      return UI.topbar("跟进", "逾期优先处理，完成后可点击圆框标记", "") +
        newTaskHtml(preBuyer) +
        sections +
        '<div class="sec-title"><h2>沟通动态</h2><span class="sec-more">最近消息</span></div>' +
        '<div class="card feed">' + feed + "</div>";
    },

    init: function (param, root) {
      /* ===== 新建跟进任务 ===== */
      var newCard = root.querySelector("#fuNew");
      var openBtn = root.querySelector('[data-act="fu-new-open"]');
      function toggleNew(show) {
        if (newCard) newCard.style.display = show ? "" : "none";
        if (openBtn) openBtn.style.display = show ? "none" : "";
      }
      if (openBtn) openBtn.addEventListener("click", function () { toggleNew(true); });
      var xBtn = newCard && newCard.querySelector('[data-act="fu-new-x"]');
      if (xBtn) xBtn.addEventListener("click", function () { toggleNew(false); });
      if (newCard) {
        newCard.querySelectorAll(".fu-day").forEach(function (ch) {
          ch.addEventListener("click", function () {
            newCard.querySelectorAll(".fu-day").forEach(function (c) { c.classList.remove("active"); });
            ch.classList.add("active");
          });
        });
        var saveBtn = newCard.querySelector('[data-act="fu-new-save"]');
        if (saveBtn) saveBtn.addEventListener("click", function () {
          var sel = root.querySelector("#fuNewBuyer");
          var inp = root.querySelector("#fuNewAction");
          var dEl = newCard.querySelector(".fu-day.active");
          if (!sel || !Mock.getBuyer(sel.value)) { App.toast("先选一个客户"); return; }
          var act = inp ? inp.value.trim() : "";
          if (!act) { App.toast("写一下要做什么，如：发工厂视频"); return; }
          var d = dEl ? Number(dEl.dataset.d) : 1;
          var f = Store.addFollowup(sel.value, act, d);
          if (f) {
            App.toast("已安排：" + act + "（" + U.dueLabel(d).text + "）");
            App.refresh();
          }
        });
      }

      /* ===== 任务列表 ===== */
      root.querySelectorAll(".fitem").forEach(function (el) {
        var f = null;
        for (var i = 0; i < Mock.followups.length; i++) if (Mock.followups[i].id === el.dataset.fid) f = Mock.followups[i];
        if (!f) return;

        el.querySelector(".fbx").addEventListener("click", function () {
          f.done = !f.done;
          if (window.Store) Store.toggleFollowup(f.id, f.done);
          el.classList.toggle("done", f.done);
          App.toast(f.done ? "已标记完成" : "已恢复待办");
        });
        el.querySelector(".fgo").addEventListener("click", function () {
          App.go("buyer", el.dataset.go);
        });
      });
      root.querySelectorAll(".feed-item").forEach(function (el) {
        el.addEventListener("click", function () { App.go("buyer", el.dataset.go); });
      });
    }
  };
})();
