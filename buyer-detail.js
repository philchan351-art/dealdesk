/* ===== 页面：买家详情（WhatsApp 过渡模式 / 中文对照 / 国家沟通画像 / 本地化对比 / 编号选项触达） ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  var WA_ICON = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1l.8-.9c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.5-.1 1.1Z"/></svg>';

  function waLink(num, text) {
    var digits = String(num || "").replace(/\D/g, "");
    if (!digits) return "";
    return "https://wa.me/" + digits + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  function savedAt(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* ===== P1：谈单诊断 / 成交流失标记 / 行为埋点 ===== */
  var LOSE_REASONS = ["价格", "MOQ", "交期", "无响应", "选了别家", "其他"];

  function diagText(b) {
    var d = b.aiDiag || {};
    return "谈单诊断 · 下一步目标：" + (d.nextGoal || "推进") + (d.blocker && d.blocker !== "无" ? " · 卡点：" + d.blocker : "");
  }

  function outcomeHtml(b) {
    if (b.outcome) {
      var won = b.outcome.status === "won";
      return '<div class="outcome-row" style="margin:0 16px 12px">' +
        '<span class="outcome-chip ' + (won ? "won" : "lost") + '">' + (won ? "✓ 已成交" : "✗ 已流失" + (b.outcome.reason ? " · " + b.outcome.reason : "")) + "</span>" +
        '<button class="oc-clear" data-act="oc-clear">清除标记</button></div>';
    }
    return '<div class="outcome-row" style="margin:0 16px 12px">' +
      '<button class="oc-btn won" data-act="oc-won">✓ 标记已成交</button>' +
      '<button class="oc-btn lost" data-act="oc-lost">✗ 标记已流失</button></div>';
  }

  /* 埋点：记录谈单行为事件（学习层原料），每个买家保留最近 200 条 */
  function AIevt(b, t, extra) {
    if (!b) return;
    if (!b.aiEvents) b.aiEvents = [];
    var e = { t: t, at: new Date().toISOString() };
    if (extra) for (var k in extra) e[k] = extra[k];
    b.aiEvents.push(e);
    if (b.aiEvents.length > 200) b.aiEvents = b.aiEvents.slice(-200);
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

  function bubble(m, idx) {
    var zh = m.zh ? '<div class="zh-line">' + m.zh + "</div>" : "";
    if (m.from === "me") {
      var isH = m.status === "handed";
      var handed = isH
        ? '<div class="handed-bar"><span class="handed-tag">已预填到 WhatsApp · 还没发送</span>' +
          '<button class="h-y" data-act="h-y" data-idx="' + idx + '">✓ 已发</button>' +
          '<button class="h-n" data-act="h-n" data-idx="' + idx + '">✕ 没发</button></div>'
        : "";
      var meta = (m.time || "") + " " + (isH ? '<span class="h-wait">待确认</span>' : "✓✓") +
        ' <span class="m-del" data-act="m-del" data-idx="' + idx + '" title="删除这条记录">✕</span>';
      return '<div class="msg msg-me" data-idx="' + idx + '"><div class="bubble">' + m.text + handed + "</div>" +
        '<div class="msg-meta">' + meta + "</div></div>";
    }
    return '<div class="msg msg-buyer"><div class="bubble">' + m.text + zh + "</div>" +
      '<div class="msg-meta">' + (m.time || "") + "</div></div>";
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

  function langCard(b) {
    var LANGS = CountryProfiles.langs();
    var opts = '<option value="">自动 · 按国家（' + (b.country || "未知") + "）</option>" +
      LANGS.map(function (l) { return '<option value="' + l + '"' + (b.msgLang === l ? " selected" : "") + ">" + l + "</option>"; }).join("");
    return '<div class="card" style="margin-top:12px;padding:11px 13px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<span style="font-size:12px;font-weight:700;color:var(--ink);white-space:nowrap">回复语言</span>' +
      '<select id="langSel" style="flex:1;font-size:13px;font-weight:600;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--surface-2)">' + opts + "</select></div>" +
      '<div class="set-note" style="margin-top:8px">默认按国家自动；客户实际用别的语言（如人在中国但用英语）就在这里改，AI 生成 / 翻译都按它。</div>' +
      "</div>";
  }

  window.Screens["buyer-detail"] = {
    title: "买家详情 · WhatsApp 过渡模式",

    render: function (param) {
      var b = Mock.getBuyer(param);
      if (!b) return '<div class="empty">未找到该买家</div>';

      var g = U.grade(b.intent);
      var sugg = (b.aiSuggests && b.aiSuggests.items && b.aiSuggests.items.length) ? b.aiSuggests.items : (Mock.suggestions[b.id] || []);

       var suggHtml = sugg.map(suggCard).join("");
       if (!suggHtml) suggHtml = '<div class="set-note" style="padding:2px 0">还没有建议。已配置 AI 时，点上方「✦ 生成 3 条」，AI 会结合全部历史对话代写（中外语对照）。</div>';

      var ctx = (b.context || []);
      var ctxHtml = ctx.length
        ? '<div class="card ctx-card">' +
          '<div class="ctx-head"><span class="ctx-title">已自动沉淀</span>' +
          '<span class="ctx-hint">沟通中自动提取 · 永不重复问客户</span></div>' +
          '<div class="ctx-grid">' + ctx.map(function (c) {
            return '<div class="ctx-item"><span class="ctx-k">' + c.k + '</span><span class="ctx-v">' + c.v + "</span></div>";
          }).join("") + "</div></div>"
        : "";

      var msgHtml = b.messages.map(function (m, i) { return bubble(m, i); }).join("");
      var optHtml = b.options
        ? '<div class="wacard"><div class="wa-opt-label">编号选项触达 · 客户回一个数字即可，自动识别并沉淀</div>' +
          b.options.items.map(function (it, i) {
            return '<button class="wa-opt" data-oi="' + i + '">' + it.t + "</button>";
          }).join("") + "</div>"
        : "";

      return '<div class="topbar">' +
        '<div class="tb-back" data-act="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div>' +
        '<div class="tb-title"><h1>' + b.name + '</h1><div class="tb-sub">' + (b.wa ? (String(b.wa).charAt(0) === "+" ? b.wa : "+" + b.wa) : "未填 WhatsApp") + " · " + b.country + " · " + b.lastActive + " 活跃</div></div>" +
        '<button class="wa-jump" data-act="jump">' + WA_ICON + "<span>直达对话</span></button>" +
        "</div>" +
        '<div class="detail-body">' +
        '<div class="card d-info">' + U.avatar(b, true) +
        '<div><div class="d-name">' + b.name + "</div>" +
        '<div class="d-sub">' + b.product + " · " + b.qty + (b.amount ? " · " + U.money(b.amount, b.currency) : " · 待报价") + "</div>" +
        '<div class="d-tags">' + b.tags.map(function (t) { return '<span class="tag">' + t + "</span>"; }).join("") + "</div></div>" +
         '<div class="d-ring">' + U.intentRing(b.intent) + "<small>意向评分</small></div>" +
         "</div>" +
         outcomeHtml(b) +
          '<div class="card tracker" style="margin-top:10px">' + U.stageTracker(b.stage) + "</div>" +
         '<div class="d-sec-title" style="margin-top:14px;margin-left:16px;margin-right:16px">WhatsApp 对话记录 · 过渡模式</div>' +
         '<div class="set-note" style="padding:0 16px 8px;font-size:11px">预填 ≠ 已发：发送后点「✓ 已发」计入记录；没发或改过的点「✕ 没发」删除。</div>' +
        '<div class="wa-chat">' +
        '<div class="wa-head">' + WA_ICON +
        '<div class="wa-hmid"><b>' + b.name + "</b><span>" + (b.wa || "已绑定") + " · 在线</span></div>" +
        '<button class="wa-lang" data-act="lang">中文对照</button>' +
        '<span class="wa-pill">官方通道 · 零感知</span>' +
        "</div>" +
        '<div class="wa-msgs" id="waMsgs">' + msgHtml + "</div>" +
        optHtml +
        '<div class="wa-logrow"><input id="logBuyer" placeholder="客户回了什么？记一下（如：OK / 运费多少）"/>' +
        '<button class="log-btn" data-act="log-buyer">记入对话</button></div>' +
        "</div>" +
         "</div>" +
         '<div class="d-sec-title" style="margin-top:14px;margin-left:16px;margin-right:16px">回复客户 · 两种方式任选</div>' +
         langCard(b) +
         '<div class="mode-card mode-a" style="margin:0 16px 10px">' +
         '<div class="mode-head"><span class="mode-badge a">①</span>' +
         '<div class="mode-tt"><b>自己写中文 · AI 翻译成外语</b><span>写中文 → AI 翻成客户语言 → 你检查满意再发</span></div></div>' +
         '<div class="mode-a-row"><input id="msgInput" placeholder="写中文要点，如：你好，请问你主要想找什么产品？"/>' +
         '<button class="tr-btn" data-act="send">AI 翻译 →</button></div>' +
         '<div id="pendWrap"></div>' +
         "</div>" +
         '<div class="mode-card mode-b" style="margin:0 16px 10px">' +
         '<div class="mode-head"><span class="mode-badge b">②</span>' +
         '<div class="mode-tt"><b>AI 代写 · 上下文 + 长期记忆</b><span>AI 结合全部对话历史写 3 条，挑一条发</span></div>' +
         '<span id="suggLang" class="lang-chip">→ ' + ((window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语") + "</span>" +
          (b.aiSuggests ? '<span id="suggSaved" class="lang-chip saved">已存 ' + savedAt(b.aiSuggests.at) + "</span>" : "") +
          '<button class="regen" data-act="regen" title="基于最新档案与对话重新生成">' + (b.aiSuggests ? "✦ 重新生成" : "✦ 生成 3 条") + "</button></div>" +
          '<div id="diagLine" class="diag-line">' + (b.aiDiag ? diagText(b) : "谈单诊断：点「✦ 生成 3 条」后，AI 先诊断这单在哪一步、下一步推什么，再给建议") + "</div>" +
          '<div id="suggWrap">' + suggHtml + "</div>" +
          "</div>" +
         remindHtml(b) +
         profileHtml(b) +
         ctxHtml +
         compareHtml(b) +
         "</div>";
     },

    init: function (param, root) {
      var b = Mock.getBuyer(param);
      if (!b) return;

      var back = root.querySelector('[data-act="back"]');
      if (back) back.addEventListener("click", function () { App.go("buyers"); });
      var fuBtn = root.querySelector('[data-act="fu"]');
      if (fuBtn) fuBtn.addEventListener("click", function () { App.go("followup"); });

      var langSel = root.querySelector("#langSel");
       /* 成交 / 流失标记（学习层的结果标签） */
       var ocWon = root.querySelector('[data-act="oc-won"]');
       if (ocWon) ocWon.addEventListener("click", function () {
         if (!confirm("标记为已成交？（标错可点\"清除标记\"）")) return;
         b.outcome = { status: "won", at: new Date().toISOString() };
         AIevt(b, "outcome", { status: "won" });
         if (window.Store) Store.commit();
         App.toast("已记录成交");
         App.refresh();
       });
       var ocLost = root.querySelector('[data-act="oc-lost"]');
       if (ocLost) ocLost.addEventListener("click", function () {
         var row = root.querySelector(".outcome-row");
         if (!row) return;
         row.innerHTML = '<span class="oc-ask">流失原因（周报统计用）：</span>' +
           LOSE_REASONS.map(function (r) { return '<button class="oc-reason" data-r="' + r + '">' + r + "</button>"; }).join("") +
           '<button class="oc-clear" data-act="oc-cancel">取消</button>';
         row.querySelectorAll(".oc-reason").forEach(function (btn) {
           btn.addEventListener("click", function () {
             b.outcome = { status: "lost", reason: btn.dataset.r, at: new Date().toISOString() };
             AIevt(b, "outcome", { status: "lost", reason: btn.dataset.r });
             if (window.Store) Store.commit();
             App.toast("已记录流失 · " + btn.dataset.r);
             App.refresh();
           });
         });
         var cx = row.querySelector('[data-act="oc-cancel"]');
         if (cx) cx.addEventListener("click", function () { App.refresh(); });
       });
       var ocClear = root.querySelector('[data-act="oc-clear"]');
       if (ocClear) ocClear.addEventListener("click", function () {
         b.outcome = null;
         if (window.Store) Store.commit();
         App.refresh();
       });

       if (langSel) langSel.addEventListener("change", function () {
         if (langSel.value) b.msgLang = langSel.value; else delete b.msgLang;
         if (window.Store) Store.commit();
         var tag = root.querySelector("#suggLang");
         if (tag) tag.textContent = "→ " + ((window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语");
         App.toast(langSel.value ? "已设为" + langSel.value + " · AI 将按此语言生成/翻译" : "已恢复按国家自动选择");
       });

      var jump = root.querySelector('[data-act="jump"]');
      if (jump) jump.addEventListener("click", function () {
         if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先用\"新增客户\"补录"); return; }
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

      /* 客户回复速记：保持虚拟对话与真实 WhatsApp 一致 */
      var logIn = root.querySelector("#logBuyer");
      var logBtn = root.querySelector('[data-act="log-buyer"]');
      function doLogBuyer() {
        var t = logIn && logIn.value.trim();
        if (!t) { App.toast("先写客户说的内容"); return; }
        b.messages.push({ from: "buyer", text: t, time: "刚刚" });
        AIevt(b, "reply", { via: "quicklog", text: t });
        if (window.Store) Store.commit();
        App.refresh();
      }
      if (logBtn) logBtn.addEventListener("click", doLogBuyer);
      if (logIn) logIn.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogBuyer(); });

      /* 交接确认：✓ 已发 / ✕ 没发 / 任意我方记录可删 */
      Array.prototype.forEach.call(root.querySelectorAll('.wa-msgs [data-act="h-y"],.wa-msgs [data-act="h-n"],.wa-msgs [data-act="m-del"]'), function (el) {
        el.addEventListener("click", function () {
          var idx = +el.getAttribute("data-idx");
          if (el.getAttribute("data-act") === "h-y") {
            if (b.messages[idx]) { b.messages[idx].status = "sent"; AIevt(b, "confirmed", { text: b.messages[idx].text }); }
          } else {
            b.messages.splice(idx, 1);
          }
          if (window.Store) Store.commit();
          App.refresh();
        });
      });

      function scrollDown() {
        var wa = root.querySelector(".wa-msgs");
        wa.scrollTop = wa.scrollHeight;
        var chat = root.querySelector(".wa-chat");
        if (chat && chat.scrollIntoView) chat.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      var input = root.querySelector("#msgInput");
      var msgs = root.querySelector("#waMsgs");

      function push(msg) {
        b.messages.push(msg);
        if (window.Store) Store.commit();
        var div = document.createElement("div");
        div.innerHTML = bubble(msg, b.messages.length - 1);
        msgs.appendChild(div.firstChild);
        scrollDown();
      }
      /* 直达 WhatsApp（建议卡 / 非中文输入） */
      function openWa(finalText, note) {
        if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先用\"新增客户\"补录"); return false; }
        var su = waLink(b.wa, finalText);
        if (!su) { App.toast("号码格式不正确，无法打开 WhatsApp"); return false; }
        push({ from: "me", text: finalText, time: "刚刚", status: "handed" });
        input.value = "";
        window.open(su, "_blank");
        App.toast(note || "已预填到 WhatsApp · 还没发送！你发送后回来点「✓ 已发」，没发/改了点「✕ 没发」");
        return true;
      }
      function sendWa(text) {
        if (!text) return;
        openWa(text);
      }

      /* ① 写中文 → AI 先翻译并在对话区展示（中外语对照）→ 再手动跳 WhatsApp */
      var pending = null; // { zh, en, lang, loading }
      function pendingHtml() {
        var loading = pending.loading;
        return '<div class="pending">' +
          '<div class="pending-head"><span class="pending-tag">' + (loading ? "AI 正在翻译…" : "① 已翻译 · 确认后发送") + '</span><span class="pending-lang">→ ' + pending.lang + "</span></div>" +
          (loading
            ? '<div class="pending-text pending-loading">正在把中文改写为符合客户习惯的表达…</div>'
            : '<div class="pending-text">' + pending.en + "</div>" +
              '<div class="pending-zh">你写的中文：' + pending.zh + "</div>" +
              '<div class="pending-btns">' +
              '<button class="p-send" data-act="p-send">发到 WhatsApp</button>' +
              '<button class="p-re" data-act="p-re">不满意 · 重译</button>' +
              '<button class="p-x" data-act="p-x">取消</button>' +
              "</div>") +
          "</div>";
      }
      function bindPending() {
        var box = root.querySelector("#pendWrap .pending");
        if (!box) return;
        var s = box.querySelector('[data-act="p-send"]');
        if (s) s.addEventListener("click", function () {
          AIevt(b, "sent", { src: "translate", text: pending.en });
          if (window.Store) Store.commit();
          if (openWa(pending.en)) { pending = null; renderPending(); }
        });
        var r = box.querySelector('[data-act="p-re"]');
        if (r) r.addEventListener("click", function () { translate(pending.zh); });
        var x = box.querySelector('[data-act="p-x]');
        if (x) x.addEventListener("click", function () { pending = null; renderPending(); });
      }
      function renderPending() {
        var wrap = root.querySelector("#pendWrap");
        if (!wrap) return;
        wrap.innerHTML = pending ? pendingHtml() : "";
        bindPending();
        if (pending) {
          var el = root.querySelector(".mode-a");
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
      function translate(t) {
        t = String(t || "").trim();
        if (!t) return;
        if (!window.LLM || !LLM.configured()) { App.toast("请先在设置里配置 AI（智能引擎）"); return; }
        pending = { zh: t, en: "", lang: (window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语", loading: true };
        renderPending();
        LLM.localize(t, b).then(function (en) {
          en = String(en || "").trim();
          if (!en) throw new Error("翻译结果为空");
          pending.loading = false;
          pending.en = en;
          renderPending();
          App.toast("已翻译 · 检查一下，满意再点\"发到 WhatsApp\"");
        }).catch(function (e) {
          pending = null;
          renderPending();
          App.toast("翻译失败，请重试：" + e.message);
        });
      }
      function doTranslate() {
        var t = input.value.trim();
        if (!t) { App.toast("先在方式①里写一句中文，AI 翻给你看；或去方式②挑一条 AI 代写的"); return; }
        if (!/[一-龥]/.test(t)) { AIevt(b, "sent", { src: "manual", text: t }); if (window.Store) Store.commit(); sendWa(t); return; }
        if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先用\"新增客户\"补录"); return; }
        translate(t);
      }

      function suggIndex(container, el) {
        var cards = container.querySelectorAll(".sugg");
        for (var i = 0; i < cards.length; i++) if (cards[i].contains(el)) return i;
        return 0;
      }
      function bindSugg(container) {
        container.querySelectorAll(".sugg-use").forEach(function (btn) {
          btn.addEventListener("click", function () {
            AIevt(b, "sent", { src: "ai", i: suggIndex(container, btn), text: btn.dataset.text });
            if (window.Store) Store.commit();
            sendWa(btn.dataset.text);
          });
        });
        container.querySelectorAll(".sugg-copy").forEach(function (btn) {
          btn.addEventListener("click", function () {
            AIevt(b, "copy", { i: suggIndex(container, btn), text: btn.dataset.ctext });
            if (window.Store) Store.commit();
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
        LLM.suggest(b).then(function (res) {
          var list = res && res.list;
          if (!list || !list.length) throw new Error("返回为空");
          var items = list.slice(0, 3);
          var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语";
          b.aiSuggests = { lang: lang, at: Date.now(), items: items };
          if (res.diagnosis && (res.diagnosis.nextGoal || res.diagnosis.blocker)) {
            b.aiDiag = { at: Date.now(), nextGoal: res.diagnosis.nextGoal || "", blocker: res.diagnosis.blocker || "" };
          }
          AIevt(b, "gen", { stage: Mock.STAGES[b.stage], goal: b.aiDiag ? b.aiDiag.nextGoal : "", texts: items.map(function (s) { return s.text; }) });
          if (window.Store) Store.commit();
          wrap.innerHTML = items.map(suggCard).join("");
          bindSugg(wrap);
          var dl = root.querySelector("#diagLine");
          if (dl && b.aiDiag) dl.textContent = diagText(b);
          var sv = root.querySelector("#suggSaved");
          if (!sv) {
            sv = document.createElement("span");
            sv.id = "suggSaved";
            sv.className = "lang-chip saved";
            var mh = root.querySelector(".mode-b .mode-head");
            var rg0 = mh && mh.querySelector(".regen");
            if (mh && rg0) mh.insertBefore(sv, rg0);
          }
          if (sv) sv.textContent = "已存 " + savedAt(b.aiSuggests.at);
          if (regen) regen.textContent = "✦ 重新生成";
          var leaked = lang !== "中文" && items.some(function (s) { return /[一-龥]/.test(s.text || ""); });
          App.toast(leaked ? "注意：AI 仍输出了中文，建议在设置里换成更强模型后重试" : "已生成并保存 · 含谈单诊断");
        }).catch(function (e) {
          App.toast("生成失败：" + e.message);
          App.refresh();
        }).finally(function () { regen.disabled = false; });
      });
      root.querySelector('[data-act="send"]').addEventListener("click", function () { doTranslate(); });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") doTranslate(); });

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
            var prevStage = b.stage;
            if (b.stage < 4) b.stage++;
            if (b.stage !== prevStage) AIevt(b, "stage", { to: Mock.STAGES[b.stage] });
            AIevt(b, "reply", { via: "option", text: opt.reply });
            b.context = b.context || [];
            b.context.push({ k: "决策", v: opt.t.replace(/^\d+ · /, "") });
            if (window.Store) Store.commit();
            App.toast("已识别客户应答 → " + opt.note + "（意向/阶段已自动更新）");
            App.go("buyer", b.id);
          }, 1200);
        });
      });

      /* 进页面停在顶部：先看到客户名字/号码和 WhatsApp 对话框 */
    }
  };
})();
