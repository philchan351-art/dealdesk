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
      var sugg = Mock.suggestions[b.id] || [];

       var suggHtml = sugg.map(suggCard).join("");
       if (!suggHtml) suggHtml = '<div class="set-note" style="padding:4px 2px 10px">该买家暂无预设建议。已配置 AI 时，点上方"✦ 重新代写 3 条"，AI 会结合档案与全部历史对话生成（中外语对照）。</div>';

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
        langCard(b) +
        remindHtml(b) +
        profileHtml(b) +
        ctxHtml +
         '<div class="d-sec-title" style="margin-left:16px;margin-right:16px">② AI 代写 <span id="suggLang" class="lang-chip">→ ' + ((window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语") + "</span>" +
         '<button class="regen" data-act="regen" title="基于最新档案与对话重新生成">✦ 重新代写 3 条</button></div>' +
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
         '<div class="wa-composer"><input id="msgInput" placeholder="① 写中文要点 · AI 先翻译给你看，再发 WhatsApp"/>' +
         '<button class="wa-send" data-act="send" aria-label="AI 翻译">' + WA_ICON + "</button></div>";
    },

    init: function (param, root) {
      var b = Mock.getBuyer(param);
      if (!b) return;

      var back = root.querySelector('[data-act="back"]');
      if (back) back.addEventListener("click", function () { App.go("buyers"); });
      var fuBtn = root.querySelector('[data-act="fu"]');
      if (fuBtn) fuBtn.addEventListener("click", function () { App.go("followup"); });

      var langSel = root.querySelector("#langSel");
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
      /* 直达 WhatsApp（建议卡 / 非中文输入） */
      function openWa(finalText, note) {
        if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先用\"新增客户\"补录"); return false; }
        var su = waLink(b.wa, finalText);
        if (!su) { App.toast("号码格式不正确，无法打开 WhatsApp"); return false; }
        push({ from: "me", text: finalText, time: "刚刚" });
        input.value = "";
        window.open(su, "_blank");
        App.toast(note || "已打开 WhatsApp · 已预填，点发送即可（过渡模式）");
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
        var box = msgs.querySelector(".pending");
        if (!box) return;
        var s = box.querySelector('[data-act="p-send"]');
        if (s) s.addEventListener("click", function () {
          if (openWa(pending.en)) { pending = null; renderPending(); }
        });
        var r = box.querySelector('[data-act="p-re"]');
        if (r) r.addEventListener("click", function () { translate(pending.zh); });
        var x = box.querySelector('[data-act="p-x]');
        if (x) x.addEventListener("click", function () { pending = null; renderPending(); });
      }
      function renderPending() {
        var old = msgs.querySelector(".pending");
        if (old) old.remove();
        if (!pending) return;
        var div = document.createElement("div");
        div.innerHTML = pendingHtml();
        msgs.appendChild(div.firstChild);
        bindPending();
        scrollDown();
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
        if (!t) { App.toast("先写一句中文，AI 翻给你看；或直接点上方\"② AI 代写\""); return; }
        if (!/[一-龥]/.test(t)) { sendWa(t); return; }
        if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先用\"新增客户\"补录"); return; }
        translate(t);
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
          wrap.innerHTML = list.slice(0, 3).map(suggCard).join("");
          bindSugg(wrap);
          var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语";
          var leaked = lang !== "中文" && list.slice(0, 3).some(function (s) { return /[一-龥]/.test(s.text || ""); });
          App.toast(leaked ? "注意：AI 仍输出了中文，建议在设置里换成更强模型后重试" : "已基于最新上下文重新生成");
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
