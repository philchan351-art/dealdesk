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
  var BD_VER = (window.APP_VERSION && APP_VERSION.v) || "?"; /* 版本角标：单一事实源 = version.js（2026-10-19 版本号体系），便于一眼确认手机跑的是哪版 */
  var zhBusy = {};
  var _chatPos = { id: null, top: 0, atBottom: true }; /* 2026-10-18（Phil「页面自己跳上跳下」）：聊天滚动位置跨重渲染记忆 */ // 防重入：同一文本正在翻译时不重复发起
  var _bdGen = 0;      /* 2026-10-18：init 代际号——被新一轮渲染取代后，遗留的 rAF 回调不得再执行（旧渲染的滚动会把新画面拽乱） */
  var scriptCache = { key: "", ts: 0, j: null }; /* 2026-10-18（A7）：话术数据 60s 缓存——同页刷新不重复请求 */
  /* 2026-10-21（Phil「要很久才出来」）：登录进主界面时预取一次话术元数据（5KB、~150ms），
     让"第一次进客户页"也能从本地缓存秒出，不用等网络 */
  window.DDSharedPrefetch = function () {
    try {
      if (!window.Sync || !Sync.enabled || !Sync.enabled() || !Sync.sharedMeta) return;
      Sync.sharedMeta().then(function (j) {
        if (j && j.docs && j.docs.length) { try { localStorage.setItem("dd_scripts_cache_v1", JSON.stringify({ ts: Date.now(), docs: j.docs })); } catch (e) {} }
      }).catch(function () {});
    } catch (e) {}
    /* 2026-10-21（Phil「照片要很久才出来」）：预取照片清单 + 预热 14 张缩略图（共约 186KB）——
       进客户页时清单走本地缓存、缩略图直接命中 HTTP 缓存 */
    try {
      fetch("photos.json?v=4").then(function (r) { return r.json(); }).then(function (man) {
        try { localStorage.setItem("dd_photos_cache_v1", JSON.stringify({ ts: Date.now(), data: man })); } catch (e) {}
        try {
          var base = (man && man.suitcase && man.suitcase.base) || "photos/";
          ((man && man.suitcase && man.suitcase.groups) || []).forEach(function (g) {
            (g.photos || []).forEach(function (ph) {
              var im = new Image();
              im.src = base + (ph.thumb || ("thumbs/" + ph.file)) + "?v=4";
            });
          });
        } catch (e2) {}
      }).catch(function () {});
    } catch (e) {}
  };
  var photoCache = { ts: 0, data: null };        /* 2026-10-18（A7）：photos.json 60s 缓存 */
  var photoSel = {};                             /* 2026-10-18（A7）：照片选中状态按客户存模块级，同页刷新不清空 */

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

  /* 2026-10-18（B2）：成交/流失是低频动作，从两个大按钮收成小胶囊，不再占满一行 */
  function outcomeHtml(b) {
    if (b.outcome) {
      var won = b.outcome.status === "won";
      return '<div class="outcome-row" style="margin:10px 16px 0">' +
        '<span class="outcome-chip ' + (won ? "won" : "lost") + '">' + (won ? "✓ 已成交" : "✗ 已流失" + (b.outcome.reason ? " · " + escHtml(b.outcome.reason) : "")) + "</span>" +
        '<button class="oc-clear" data-act="oc-clear">清除标记</button></div>';
    }
    return '<div class="outcome-row" style="margin:10px 16px 0">' +
      '<button class="oc-mini" data-act="oc-won">✓ 成交</button>' +
      '<button class="oc-mini oc-mini-lost" data-act="oc-lost">✗ 流失</button></div>';
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
      (s.blocked ? '<div class="sugg-warn" style="color:#b91c1c">⛔ 后置校验：' + escHtml((s.blockReasons || []).join("；")) + " — 触碰红线，改完再发</div>" : "") +
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
    if (imgsHtml) {
      if (!m.text) imgsHtml += '<div class="zh-line zh-skip">图片消息不自动翻译 · 把文字复制进「记一句」即可翻</div>'; /* 2026-10-19（Phil「还是翻译不出来」）：纯图片消息不再静默无反馈 */
      imgsHtml = '<div class="msg-imgs">' + imgsHtml + "</div>";
    }
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
    return '<div class="remind"><b>' + U.dueLabel(U.followDays(fu)).text + '</b><span>' + escHtml(fu.action) +
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
        '<div class="cmp-notes">' + (b.compare.notes || []).map(function (n) { return "<div>· " + escHtml(n) + "</div>"; }).join("") + "</div>" +
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
       /* 2026-10-22（「客户进不去了」）：老数据可能只有 options 没有 items，缺字段不能让 render 抛异常 */
       var optHtml = b.options && b.options.items
         ? '<div class="wacard"><div class="wa-opt-label">编号选项触达 · 客户回一个数字即可，自动识别并沉淀</div>' +
          b.options.items.map(function (it, i) {
            return '<button class="wa-opt" data-oi="' + i + '">' + escHtml(it.t) + "</button>";
          }).join("") + "</div>"
        : "";

       return '<div class="topbar">' +
         '<div class="tb-back" data-act="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div>' +
          '<div class="tb-title"><h1>' + escHtml(b.name) + '</h1><div class="tb-sub">' + escHtml(b.wa ? U.waDisplay(b.wa) : "未填 WhatsApp") + " · " + escHtml(b.country) + " · " + escHtml(b.lastActive) + " 活跃</div></div>" +
          '<button class="wa-jump edit-prof" data-act="edit-prof" title="修改姓名/WhatsApp 号码等基础信息">✎ 编辑</button>' +
          '<button class="wa-jump" data-act="jump">' + WA_ICON + "<span>直达对话</span></button>" +
         "</div>" +
         '<div class="detail-body">' +
         '<div class="card d-info">' + U.avatar(b, true) +
         '<div><div class="d-name">' + escHtml(b.name) + "</div>" +
          '<div class="d-sub">' + escHtml(b.product) + " · " + escHtml(b.qty) + " · " + U.quoteLabel(b) + "</div>" +
          '<div class="d-tags">' + (b.tags || []).map(function (t) { return '<span class="tag">' + escHtml(t) + "</span>"; }).join("") + "</div></div>" +
         '<div class="d-ring">' + U.intentRing(b.intent) + "<small>意向评分</small></div>" +
         "</div>" +
          outcomeHtml(b) +
          /* 2026-10-22（Phil：阶段判定不能"表面"）：阶段卡 = 进度条 + 最近一次留痕 + 手动调阶段（六档芯片） */
           '<div class="card tracker st-card" style="margin-top:10px">' + U.stageTracker(b.stage) +
            (function () {
              /* 2026-10-22（浏览器真机复现的崩溃点）：旧写法下标里裸读 b.stageLog.length，
                 没有 stageLog 字段的客户（新建客户、从未推进过阶段的客户）render 直接抛异常 → 点不进客户 */
              var _sl = b.stageLog || [];
              var lg = _sl.length ? _sl[_sl.length - 1] : null;
              return lg ? '<div class="st-log">阶段留痕：' + Mock.STAGES[lg.from] + " → " + Mock.STAGES[lg.to] + (lg.why ? " · " + escHtml(lg.why) : "") + " · " + String(lg.at).slice(5, 10) + "</div>" : "";
            })() +
            (b.outcome ? "" : '<div class="st-adj" data-act="st-adj">调整阶段 ▾</div><div class="st-chips" style="display:none">' + Mock.STAGES.map(function (s, i) { return '<button type="button" class="st-chip' + (i === b.stage ? " active" : "") + '" data-si="' + i + '">' + s + "</button>"; }).join("") + "</div>") +
           "</div>" +
           /* 成交信号卡：机械/AI 检测到付款/PI 硬证据 → 醒目提示，一键确认才算成交（Phil 口径：成交=人工终裁） */
           (function () {
             if (!b.closeSignal || b.outcome) return "";
             return '<div class="card close-signal" style="margin:10px 16px 0"><b>💰 检测到成交信号</b><span>' + escHtml(b.closeSignal.why) + (b.closeSignal.evidence ? ' · 证据："' + escHtml(b.closeSignal.evidence) + '"' : "") + '</span><div class="cs-actions"><button class="cs-won" data-act="cs-won">✓ 确认成交（计入本月成交）</button><button class="cs-no" data-act="cs-no">还没成 · 忽略</button></div></div>';
           })() +
           (function () {
             var rk = riskOf(b);
              return rk ? '<div class="card risk-card" style="margin:10px 16px 0"><b>⚠ 谈单遇冷</b><span>' + escHtml(rk.reasons) + '</span><div class="risk-strat">建议策略：' + escHtml(rk.strat) + "</div></div>" : "";
           })() +
          /* 2026-10-14 真实反馈：没喂产品资料时 AI 会编参数，用醒目横幅引导去上传训练资料 */
          (function () {
            var p = (window.Store && Store.getPersona) ? Store.getPersona() : null;
            var hasDocs = !!(p && (p.docs || []).length);
            /* 2026-10-18（B10）：两行长横幅收成单行小条，一句话讲清后果和去处 */
            return hasDocs ? "" : '<div class="set-note" style="margin:10px 16px 0;padding:8px 12px;border-radius:10px;background:#FFF7E8;border:1px solid #FFD591;font-size:12px;color:#8a6d1a">⚠ 还没喂产品资料，AI 可能"编"参数 · 到「设置 → AI 训练资料」上传即可</div>';
          })() +
           '<div id="scriptCard"></div>' +
           '<div id="photoCard"></div>' +
            '<div class="d-sec-title" style="margin-top:14px;margin-left:16px;margin-right:16px">WhatsApp 对话记录 · 过渡模式</div>' +
          '<div class="wa-chat">' +
          '<div class="wa-head">' + WA_ICON +
          '<div class="wa-hmid"><b>' + escHtml(b.name) + "</b><span>" + escHtml(b.wa ? U.waDisplay(b.wa) : "未填 WhatsApp") + "</span></div>" +
         '<button class="wa-lang" data-act="import" style="margin-right:6px">＋ 导入</button>' +
         '<button class="wa-lang active" data-act="lang">中文对照</button>' +
         '<span class="zh-ver">v' + BD_VER + '</span>' +
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
            '<div class="mode-tt"><b>自己写中文 · AI 自动扩充</b></div>' +
            '<div class="mt-row mt-row-inline"><button class="mt-btn active" data-mt="expand">按意图扩充</button><button class="mt-btn" data-mt="direct">逐句直译</button></div></div>' +
           '<textarea id="msgInput" rows="3" placeholder="写大概意图（写完自动扩充），或按住下面🎤说话"></textarea>' +
             '<button class="mic-btn" id="micBtn" type="button">🎤 按一下说话</button>' +
             '<div class="mic-note">语音→文字 · 只转写、不存任何录音</div>' +
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
       var myGen = ++_bdGen; /* 代际号：后续重渲染会使本 init 的遗留 rAF 失效 */

       var back = root.querySelector('[data-act="back"]');
      if (back) back.addEventListener("click", function () { App.go("buyers"); });
      var fuBtn = root.querySelector('[data-act="fu"]');
      if (fuBtn) fuBtn.addEventListener("click", function () { App.go("followup", "new/" + b.id); });

      var langSel = root.querySelector("#langSel");
        /* 成交 / 流失标记（学习层的结果标签）
           2026-10-22（Phil：实际成交要被判出来）：成交与 stage 联动——
           标成交 ⇒ stage→5（留痕、记 prevStage 可回退）；清标记 ⇒ 回到 prevStage */
         function markWon(via) {
           if (b.outcome) return;
           /* 2026-10-23：数据写入收口到 Store.markWon（与列表一键 ✓ 同一入口），这里只管埋点与界面 */
           Store.markWon(b.id, via);
           AIevt(b, "outcome", { status: "won", via: via || "manual" });
           if (window.Store) Store.commit();
           App.toast("已记录成交 · 计入本月成交");
           App.refresh();
         }
        var ocWon = root.querySelector('[data-act="oc-won"]');
        if (ocWon) ocWon.addEventListener("click", function () {
          if (!confirm("标记为已成交？（标错可点\"清除标记\"）")) return;
          markWon("manual");
        });
        /* 成交信号卡：一键确认 / 忽略 */
        var csWon = root.querySelector('[data-act="cs-won"]');
        if (csWon) csWon.addEventListener("click", function () {
          if (!confirm("确认标记为已成交？（计入本月成交，标错可点\"清除标记\"）")) return;
          markWon("signal");
        });
        var csNo = root.querySelector('[data-act="cs-no"]');
        if (csNo) csNo.addEventListener("click", function () {
          b.closeSignal = null;
          if (window.Store) Store.commit();
          App.toast("已忽略（之后再有成交信号会重新提醒）");
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
          /* 清除"已成交"：stage 从 5 回到标记前的档位（留痕），客户重新回到进行中管道 */
          if (b.outcome && b.outcome.status === "won" && b.stage >= 5) {
            var back = (typeof b.outcome.prevStage === "number") ? b.outcome.prevStage : 4;
            b.stage = Math.min(back, 4);
            b.stageLog = b.stageLog || [];
            b.stageLog.push({ from: 5, to: b.stage, at: new Date().toISOString(), why: "清除成交标记", src: "manual" });
            AIevt(b, "stage", { to: Mock.STAGES[b.stage] });
          }
          b.outcome = null;
          b.closeSignal = null;
          if (window.Store) Store.commit();
          App.refresh();
        });
        /* 手动调阶段：进度条上「调整阶段 ▾」→ 六档芯片，任意方向，留痕"手动调整" */
        var stAdj = root.querySelector('[data-act="st-adj"]');
        if (stAdj) stAdj.addEventListener("click", function (e) {
          e.stopPropagation();
          var chips = root.querySelector(".st-chips");
          if (chips) chips.style.display = chips.style.display === "none" ? "" : "none";
        });
        root.querySelectorAll(".st-chip").forEach(function (ch) {
          ch.addEventListener("click", function () {
            var to = Number(ch.dataset.si);
            if (b.outcome) { App.toast("已成交/流失客户：先清除标记再调阶段"); return; }
            if (to === b.stage) { App.refresh(); return; }
            if (window.U && U.applyStage) {
              if (to > b.stage) U.applyStage(b, to, "手动调整", "manual");
              else {
                var f5 = b.stage;
                b.stage = to;
                b.stageLog = b.stageLog || [];
                b.stageLog.push({ from: f5, to: to, at: new Date().toISOString(), why: "手动调回", src: "manual" });
              }
            } else {
              b.stage = to;
            }
            AIevt(b, "stage", { to: Mock.STAGES[b.stage] });
            if (window.Store) Store.commit();
            App.toast("阶段已设为：" + Mock.STAGES[b.stage]);
            App.refresh();
          });
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
        /* 2026-10-22（Phil「客户进不去了」，Chrome 复核）：window.open(_blank) 在 Chrome（尤其安卓）
           默认开后台新标签——屏幕不动，看起来像死按钮。统一改当前窗口导航：可见跳转，返回键回客户页 */
        location.href = ju;
        App.toast("正在打开 WhatsApp → " + b.name);
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
          /* 2026-10-19（Phil「还是翻译不出来」）：只跳过"纯中文"；中英混合（客户信息表单/带中文标注的消息）也译——
             翻译 SYS 已支持"保留中文、只译外文"。纯中文 = 有中文且外文字母 <10 个 */
          if (!text) return;
          if (/[一-龥]/.test(text) && (text.match(/[A-Za-z]/g) || []).length < 10) return;
          if (!window.LLM || !LLM.configured()) return;
          if (zhBusy[text]) return;
          var target = null;
          for (var i0 = b.messages.length - 1; i0 >= 0; i0--) {
            var m0 = b.messages[i0];
            if (m0.text === text && (!m0.zh || m0.zh === "翻译中…" || m0.zhFail)) { target = m0; break; }
          }
          if (!target) return; /* 锁必须在确认目标之后才加，否则找不到的文本会被永久锁死 */
          zhBusy[text] = 1;
          target.zh = "翻译中…"; target.zhFail = false;
          if (!patchBubble(target)) App.refresh(); /* 占位：只换这一个气泡，不整页重绘 */
          startZh(target);
        }
        /* 2026-10-18（Phil：进客户页"页面不断往上拉+跳动闪烁，十几秒才稳定"）：
           翻译完成/失败只"外科手术"替换对应那一个气泡（重绘前旧逻辑每次都整页
           innerHTML 重建，外层 .screen 还被 smooth 滚回顶部——一次进页最多触发
           6 条补翻译 = 6 次全量重渲染，这就是抖动的全部来源） */
        function patchBubble(m) {
          var wa = root.querySelector("#waMsgs");
          if (!wa) return false;
          var idx = b.messages.indexOf(m);
          if (idx < 0) return false;
          var node = wa.children[idx];
          if (!node) return false;
          var div = document.createElement("div");
          div.innerHTML = bubble(m, idx);
          try { wa.replaceChild(div.firstChild, node); } catch (e) { return false; }
          return true;
        }
         function startZh(m) {
           /* 2026-10-19（Phil「翻译老失败」）：网络瞬断类失败（Load failed 等）先自动重试 1 次再报错——
              翻译是幂等调用，重试无副作用；系统性失败仍走红字+toast */
           function attempt(retries) {
             return LLM.translate(m.text, b).catch(function (e) {
               if (retries > 0) return new Promise(function (res) { setTimeout(function () { res(attempt(retries - 1)); }, 800); });
               throw e;
             });
           }
           attempt(1).then(function (zh) {
            zh = String(zh || "").trim();
            if (!zh) throw new Error("返回空译文");
            m.zh = zh; m.zhFail = false;
            if (window.Store) Store.commit();
            if (!patchBubble(m)) App.refresh();
          }).catch(function (e) {
            m.zh = ""; m.zhFail = true;
            App.toast("自动翻译失败：" + String((e && e.message) || e).slice(0, 40), 3500);
            if (!patchBubble(m)) App.refresh();
          }).then(function () { zhBusy[m.text] = 0; });
        }

       /* P2：意向信号——客户回复后 AI 静默默估升降并留一句依据（列表点徽章查看）
          v1.2.12「读」：同步存态势研判到 b.lastRead，生成链路（代写/扩充/直译）自动吃到 */
       function judgeIntent(t) {
         if (!window.LLM || !LLM.configured() || !window.Store) return;
         LLM.readMsg(t, b).then(function (o) {
           if (!o) return;
           if (o.delta) {
             AIevt(b, "intent", { delta: o.delta, reason: o.reason || "" });
             Store.bumpIntent(b.id, o.delta, o.reason || "客户消息信号");
           }
           if (o.posture) {
             b.lastRead = { posture: o.posture, concern: o.concern || "", warm: o.warm || "", evidence: o.evidence || "", at: new Date().toISOString() };
             Store.commit();
           }
           /* 2026-10-22 阶段严格判定：速记路径（记客户/记我发）同样吃 AI 阶段层——
              机械硬信号已在 addMessage 应用，这里与机械取高、单调推进；5 只挂成交信号卡 */
           if (o.stage !== null && o.stage > b.stage && !b.outcome) {
             if (o.stage >= 5) {
               if (!b.closeSignal) { b.closeSignal = { at: new Date().toISOString(), why: o.stageWhy || "AI 判成交信号", evidence: String(t || "").slice(0, 80), src: "ai" }; Store.commit(); }
             } else if (U.applyStage(b, o.stage, o.stageWhy || "AI 阶段研判", "ai", t)) {
               Store.commit();
             }
           }
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
         /* 2026-10-18（阶段一 · 反应采集）：我方消息确认「已发」后计时，客户下一条记录到达时记下响应时长（ms）。
            纯后台数据，界面无任何显示、不影响现有流程——L5 小样本学习与信任账本的原料。
            基线口径：最近 N 条已盖 sentAt 的我方消息中，有 reactionMs 的比例=回应率，其均值=平均响应时长 */
          function recordReaction() {
            var ms = b.messages;
            for (var i = ms.length - 2; i >= 0; i--) { /* 从倒数第二条起扫：末尾正是刚记的客户消息 */
              var m = ms[i];
              if (m.from === "buyer") return false; /* 先碰到更早的客户消息 = 该待发项在采集期内无回应，保持原样计入未回 */
              if (m.from === "me" && m.sentAt && !m.reactedAt) {
                m.reactedAt = new Date().toISOString();
                m.reactionMs = Date.now() - new Date(m.sentAt).getTime();
                AIevt(b, "buyer_reaction", { ms: m.reactionMs });
                return true; /* 2026-10-23：只有真的改动了数据才需要调用方补一次落盘 */
              }
            }
            return false;
          }
          function doLogBuyer() {
            var t = logIn && logIn.value.trim();
            if (!t && !logImgs.length) { App.toast("先写客户说的内容，或点 📷 附图"); return; }
            AIevt(b, "reply", { via: "quicklog", text: t });
            /* 2026-10-23：统一走 Store.addMessage——机械阶段扫描对"记客户"同样生效
               （此前直接 push 进消息数组，绕过了扫描：客户说"已付定金"阶段也不动） */
            Store.addMessage(b.id, t, null, { from: "buyer", imgs: logImgs.length ? logImgs.slice() : null });
            if (recordReaction()) Store.commit(); /* 只有反应计时真改动了旧消息才补落盘，避免重复云推送 */
            logImgs = []; logPrevRender();
            App.refresh();
            if (t) { autoZh(t); judgeIntent(t); }
          }
         /* 2026-10-14 现场反馈：业务员在 WhatsApp 自己报了价，但记录里只有客户那句"多少钱"，
            看板就一直显示"他在等你的回复/待报价"。记我发 = 手动补记我方消息，最新一条变我方 → 状态立即翻成"你已回"
            2026-10-23：报价状态改按证据判（已报价/未报价）；记我发同步过阶段扫描——记"已报价 EXW 222"阶段立即进报价档 */
         function doLogMe() {
             var t = logIn && logIn.value.trim();
             if (!t && !logImgs.length) { App.toast("先写你发的内容，或点 📷 附图"); return; }
             AIevt(b, "reply", { via: "quicklog-me", text: t });
             /* 2026-10-18（阶段一）：手动补记=已发出，直接盖发送时间戳。
                2026-10-23：统一走 Store.addMessage（from="me"）——"记我发"从此也触发阶段扫描：
                记「已报价 EXW 222」阶段立即进报价档并留痕（此前绕路直推数组，阶段纹丝不动） */
             Store.addMessage(b.id, t, null, { from: "me", sentAt: new Date().toISOString(), imgs: logImgs.length ? logImgs.slice() : null });
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
            「翻译中…」视为缺失（防极端时序下占位被存进云端后卡死）；zhFail 不自动重翻（持续失败会刷屏），靠气泡里点按重试
            2026-10-18（Phil：进客户页抖动闪烁）：占位一次性批量写入（逐气泡替换、零整页重渲染），
            再并行发起翻译——旧逻辑每条触发一次整页重渲染，进页最多连环重绘 6 次 */
         if (window.LLM && LLM.configured()) {
           /* 2026-10-19：与 autoZh 同口径——只跳过"纯中文"，中英混合也补翻（SYS 已处理"保留中文、只译外文"） */
          var missZh = b.messages.filter(function (m) { return (!m.zh || m.zh === "翻译中…") && !m.zhFail && m.text && !(/[一-龥]/.test(m.text) && (m.text.match(/[A-Za-z]/g) || []).length < 10); }).slice(-6);
           var toStart = [];
           missZh.forEach(function (m) {
             if (zhBusy[m.text]) return;
             zhBusy[m.text] = 1;
             m.zh = "翻译中…"; m.zhFail = false;
             toStart.push(m);
           });
           toStart.forEach(function (m) { patchBubble(m); });
           toStart.forEach(startZh);
         }

       /* 交接确认：✓ 已发 / ✕ 没发 / 任意我方记录可删
          2026-10-18：改事件委托——补翻译现在是气泡级替换 DOM，逐元素绑定会随旧节点丢失 */
       var waMsgsEl = root.querySelector("#waMsgs");
       if (waMsgsEl) waMsgsEl.addEventListener("click", function (e) {
         var el = e.target && e.target.closest ? e.target.closest('[data-act="h-y"],[data-act="h-n"],[data-act="m-del"]') : null;
         if (!el) return;
         var idx = +el.getAttribute("data-idx");
          if (el.getAttribute("data-act") === "h-y") {
            if (b.messages[idx]) { b.messages[idx].status = "sent"; b.messages[idx].sentAt = new Date().toISOString(); /* 2026-10-18（阶段一）：确认已发=反应计时起点 */ AIevt(b, "confirmed", { text: b.messages[idx].text, stage: b.stage }); }
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

      function scrollDown() {
        var wa = root.querySelector(".wa-msgs");
        wa.scrollTop = wa.scrollHeight;
        var chat = root.querySelector(".wa-chat");
        if (chat && chat.scrollIntoView) chat.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

       /* 2026-10-18（Phil「我什么都没动，页面自己跳上跳下，很不稳定」）：
          根因 = 任何后台事件（翻译完成/意向完成/同步）都整页重渲染，旧逻辑每次都无条件跳日志底部
          → 用户正在读历史消息时，画面被反复拽到底部。新规则（模块级 _chatPos 跨重渲染共享）：
          · 切到别的买家 / 首次打开页面 → 跳最新消息，并把对话区带入视野
          · 同一买家的后台重渲染 → 恢复重渲染前的滚动位置；只有本来就在底部才吸底 */
       var waTrack = root.querySelector(".wa-msgs");
       if (waTrack) waTrack.addEventListener("scroll", function () {
         _chatPos.top = waTrack.scrollTop;
         _chatPos.atBottom = waTrack.scrollTop + waTrack.clientHeight >= waTrack.scrollHeight - 60;
       }, { passive: true });
        var buyerChanged = (_chatPos.id !== b.id);
        if (buyerChanged) { _chatPos.top = 0; _chatPos.atBottom = true; }
        _chatPos.id = b.id;
        /* 2026-10-18（Phil：进客户页"往上拉+跳动闪烁"）：以 nav() 的 sameScreen 为准——
           进入页面（列表→详情、客户→客户）→ 定位对话区并跳最新消息；
           同页刷新（翻译完成等）→ 位置原样保持，绝不拽动外层滚动 */
        var firstView = !!(window.DDNav && !window.DDNav.same);
        function placeChat() {
          if (myGen !== _bdGen) return; /* 本代渲染已被更新：遗留的 rAF 不得再滚动（旧渲染的回调会把新画面拽乱） */
          var wa = root.querySelector(".wa-msgs");
          if (!wa) return;
          if (firstView || _chatPos.atBottom) wa.scrollTop = wa.scrollHeight;
          else wa.scrollTop = Math.min(_chatPos.top, Math.max(0, wa.scrollHeight - wa.clientHeight));
          if (firstView) {
            var chat = root.querySelector(".wa-chat");
            if (chat && chat.scrollIntoView) chat.scrollIntoView({ behavior: "auto", block: "nearest" });
          }
        }
        requestAnimationFrame(function () { requestAnimationFrame(placeChat); });
       /* 记录里的图片加载完后容器高度变化 → 按同一规则重新定位（不再强制跳底） */
       Array.prototype.forEach.call(root.querySelectorAll(".wa-msgs img"), function (im) {
         if (!im.complete) {
           im.addEventListener("load", placeChat, { once: true });
           im.addEventListener("error", placeChat, { once: true });
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
        /* 2026-10-23：统一走 Store.addMessage（noSave：调用方的 commit 一次性落盘）——
           发 WhatsApp / 编号选项路径的阶段扫描不再被绕过 */
        if (window.Store && Store.addMessage) {
          Store.addMessage(b.id, msg.text, msg.zh, { from: msg.from, time: msg.time, status: msg.status, sentAt: msg.sentAt, imgs: msg.imgs, noSave: true });
        } else {
          b.messages.push(msg);
        }
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
        /* 2026-10-22（Phil「客户进不去了」）：push 已 commit；当前窗口导航（Chrome 下 window.open 是后台新标签像死按钮） */
        location.href = su;
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
           if (!box || b.outcome) return;
            var line = b.scope || "all";
             /* 2026-10-21（Phil「要很久才出来 / 退出再进又消失」）：先把本地缓存【同步】画出来，再后台静默刷新——
                永不空窗、永不闪没；连缓存都没有时先渲染"加载中"骨架，也绝不留白 */
             function sigOf(docs) { return (docs || []).map(function (d) { return String(d.key || d.name || "") + ":" + ((d.steps || []).length); }).join("|"); }
             var cachedNow = readCache();
             var cacheSig = cachedNow ? sigOf(cachedNow.docs) : "";
             var shown = false;
             if (cachedNow) { try { onShared({ docs: cachedNow.docs }); shown = true; } catch (e) {} }
             if (!shown) { box.innerHTML = '<div class="card ctx-card" style="margin:12px 16px 0"><div class="ctx-head"><span class="ctx-title">📜 新客话术</span><span class="ctx-hint">加载中…</span></div></div>'; }
             /* 2026-10-18（A7）：60s 缓存——同页刷新（记一笔/确认已发等）不重复请求云端 */
             if (scriptCache.j && scriptCache.key === line && Date.now() - scriptCache.ts < 60000) {
               if (!shown) { try { onShared(scriptCache.j); shown = true; } catch (e) {} }
               return;
             }
            /* 2026-10-21（Phil「新客话术有时有有时没有」）：四条兜底保证"一定有"——
               ① 本地持久缓存（拉过一次就能离线显示）② 拉取失败自动读缓存
               ③ 该产品线没有专属剧本时回退显示全部剧本（带提示）
               ④ 连缓存都没有 → 显示占位卡 + 重试按钮，绝不再静默消失 */
            function readCache() { try { var raw = localStorage.getItem("dd_scripts_cache_v1"); if (!raw) return null; var o = JSON.parse(raw); return (o && o.docs && o.docs.length) ? o : null; } catch (e) { return null; } }
            function writeCache(j) { try { localStorage.setItem("dd_scripts_cache_v1", JSON.stringify({ ts: Date.now(), docs: (j && j.docs) || [] })); } catch (e) {} }
            function renderEmpty() {
              box.innerHTML = '<div class="card ctx-card" style="margin:12px 16px 0">' +
                '<div class="ctx-head"><span class="ctx-title">📜 新客话术</span><span class="ctx-hint">没加载到</span></div>' +
                '<div class="sp-hint">⚠ 没拉到团队剧本（网络或登录状态问题）——点下面重试。若一直加载不到，请管理员到「设置 → 团队资料」确认剧本还在。</div>' +
                '<button type="button" class="sp-sendone" data-act="sp-retry">↻ 重新加载话术</button></div>';
              var rt = box.querySelector('[data-act="sp-retry"]');
              if (rt) rt.addEventListener("click", function () { scriptCache = { key: "", ts: 0, j: null }; load(); });
            }
            function useCacheOrEmpty() {
              var c = readCache();
              if (c) { onShared({ docs: c.docs }); return; }
              renderEmpty();
            }
            function load() {
              if (!window.Sync || !Sync.enabled() || !Sync.sharedMeta) { if (!shown) useCacheOrEmpty(); return; }
              Sync.sharedMeta().then(function (j) {
                if (j && j.docs && j.docs.length) {
                  writeCache(j);
                  scriptCache = { key: line, ts: Date.now(), j: j };
                  /* 内容与已显示的一致就不重画——避免"闪一下"的观感 */
                  if (!shown || sigOf(j.docs) !== cacheSig) { onShared(j); shown = true; }
                } else if (!shown) useCacheOrEmpty();
              }).catch(function () { if (!shown) useCacheOrEmpty(); });
            }
          function onShared(j) {
            if (!j) return;
           /* 产品线=通用（或未设）→ 看全部剧本；指定产品线 → 该产品线 + 通用 */
            var allScripts = ((j && j.docs) || []).filter(function (d) {
              return d.type === "script" && d.steps && d.steps.length;
            });
            var scripts = allScripts.filter(function (d) {
              return line === "all" || d.scope === "all" || d.scope === line;
            });
            /* 2026-10-21（Phil）：该产品线一套剧本都没有（如宠物客户 vs 行李箱专属剧本）→ 回退显示全部剧本，
               卡片里加一行说明，保证新客一定有话术可用 */
            var scopeFallback = false;
            if (!scripts.length && allScripts.length) { scripts = allScripts.slice(); scopeFallback = true; }
            if (!scripts.length) { renderEmpty(); return; }
           var st0 = (window.Store && Store.getSettings) ? (Store.getSettings() || {}) : {};
           var au0 = window.Auth && Auth.get();
           var myName = st0.name || (au0 && au0.name) || "";
           var cf = String(b.name || "").trim().split(/\s+/)[0] || "";
               /* 2026-10-17 话术换版（五步→六步，插入「三 未报价收尾」）：旧 key 进度带进新 key，
                  cap=2 —— 插入点在第 3 步，旧的第 3 步起都是没发过的新内容，✓ 只保留到新第 2 步。
                  当天二次修正换版（标题改回 Phil 指定「未报价收尾」、正文恢复原文弯引号）→ key 98ba0e2f 也视为旧 key，
                  多个旧 key 取 max（不 break），业务员在新版再发任一步后新 key 进度接管。
                  2026-10-28 修复：此表一直停在 10/17 旧映射（目标 31eedc36 已失效）——10/19–10/21 剧本换版
                  （16722a14/f0daad5c → 5c1906c4 → 80d486f0 → ca06b323）迁移全部落空，客户播放器「x/6」被重置为 0。
                  现与 llm.js SCRIPT_KEY_MIGRATION 对齐：9 个历史 key → a2ae39b8（10/29 MOQ 细化换版；此前 10/28 变色款 200 台 → 75ecc8d1）；
                  f47eb318/98ba0e2f cap=2（插入位移），其余 cap=3（第四步文案变，已发一/二/三 步仍算数） */
               var PROG_MIGRATION = { "f47eb318-mvazd29i": { to: "a2ae39b8-mvtdwpnl", cap: 2 }, "98ba0e2f-mvc6rf66": { to: "a2ae39b8-mvtdwpnl", cap: 2 }, "31eedc36-mvc6xdi7": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "369246e3-mvg5888z": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "16722a14-mvga8l75": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "f0daad5c-mvgbye8l": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "ca06b323-mvj32bx1": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "e5645418-mvszfxn9": { to: "a2ae39b8-mvtdwpnl", cap: 3 }, "75ecc8d1-mvszghst": { to: "a2ae39b8-mvtdwpnl", cap: 3 } };
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
              /* 2026-10-20（v1.2.7，Phil）：只有一套话术时名称原来不显示（只在多套并存时分行标注）
                 → 单一话术的完整名称直接进卡头，随时可见是哪套剧本 */
              var singleName = (scripts.length === 1 && scripts[0].name) ? scripts[0].name : "新客话术";
              var html = '<div class="card ctx-card" style="margin:12px 16px 0">' +
                '<div class="ctx-head"><span class="ctx-title">📜 ' + escHtml(singleName) + '（' + sent + "/" + total + '）</span>' +
                '<span class="ctx-hint">' + (scripts.length > 1 ? scripts.length + " 套 · " : "") + "点选一段 → 下方发送</span></div>" +
                 (isNew ? '<div class="sp-hint">💡 新客户首谈：按编号顺序一段段发（客户回一段你再发下一段）。署名自动换成你的名字；客户以后问参数，选中对应那步再发即可。</div>' : "") +
                 (scopeFallback ? '<div class="sp-hint">ℹ 该产品线暂无专属剧本，下面是现有剧本，可直接使用（需要专属版本请管理员上传并把产品线设为该线或「通用」）。</div>' : "") +
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
                  /* 2026-10-23：统一走 Store.addMessage（noSave，下方 commit 一次性落盘）——
                     话术步进文本也过阶段扫描（话术里含"已报价 EXW…"即进报价档） */
                  Store.addMessage(b.id, text, null, { from: "me", status: "handed", noSave: true });
                  AIevt(b, "script", { doc: d.key, step: i, title: st.title || "" });
                  b.scriptProg = b.scriptProg || {};
                  b.scriptProg[d.key] = Math.max(Number(b.scriptProg[d.key] || 0), i + 1);
                  if (window.Store) Store.commit();
                  /* 2026-10-22（Phil「客户进不去了」）：commit 已先行；当前窗口导航（Chrome 下 window.open 是后台新标签像死按钮） */
                  location.href = su;
                  App.toast("已打开第 " + (i + 1) + " 步 · 还没发送！发完回来点「✓ 已发」");
                  App.refresh();
                });
            }
            renderCard();
          }
            load();
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
          function onManifest(man) {
            var data = man && man.suitcase;
            if (!data || !data.groups || !data.groups.length) { box.innerHTML = ""; return; }
            var flat = [];
             data.groups.forEach(function (g) {
               (g.photos || []).forEach(function (p) {
                 /* 2026-10-21（Phil「照片要很久才出来」）：网格用小缩略图（360px/约13KB），发送仍取原图 */
                 flat.push({
                   label: p.label,
                   file: (data.base || "photos/") + p.file,
                   thumb: (data.base || "photos/") + (p.thumb || ("thumbs/" + p.file)),
                   g: g.title
                 });
               });
             });
            if (!flat.length) { box.innerHTML = ""; return; }
            /* 2026-10-18 v2（Phil）：多选 + 右上角「全选」+ 醒目圈框——
               sel 为索引集合，点照片切换选中，全选框一次框定全部，可一次发给本客户 */
            var sel = photoSel[b.id] || (photoSel[b.id] = {}); /* 2026-10-18（A7）：选中状态跨同页刷新保留 */
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
              html += '<div class="ph-grid">';
              /* 2026-10-18（A3）：恢复每组小标题（多选改版拍平后两组混在一起分不清）；标题占满整行 */
              var lastG = null;
              flat.forEach(function (it, n) {
                if (data.groups.length > 1 && it.g !== lastG) { html += '<div class="ph-gtitle ph-gtitle-row">' + escHtml(it.g) + '</div>'; lastG = it.g; }
                html += '<button type="button" class="ph-chip' + (sel[n] ? " sel" : "") + '" data-n="' + n + '">' +
                   '<img src="' + it.thumb + '?v=4" loading="lazy" decoding="async" alt=""/>' +
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
                photoSel[b.id] = {}; sel = photoSel[b.id];
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
                      /* 2026-10-18（A4）：原生分享是"已分享"，不是"预填 WhatsApp"——不带待确认按钮 */
                      Store.addMessage(b.id, "📷 已分享照片×" + items.length, null, { from: "me", status: "sent", noSave: true }); /* 2026-10-23：统一走扫描入口 */
                      AIevt(b, "photo", { n: items.length, via: "native-share" });
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
          }
           /* 2026-10-21（Phil「照片也要很久才出来」）：先本地缓存同步出卡（零等待），再后台刷新；
              连缓存都没有时先出「加载中」骨架，绝不留白；失败自动读缓存 */
           function readPCache() { try { var raw = localStorage.getItem("dd_photos_cache_v1"); if (!raw) return null; var o = JSON.parse(raw); return (o && o.data) ? o : null; } catch (e) { return null; } }
           function writePCache(man) { try { localStorage.setItem("dd_photos_cache_v1", JSON.stringify({ ts: Date.now(), data: man })); } catch (e) {} }
           var pc = readPCache();
           var shownPhoto = false;
           if (pc) { try { onManifest(pc.data); shownPhoto = true; } catch (e) {} }
           if (!shownPhoto) { box.innerHTML = '<div class="card ctx-card" style="margin:12px 16px 0"><div class="ctx-head"><span class="ctx-title">📷 产品照片</span><span class="ctx-hint">加载中…</span></div></div>'; }
           /* 2026-10-18（A7）：60s 缓存——同页刷新不重复请求 photos.json */
           if (photoCache.data && Date.now() - photoCache.ts < 60000) { if (!shownPhoto) onManifest(photoCache.data); return; }
           fetch("photos.json?v=4").then(function (r) { return r.json(); }).then(function (man) {
             photoCache = { ts: Date.now(), data: man };
             writePCache(man);
             onManifest(man);
           }).catch(function () {
             if (shownPhoto) return;
             var pc2 = readPCache();
             if (pc2) { try { onManifest(pc2.data); return; } catch (e) {} }
             box.innerHTML = '<div class="card ctx-card" style="margin:12px 16px 0"><div class="ctx-head"><span class="ctx-title">📷 产品照片</span><span class="ctx-hint">没加载到 · 下拉刷新试试</span></div></div>';
           });
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
              : (pending.brain ? '<div class="pending-brain" style="font-size:12px;color:#8a7f6d;padding:2px 0 6px;line-height:1.5">🧠 ' + escHtml(pending.brain) + "</div>" : "") +
                '<div class="pending-text">' + escHtml(pending.en) + "</div>" +
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
            pending.brain = isExp ? String(o.brain || "").trim() : "";
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
          if (res.diagnosis && (res.diagnosis.nextGoal || res.diagnosis.blocker || res.diagnosis.move)) {
            b.aiDiag = { at: new Date().toISOString(), nextGoal: res.diagnosis.nextGoal || "", blocker: res.diagnosis.blocker || "", move: res.diagnosis.move || "" };
          }
          AIevt(b, "gen", { stage: Mock.STAGES[b.stage], goal: b.aiDiag ? b.aiDiag.nextGoal : "", texts: items.map(function (s) { return s.text; }) });
           if (window.Store) Store.commit();
            /* v1.2.12「定」可视化：一行大脑解读（姿态→出招→下一步），收起式，点开展开依据 */
            var bb = [];
            if (b.lastRead && b.lastRead.posture) bb.push("他的姿态：" + b.lastRead.posture + (b.lastRead.concern ? " · 在意：" + b.lastRead.concern : ""));
            if (res.diagnosis && res.diagnosis.move) bb.push("这轮出招：" + res.diagnosis.move);
            if (res.diagnosis && res.diagnosis.nextGoal) bb.push("下一步：" + res.diagnosis.nextGoal + (res.diagnosis.blocker && res.diagnosis.blocker !== "无" ? " · 卡点：" + res.diagnosis.blocker : ""));
            var brainHtml = bb.length
              ? '<details style="margin:0 0 8px"><summary style="font-size:12px;color:#8a7f6d;cursor:pointer">🧠 ' + escHtml(bb[0] || "大脑解读") + '</summary><div style="font-size:12px;color:#6b6257;padding:4px 0 2px 14px">' + escHtml(bb.slice(1).join(" ｜ ")) + (b.lastRead && b.lastRead.evidence ? "<br>依据：「" + escHtml(b.lastRead.evidence) + "」" : "") + "</div></details>"
              : "";
            wrap.innerHTML = brainHtml + items.map(function (s) { return suggCard(s, b); }).join("");
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

         /* 2026-10-18（A1）：🎤 按住说话统一用修好的 Voice 组件——保温流（每次进页最多弹 1 次 Allow）、
            "按住说话 · 语音转文字"文案、松手后"已停录音"、被禁常驻指引面板、授权弹窗打断诊断。
            本页原有一套独立旧实现（每次按压现取麦克风、"松手结束/识别中…"看着像录音键），已整体移除 */
         var micBtn = root.querySelector("#micBtn");
         if (micBtn && input && window.Voice) {
           Voice.attach(micBtn, input);
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
             /* 2026-10-22：原来的盲目 stage++（答什么都升一档）→ 有硬信号证据才推进 */
             var prevStage = b.stage;
             var sig2 = (window.U && U.stageScan) ? U.stageScan(b, opt.reply) : null;
             if (sig2 && sig2.to <= 4) U.applyStage(b, sig2.to, sig2.why, "rule", opt.reply);
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
