/* ===== 页面：买家详情（WhatsApp 过渡模式 / 中文对照 / 国家沟通画像 / 本地化对比 / 编号选项触达） ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  var WA_ICON = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1l.8-.9c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.5-.1 1.1Z"/></svg>';

  function waLink(num, text) {
    var d = String(num || "").replace(/\D/g, "");
    if (!d) return "";
    return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "");
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

  function suggCard(s) {
    var t = String(s.text || "");
    return '<div class="sugg">' +
      '<div class="sugg-top"><span class="sugg-style">' + s.style + '</span>' +
      '<div class="sugg-btns">' +
      '<button class="sugg-use" data-text="' + t.replace(/"/g, "&quot;") + '">发到 WhatsApp</button>' +
      '<button class="sugg-copy" data-ctext="' + t.replace(/"/g, "&quot;") + '">复制</button>' +
      '</div></div>' +
      '<div class="sugg-text">' + t + "</div>" +
      (s.zh ? '<div class="sugg-zh">中文：' + s.zh + "</div>" : "") +
      "</div>";
  }

  function bubble(m) {
    var cls = m.from === "me" ? "msg-me" : "msg-buyer";
    var zh = (m.from === "buyer" && m.zh)
      ? '<div class="zh-line">' + m.zh + "</div>"
      : "";
    var ticks = m.from === "me"
      ? '<svg class="tick" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 6.5 4.5 10 11 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 6.5 10.5 10 17 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
      : "";
    return '<div class="msg ' + cls + '"><div class="bubble">' + m.text + zh +
      '<div class="msg-meta"><span>' + m.time + "</span>" + ticks + "</div></div></div>";
  }

  function remindHtml(b) {
    var fu = U.getFollowupByBuyer(b.id);
    if (!fu || fu.done) return "";
    return '<div class="remind"><b>' + U.dueLabel(fu.dueIn).text + '</b><span>' + fu.action +
      '</span><button class="rbt" data-act="fu">去跟进</button></div>';
  }

  function profileHtml(b) {
    if (!b.profile) return "";
    return '<div class="card ctx-card profile-card">' +
      '<div class="ctx-head"><span class="ctx-title">对方国家沟通画像</span><span class="ctx-hint">本地化引擎自动应用</span></div>' +
      '<div class="profile-rows">' +
      '<div class="prow"><span>称呼</span><b>' + b.profile.address + "</b></div>" +
      '<div class="prow"><span>风格</span><b>' + b.profile.style + "</b></div>" +
      '<div class="prow"><span>提示</span><b>' + b.profile.tip + "</b></div>" +
      "</div></div>";
  }

  function compareHtml(b) {
    if (!b.compare) return "";
    return '<div class="d-sec-title" style="margin-left:16px;margin-right:16px">直译 vs 地道 · 本地化对比</div>' +
      '<div class="card cmp-card" style="margin:0 16px 12px">' +
      '<div class="cmp-intent">中文意图：' + b.compare.intent + "</div>" +
      '<div class="cmp-col bad"><div class="cmp-tag">直译 · 普通翻译软件</div><p>' + b.compare.literal + "</p></div>" +
      '<div class="cmp-col good"><div class="cmp-tag">本地化改写 · DealDesk</div><p>' + b.compare.local + "</p></div>" +
      '<div class="cmp-notes">' + b.compare.notes.map(function (n) { return "<div>· " + n + "</div>"; }).join("") + "</div>" +
      "</div>";
  }

  window.Screens["buyer-detail"] = {
    title: "买家详情 · WhatsApp 过渡模式",

    render: function (param) {
      var b = Mock.getBuyer(param);
      if (!b) return '<div class="empty">未找到该买家</div>';

      var g = U.grade(b.intent);
      var sugg = Mock.suggestions[b.id] || [];

      var suggHtml = sugg.map(suggCard).join("");
      if (!suggHtml) suggHtml = '<div class="set-note" style="padding:4px 2px 10px">该买家暂无预设建议。已配置 LLM 时，点右上方"↻ 重新生成"即可基于档案生成。</div>';

      var ctx = (b.context || []);
      var ctxHtml = ctx.length
        ? '<div class="card ctx-card">' +
          '<div class="ctx-head"><span class="ctx-title">已自动沉淀</span>' +
          '<span class="ctx-hint">沟通中自动提取 · 永不重复问客户</span></div>' +
          '<div class="ctx-grid">' + ctx.map(function (c) {
            return '<div class="ctx-item"><span class="ctx-k">' + c.k + '</span><span class="ctx-v">' + c.v + "</span></div>";
          }).join("") + "</div></div>"
        : "";

      var msgHtml = b.messages.map(bubble).join("");
      var optHtml = b.options
        ? '<div class="wacard"><div class="wa-opt-label">编号选项触达 · 客户回一个数字即可，自动识别并沉淀</div>' +
          b.options.items.map(function (it, i) {
            return '<button class="wa-opt" data-oi="' + i + '">' + it.t + "</button>";
          }).join("") + "</div>"
        : "";

      return '<div class="topbar">' +
        '<div class="tb-back" data-act="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div>' +
        '<div class="tb-title"><h1>买家详情</h1><div class="tb-sub">' + b.company + " · " + b.country + " · " + b.lastActive + " 活跃</div></div>" +
        '<button class="wa-jump" data-act="jump">' + WA_ICON + "<span>直达对话</span></button>" +
        "</div>" +
        '<div class="detail-body">' +
        '<div class="card d-info">' + U.avatar(b, true) +
        '<div><div class="d-name">' + b.name + "</div>" +
        '<div class="d-sub">' + b.product + " · " + b.qty + (b.amount ? " · " + U.money(b.amount, b.currency) : " · 待报价") + "</div>" +
        '<div class="d-tags">' + b.tags.map(function (t) { return '<span class="tag">' + t + "</span>"; }).join("") + "</div></div>" +
        '<div class="d-ring">' + U.intentRing(b.intent) + "<small>意向评分</small></div>" +
        "</div>" +
        '<div class="card tracker" style="margin-top:12px">' + U.stageTracker(b.stage) + "</div>" +
        remindHtml(b) +
        profileHtml(b) +
        ctxHtml +
        '<div class="d-sec-title" style="margin-left:16px;margin-right:16px">AI 回复建议 · WhatsApp 版式' +
        '<button class="regen" data-act="regen" title="基于最新档案与对话重新生成">↻ 重新生成</button></div>' +
        '<div style="padding:0 16px" id="suggWrap">' + suggHtml + "</div>" +
        compareHtml(b) +
        '<div class="d-sec-title" style="margin-left:16px;margin-right:16px">WhatsApp 对话 · 过渡模式（wa.me 一键交接）</div>' +
        '<div class="wa-chat">' +
        '<div class="wa-head">' + WA_ICON +
        '<div class="wa-hmid"><b>' + b.name + "</b><span>" + (b.wa || "已绑定") + " · 在线</span></div>" +
        '<button class="wa-lang" data-act="lang">中文对照</button>' +
        '<span class="wa-pill">官方通道 · 零感知</span>' +
        "</div>" +
        '<div class="wa-msgs" id="waMsgs">' + msgHtml + "</div>" +
        optHtml +
        "</div>" +
        "</div>" +
        '<div class="wa-composer"><input id="msgInput" placeholder="用中文输入 · 发出前按' + b.country + '表达习惯本地化"/>' +
        '<button class="wa-send" data-act="send" aria-label="发送">' + WA_ICON + "</button></div>";
    },

    init: function (param, root) {
      var b = Mock.getBuyer(param);
      if (!b) return;

      var back = root.querySelector('[data-act="back"]');
      if (back) back.addEventListener("click", function () { App.go("buyers"); });
      var fuBtn = root.querySelector('[data-act="fu"]');
      if (fuBtn) fuBtn.addEventListener("click", function () { App.go("followup"); });

      var jump = root.querySelector('[data-act="jump"]');
      if (jump) jump.addEventListener("click", function () {
        if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先用\"新增买家\"补录"); return; }
        var ju = waLink(b.wa);
        if (!ju) { App.toast("号码格式不正确，请在档案里补全国际号码（含国家码）"); return; }
        window.open(ju, "_blank");
        App.toast("已打开官方 WhatsApp → " + b.name);
      });

      var langBtn = root.querySelector('[data-act="lang"]');
      if (langBtn) langBtn.addEventListener("click", function () {
        var wa = root.querySelector(".wa-msgs");
        wa.classList.toggle("zh-on");
        langBtn.classList.toggle("active");
        App.toast(langBtn.classList.contains("active") ? "已开启中文对照" : "已关闭中文对照");
      });

      var body = root.querySelector(".detail-body");
      function scrollDown() {
        var wa = root.querySelector(".wa-msgs");
        wa.scrollTop = wa.scrollHeight;
        body.scrollTop = body.scrollHeight;
      }

      var input = root.querySelector("#msgInput");
      var msgs = root.querySelector("#waMsgs");

      function push(msg) {
        b.messages.push(msg);
        if (window.Store) Store.commit();
        var div = document.createElement("div");
        div.innerHTML = bubble(msg);
        msgs.appendChild(div.firstChild);
        scrollDown();
      }
      function sendWa(text) {
        if (!text) return;
        if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先用\"新增买家\"补录"); return; }
        var hasCn = /[一-龥]/.test(text);
        function doOpen(finalText, note) {
          var su = waLink(b.wa, finalText);
          if (!su) { App.toast("号码格式不正确，无法打开 WhatsApp"); return; }
          push({ from: "me", text: finalText, time: "刚刚" });
          input.value = "";
          window.open(su, "_blank");
          App.toast(note);
        }
        if (hasCn && window.LLM && LLM.configured()) {
          App.toast("正在按" + b.country + "商务习惯本地化…");
          LLM.localize(text, b).then(function (en) {
            en = String(en || "").trim();
            if (!en) throw new Error("为空");
            doOpen(en, "已本地化并打开 WhatsApp · 点发送即可");
          }).catch(function () {
            doOpen(text, "本地化失败，已用原文打开 WhatsApp");
          });
        } else if (hasCn) {
          doOpen(text, "已打开 WhatsApp · 这是中文，建议用上方 AI 建议的外文发给客户");
        } else {
          doOpen(text, "已打开 WhatsApp · 已预填，点发送即可（过渡模式）");
        }
      }

      function bindSugg(container) {
        container.querySelectorAll(".sugg-use").forEach(function (btn) {
          btn.addEventListener("click", function () {
            sendWa(btn.dataset.text);
          });
        });
        container.querySelectorAll(".sugg-copy").forEach(function (btn) {
          btn.addEventListener("click", function () {
            copyText(btn.dataset.ctext);
          });
        });
      }
      bindSugg(root);

      var regen = root.querySelector('[data-act="regen"]');
      if (regen) regen.addEventListener("click", function () {
        if (!window.LLM || !LLM.configured()) { App.toast("请先在设置里配置 LLM"); return; }
        var wrap = root.querySelector("#suggWrap");
        regen.disabled = true;
        wrap.innerHTML = '<div class="empty" style="padding:20px 0">正在结合最新档案与对话生成…</div>';
        LLM.suggest(b).then(function (list) {
          if (!list || !list.length) throw new Error("返回为空");
          wrap.innerHTML = list.slice(0, 2).map(suggCard).join("");
          bindSugg(wrap);
          App.toast("已基于最新上下文重新生成");
        }).catch(function (e) {
          App.toast("生成失败：" + e.message);
          App.refresh();
        }).finally(function () { regen.disabled = false; });
      });
      root.querySelector('[data-act="send"]').addEventListener("click", function () {
        sendWa(input.value.trim());
      });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") sendWa(input.value.trim()); });

      /* 编号选项：客户回数字 → 自动识别 → 上下文沉淀 → 阶段/意向自动推进 */
      root.querySelectorAll(".wa-opt").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var oi = Number(btn.dataset.oi);
          var opt = b.options.items[oi];
          if (!opt) return;
          root.querySelectorAll(".wa-opt").forEach(function (o) { o.classList.add("used"); });
          btn.classList.add("used");
          push({ from: "me", text: b.options.text + "：" + opt.t, time: "刚刚" });
          if (!opt.reply || b._optReplied) return;
          b._optReplied = true;
          setTimeout(function () {
            push({ from: "buyer", text: opt.reply, time: "刚刚" });
            b.intent = Math.min(99, b.intent + 2);
            if (b.stage < 4) b.stage++;
            b.context = b.context || [];
            b.context.push({ k: "决策", v: opt.t.replace(/^\d+ · /, "") });
            if (window.Store) Store.commit();
            App.toast("已识别客户应答 → " + opt.note + "（意向/阶段已自动更新）");
            App.go("buyer", b.id);
          }, 1200);
        });
      });

      setTimeout(scrollDown, 60);
    }
  };
})();
