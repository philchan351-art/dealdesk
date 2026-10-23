/* ===== 页面：谈单作战台 =====
 * 同时多人聊单的一屏调度台：谁在等我 → 逾期/到期 → 按计划 → 等客户（默认收起）。
 * 每张卡自动带"一句话当前状态"（点一下可改成你的备注）、最近一条消息、承诺未兑现、AI 草稿。
 * 发送走 WhatsApp 过渡模式（wa.me 预填，人点发送），不自动发；发送行为写 aiEvents 供学习层使用。 */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  var WA_ICON = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1l.8-.9c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.5-.1 1.1Z"/></svg>';

  var SORTS = [
    { k: "wait", n: "谁在等我" },
    { k: "stage", n: "按阶段" },
    { k: "time", n: "按时间" },
    { k: "country", n: "按国家" }
  ];
  var sort = "wait";
  var muted = {}; /* 本会话内"一键静音"的客户 id → 1 */

  function lastMsg(b) {
    var ms = b.messages || [];
    return ms.length ? ms[ms.length - 1] : null;
  }
  function fuOf(b) {
    for (var i = 0; i < Mock.followups.length; i++) {
      var f = Mock.followups[i];
      if (f.buyerId === b.id && !f.done) return f;
    }
    return null;
  }
  function draftOf(b) {
    var s = Mock.suggestions && Mock.suggestions[b.id];
    return (s && s[0]) || null;
  }
  function pri(b) {
    var f = fuOf(b);
    if ((f && U.followDays(f) < 0) || b.unread > 0) return 0; /* 等你：逾期承诺 或 有新消息 */
    if (U.buyerFollowDays(b) <= 3) return 1; /* 今天/明天到期（2026-10-22：按 dueDate 滚动计算） */
    if (lastMsg(b) && lastMsg(b).from === "me") return 3; /* 等客户 */
    return 2;
  }
  function priTitle(p) {
    return ["需要你回", "今天/明天到期", "按计划推进", "等客户回复"][p] || "";
  }
  function headTag(b) {
    var f = fuOf(b);
    if (f && U.followDays(f) < 0) return U.dueBadge(U.followDays(f));
    if (b.unread > 0) return '<span class="due due-hot">' + b.unread + " 条新消息</span>";
    if (f) { var fd = U.followDays(f); if (fd >= 0 && fd <= 3) return U.dueBadge(fd); }
    return "";
  }
  function ctx(b, keys) {
    var arr = b.context || [];
    for (var i = 0; i < arr.length; i++) {
      for (var k = 0; k < keys.length; k++) {
        if (arr[i].k === keys[k]) return arr[i].v;
      }
    }
    return "";
  }
  function trunc(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n) + "…" : s;
  }
  function autoStatus(b) {
    var f = fuOf(b), out = [];
    if (f && U.followDays(f) < 0) out.push("⚠ 欠他：" + trunc(f.action, 14));
    var lm = lastMsg(b);
    if (lm) {
      var who = lm.from === "me" ? "你已回" : "他在等你的回复";
      out.push(who);
      var t = lm.from === "buyer" ? (lm.zh || lm.text) : lm.text;
      out.push("· " + trunc(t, 26));
    }
    var block = ctx(b, ["卡点", "顾虑", "目标价", "预算", "交期", "账期"]);
    if (block) out.push("｜" + block);
    return trunc(out.join(" "), 84) || "刚建档，还有一次首跟没发";
  }
  function evt(b, t, extra) {
    if (!b) return;
    if (!b.aiEvents) b.aiEvents = [];
    var e = { t: t, at: new Date().toISOString() };
    if (extra) for (var k in extra) e[k] = extra[k];
    b.aiEvents.push(e);
    if (b.aiEvents.length > 200) b.aiEvents = b.aiEvents.slice(-200);
  }
  function waLink(num, text) {
    var digits = String(num || "").replace(/\D/g, "");
    if (!digits) return "";
    return "https://wa.me/" + digits + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function copyText(t) {
    function done() { App.toast("已复制 · 打开和客户的 WhatsApp 对话，粘贴发送即可"); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { App.toast("复制失败，请长按文字手动复制"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done).catch(fallback);
    } else { fallback(); }
  }
  function card(b) {
    var p = pri(b), f = fuOf(b), lm = lastMsg(b), d = draftOf(b);
    var amount = b.amount ? U.money(b.amount, b.currency) : "待报价";
    return '<div class="wcard card ' + (p === 3 ? "wcard-mute" : "") + '" data-id="' + escHtml(b.id) + '" data-p="' + p + '">' +
      '<div class="whead">' + U.avatar(b) +
      '<div class="wwho"><b>' + escHtml(b.name) + '</b><span>' + escHtml(b.company) + " · " + escHtml(b.country) + "</span></div>" +
      '<div class="wmeta">' + U.intentBadge(b.intent) + "<b>" + amount + "</b></div></div>" +
      '<div class="wsub"><span class="stage-tag">' + Mock.STAGES[b.stage] + "</span>" +
      (p === 3 ? '<span class="waiting-chip">等客户</span>' : headTag(b)) +
      '<span class="wsub-r">' + escHtml(b.product) + " · " + escHtml(b.qty) + "</span></div>" +
      '<div class="wstatus" data-act="w-edit" title="点一下改成你的备注">📌 ' + escHtml(b.warStatus || autoStatus(b)) + '</div>' +
      (lm ? '<div class="wmsg"><span class="wmsg-tag ' + (lm.from === "me" ? "me" : "in") + '">' + (lm.from === "me" ? "你 · " : "他 · ") + escHtml(lm.time || "") + "</span>" +
        '<p>' + escHtml(lm.from === "buyer" ? (lm.zh || lm.text) : lm.text) + "</p></div>" : "") +
      (f && U.followDays(f) < 0 ? '<div class="wfu"><label><i data-act="w-done" data-fid="' + escHtml(f.id) + '"></i>承诺未兑现：' + escHtml(f.action) + "</label>" + U.dueBadge(U.followDays(f)) + "</div>" : "") +
      (d
        ? '<div class="wdraft"><div class="wdraft-top"><span class="wdraft-style">AI 草稿 · ' + escHtml(d.style) + '</span>' +
          '<div class="wdraft-btns">' +
          '<button class="wdraft-copy" data-act="w-copy" data-id="' + escHtml(b.id) + '">复制</button>' +
          '<button class="wdraft-send" data-act="w-send" data-id="' + escHtml(b.id) + '">' + WA_ICON + "发 WhatsApp</button>" +
          "</div></div>" +
          '<div class="wdraft-text">' + escHtml(d.text) + "</div>" +
          (d.zh ? '<div class="wdraft-zh">中文：' + escHtml(d.zh) + "</div>" : "") +
          "</div>"
        : '<div class="wdraft empty"><span>还没有 AI 草稿</span><button class="wgo" data-act="w-go" data-id="' + escHtml(b.id) + '">去谈单页生成 →</button></div>') +
      '<div class="wfoot"><button class="wgo" data-act="w-go" data-id="' + escHtml(b.id) + '">看完整对话</button>' +
      '<button class="wgo" data-act="w-mute" data-id="' + escHtml(b.id) + '">' + (muted[b.id] ? "取消静音" : "一键静音") + "</button></div>" +
      "</div>";
  }

  /* 按时间排：lastActive 是"今天 09:12 / 昨天 / 3 天前"这类文本，统一转成 -n 比较 */
  function timeVal(b) {
    var s = String(b.lastActive || "");
    if (/刚刚/.test(s)) return -1;
    if (/今天/.test(s)) return -2;
    if (/昨天/.test(s)) return -3;
    var m = s.match(/^(\d+)\s*天前/);
    if (m) return -3 - (+m[1]);
    if (/周/.test(s)) return -10;
    if (/小时前/.test(s)) return -2;
    return -999;
  }

  function renderQueue() {
    var wrap = document.querySelector(".wqueue");
    if (!wrap) return;
    /* 2026-10-22（口径统一）：已标成交/流失的客户离开谈单队列 */
    var deals = Mock.buyers.filter(function (b) { return b.stage < 5 && !b.outcome && !muted[b.id]; });
    var groups = [];
    if (sort === "wait") {
      var p0 = deals.filter(function (b) { return pri(b) === 0; });
      var p1 = deals.filter(function (b) { return pri(b) === 1; });
      var p2 = deals.filter(function (b) { return pri(b) === 2; });
      if (p0.length) groups.push({ title: priTitle(0), n: p0.length, items: p0 });
      if (p1.length) groups.push({ title: priTitle(1), n: p1.length, items: p1 });
      if (p2.length) groups.push({ title: priTitle(2), n: p2.length, items: p2 });
    } else if (sort === "stage") {
      Mock.STAGES.slice(0, 5).forEach(function (s, i) {
        var items = deals.filter(function (b) { return b.stage === i; });
        if (items.length) groups.push({ title: s, n: items.length, items: items });
      });
    } else if (sort === "country") {
      var byC = {};
      deals.forEach(function (b) { (byC[b.country] = byC[b.country] || []).push(b); });
      Object.keys(byC).sort().forEach(function (c) {
        groups.push({ title: c, n: byC[c].length, items: byC[c] });
      });
    } else {
      groups.push({ title: "最近动态", n: deals.length, items: deals.slice().sort(function (a, b) { return timeVal(b) - timeVal(a); }) });
    }
    var html = groups.length
      ? groups.map(function (g) {
        return '<div class="wgroup"><div class="sec-title"><h2>' + escHtml(g.title) + '</h2><span class="sec-more">' + g.n + " 人</span></div>" +
          '<div class="stagger">' + g.items.map(card).join("") + "</div></div>";
      }).join("")
      : '<div class="wempty">🎉 队列空了——该歇口气了</div>';
    var mut = Mock.buyers.filter(function (b) { return b.stage < 5 && !b.outcome && muted[b.id]; });
    if (mut.length) {
      html += '<details class="wmuted"><summary>🔕 已静音 ' + mut.length + " 人（点开查看）</summary>" +
        '<div class="stagger">' + mut.map(card).join("") + "</div></details>";
    }
    wrap.innerHTML = html;
    bindCards(wrap);
  }

  function render() {
    var all = Mock.buyers.filter(function (b) { return b.stage < 5 && !b.outcome; });
    var waitN = all.filter(function (b) { return pri(b) === 0; }).length;
    var hotN = Mock.followups.filter(function (f) { return U.followDays(f) < 0 && !f.done; }).length;
    var tabs = SORTS.map(function (s) {
      return '<button class="wtab' + (s.k === sort ? " on" : "") + '" data-act="w-sort" data-sort="' + s.k + '">' + s.n + "</button>";
    }).join("");
    return UI.topbar("谈单", all.length + " 笔进行中 · " + waitN + " 笔等你回") +
      '<div class="pipe stagger">' +
      "<div><b>≈ " + U.money(U.openPipeline()) + "</b><span>在谈总额</span></div>" +
      "<div><b>" + waitN + " 人</b><span>等你回复</span></div>" +
      '<div><b>' + hotN + ' 笔</b><span>承诺已逾期</span></div>' +
      "</div>" +
      '<div class="wtabs">' + tabs + "</div>" +
      '<div class="wqueue"></div>';
  }

  function bindCards(root) {
    root.querySelectorAll(".wcard").forEach(function (cardEl) {
      cardEl.addEventListener("click", function (ev) {
        if (ev.target.closest("[data-act]")) return;
        App.go("buyer", cardEl.dataset.id);
      });
      cardEl.querySelectorAll("[data-act]").forEach(function (el) {
        el.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var act = el.dataset.act;
          var id = el.dataset.id;
          var b = id ? Mock.getBuyer(id) : Mock.getBuyer(cardEl.dataset.id);
          if (act === "w-go" && b) App.go("buyer", b.id);
          else if (act === "w-edit" && b) {
            var st = cardEl.querySelector(".wstatus");
            if (!st || st.querySelector("input")) return;
            var inp = document.createElement("input");
            inp.className = "wstatus-inp";
            inp.type = "text";
            inp.maxLength = 60;
            inp.placeholder = "一句话：他在等什么 / 你欠他什么";
            inp.value = b.warStatus || "";
            inp.addEventListener("click", function (e) { e.stopPropagation(); });
            inp.addEventListener("input", function (e) { e.stopPropagation(); });
            st.textContent = "";
            st.appendChild(inp);
            var save = document.createElement("button");
            save.className = "wstatus-save";
            save.textContent = "存";
            save.addEventListener("click", function (e) {
              e.stopPropagation();
              b.warStatus = inp.value.trim(); /* 留空 = 恢复 AI 自动 */
              evt(b, "war_status", { text: b.warStatus });
              Store.commit();
              App.toast(b.warStatus ? "已记住，下次直接显示" : "已恢复 AI 自动总结");
              renderQueue();
            });
            st.appendChild(save);
            try { inp.focus(); } catch (e) {}
          }
          else if (act === "w-copy" && b) {
            var dd = draftOf(b);
            if (dd) copyText(dd.text);
          }
          else if (act === "w-send" && b) {
            var dr = draftOf(b);
            if (!dr) return;
            var ju = waLink(b.wa, dr.text);
            if (!ju) { App.toast("这个客户还没存 WhatsApp 号，先去「谈单页 → 记 WhatsApp」"); return; }
            evt(b, "sent", { src: "war", text: dr.text, zh: dr.zh || "", style: dr.style, stage: Mock.STAGES[b.stage] });
            if (b.unread > 0) b.unread = 0;
            b.lastActive = "刚刚";
            Store.commit();
            /* 2026-10-22（Phil「客户进不去了」）：commit 已先行；当前窗口导航（Chrome 下 window.open 是后台新标签像死按钮） */
            location.href = ju;
            App.toast("已预填到 WhatsApp · 还没发送，你确认后再点发送");
          }
          else if (act === "w-done") {
            Store.toggleFollowup(el.dataset.fid, true);
            App.toast("✓ 承诺已兑现");
            renderQueue();
          }
          else if (act === "w-mute" && b) {
            if (muted[b.id]) {
              delete muted[b.id];
              App.toast("已取消静音");
            } else {
              muted[b.id] = 1;
              App.toast("已静音：只在你主动查看时出现");
            }
            renderQueue();
          }
        });
      });
    });
  }

  window.Screens.deals = {
    title: "谈单",
    render: render,
    init: function (param, root) {
      renderQueue();
      root.querySelectorAll(".wtab").forEach(function (el) {
        el.addEventListener("click", function () {
          sort = el.dataset.sort;
          root.querySelectorAll(".wtab").forEach(function (x) { x.classList.toggle("on", x === el); });
          renderQueue();
        });
      });
    }
  };
})();
