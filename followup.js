/* ===== 页面：沟通记录与跟进提醒 ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  var GROUPS = [
    { name: "已逾期", test: function (f) { return f.dueIn < 0; } },
    { name: "今天", test: function (f) { return f.dueIn === 0; } },
    { name: "后续安排", test: function (f) { return f.dueIn > 0; } }
  ];

  window.Screens.followup = {
    title: "跟进提醒",

    render: function () {
      var sections = GROUPS.map(function (g) {
        var items = Mock.followups
          .filter(g.test)
          .sort(function (a, b) { return a.dueIn - b.dueIn; })
          .map(function (f) {
            var b = Mock.getBuyer(f.buyerId);
            return '<div class="fitem' + (f.done ? " done" : "") + '" data-fid="' + f.id + '" data-go="' + b.id + '">' +
              '<span class="fbx">✓</span>' +
              '<div class="fmain"><b>' + escHtml(f.action) + "</b>" +
              '<div class="fsub">' + escHtml(b.name) + " · " + Mock.STAGES[b.stage] + " · " + U.dueLabel(f.dueIn).text + "</div></div>" +
              '<button class="fgo">去谈</button>' +
              "</div>";
          }).join("");
        if (!items) return "";
        return '<div class="sec-title"><h2>' + g.name + '</h2><span class="sec-more">' + (items.split("fitem").length - 1) + " 项</span></div>" +
          '<div class="stagger">' + items + "</div>";
      }).join("");

      var feedIds = ["b1", "b2", "b3", "b5", "b6"];
      var feed = feedIds.map(function (id) {
        var b = Mock.getBuyer(id);
        var m = b.messages[b.messages.length - 1];
        return '<div class="feed-item" data-go="' + b.id + '">' + U.avatar(b) +
          '<div class="feed-txt"><b>' + escHtml(b.name) + "</b><p>" + escHtml(m.text) + "</p></div>" +
          '<span class="feed-time">' + escHtml(m.time) + "</span></div>";
      }).join("");

      return UI.topbar("跟进", "逾期优先处理，完成后可点击圆框标记") +
        sections +
        '<div class="sec-title"><h2>沟通动态</h2><span class="sec-more">最近消息</span></div>' +
        '<div class="card feed">' + feed + "</div>";
    },

    init: function (param, root) {
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
