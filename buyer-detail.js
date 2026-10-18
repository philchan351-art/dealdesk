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
  var BD_VER = 75; /* 2026-10-18（Phil「依然没翻译」）：前端版本角标，显示在对话区，便于一眼确认手机跑的是哪版代码 */
  var zhBusy = {}; // 防重入：同一文本正在翻译时不重复发起

  function diagText(b) {
    var d = b.aiDiag || {};
    return "谈单诊断 · 下一步目标：" + (d.nextGoal || "推进") + (d.blocker && d.blocker !== "无" ? " · 卡点：" + d.blocker : "");
  }

  /* P2：底线校验——文本里出现低于底线的价格时软提示（不拦截，人来拍板） */
  function limitWarn(b, text) {
    var L = b && b.limit;
    if (!L || !L.price) return "";
    var nums = String(text || "").match(/\d+(?:\.\d+)?/g) || [];
    for (var i = 0; i < nums.length; i++) {
      var n = parseFloat(nums[i]);
      if (n >= L.price * 0.3 && n < L.price) return "含低于你底线 $" + L.price + " 的价格";
    }
    return "";
  }

  /* P2：风险单——48h 无新消息或意向连续降级 → 红色提醒卡 + 建议策略 */
  function riskOf(b) {
    if (b.outcome) return null;
    var now = Date.now();
    /* P0：updatedAt 统一 ISO 字符串后，旧式 now - updatedAt（数值相减）会得到 NaN，必须 new Date() 解析 */
    var silent = b.updatedAt && (now - new Date(b.updatedAt).getTime()) > 48 * 3600 * 1000;
    var log = b.intentLog || [];
    var drops = 0;
    for (var i = log.length - 1; i >= 0; i--) { if (log[i].d < 0) drops++; else break; }
    if (!silent && drops < 2) return null;
    var reasons = [];
    if (silent) reasons.push("48 小时无新消息");
    if (drops >= 2) reasons.push("意向连续下降 " + drops + " 次");
    var strat = drops >= 2
      ? "别再推价格，先发一条低回复门槛的轻量消息（确认是否收到资料 / 问近期安排）重新破冰"
      : "发一条单问题消息试探回应（问产品细节或档期），不谈价格";
    return { reasons: reasons.join("，"), strat: strat };
  }

  function outcomeHtml(b) {
    if (b.outcome) {
      var won = b.outcome.status === "won";
    return '<div class="outcome-row" style="margin:0 16px 12px">' +
      '<span class="outcome-chip ' + (won ? "won" : "lost") + '">' + (won ? "✓ 已成交" : "✗ 已流失" + (b.outcome.reason ? " · " + escHtml(b.outcome.reason) : "")) + "</span>" +
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

  function suggCard(s, b) {
    var t = String(s.text || "");
    var w = limitWarn(b, t);
    /* P0 XSS：AI 文案/风格全部转义后再入 HTML（属性内 getAttribute 会自动还原实体） */
    return '<div class="sugg">' +
      '<div class="sugg-top"><span class="sugg-style">' + escHtml(s.style) + "</span>" +
      '<div class="sugg-btns">' +
      '<button class="sugg-use" data-text="' + escHtml(t) + '" data-zh="' + escHtml(s.zh || "") + '">发到 WhatsApp</button>' +
      '<button class="sugg-copy" data-ctext="' + escHtml(t) + '">复制</button>' +
      "</div></div>" +
      '<div class="sugg-text">' + escHtml(t) + "</div>" +
      (w ? '<div class="sugg-warn">⚠ ' + escHtml(w) + " · 超出你设的底线，需你本人确认</div>" : "") +
      (s.zh ? '<div class="sugg-zh">中文：' + escHtml(s.zh) + "</div>" : "") +
      "</div>";
  }

  function bubble(m, idx) {
    /* P0 XSS：客户消息/译文/标签/时间全部来自外部数据，必须转义（存储型注入的主入口） */
    var zh = m.zh ? '<div class="zh-line' + (m.zh === "翻译中…" ? " zh-busy" : "") + '">' + escHtml(m.zh) + "</div>"
      : (m.zhFail ? '<div class="zh-line zh-fail" data-act="zh-retry" data-idx="' + idx + '">翻译失败 · 点按重试 ↻</div>' : "");
    var txt = m.text ? escHtml(m.text) : "";
    var tag = m.tag ? '<div class="imp-tag">' + escHtml(m.tag) + "</div>" : "";
    var time = escHtml(m.time || "");
    /* 附图（2026-10-17）：base64 字母表无引号，属性内拼接安全；格式白名单防脏数据 */
    var imgsHtml = (m.imgs || []).map(function (im) {
      if (!im || !im.d) return "";
      var fmt = String(im.f || "jpeg").replace(/[^a-z0-9]/gi, "") || "jpeg";
      return '<img class="msg-img" src="data:image/' + fmt + ';base64,' + im.d + '" loading="lazy" alt="图片"/>';
    }).join("");
    if (imgsHtml) imgsHtml = '<div class="msg-imgs">' + imgsHtml + "</div>";
    if (m.from === "me") {
      var isH = m.status === "handed";
      var handed = isH
        ? '<div class="handed-bar"><span class="handed-tag">已预填到 WhatsApp · 还没发送</span>' +
          '<button class="h-y" data-act="h-y" data-idx="' + idx + '">✓ 已发</button>' +
          '<button class="h-n" data-act="h-n" data-idx="' + idx + '">✕ 没发</button></div>'
        : "";
       var meta = time + " " + (isH ? '<span class="h-wait">待确认</span>' : "✓✓") +
         ' <span class="m-del" data-act="m-del" data-idx="' + idx + '" title="删除这条记录">✕</span>';
       return '<div class="msg msg-me" data-idx="' + idx + '"><div class="bubble">' + txt + imgsHtml + zh + handed + tag + "</div>" +
         '<div class="msg-meta">' + meta + "</div></div>";
    }
    return '<div class="msg msg-buyer"><div class="bubble">' + txt + imgsHtml + zh + tag + "</div>" +
      '<div class="msg-meta">' + time + "</div></div>";
  }

  function remindHtml(b) {
    var fu = U.getFollowupByBuyer(b.id);
    if (!fu || fu.done) return "";
    return '<div class="remind"><b>' + U.dueLabel(fu.dueIn).text + '</b><span>' + escHtml(fu.action) +
      '</span><button class="rbt" data-act="fu">去跟进</button></div>';
  }

  function profileHtml(b) {
    if (!b.profile) return "";
    return '<div class="card ctx-card profile-card">' +
      '<div class="ctx-head"><span class="ctx-title">对方国家沟通画像</span><span class="ctx-hint">本地化引擎自动应用</span></div>' +
       '<div class="profile-rows">' +
       '<div class="prow"><span>称呼</span><b>' + escHtml(b.profile.address) + "</b></div>" +
       '<div class="prow"><span>风格</span><b>' + escHtml(b.profile.style) + "</b></div>" +
       '<div class="prow"><span>提示</span><b>' + escHtml(b.profile.tip) + "</b></div>" +
       "</div></div>";
  }

  function compareHtml(b) {
    if (!b.compare) return "";
    return '<div class="d-sec-title" style="margin-left:16px;margin-right:16px">直译 vs 地道 · 本地化对比</div>' +
      '<div class="card cmp-card" style="margin:0 16px 12px">' +
       '<div class="cmp-intent">中文意图：' + escHtml(b.compare.intent) + "</div>" +
       '<div class="cmp-col bad"><div class="cmp-tag">直译 · 普通翻译软件</div><p>' + escHtml(b.compare.literal) + "</p></div>" +
       '<div class="cmp-col good"><div class="cmp-tag">本地化改写 · 谈单舱</div><p>' + escHtml(b.compare.local) + "</p></div>" +
       '<div class="cmp-notes">' + b.compare.notes.map(function (n) { return "<div>· " + escHtml(n) + "</div>"; }).join("") + "</div>" +
      "</div>";
  }

  /* 2026-10-18（Phil）：语言选择收成一个紧凑框，与「回复客户」标题同一行；说明小字全部去掉 */
  function langCard(b) {
    var LANGS = CountryProfiles.langs();
    var opts = '<option value="">自动 · 按国家（' + escHtml(b.country || "未知") + "）</option>" +
      LANGS.map(function (l) { return '<option value="' + l + '"' + (b.msgLang === l ? " selected" : "") + ">" + l + "</option>"; }).join("");
    return '<div class="reply-row">' +
      '<div class="d-sec-title" style="margin:0">回复客户</div>' +
      '<span class="lang-globe">🌐</span>' +
      '<select id="langSel" class="lang-mini" title="回复语言（默认按国家自动）">' + opts + "</select></div>";
  }

  window.Screens["buyer-detail"] = {
    title: "买家详情 · WhatsApp 过渡模式",

    render: function (param) {
      var b = Mock.getBuyer(param);
      if (!b) return '<div class="empty">未找到该买家</div>';

      var g = U.grade(b.intent);
      var sugg = (b.aiSuggests && b.aiSuggests.items && b.aiSuggests.items.length) ? b.aiSuggests.items : (Mock.suggestions[b.id] || []);

        var suggHtml = sugg.map(function (s) { return suggCard(s, b); }).join("");
       if (!suggHtml) suggHtml = '<div class="set-note" style="padding:2px 0">还没有建议。已配置 AI 时，点上方「✦ 生成 3 条」，AI 会结合全部历史对话代写（中外语对照）。</div>';

      var ctx = (b.context || []);
      var ctxHtml = ctx.length
        ? '<div class="card ctx-card">' +
          '<div class="ctx-head"><span class="ctx-title">已自动沉淀</span>' +
          '<span class="ctx-hint">沟通中自动提取 · 永不重复问客户</span></div>' +
          '<div class="ctx-grid">' + ctx.map(function (c) {
            return '<div class="ctx-item"><span class="ctx-k">' + escHtml(c.k) + '</span><span class="ctx-v">' + escHtml(c.v) + "</span></div>";
          }).join("") + "</div></div>"
        : "";

      var memoryHtml = b.memory
        ? '<div class="card mem-card"><div class="ctx-head"><span class="ctx-title">🧠 AI 长期记忆</span><span class="ctx-hint">过往聊天导入 · 自动影响 AI 回复</span></div><div class="mem-text">' + escHtml(b.memory) + "</div></div>"
        : "";

      var importHtml =
        '<div id="importPanel" class="import-panel" style="display:none">' +
        '<div class="set-note" style="margin:0 0 8px">粘贴过往聊天文字，或传 WhatsApp 截图 / 文字文件 / 视频（图最多 8 张、单张原图≤20MB，自动压缩；文件 1 个，视频 1 个≤4MB）。AI 会：逐条还原进上方对话 + 沉淀档案要点 + 生成长期记忆。只存在你自己的账号里。</div>' +
        '<textarea class="set-inp" id="importText" style="min-height:70px;padding:9px;font-family:inherit;line-height:1.5" placeholder="粘贴聊天文字（格式随意，如：客户：500台什么价 / 我们：FOB 32美元…）"></textarea>' +
        '<div class="import-row"><button class="set-btn-inline" data-act="pick-img">📷 图片</button><button class="set-btn-inline" data-act="pick-file">📄 文件</button><button class="set-btn-inline" data-act="pick-video">🎬 视频</button></div>' +
        '<input type="file" id="importImgs" accept="image/*" multiple style="display:none"/>' +
        '<input type="file" id="importFile" accept=".txt,.md,.csv,.json" style="display:none"/>' +
        '<input type="file" id="importVideo" accept="video/*" style="display:none"/>' +
        '<div class="set-note" id="importPickInfo" style="margin:6px 0"></div>' +
        '<div class="set-actions"><button class="tr-btn" data-act="do-import" id="importGo" style="flex:1">AI 分析并导入</button></div>' +
        '<div class="set-note" id="importStatus" style="margin-top:8px"></div>' +
        "</div>";

      var msgHtml = b.messages.map(function (m, i) { return bubble(m, i); }).join("");
      var optHtml = b.options
        ? '<div class="wacard"><div class="wa-opt-label">编号选项触达 · 客户回一个数字即可，自动识别并沉淀</div>' +
          b.options.items.map(function (it, i) {
            return '<button class="wa-opt" data-oi="' + i + '">' + escHtml(it.t) + "</button>";
          }).join("") + "</div>"
        : "";

       return '<div class="topbar">' +
         '<div class="tb-back" data-act="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div>' +
          '<div class="tb-title"><h1>' + escHtml(b.name) + '</h1><div class="tb-sub">' + escHtml(b.wa ? (String(b.wa).charAt(0) === "+" ? b.wa : "+" + b.wa) : "未填 WhatsApp") + " · " + escHtml(b.country) + " · " + escHtml(b.lastActive) + " 活跃</div></div>" +
          '<button class="wa-jump edit-prof" data-act="edit-prof" title="修改姓名/WhatsApp 号码等基础信息">✎ 编辑</button>' +
          '<button class="wa-jump" data-act="jump">' + WA_ICON + "<span>直达对话</span></button>" +
         "</div>" +
         '<div class="detail-body">' +
         '<div class="card d-info">' + U.avatar(b, true) +
         '<div><div class="d-name">' + escHtml(b.name) + "</div>" +
         '<div class="d-sub">' + escHtml(b.product) + " · " + escHtml(b.qty) + (b.amount ? " · " + U.money(b.amount, b.currency) : " · 待报价") + "</div>" +
         '<div class="d-tags">' + b.tags.map(function (t) { return '<span class="tag">' + escHtml(t) + "</span>"; }).join("") + "</div></div>" +
         '<div class="d-ring">' + U.intentRing(b.intent) + "<small>意向评分</small></div>" +
         "</div>" +
         outcomeHtml(b) +
          '<div class="card tracker" style="margin-top:10px">' + U.stageTracker(b.stage) + "</div>" +
           (function () {
             var rk = riskOf(b);
              return rk ? '<div class="card risk-card" style="margin:10px 16px 0"><b>⚠ 谈单遇冷</b><span>' + escHtml(rk.reasons) + '</span><div class="risk-strat">建议策略：' + escHtml(rk.strat) + "</div></div>" : "";
           })() +
          /* 2026-10-14 真实反馈：没喂产品资料时 AI 会编参数，用醒目横幅引导去上传训练资料 */
          (function () {
            var p = (window.Store && Store.getPersona) ? Store.getPersona() : null;
            var hasDocs = !!(p && (p.docs || []).length);
            return hasDocs ? "" : '<div class="card" style="margin:10px 16px 0;background:#FFF7E8;border:1px solid #FFD591"><b>⚠ 还没喂产品资料</b><div style="font-size:12px;color:#8a6d1a;margin-top:4px">没有资料，AI 回复客户时会"编"参数（续航/认证/价格都可能是假的）。到「设置 → AI 训练资料」上传你的产品目录/公司简介，AI 就只按你资料里写的说。</div></div>';
          })() +
           '<div id="scriptCard"></div>' +
           '<div id="photoCard"></div>' +
           '<div class="d-sec-title" style="margin-top:14px;margin-left:16px;margin-right:16px">WhatsApp 对话记录 · 过渡模式</div>' +
         '<div class="set-note" style="padding:0 16px 8px;font-size:11px">预填 ≠ 已发：发送后点「✓ 已发」计入记录；没发或改过的点「✕ 没发」删除。</div>' +
        '<div class="wa-chat">' +
         '<div class="wa-head">' + WA_ICON +
         '<div class="wa-hmid"><b>' + escHtml(b.name) + "</b><span>" + escHtml(b.wa || "已绑定") + " · 在线</span></div>" +
        '<button class="wa-lang" data-act="import" style="margin-right:6px">＋ 导入</button>' +
        '<button class="wa-lang active" data-act="lang">中文对照</button>' +
        '<span class="wa-pill">官方通道 · 零感知</span>' + '<span class="zh-ver">v' + BD_VER + '</span>' +
        "</div>" +
        importHtml +
        '<div class="wa-msgs zh-on" id="waMsgs">' + msgHtml + "</div>" +
        optHtml +
        '<div class="wa-logrow"><button class="log-img-btn" data-act="log-img" type="button" title="附图（最多 3 张）">📷</button>' +
        '<textarea id="logBuyer" rows="3" placeholder="记一句 / 发图（客户说的·你发的，可多行写完整，如：已报价 EXW 222）"></textarea>' +
        '<button class="log-btn" data-act="log-buyer">记客户</button>' +
        '<button class="log-btn log-btn-me" data-act="log-me">记我发</button></div>' +
        '<input type="file" id="logImgs" accept="image/*" multiple style="display:none"/>' +
        '<div id="logImgPrev" class="log-img-prev" style="display:none"></div>' +
        "</div>" +
         "</div>" +
            /* 2026-10-18（Phil 精简三指令）：语言框并入标题行；方式①意图框变大+写完自动扩充（无按钮）；
               方式②一行标题「AI 代写 · 语言」+重新生成按钮；谈单诊断行/已存时间/说明小字全删 */
            langCard(b) +
            '<div class="mode-card mode-a" style="margin:0 16px 10px">' +
           '<div class="mode-head"><span class="mode-badge a">①</span>' +
           '<div class="mode-tt"><b>自己写中文 · AI 自动扩充</b></div></div>' +
           '<div class="mt-row"><button class="mt-btn active" data-mt="expand">按意图扩充（推荐）</button><button class="mt-btn" data-mt="direct">逐句直译</button></div>' +
           '<textarea id="msgInput" rows="3" placeholder="写大概意图（写完自动扩充），或按住下面🎤说话"></textarea>' +
             '<button class="mic-btn" id="micBtn" type="button">🎤 按住说话</button>' +
             '<div id="pendWrap"></div>' +
            "</div>" +
          '<div class="mode-card mode-b" style="margin:0 16px 10px">' +
          '<div class="mode-head"><span class="mode-badge b">②</span>' +
           '<span class="mode-b-tt">AI 代写 · <b id="suggLang">' + escHtml((window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语") + "</b></span>" +
            '<button class="regen" data-act="regen">' + (b.aiSuggests ? "✦ 重新生成" : "✦ 生成 3 条") + "</button></div>" +
           '<div id="suggWrap">' + suggHtml + "</div>" +
           "</div>" +
         remindHtml(b) +
         profileHtml(b) +
         ctxHtml +
         memoryHtml +
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
          if (tag) tag.textContent = (window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语";
           App.toast(langSel.value ? "已设为" + langSel.value + " · AI 将按此语言生成/翻译" : "已恢复按国家自动选择");
        });

      /* 2026-10-17：价格底线卡按 Phil 要求整体移除（暂时用不到）。
         提示词层「铁律C」保留——历史客户若已存过底线值，AI 仍会遵守，作为安全网。 */

      /* 编辑档案：复用新增弹层，预填当前值（2026-10-14 现场需求：姓名/号码等信息可改） */
      var editProf = root.querySelector('[data-act="edit-prof"]');
      if (editProf) editProf.addEventListener("click", function () {
        if (window.BuyerSheet) BuyerSheet.open(b.id);
      });
      var jump = root.querySelector('[data-act="jump"]');
      if (jump) jump.addEventListener("click", function () {
         if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先点右上角「✎ 编辑」补全"); return; }
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
        /* 客户发外语 → 自动补中文对照（译文存进消息里，下次不用再翻）
           2026-10-18（Phil 反馈「依然没看到翻译」）：全程状态可见——
           ① 气泡里立即显示「翻译中…」占位（功能跑没跑，一眼可见）
           ② 失败弹 toast 说原因 + 气泡留「点按重试」标记，不再有任何静默路径
           ③ 失败清 zhBusy 锁，同一条随时可重试 */
        function autoZh(text) {
          if (!text || /[一-龥]/.test(text)) return; // 中文不用翻
          if (!window.LLM || !LLM.configured()) return;
          if (zhBusy[text]) return;
          zhBusy[text] = 1;
          var target = null;
          for (var i0 = b.messages.length - 1; i0 >= 0; i0--) {
            var m0 = b.messages[i0];
            if (m0.text === text && (!m0.zh || m0.zh === "翻译中…" || m0.zhFail)) { target = m0; break; }
          }
          if (!target) { zhBusy[text] = 0; return; }
          target.zh = "翻译中…"; target.zhFail = false;
          App.refresh(); /* 占位立即可见 */
          LLM.translate(text, b).then(function (zh) {
            zh = String(zh || "").trim();
            if (!zh) throw new Error("返回空译文");
            var done = false;
            for (var i = b.messages.length - 1; i >= 0; i--) {
              var m = b.messages[i];
              if (m.text === text && (!m.zh || m.zh === "翻译中…")) { m.zh = zh; m.zhFail = false; done = true; break; }
            }
            if (done) { if (window.Store) Store.commit(); App.refresh(); }
          }).catch(function (e) {
            if (target) { target.zh = ""; target.zhFail = true; }
            App.toast("自动翻译失败：" + String((e && e.message) || e).slice(0, 40), 3500);
            App.refresh();
          }).then(function () { zhBusy[text] = 0; });
        }

       /* P2：意向信号——客户回复后 AI 静默默估升降并留一句依据（列表点徽章查看） */
       function judgeIntent(t) {
         if (!window.LLM || !LLM.configured() || !window.Store) return;
         LLM.intentDelta(t, b).then(function (o) {
           if (!o || !o.delta) return;
           AIevt(b, "intent", { delta: o.delta, reason: o.reason || "" });
           Store.bumpIntent(b.id, o.delta, o.reason || "客户消息信号");
           App.refresh();
         }).catch(function () {});
       }
       /* 记一条附图（2026-10-17）：FB 表单截图 / 产品图 / 聊天截图直接记进对话，图随消息一起存、云端同步 */
       var logImgs = []; /* 待记录压缩图 [{d: base64, f: "jpeg"}]，单条最多 3 张 */
       var logImgPrev = root.querySelector("#logImgPrev");
       function logPrevRender() {
         if (!logImgPrev) return;
         if (!logImgs.length) { logImgPrev.style.display = "none"; logImgPrev.innerHTML = ""; return; }
         logImgPrev.style.display = "";
         logImgPrev.innerHTML = logImgs.map(function (im, i) {
           return '<div class="log-prev-it"><img src="data:image/' + im.f + ';base64,' + im.d + '" alt=""/>' +
             '<button class="log-prev-x" data-li="' + i + '" type="button" title="移除这张">✕</button></div>';
         }).join("");
         logImgPrev.querySelectorAll(".log-prev-x").forEach(function (x) {
           x.addEventListener("click", function () { logImgs.splice(+x.getAttribute("data-li"), 1); logPrevRender(); });
         });
       }
       function logImgsBytes() {
         var s = 0;
         logImgs.forEach(function (x) { s += x.d.length; });
         return s;
       }
       function buyerImgsBytes() {
         var s = 0;
         b.messages.forEach(function (m) { (m.imgs || []).forEach(function (im) { s += im.d.length; }); });
         return s;
       }
       function addLogImgs(files) {
         var fs = Array.prototype.slice.call(files || []);
         if (!fs.length) return;
         if (logImgs.length + fs.length > 3) { App.toast("一条最多 3 张，超出的请分条记"); fs = fs.slice(0, Math.max(0, 3 - logImgs.length)); }
         fs.forEach(function (f) {
           if (f.size > 20 * 1048576) { App.toast("「" + f.name + "」太大（单张 ≤20MB）"); return; }
           compressImage(f, function (b64) {
             if (!b64) { App.toast("图片读取失败"); return; }
             if (b64.length > 8 * 1024 * 1024) { App.toast("「" + f.name + "」压缩后仍太大，请裁剪后重选"); return; }
             /* 防云端 data.json 膨胀：单个客户图片总量（含历史记录）≤8MB base64 */
             if (buyerImgsBytes() + logImgsBytes() + b64.length > 8 * 1024 * 1024) {
               App.toast("该客户已存图片较多（上限 8MB），可删掉旧记录里的图再传"); return;
             }
             logImgs.push({ d: b64, f: "jpeg" });
             logPrevRender();
           }, 1280, 0.78);
         });
       }
       var logImgIn = root.querySelector("#logImgs");
       var logImgBtn = root.querySelector('[data-act="log-img"]');
       if (logImgBtn && logImgIn) {
         logImgBtn.addEventListener("click", function () { logImgIn.click(); });
         logImgIn.addEventListener("change", function (e) { addLogImgs(e.target.files); e.target.value = ""; });
       }
        function doLogBuyer() {
          var t = logIn && logIn.value.trim();
          if (!t && !logImgs.length) { App.toast("先写客户说的内容，或点 📷 附图"); return; }
          var msg = { from: "buyer", text: t, time: "刚刚" };
          if (logImgs.length) msg.imgs = logImgs.slice();
          b.messages.push(msg);
          AIevt(b, "reply", { via: "quicklog", text: t });
           if (window.Store) Store.commit();
           logImgs = []; logPrevRender();
           App.refresh();
           if (t) { autoZh(t); judgeIntent(t); }
         }
        /* 2026-10-14 现场反馈：业务员在 WhatsApp 自己报了价，但记录里只有客户那句"多少钱"，
           看板就一直显示"他在等你的回复/待报价"。记我发 = 手动补记我方消息，最新一条变我方 → 状态立即翻成"你已回" */
        function doLogMe() {
           var t = logIn && logIn.value.trim();
           if (!t && !logImgs.length) { App.toast("先写你发的内容，或点 📷 附图"); return; }
           var msg = { from: "me", text: t, time: "刚刚" };
           if (logImgs.length) msg.imgs = logImgs.slice();
           b.messages.push(msg);
           AIevt(b, "reply", { via: "quicklog-me", text: t });
           if (window.Store) Store.commit();
           logImgs = []; logPrevRender();
           App.refresh();
           if (t) autoZh(t); /* 2026-10-18（Phil）：我方发的英文也即时补中文对照，与加载时补翻口径一致 */
         }
       var logMeBtn = root.querySelector('[data-act="log-me"]');
       if (logBtn) logBtn.addEventListener("click", doLogBuyer);
       if (logMeBtn) logMeBtn.addEventListener("click", doLogMe);
       /* 2026-10-17：记一句改多行框后——Enter 提交（保持快记习惯），Shift+Enter 换行（写完整信息） */
      if (logIn) logIn.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doLogBuyer(); } });

        /* 页面加载时：给最近缺中文对照的外语消息自动补翻译（客户和我发的都算，最多 6 条，不刷屏）。
           「翻译中…」视为缺失（防极端时序下占位被存进云端后卡死）；zhFail 不自动重翻（持续失败会刷屏），靠气泡里点按重试 */
        b.messages.filter(function (m) { return (!m.zh || m.zh === "翻译中…") && !m.zhFail && m.text && !/[一-龥]/.test(m.text); }).slice(-6)
         .forEach(function (m) {
           autoZh(m.text);
         });

      /* 交接确认：✓ 已发 / ✕ 没发 / 任意我方记录可删 */
      Array.prototype.forEach.call(root.querySelectorAll('.wa-msgs [data-act="h-y"],.wa-msgs [data-act="h-n"],.wa-msgs [data-act="m-del"]'), function (el) {
        el.addEventListener("click", function () {
          var idx = +el.getAttribute("data-idx");
          if (el.getAttribute("data-act") === "h-y") {
            if (b.messages[idx]) { b.messages[idx].status = "sent"; AIevt(b, "confirmed", { text: b.messages[idx].text, stage: b.stage }); }
          } else {
            /* 埋点：「✕ 没发」＝建议被弃用的负样本，必须先留痕再删；「删除记录」属数据清理，不记 */
            if (el.getAttribute("data-act") === "h-n" && b.messages[idx]) {
              AIevt(b, "rejected", { src: "ai", text: b.messages[idx].text, zh: b.messages[idx].zh, stage: b.stage });
            }
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

      /* 2026-10-17：打开买家即定位客户最新消息（此前默认停在记录顶部，每次都要手动下滑） */
      function jumpToLatest() {
        var wa = root.querySelector(".wa-msgs");
        if (!wa) return;
        wa.scrollTop = wa.scrollHeight;
        var chat = root.querySelector(".wa-chat");
        if (chat && chat.scrollIntoView) chat.scrollIntoView({ behavior: "auto", block: "nearest" });
      }
      requestAnimationFrame(function () { requestAnimationFrame(jumpToLatest); });
      /* 记录里的图片加载完后容器高度变化，需重新定位到最新 */
      Array.prototype.forEach.call(root.querySelectorAll(".wa-msgs img"), function (im) {
        if (!im.complete) {
          im.addEventListener("load", jumpToLatest, { once: true });
          im.addEventListener("error", jumpToLatest, { once: true });
        }
      });

       var input = root.querySelector("#msgInput");
       var msgs = root.querySelector("#waMsgs");

       /* 记录里的图片点开放大（2026-10-17），点任意处关闭 */
       var imgView = null;
       function closeImgView() { if (imgView) { imgView.remove(); imgView = null; } }
        /* 2026-10-18：气泡里「翻译失败 · 点按重试」→ 对那条消息重翻 */
        if (msgs) msgs.addEventListener("click", function (e) {
          var rz = e.target && e.target.closest ? e.target.closest('[data-act="zh-retry"]') : null;
          if (!rz) return;
          var rm = b.messages[+rz.getAttribute("data-idx")];
          if (rm && rm.text) autoZh(rm.text);
        });
        if (msgs) msgs.addEventListener("click", function (e) {
          var im = e.target && e.target.closest ? e.target.closest(".msg-img") : null;
          if (!im) return;
         closeImgView();
         var el = document.createElement("div");
         el.className = "img-view";
         el.innerHTML = '<img src="' + im.src + '" alt=""/><div class="iv-hint">点任意处关闭</div>';
         el.addEventListener("click", closeImgView);
         (document.querySelector(".phone") || root).appendChild(el);
         imgView = el;
       });

       function push(msg) {
        b.messages.push(msg);
        if (window.Store) Store.commit();
        var div = document.createElement("div");
        div.innerHTML = bubble(msg, b.messages.length - 1);
        msgs.appendChild(div.firstChild);
        scrollDown();
      }

      /* ===== 过往聊天导入：文字/图片/视频/文件 → 云端 /import 逐份分析 → 预览 → 写入档案（长期记忆） ===== */
      var importPanel = root.querySelector("#importPanel");
      var importStatus = root.querySelector("#importStatus");
      var importPickInfo = root.querySelector("#importPickInfo");
      var importJobs = [];
      var impConvo = [], impFields = {}, impSummaries = [];
      function refreshPickInfo() {
        importPickInfo.textContent = importJobs.length
          ? "已选：" + importJobs.map(function (j) { return (j.kind === "image" ? "图" : j.kind === "video" ? "视频" : "文件") + " " + (j.name || ""); }).join("；")
          : "";
      }
      function b64Of(file, cb) {
        var fr = new FileReader();
        fr.onload = function () { cb(String(fr.result || "").split(",")[1] || ""); };
        fr.onerror = function () { cb(""); };
        fr.readAsDataURL(file);
      }
       /* 图片本地压缩：默认最长边 ≤1600px、JPEG ~82%（导入 OCR 场景）；记一条附图传 1280/0.78 进一步控体积。
          上传体积和视觉模型推理时间大幅下降，聊天截图 OCR 清晰度不受影响；加载/编码失败自动回退原始 base64 */
       function compressImage(file, cb, maxDim, q) {
         maxDim = maxDim || 1600; q = q || 0.82;
         var url = URL.createObjectURL(file);
         var img = new Image();
         function fall() { try { URL.revokeObjectURL(url); } catch (e) {} b64Of(file, function (b) { cb(b, (file.type || "").split("/")[1] || "jpg"); }); }
         img.onload = function () {
           try {
             var MAX = maxDim, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
             var scale = Math.min(1, MAX / Math.max(w, h));
             var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
             var cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
             cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
             var out = cv.toDataURL("image/jpeg", q).split(",")[1] || "";
            URL.revokeObjectURL(url);
            if (out) { cb(out, "jpg"); return; }
          } catch (e) { /* 编码失败，落到原始 base64 */ }
          fall();
        };
        img.onerror = fall;
        img.src = url;
      }
       function pushFileJob(kind, file, maxBytes) {
         if (!file) return;
         /* 2026-10-14 现场反馈修复：原逻辑按"压缩前原图大小"卡 2MB——iPhone 聊天截图 PNG 普遍 2-4MB，
            含产品图的页面必被拒（这就是"后面两页传不上去"的根因）。
            现在：原图只卡 20MB 安全上限，真正的大小校验放到压缩之后（压完一般只有几百 KB） */
         var rawCap = kind === "image" ? 20 * 1048576 : maxBytes;
         if (file.size > rawCap) { App.toast("「" + file.name + "」太大（≤" + Math.round(rawCap / 1048576) + "MB）"); return; }
         function finish(b64, fmt) {
           if (!b64) { App.toast("文件读取失败"); return; }
           if (b64.length > 8 * 1024 * 1024) { App.toast("「" + file.name + "」压缩后仍太大，请裁剪页面范围后重截"); return; }
           importJobs.push({ kind: kind, data: b64, name: file.name, format: fmt || ((file.type || "").split("/")[1] || "") });
           refreshPickInfo();
         }
         if (kind === "image") compressImage(file, finish);
         else b64Of(file, function (b64) { finish(b64); });
       }
      root.querySelector('[data-act="import"]').addEventListener("click", function () {
        importPanel.style.display = importPanel.style.display === "none" ? "block" : "none";
      });
      root.querySelector('[data-act="pick-img"]').addEventListener("click", function () { root.querySelector("#importImgs").click(); });
      root.querySelector('[data-act="pick-file"]').addEventListener("click", function () { root.querySelector("#importFile").click(); });
      root.querySelector('[data-act="pick-video"]').addEventListener("click", function () { root.querySelector("#importVideo").click(); });
      root.querySelector("#importImgs").addEventListener("change", function (e) {
        var fs = Array.prototype.slice.call(e.target.files || []);
        e.target.value = "";
         if (fs.length > 8) { App.toast("一次最多 8 张，请按时间顺序选；再多请分两次导入"); fs = fs.slice(0, 8); }
        fs.forEach(function (f) { pushFileJob("image", f, 2 * 1048576); });
      });
      root.querySelector("#importFile").addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!f) return;
        if (!/\.(txt|md|csv|json)$/i.test(f.name)) { App.toast("只支持 .txt/.md/.csv/.json 文件"); return; }
        pushFileJob("file", f, 3 * 1048576);
      });
      root.querySelector("#importVideo").addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = "";
        pushFileJob("video", f, 4 * 1048576);
      });
      root.querySelector('[data-act="do-import"]').addEventListener("click", function () {
        var txt = root.querySelector("#importText").value.trim();
        var jobs = importJobs.slice();
        if (txt) jobs.unshift({ kind: "text", data: txt, name: "粘贴文字", format: "" });
        if (!jobs.length) { App.toast("先粘贴聊天文字，或选择图片/文件/视频"); return; }
        var st = Store.getSettings() || {}, c = st.llm || {}, cl = st.cloud || {};
        if (!c.proxyUrl && cl.proxyUrl) c.proxyUrl = cl.proxyUrl;
        var impAu = window.Auth && Auth.get();
        if (!c.proxyUrl || !impAu || !impAu.session) { App.toast("请先登录（设置里配置云代理地址）"); return; }
        var go = root.querySelector("#importGo");
        go.disabled = true;
        impConvo = []; impFields = {}; impSummaries = [];
        /* 多份材料并行分析（原来串行，2 张图 = 2 倍时间）；结果仍按选择顺序合并，保证对话还原不乱序 */
        var total = jobs.length, done = 0;
        importStatus.textContent = "AI 分析中（0/" + total + "）";
        var results = jobs.map(function (j) {
          var label = j.kind === "text" ? "文字" : (j.kind === "video" ? "视频" : j.kind === "image" ? "图片" : "文件");
          function tick() {
            done++;
            importStatus.textContent = "AI 分析中（" + done + "/" + total + "）· 完成 " + label + " " + (j.name || "") + (done < total ? "，其余并行进行中…" : "");
          }
          return fetch(String(c.proxyUrl).replace(/\/+$/, "") + "/import", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-dealdesk-session": impAu.session },
            body: JSON.stringify({ kind: j.kind, data: j.data, name: j.name, format: j.format })
          }).then(function (r) { return r.json(); }).then(function (res) {
            tick();
            if (res.error) return { err: res.error };
            return { ok: true, convo: res.convo || [], fields: res.fields || [], summary: res.summary || "" };
          }).catch(function (e) { tick(); return { err: String(e.message || e) }; });
        });
        Promise.all(results).then(function (outs) {
          go.disabled = false;
          var errs = [];
          outs.forEach(function (o) {
            if (!o) return;
            if (o.err) { errs.push(o.err); return; }
            o.convo.forEach(function (l) { if (l && l.text) impConvo.push({ from: l.from, text: l.text, time: l.time || undefined }); });
            o.fields.forEach(function (f) { if (f && f.k && f.v) impFields[f.k] = f.v; });
            if (o.summary) impSummaries.push(o.summary);
          });
           /* 2026-10-14：部分失败必须显式告知（原来只要有一份成功就静默吞掉错误，用户以为 4 页全导入了） */
           var errLine = errs.length
             ? '<div style="color:#e5484d;margin-top:4px">⚠ ' + errs.length + ' 份材料分析失败：' + escHtml(errs.join("；").slice(0, 150)) + "（失败的截图可单独再传一次）</div>"
             : "";
           if (!impConvo.length && !impSummaries.length) {
             importStatus.textContent = "分析失败：" + (errs.join("；").slice(0, 120) || "没识别到内容，换更清晰的截图或补点文字再试");
             return;
           }
           importStatus.innerHTML =
              '<b style="color:var(--brand-deep)">分析完成，确认存进「' + escHtml(b.name) + "」的档案？</b><br>" +
             "对话还原 " + impConvo.length + " 条" + (Object.keys(impFields).length ? " · 档案要点 " + Object.keys(impFields).length + " 项" : "") + errLine +
            (impSummaries.length ? '<br><span class="mem-text">' + escHtml(impSummaries.join("；").slice(0, 220)) + "…</span>" : "") +
            '<div class="import-row" style="margin-top:8px"><button class="tr-btn" data-act="commit-import" style="flex:1">存入档案（长期记忆）</button><button class="set-btn-inline" data-act="abort-import">取消</button></div>';
        });
      });
      importStatus.addEventListener("click", function (e) {
        var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
        if (!t) return;
        var act = t.getAttribute("data-act");
        if (act === "abort-import") { importStatus.innerHTML = ""; }
        if (act === "commit-import") {
          Store.importIntoBuyer(b.id, impConvo, impSummaries.join("；"), Object.keys(impFields).map(function (k) { return { k: k, v: impFields[k] }; }));
          App.toast("已导入：对话 " + impConvo.length + " 条，长期记忆已更新");
          App.refresh();
        }
      });
      /* 直达 WhatsApp（建议卡 / 非中文输入） */
      function openWa(finalText, zh, note) {
        if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先点右上角「✎ 编辑」补全"); return false; }
        var su = waLink(b.wa, finalText);
        if (!su) { App.toast("号码格式不正确，无法打开 WhatsApp"); return false; }
        push({ from: "me", text: finalText, time: "刚刚", status: "handed", zh: zh || undefined });
        input.value = "";
        window.open(su, "_blank");
        App.toast(note || "已预填到 WhatsApp · 还没发送！你发送后回来点「✓ 已发」，没发/改了点「✕ 没发」");
        return true;
      }
       function sendWa(text, zh) {
         if (!text) return;
         openWa(text, zh);
       }

       /* ===== 2026-10-15 新客话术播放器：按客户产品线取团队剧本，业务员按顺序一步步发 =====
          - 署名自动替换为当前发送人（谁发署谁的名）
          - 进度记在 b.scriptProg（docKey → 已发步数），客户以后忘了参数可随时「重发」某步
          - 只预填到 WhatsApp，实际发送由业务员确认（与「发到 WhatsApp」同一模式） */
       (function loadScriptCard() {
         var box = root.querySelector("#scriptCard");
         if (!box || b.outcome || !window.Sync || !Sync.enabled()) return;
         Sync.sharedAll().then(function (j) {
           var line = b.scope || "all";
           /* 产品线=通用（或未设）→ 看全部剧本；指定产品线 → 该产品线 + 通用 */
           var scripts = ((j && j.docs) || []).filter(function (d) {
             return d.type === "script" && d.steps && d.steps.length && (line === "all" || d.scope === "all" || d.scope === line);
           });
           if (!scripts.length) return;
           var st0 = (window.Store && Store.getSettings) ? (Store.getSettings() || {}) : {};
           var au0 = window.Auth && Auth.get();
           var myName = st0.name || (au0 && au0.name) || "";
           var cf = String(b.name || "").trim().split(/\s+/)[0] || "";
             /* 2026-10-17 话术换版（五步→六步，插入「三 未报价收尾」）：旧 key 进度带进新 key，
                cap=2 —— 插入点在第 3 步，旧的第 3 步起都是没发过的新内容，✓ 只保留到新第 2 步。
                当天二次修正换版（标题改回 Phil 指定「未报价收尾」、正文恢复原文弯引号）→ key 98ba0e2f 也视为旧 key，
                多个旧 key 取 max（不 break），业务员在新版再发任一步后新 key 进度接管 */
             var PROG_MIGRATION = { "f47eb318-mvazd29i": { to: "31eedc36-mvc6xdi7", cap: 2 }, "98ba0e2f-mvc6rf66": { to: "31eedc36-mvc6xdi7", cap: 2 } };
             function progOf(d) {
               var prog = b.scriptProg || {};
               var p = Number(prog[d.key] || 0);
               if (!p) {
                 for (var ok in PROG_MIGRATION) {
                   if (PROG_MIGRATION[ok].to === d.key) p = Math.max(p, Math.min(Number(prog[ok] || 0), PROG_MIGRATION[ok].cap));
                 }
               }
               return Math.min(p, d.steps.length);
             }
            /* 2026-10-17 布局（Phil）：每步一行+每步一个发送按钮太占地方 →
               步骤改成横排芯片（每行 3 个，6 步两排刚好），点选一段，底部只有一个「发到 WhatsApp」按钮。
               默认选中第一个未发步骤；发完刷新后自动停在下一段 */
            var sel = null; /* {si: 剧本下标, i: 步骤下标} */
             function renderCard() {
               var total = 0, sent = 0;
               scripts.forEach(function (d) {
                 total += d.steps.length;
                 sent += progOf(d);
               });
              var isNew = (b.messages || []).length < 2;
              if (!sel) {
                for (var a = 0; a < scripts.length && !sel; a++) {
                  var s0 = progOf(scripts[a]);
                  if (s0 < scripts[a].steps.length) sel = { si: a, i: s0 };
                }
              }
              var selSt = sel ? scripts[sel.si] && scripts[sel.si].steps[sel.i] : null;
              var html = '<div class="card ctx-card" style="margin:12px 16px 0">' +
                '<div class="ctx-head"><span class="ctx-title">📜 新客话术（' + sent + "/" + total + '）</span>' +
                '<span class="ctx-hint">' + (scripts.length > 1 ? scripts.length + " 套 · " : "") + "点选一段 → 下方发送</span></div>" +
                (isNew ? '<div class="sp-hint">💡 新客户首谈：按编号顺序一段段发（客户回一段你再发下一段）。署名自动换成你的名字；客户以后问参数，选中对应那步再发即可。</div>' : "") +
                '<div class="sp-body">';
                scripts.forEach(function (d, si) {
                  var snt = progOf(d);
                 if (scripts.length > 1) html += '<div class="sp-setname">' + escHtml(d.name || "话术 " + (si + 1)) + "</div>";
                  html += '<div class="sp-grid">';
                  d.steps.forEach(function (st, i) {
                    var done = i < snt;
                    var isSel = sel && sel.si === si && sel.i === i;
                    /* 芯片里只放短名：剥掉标题里的中文序号前缀（「三 未报价收尾」→「未报价收尾」），序号用左侧徽章 */
                    var nm = String(st.title || ("第 " + (i + 1) + " 步")).replace(/^[一二三四五六七八九十]+\s*/, "");
                    html += '<button type="button" class="sp-chip' + (done ? " done" : "") + (isSel ? " sel" : "") + '" data-si="' + si + '" data-i="' + i + '">' +
                      '<span class="sp-no">' + (i + 1) + '</span>' +
                      '<span class="sp-name">' + escHtml(nm) + '</span>' +
                      (done ? '<span class="sp-ck">✓</span>' : "") +
                      "</button>";
                  });
                  html += "</div>";
                });
                html += '<button type="button" class="sp-sendone" data-act="sp-send">' +
                  (selSt ? "📤 发到 WhatsApp · 第 " + (sel.i + 1) + " 段" : "📤 发到 WhatsApp") +
                  "</button></div></div>";
               box.innerHTML = html;
               box.querySelectorAll(".sp-chip").forEach(function (ch) {
                ch.addEventListener("click", function () {
                  sel = { si: +ch.getAttribute("data-si"), i: +ch.getAttribute("data-i") };
                  renderCard();
                });
              });
              var sendBtn = box.querySelector('[data-act="sp-send"]');
              if (sendBtn) sendBtn.addEventListener("click", function () {
                  if (!sel) return;
                  var si = sel.si, i = sel.i;
                  var d = scripts[si], st = d && d.steps[i];
                  if (!st) return;
                  if (!b.wa) { App.toast("这个客户还没有 WhatsApp 号码，先用上方「编辑」补录再发"); return; }
                  var text = (window.DocExtract && DocExtract.fillVars) ? DocExtract.fillVars(st.text, cf, myName) : String(st.text || "");
                  var su = waLink(b.wa, text);
                  if (!su) { App.toast("号码格式不对，打不开 WhatsApp，请检查档案里的号码"); return; }
                  b.messages.push({ from: "me", text: text, time: "刚刚", status: "handed" });
                  AIevt(b, "script", { doc: d.key, step: i, title: st.title || "" });
                  b.scriptProg = b.scriptProg || {};
                  b.scriptProg[d.key] = Math.max(Number(b.scriptProg[d.key] || 0), i + 1);
                  if (window.Store) Store.commit();
                  window.open(su, "_blank");
                  App.toast("已打开第 " + (i + 1) + " 步 · 还没发送！发完回来点「✓ 已发」");
                  App.refresh();
                });
            }
            renderCard();
          }).catch(function () { /* 剧本拉取失败不阻塞客户页 */ });
        })();

        /* ===== 2026-10-18 产品照片库改版（Phil 三指令）：
           ① 换成 WA 版整体照 4 张（photos/wa/，旧 Titan X 12 张已删）
           ② 缩略图一排 4 张，尽量省空间
           ③ 发送直达当前客户：openWa 把「照片链接」预填进本客户的 WhatsApp 对话框，
              不用再选客户；保留「分享原图」走 iOS 分享面板（发原生图片/其他 App） */
        (function loadPhotoCard() {
          var box = root.querySelector("#photoCard");
          if (!box || b.outcome || b.scope === "pet") return;
          var pageBase = location.href.split("#")[0].replace(/[^/]*$/, "");
          fetch("photos.json?v=3").then(function (r) { return r.json(); }).then(function (man) {
            var data = man && man.suitcase;
            if (!data || !data.groups || !data.groups.length) { box.innerHTML = ""; return; }
            var flat = [];
            data.groups.forEach(function (g) {
              (g.photos || []).forEach(function (p) {
                flat.push({ label: p.label, file: (data.base || "photos/") + p.file });
              });
            });
            if (!flat.length) { box.innerHTML = ""; return; }
            /* 2026-10-18 v2（Phil）：多选 + 右上角「全选」+ 醒目圈框——
               sel 为索引集合，点照片切换选中，全选框一次框定全部，可一次发给本客户 */
            var sel = {};
            function selItems() {
              var out = [];
              flat.forEach(function (it, n) { if (sel[n]) out.push(it); });
              return out;
            }
            function absUrl(it) { return pageBase + it.file; }
            function renderCard() {
              var cnt = selItems().length;
              var allOn = cnt === flat.length && cnt > 0;
              var html = '<div class="card ctx-card" style="margin:12px 16px 0">' +
                '<div class="ctx-head"><span class="ctx-title">📷 ' + escHtml(data.name || "产品照片") + '</span>' +
                '<label class="ph-all"><input type="checkbox" data-act="ph-all"' + (allOn ? " checked" : "") + "/> 全选</label></div>" +
                '<div class="sp-body">';
              if (data.groups.length > 1) html += '<div class="ph-gtitle">' + escHtml(data.groups[0].title) + '</div>';
              html += '<div class="ph-grid">';
              flat.forEach(function (it, n) {
                html += '<button type="button" class="ph-chip' + (sel[n] ? " sel" : "") + '" data-n="' + n + '">' +
                  '<img src="' + it.file + '?v=3" loading="lazy" alt=""/>' +
                  '<span class="ph-lb">' + escHtml(it.label) + "</span></button>";
              });
              html += "</div>" +
                '<div class="ph-note">主按钮发<b>原生照片</b>（客户直接看到图）：弹出分享面板后在 WhatsApp 里点一下本客户即发；不想选人可用下方链接方式</div>' +
                '<button type="button" class="ph-sendone" data-act="ph-send">' +
                (cnt ? "📷 发给本客户 · " + cnt + " 张（原生照片）" : "📷 发给本客户（先点照片选中，可多选）") + "</button>" +
                '<button type="button" class="ph-share" data-act="ph-share">发图片链接（免选客户）</button></div></div>';
              box.innerHTML = html;
              box.querySelectorAll(".ph-chip").forEach(function (ch) {
                ch.addEventListener("click", function () {
                  var n = +ch.getAttribute("data-n");
                  if (sel[n]) delete sel[n]; else sel[n] = true;
                  renderCard();
                });
              });
              box.querySelector('[data-act="ph-all"]').addEventListener("change", function (e) {
                sel = {};
                if (e.target.checked) flat.forEach(function (it, n) { sel[n] = true; });
                renderCard();
              });
              /* 2026-10-18 v3（Phil："你发过去的是链接，全部改成照片，客户能直接看到照片"）：
                 主按钮=原生照片（iOS 分享面板，选 WhatsApp 后点一下本客户）；
                 次按钮=图片链接预填（免选客户，但客户看到的是链接） */
              box.querySelector('[data-act="ph-send"]').addEventListener("click", function () {
                var items = selItems();
                if (!items.length) { App.toast("先点照片选中（或点右上角「全选」）"); return; }
                Promise.all(items.map(function (it) {
                  return fetch(it.file + "?v=3").then(function (r) { return r.blob(); }).then(function (bl) {
                    return new File([bl], "WA-" + it.label + ".jpg", { type: "image/jpeg" });
                  });
                })).then(function (files) {
                  if (navigator.canShare && navigator.canShare({ files: files })) {
                    navigator.share({ files: files, title: items.length === 1 ? items[0].label : "产品照片 ×" + items.length }).then(function () {
                      b.messages.push({ from: "me", text: "📷 已发照片×" + items.length + "（原生）", time: "刚刚", status: "handed" });
                      AIevt(b, "photo", { n: items.length, via: "share" });
                      if (window.Store) Store.commit();
                      App.refresh();
                    }).catch(function (e) { if (String((e && e.name) || e) !== "AbortError") App.toast("分享面板没打开，可改用「发图片链接」"); });
                  } else App.toast("这台设备不支持照片分享，请点「发图片链接」");
                }).catch(function () { App.toast("照片没加载出来，请点「发图片链接」"); });
              });
              box.querySelector('[data-act="ph-share"]').addEventListener("click", function () {
                var items = selItems();
                if (!items.length) { App.toast("先点照片选中（或点右上角「全选」）"); return; }
                if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先点右上角「✎ 编辑」补全"); return; }
                var msg = items.length === 1
                  ? "📷 " + items[0].label + "\n" + absUrl(items[0])
                  : "📷 产品照片 ×" + items.length + "\n" + items.map(function (it, i) { return (i + 1) + ". " + it.label + " " + absUrl(it); }).join("\n");
                if (openWa(msg, "发了照片链接×" + items.length + "：" + items.map(function (it) { return it.label; }).join("、"))) {
                  AIevt(b, "photo", { n: items.length, via: "wa-link" });
                }
              });
            }
            renderCard();
          }).catch(function () { box.innerHTML = ""; });
        })();

       /* ① 写大概意图 → AI 按意图扩充（或逐句直译）→ 对话区展示对照 → 再手动跳 WhatsApp */
       var mtMode = "expand"; // expand=按意图扩充 / direct=逐句直译
       var pending = null; // { raw, zh, en, mode, lang, loading }
       function pendingHtml() {
         var loading = pending.loading;
         var isExp = pending.mode === "expand";
          return '<div class="pending">' +
            '<div class="pending-head"><span class="pending-tag">' + (loading ? (isExp ? "AI 正在按意图扩充…" : "AI 正在翻译…") : (isExp ? "① 已扩充 · 确认后发送" : "① 已翻译 · 确认后发送")) + '</span><span class="pending-lang">→ ' + escHtml(pending.lang) + "</span></div>" +
            (loading
              ? '<div class="pending-text pending-loading">' + (isExp ? "正在把你的意图补成一条完整消息…" : "正在把中文改写为符合客户习惯的表达…") + "</div>"
              : '<div class="pending-text">' + escHtml(pending.en) + "</div>" +
                (limitWarn(b, pending.en) ? '<div class="pending-warn">⚠ ' + escHtml(limitWarn(b, pending.en)) + " · 超出你设的底线，需你本人确认后发送</div>" : "") +
                '<div class="pending-zh">' + (isExp ? "这条消息的意思：" : "你写的中文：") + escHtml(pending.zh) + "</div>" +
               '<div class="pending-btns">' +
               '<button class="p-send" data-act="p-send">发到 WhatsApp</button>' +
               '<button class="p-re" data-act="p-re">不满意 · 再来一条</button>' +
               '<button class="p-x" data-act="p-x">取消</button>' +
               "</div>") +
           "</div>";
       }
       function bindPending() {
         var box = root.querySelector("#pendWrap .pending");
         if (!box) return;
         var s = box.querySelector('[data-act="p-send"]');
         if (s) s.addEventListener("click", function () {
            /* 埋点：raw↔text 配对——业务员自己写的中文原话 vs AI 输出，是个体化风格学习的唯一证据 */
            AIevt(b, "sent", { src: pending.mode === "expand" ? "expand" : "translate", raw: pending.raw, zh: pending.zh, text: pending.en, stage: b.stage });
           if (window.Store) Store.commit();
           if (openWa(pending.en, pending.zh)) { pending = null; renderPending(); }
         });
          var r = box.querySelector('[data-act="p-re"]');
          if (r) r.addEventListener("click", function () { AIevt(b, "regen", { raw: pending.raw, mode: pending.mode, stage: b.stage }); translate(pending.raw); });
          var x = box.querySelector('[data-act="p-x"]');
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
       /* ① 模式切换：按意图扩充 / 逐句直译 */
       root.querySelectorAll("[data-mt]").forEach(function (btn) {
         btn.addEventListener("click", function () {
           mtMode = btn.getAttribute("data-mt");
           root.querySelectorAll("[data-mt]").forEach(function (x) { x.classList.remove("active"); });
           btn.classList.add("active");
           var go = root.querySelector("#mtGo");
           if (go) go.textContent = mtMode === "expand" ? "AI 扩充 →" : "AI 翻译 →";
         });
       });

       function translate(t) {
         t = String(t || "").trim();
         if (!t) return;
         if (!window.LLM || !LLM.configured()) { App.toast("请先在设置里配置 AI（智能引擎）"); return; }
         var isExp = mtMode === "expand";
         pending = { raw: t, zh: t, en: "", mode: mtMode, lang: (window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语", loading: true };
         renderPending();
         var call = isExp
           ? LLM.expand(t, b)
           : LLM.localize(t, b).then(function (en0) { return { text: en0, zh: t }; });
         call.then(function (o) {
           var en = String(o.text || "").trim();
           if (!en) throw new Error("结果为空");
           pending.loading = false;
           pending.en = en;
           pending.zh = isExp ? (String(o.zh || "").trim() || t) : t;
           renderPending();
           App.toast(isExp ? "已按你的意图扩充 · 检查满意再点\"发到 WhatsApp\"" : "已翻译 · 检查一下，满意再点\"发到 WhatsApp\"");
         }).catch(function (e) {
           pending = null;
           renderPending();
           App.toast((isExp ? "扩充" : "翻译") + "失败，请重试：" + e.message);
         });
       }
      function doTranslate() {
        var t = input.value.trim();
        if (!t) { App.toast("先在方式①里写一句中文，AI 翻给你看；或去方式②挑一条 AI 代写的"); return; }
        if (!/[一-龥]/.test(t)) { AIevt(b, "sent", { src: "manual", raw: t, text: t, stage: b.stage }); if (window.Store) Store.commit(); sendWa(t); autoZh(t); return; }
        if (!b.wa) { App.toast("该买家暂无 WhatsApp 号码，先点右上角「✎ 编辑」补全"); return; }
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
            AIevt(b, "sent", { src: "ai", i: suggIndex(container, btn), text: btn.dataset.text, zh: btn.dataset.zh, stage: b.stage });
            if (window.Store) Store.commit();
            sendWa(btn.dataset.text, btn.dataset.zh);
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
         /* 2026-10-14 提速体验：流式打字机预览——AI 边写边显示，不再是干等 20 秒的静止状态 */
         var t0 = Date.now();
         wrap.innerHTML = '<div class="empty" style="padding:14px 0"><div id="regenTimer" style="margin-bottom:6px;color:var(--brand-deep)"><b>AI 正在结合档案、资料与对话写…</b> 0 秒</div><div id="regenLive" class="mem-text" style="max-height:190px;overflow:hidden"></div></div>';
         var timer = setInterval(function () {
           var te = wrap.querySelector("#regenTimer");
           if (te) te.innerHTML = "<b>AI 正在结合档案、资料与对话写…</b> " + Math.floor((Date.now() - t0) / 1000) + " 秒";
         }, 1000);
         LLM.suggest(b, function (full) {
           var lv = wrap.querySelector("#regenLive");
           if (lv) lv.textContent = String(full || "").length > 2200 ? "…" + String(full).slice(-2200) : String(full || "");
         }).then(function (res) {
           clearInterval(timer);
           var list = res && res.list;
          if (!list || !list.length) throw new Error("返回为空");
          var items = list.slice(0, 3);
          var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(b) : "英语";
          b.aiSuggests = { lang: lang, at: new Date().toISOString(), items: items };
          if (res.diagnosis && (res.diagnosis.nextGoal || res.diagnosis.blocker)) {
            b.aiDiag = { at: new Date().toISOString(), nextGoal: res.diagnosis.nextGoal || "", blocker: res.diagnosis.blocker || "" };
          }
          AIevt(b, "gen", { stage: Mock.STAGES[b.stage], goal: b.aiDiag ? b.aiDiag.nextGoal : "", texts: items.map(function (s) { return s.text; }) });
           if (window.Store) Store.commit();
           wrap.innerHTML = items.map(function (s) { return suggCard(s, b); }).join("");
          bindSugg(wrap);
           /* 2026-10-18：诊断行与"已存"角标已按 Phil 要求删除（UI 精简），不再回填 */
           if (regen) regen.textContent = "✦ 重新生成";
          var leaked = lang !== "中文" && items.some(function (s) { return /[一-龥]/.test(s.text || ""); });
          App.toast(leaked ? "注意：AI 仍输出了中文，建议在设置里换成更强模型后重试" : "已生成并保存 · 含谈单诊断");
        }).catch(function (e) {
          App.toast("生成失败：" + e.message);
          App.refresh();
        }).finally(function () { regen.disabled = false; });
      });
       /* 2026-10-18（Phil）：「AI 扩充」按钮删除——写完停笔 2 秒自动扩充/直译。
          意图框已是多行 textarea：Enter 换行不再触发提交；上一次还在生成中则不打断 */
       var autoT = null;
       input.addEventListener("input", function () {
         if (autoT) clearTimeout(autoT);
         var t = input.value.trim();
         if (!t) return;
         autoT = setTimeout(function () {
           if (pending && pending.loading) return;
           if (input.value.trim() === t) doTranslate();
         }, 2000);
       });

        /* 🎤 按住说话：录音 → 上传云端识别 → 回填文字（iPhone/微信/任意浏览器通用，不依赖浏览器语音引擎） */
        var micBtn = root.querySelector("#micBtn");
        if (micBtn) {
          var MediaRec = window.MediaRecorder || window.webkitMediaRecorder;
          var rec = null, chunks = [], busy = false, baseVal = "";
          var DEFAULT_LABEL = micBtn.textContent;
          function setLabel(t) { micBtn.textContent = t; }
           function cloudCfg() {
             var s = (window.Store && Store.getSettings) ? (Store.getSettings() || {}) : {};
             var c = s.llm || {};
             var cl = s.cloud || {};
             if (!c.proxyUrl && cl.proxyUrl) c.proxyUrl = cl.proxyUrl;
             var au = window.Auth && Auth.get();
             c.session = (au && au.session) || "";
             return c;
           }
          function pickMime() {
            var pref = ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/aac", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
            if (MediaRec && MediaRec.isTypeSupported) {
              for (var i = 0; i < pref.length; i++) { try { if (MediaRec.isTypeSupported(pref[i])) return pref[i]; } catch (e) {} }
            }
            return "";
          }
          function fmtOf(m) {
            m = (m || "").toLowerCase();
            if (m.indexOf("mp4") >= 0 || m.indexOf("aac") >= 0) return "m4a";
            if (m.indexOf("mp3") >= 0 || m.indexOf("mpeg") >= 0) return "mp3";
            if (m.indexOf("wav") >= 0 || m.indexOf("pcm") >= 0) return "wav";
            if (m.indexOf("ogg") >= 0) return "ogg";
            if (m.indexOf("webm") >= 0) return "webm";
            return "m4a";
          }
          function b64FromBlob(blob) {
            return new Promise(function (resolve, reject) {
              var fr = new FileReader();
              fr.onload = function () { resolve(String(fr.result).split(",")[1] || ""); };
              fr.onerror = function () { reject(new Error("读取录音失败")); };
              fr.readAsDataURL(blob);
            });
          }
          function stopStream() {
            if (rec && rec.stream) { try { rec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
          }
          /* 按住说话提示音：按下=高音（开始录），松开=低音（停止录） */
          var actx = null;
          function beep(freq, dur) {
            try {
              var AC = window.AudioContext || window.webkitAudioContext;
              if (!AC) return;
              if (!actx) actx = new AC();
              if (actx.state === "suspended") actx.resume();
              var t0 = actx.currentTime;
              var o = actx.createOscillator(), g = actx.createGain();
              o.type = "sine"; o.frequency.value = freq;
              g.gain.setValueAtTime(0.0001, t0);
              g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
              g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
              o.connect(g); g.connect(actx.destination);
              o.start(t0); o.stop(t0 + dur + 0.05);
            } catch (e) {}
          }
           var pendingStop = false, recTimer = null;
           function stopMic() {
            if (rec && rec.state === "recording") { try { rec.stop(); } catch (e) {} }
            else pendingStop = true; /* 手指先松、录音还没就绪：记一笔，rec.start() 后立即停，防止麦克风一直开着 */
          }
          micBtn.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            if (busy) return;
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !MediaRec) {
              App.toast("这台设备/浏览器不支持录音，请用系统浏览器打开，或用键盘输入"); return;
            }
            var c = cloudCfg();
            if (!c.proxyUrl) { App.toast("语音识别需要云服务：请先登录（设置里填云服务地址）"); return; }
            if (!c.session) { App.toast("请先登录后再使用语音识别"); return; }
            busy = true;
            pendingStop = false;
            var mime = pickMime();
            beep(880, 0.12); /* 按下提示音：开始录音 */
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
              if (window.Voice && Voice.noteGrant) Voice.noteGrant();
              try { rec = new MediaRec(stream, mime ? { mimeType: mime } : undefined); }
              catch (err) { rec = new MediaRec(stream); }
              chunks = [];
              baseVal = (input.value || "").replace(/\s+$/, "");
              micBtn.classList.add("rec"); setLabel("松手结束");
              rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
              rec.onerror = function (ev) { stopStream(); busy = false; micBtn.classList.remove("rec"); setLabel(DEFAULT_LABEL); App.toast("录音出错：" + (ev.error || ev.message || "未知")); };
               rec.onstop = function () {
                 try { if (recTimer) { clearTimeout(recTimer); recTimer = null; } } catch (e) {}
                 var blob = new Blob(chunks, { type: (rec && rec.mimeType) || mime || "audio/mp4" });
                var fmt = fmtOf((rec && rec.mimeType) || mime);
                stopStream();
                beep(520, 0.12); /* 松开提示音：录音已结束 */
                if (!blob.size) { busy = false; micBtn.classList.remove("rec"); setLabel(DEFAULT_LABEL); App.toast("没录到声音，再按住说一次"); return; }
                micBtn.classList.remove("rec"); micBtn.classList.add("busy"); setLabel("识别中…");
                 b64FromBlob(blob).then(function (b64) {
                   var ctl = new AbortController();
                   var tm = setTimeout(function () { ctl.abort(); }, 75000); /* 75s 封顶：服务端最长 60s（60s 长音频），再多就是网络问题 */
                    return fetch(String(c.proxyUrl).replace(/\/+$/, "") + "/stt", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "x-dealdesk-session": c.session || "" },
                      body: JSON.stringify({ audio: b64, format: fmt }),
                      signal: ctl.signal
                   }).then(function (r) { clearTimeout(tm); return r.json(); });
                 }).then(function (j) {
                  micBtn.classList.remove("busy"); setLabel(DEFAULT_LABEL);
                  if (j && j.text) { input.value = (baseVal ? baseVal + " " : "") + j.text; input.focus(); }
                  else App.toast((j && j.error ? j.error : "没识别到内容，再按住说一次").slice(0, 80));
                 }).catch(function (e2) {
                   micBtn.classList.remove("busy"); setLabel(DEFAULT_LABEL);
                   App.toast(e2 && e2.name === "AbortError" ? "识别超时（网络不稳定），请再试一次或改用打字" : "识别失败，请重试：" + e2.message);
                 }).then(function () { busy = false; });
              };
               recTimer = setTimeout(function () { try { if (rec && rec.state === "recording") rec.stop(); } catch (e3) {} }, 60000); /* 2026-10-14 反馈修复：业务员一次说 30-60s 长句会被 30s 截断"记录不下来"，放宽到 60s */
               try { rec.start(); if (pendingStop) { pendingStop = false; try { rec.stop(); } catch (err2) {} } } catch (err) { try { clearTimeout(recTimer); } catch (e4) {} stopStream(); busy = false; micBtn.classList.remove("rec"); setLabel(DEFAULT_LABEL); App.toast("录音启动失败：" + err.message); }
             }).catch(function (e) {
               busy = false; micBtn.classList.remove("rec"); setLabel(DEFAULT_LABEL);
               if (window.Voice && Voice.showDeniedPanel) Voice.showDeniedPanel();
               else App.toast("麦克风被禁用：点浏览器地址栏左侧图标允许麦克风，再按住说话");
             });
          });
          micBtn.addEventListener("pointerup", function (e) { e.preventDefault(); stopMic(); });
          micBtn.addEventListener("pointercancel", function () { stopMic(); });
          micBtn.addEventListener("pointerleave", function () { stopMic(); });
          micBtn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
          micBtn.addEventListener("dragstart", function (e) { e.preventDefault(); });
        }

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
             if (window.Store) Store.bumpIntent(b.id, 2, "回答编号选项");
            var prevStage = b.stage;
            if (b.stage < 4) b.stage++;
            if (b.stage !== prevStage) AIevt(b, "stage", { to: Mock.STAGES[b.stage] });
            AIevt(b, "reply", { via: "option", text: opt.reply });
            autoZh(opt.reply);
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
