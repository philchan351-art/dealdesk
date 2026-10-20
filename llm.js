/* ===== LLM 客户端：OpenAI 兼容接口（百炼工作区） =====
 * W2 直连模式：Key 存于本机 localStorage（设置页配置），不进代码库。
 * W3 团队规模化后可切 FC 代理模式（接口不变，换 endpoint）。
 */
(function () {
  "use strict";

  var MODELS = ["qwen-flash", "qwen-plus", "qwen3.8-flash", "qwen3.8-max-0902"]; /* 2026-10-18（Phil）：便宜快模型排默认位 */

  function cfg() {
    var s = Store.getSettings() || {};
    var c = s.llm || {};
    var cl = s.cloud || {};
    if (!c.proxyUrl && cl.proxyUrl) { c.proxyUrl = cl.proxyUrl; c.token = cl.token; }
    return c;
  }

  /* 参数红线（2026-10-14 真实反馈修复）：业务员实测 AI 会编造产品参数
     （客户问产品要素，AI 自己编出"20-30km 续航/USB/TSA 锁"，而公司实际做的是通品）。
     规则随每次生成注入系统提示，优先级高于所有其他要求。 */
  function factRule(hasDocs) {
    var s = "\n【参数红线（最高优先级，压过其他所有要求）】";
    s += "\n1. 产品参数（续航/电池/充电/认证/重量/容量/MOQ/价格/产能/交货期等）只能引用【资料】或客户档案/长期记忆里明确写过的内容。";
    s += "\n2. 资料与档案里没写明的参数：禁止写任何具体数值，禁止编造认证、奖项、合作客户、成立年份。只允许三种处理：①不提该参数；②反问客户他需要什么规格/数量；③说\"具体参数需与研发/QC 确认后发你\"。";
    if (!hasDocs) s += "\n3. 当前账号还没有上传任何训练资料：涉及具体产品参数时，一律用\"省略/反问/确认后回复\"，绝不允许用行业常见值填充。宁可回复短一点，也不准编。";
    return s;
  }

  /* 团队公共资料注入（2026-10-15 P0 起由 FC 服务端完成）：
     资料正文对业务员保密（/shared 只回元数据），AI 生成时由 /llm 服务端直接注入
     最新 3 份团队资料（各 6000 字）+ 最新 3 份本人训练资料（各 3000 字）。
     前端不再拉取正文，因此这里不再有 _sharedCache/getSharedDocs。 */

  /* 团队话术剧本（2026-10-15）：业务员在客户页一步步发给客户的固定剧本。
     注入 AI 上下文的目的：AI 报价/介绍时与剧本口径一致，并知道哪些步已经发过（不重复整段发）。
     按客户产品线过滤（suitcase/pet/all），5 分钟缓存与公共资料同策略。 */
  var _scriptCache = { at: 0, docs: [] };
  function getSharedScripts() {
    var now = Date.now();
    if (now - _scriptCache.at < 5 * 60 * 1000) return Promise.resolve(_scriptCache.docs);
    if (!window.Sync || !Sync.enabled()) return Promise.resolve(_scriptCache.docs);
    return Sync.sharedAll().then(function (j) {
      _scriptCache = { at: Date.now(), docs: ((j && j.docs) || []).filter(function (d) { return d.type === "script"; }) };
      return _scriptCache.docs;
    }).catch(function () { return _scriptCache.docs; });
  }
  /* 2026-10-17 话术换版（五步→六步，插入「三 未报价收尾」）：docKey 变了，把旧 key 进度带到新 key。
     插入点在第 3 步，旧进度第 3 步起与新内容不对应 → cap=2（只认「一 开场/二 产品卖点」已发）。
     当天二次修正换版（标题改回「未报价收尾」、正文恢复原文弯引号）→ key 98ba0e2f 也视为旧 key，多个旧 key 取 max。
     业务员在新版再发任一步后，新 key 进度接管，旧 key 数据自然失效。
      2026-10-20 第四步文案更新（价格/颜色 MOQ 调整）+ 乱码修复换版 → 16722a14。
      10-20 夜间乱码排查核实：云端现行 key 为 f0daad5c（内容与 16722a14 完全一致，均为新第四步干净文本）
      → 全部旧 key 改指向 f0daad5c：f47eb318/98ba0e2f cap=2（插入位移）；31eedc36 cap=3（第四步文案分歧）；
      369246e3/16722a14 cap=6（内容一致）。 */
  var SCRIPT_KEY_MIGRATION = { "f47eb318-mvazd29i": { to: "f0daad5c-mvgbye8l", cap: 2 }, "98ba0e2f-mvc6rf66": { to: "f0daad5c-mvgbye8l", cap: 2 }, "31eedc36-mvc6xdi7": { to: "f0daad5c-mvgbye8l", cap: 3 }, "369246e3-mvg5888z": { to: "f0daad5c-mvgbye8l", cap: 6 }, "16722a14-mvga8l75": { to: "f0daad5c-mvgbye8l", cap: 6 } };
  function scriptProgOf(buyer, d) {
    var prog = buyer.scriptProg || {};
    var p = Number(prog[d.key] || 0);
    if (!p) {
      for (var ok in SCRIPT_KEY_MIGRATION) {
        if (SCRIPT_KEY_MIGRATION[ok].to === d.key) p = Math.max(p, Math.min(Number(prog[ok] || 0), SCRIPT_KEY_MIGRATION[ok].cap));
      }
    }
    return Math.min(p, d.steps.length);
  }
  function scriptLine(buyer) {
    return getSharedScripts().then(function (docs) {
      var line = ["suitcase", "pet", "all"].indexOf(buyer.scope) >= 0 ? buyer.scope : "all";
      /* 通用客户（或未设产品线）→ 全部剧本；指定产品线 → 该产品线 + 通用 */
      var hits = docs.filter(function (d) { return line === "all" || d.scope === "all" || d.scope === line; });
      if (!hits.length) return "";
      var parts = [];
      for (var i = 0; i < hits.length; i++) {
        var d = hits[i];
        if (!d.steps || !d.steps.length) continue;
        var sent = scriptProgOf(buyer, d);
        var s = "\n【团队话术剧本·" + (d.name || "剧本") + "（已发 " + sent + "/" + d.steps.length + " 步）】\n";
        for (var k = 0; k < d.steps.length; k++) {
          s += (k + 1) + ". " + (d.steps[k].title || "") + (k < sent ? "（已发）" : "") + "：\n" + String(d.steps[k].text || "") + "\n";
        }
        parts.push(s);
      }
      if (!parts.length) return "";
      var s2 = parts.join("");
      if (s2.length > 6000) s2 = s2.slice(0, 6000) + "\n（剧本过长已截断，以档案与资料为准）";
      return s2 + "\n与客户沟通时，产品参数/价格/MOQ 必须与上述团队话术剧本保持一致，不得另报；已标记（已发）的步骤不要整段重发，只针对客户当前的问题回答。\n";
    });
  }

  /* 训练资料注入（2026-10-15 P0 改版）：
     · 云代理模式：资料全部由 FC 服务端注入（/llm 内 buildDocsBlock），前端不拉正文、不拼提示词
     · 本地直连模式（个人 Key）：只能附"本人"训练资料（自己的数据，无保密问题）；
       团队资料不在此模式可用（正文保密规则） */
  function withDocs(system) {
    var c = cfg();
    if (c && c.proxyUrl) return Promise.resolve(system);
    var p = Store.getPersona ? Store.getPersona() : null;
    var docs = (p && p.docs) || [];
    docs = docs.slice().sort(function (a, b) { return String(b.updated || "") > String(a.updated || "") ? 1 : -1; }).slice(0, 3);
    var hasPersonal = docs.length && window.Sync && Sync.enabled();
    if (!hasPersonal) return Promise.resolve(system);
    return Promise.all(docs.map(function (d) {
      return (d && d.content != null ? Promise.resolve(d.content) : Sync.docFetch(d.key))
        .then(function (v) { return String((v && v.content) || "").slice(0, 3000); })
        .catch(function () { return ""; });
    })).then(function (personal) {
      var out = "";
      for (var j2 = 0; j2 < docs.length; j2++) {
        if (personal[j2]) out += "\n【资料·" + (docs[j2].name || "文件") + "】\n" + personal[j2];
      }
      return system + out + factRule(out.length > 0);
    });
  }

  /* 完整系统提示 = 档案上下文 + 资料 + 参数红线 + 团队话术剧本 */
  function fullSystem(buyer) {
    return withDocs(ctx(buyer)).then(function (sys) {
      return scriptLine(buyer).then(function (sl) { return sys + sl; });
    });
  }

  function chat(system, user, opt) {
    opt = opt || {};
    var c = cfg();
    if (!c || !(c.key || c.proxyUrl)) return Promise.reject(new Error("LLM 未配置（设置里填 Key 或云代理地址）"));
    /* 2026-10-18（Phil 成本指令："目前暂时不要用贵的"）：全部 AI 调用走便宜快模型 qwen-flash，
       期间忽略设置里选中的模型（防手机已存过 qwen-plus 继续走贵的）。
       恢复贵模型时改回：opt.model || c.model || "qwen-plus" */
    var model0 = opt.model || "qwen-flash";
    function one(model) {
    var payload = {
      model: model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: opt.temp != null ? opt.temp : 0.4,
      max_tokens: opt.max_tokens || 600
    };
    if (c.proxyUrl) {
      var proxy = c.proxyUrl.replace(/\/+$/, "") + "/llm";
      var pheaders = { "Content-Type": "application/json" };
      var _ddau = window.Auth && Auth.get();
      if (_ddau && _ddau.session) pheaders["x-dealdesk-session"] = _ddau.session;
       /* 2026-10-16：把当前客户的产品线传给服务端，团队资料按线注入（行李箱客户不吃宠物资料） */
       if (opt.scope) pheaders["x-dealdesk-scope"] = opt.scope;
       /* 2026-10-18（Phil）：翻译等轻量调用跳过服务端资料注入（prompt 数万字符→百余字符，目标 2 秒内出译文）；
          旧版 FC 不识别该头会忽略，无副作用 */
       if (opt.nodocs) pheaders["x-dealdesk-nodocs"] = "1";
      var useStream = !!opt.onChunk;
      if (useStream) payload.stream = true;
      function streamParse(resp) {
        /* 读 DashScope SSE：每包 data: {"choices":[{"delta":{"content":"..."}}]}；累计全文并逐包上报 onChunk */
        var reader = resp.body.getReader();
        var dec = new TextDecoder("utf-8");
        var buf = "", full = "";
        function pump() {
          return reader.read().then(function (p) {
            if (p.done) return full;
            buf += dec.decode(p.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop() || "";
            for (var i = 0; i < lines.length; i++) {
              var ln = lines[i].replace(/^\s+/, "");
              if (ln.indexOf("data:") !== 0) continue;
              var data = ln.slice(5).replace(/^\s+/, "");
              if (data === "[DONE]") continue;
              try {
                var sj = JSON.parse(data);
                var d = sj.choices && sj.choices[0] && sj.choices[0].delta && sj.choices[0].delta.content;
                if (d) { full += d; opt.onChunk(full, d); }
              } catch (e) { /* 半包，等下一段拼齐 */ }
            }
            return pump();
          });
        }
        return pump();
      }
      return fetch(proxy, { method: "POST", headers: pheaders, body: JSON.stringify(payload) })
        .then(function (r) {
          var ct = String(r.headers.get("content-type") || "");
          if (useStream && r.ok && ct.indexOf("text/event-stream") >= 0) return streamParse(r);
          /* 非流式，或服务端未走流式（降级）：整包 JSON */
          return r.text().then(function (t) {
            if (!r.ok) throw new Error("API " + r.status + "：" + t.slice(0, 160));
            var j = JSON.parse(t);
            if (j.error) throw new Error(j.error);
            var content = j.content || "";
            if (useStream && content) opt.onChunk(content, content);
            return content;
          });
        });
    }
    return fetch(c.baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.key },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error("API " + r.status + "：" + t.slice(0, 160));
        var j = JSON.parse(t);
        return (j.choices && j.choices[0] && j.choices[0].message.content) || "";
      });
    });
    }
    /* 2026-10-18：快模型（qwen-flash）在当前端点不可用（404/未开通/403）时自动降级主模型，不阻塞业务员 */
    return one(model0).catch(function (e) {
      if (opt.fallbackModel && /404|403|not exist|denied|model/i.test(String((e && e.message) || e))) return one(opt.fallbackModel);
      throw e;
    });
  }

  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) {}
    var m = String(text).match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }

  /* 该业务员自己训练的个人风格：AI 生成回复/翻译时贴近她的思路和常用话术（按账号隔离，互不串味） */
  function personaLine() {
    var p = (window.Store && Store.getPersona) ? Store.getPersona() : null;
    if (!p || (!p.thoughts && !p.scripts)) return "";
    var s = "\n本账号业务员的个人风格（生成内容必须贴近这种思路与语气，不要套用别的风格）：";
    if (p.thoughts) s += "\n谈单思路：" + p.thoughts;
    if (p.scripts) s += "\n常用话术/语气示例：" + p.scripts;
    return s;
  }

  function ctx(buyer) {
    var last5 = (buyer.messages || []).slice(-5).map(function (m) {
      return (m.from === "me" ? "卖家" : "客户") + "：" + m.text;
    }).join("\n");
    /* 显式负信息：档案没记录认证时写出来，防模型"做欧洲市场→肯定有CE"式推理幻觉 */
    var hasCert = (buyer.context || []).some(function (c) {
      return /认证|证书|检测报告|test report|\bCE\b|RoHS|REACH|\bUL\b|FDA|UKCA/i.test(String(c.k) + String(c.v));
    });
    var certNeg = hasCert ? "" : "；认证/检测报告=档案未记录，即状态未知：声称\"有\"和断言\"肯定没有\"都禁止，唯一允许的说法是\"让 QC 核实状态后回你\"";
    return "客户：" + buyer.name + "（" + buyer.country + "，" + buyer.company + "）" +
      "｜谈单阶段：" + Mock.STAGES[buyer.stage] + "｜意向分：" + buyer.intent +
      "\n档案：" + (buyer.context || []).map(function (c) { return c.k + "=" + c.v; }).join("；") + certNeg +
      (buyer.profile ? "\n国家画像：" + buyer.profile.address + " / " + buyer.profile.style : "") +
       (buyer.memory ? "\n客户长期记忆（来自导入的过往聊天记录总结，重要背景，回答涉及这些话题时必须一致）：" + buyer.memory.slice(0, 800) : "") +
      "\n最近对话：\n" + last5 + personaLine();
  }

  window.LLM = {
    MODELS: MODELS,
    chat: chat, /* 2026-10-17 导出：供 FB 表单识别等轻量结构化任务复用 */
    configured: function () {
      var c = cfg();
      return !!(c && ((c.key && c.baseUrl) || c.proxyUrl));
    },
    test: function () {
      var c = cfg();
      if (!c || !(c.key || c.proxyUrl)) return Promise.reject(new Error("请先填写 API Key 或云代理地址"));
      return chat("你是测试助手。", "Reply with the single word OK.", { max_tokens: 8, model: c.model });
    },
      translate: function (text, buyer) {
       /* 2026-10-18（Phil）：「记一条」中文对照 ~1 秒内 —— 轻系统提示（纯翻译不需要档案/剧本上下文）
          + nodocs 跳过服务端资料注入 + qwen-flash（热态实测 0.75-0.77s）。
          Phil 成本指令：暂时不用贵模型 → 快模型不可用不再静默降级 qwen-plus，直接报错（autoZh 弹 toast，业务员看得见） */
       /* 2026-10-19：中英混合输入（客户信息表单/带中文标注）也要译——保留中文原样、只译外文部分 */
       return chat("你是外贸翻译。把客户消息译成自然的商务中文：数字、品牌名、型号、证书名、货币单位保留原文；过度客套可简化；若消息里已含中文，保留中文原样、只把外文部分译成中文；不要解释，只输出一个 JSON：{\"zh\":\"译文\"}", String(text || ""), { max_tokens: 2500, temp: 0.2, nodocs: true, model: "qwen-flash" })
        .then(function (t) {
          var o = parseJSON(t);
          if (o && o.zh) return String(o.zh);
          /* 2026-10-19（Phil「返回空译文」截图定位）：长消息译文被 max_tokens=300 截断 → JSON 不完整 → 解析为空 → 报"空译文"。
             上限已提至 2500；这里再做截断容错：被截断/被代码围栏包裹/纯文本时尽力提取，长译文中途截断也比整条报错强 */
          var s = String(t || "").replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
          var m = s.match(/"zh"\s*:\s*"/);
          if (m) {
            var rest = s.slice(m.index + m[0].length);
            var q = rest.lastIndexOf('"');
            if (q >= 0) rest = rest.slice(0, q);
            rest = rest.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
            if (rest) return rest;
          }
          return /[一-龥]/.test(s) ? s : null;
        });
    },
      extract: function (text, buyer) {
      return fullSystem(buyer).then(function (sys) {
        return chat(sys, Prompts.extract + "\n\n消息：" + text, { max_tokens: 400, temp: 0.2, scope: buyer.scope });
      }).then(function (t) {
        var o = parseJSON(t);
        return (o && o.fields) || [];
      });
    },
    intentDelta: function (text, buyer) {
      return chat(ctx(buyer), Prompts.intent + "\n\n消息：" + text, { max_tokens: 120, temp: 0.2 })
        .then(function (t) {
          var o = parseJSON(t);
          if (!o || typeof o.delta !== "number") return null;
          o.delta = Math.max(-15, Math.min(15, Math.round(o.delta)));
          return o;
        });
    },
     /* onChunk（可选）：流式生成时逐包回调（full, delta）；AI 代写「重新生成」用它做打字机预览 */
     suggest: function (buyer, onChunk) {
       var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(buyer) : "英语";
      var needForeign = lang !== "中文";
      function hasCjk(s) { return /[一-龥]/.test(String(s || "")); }
      function leak(list) {
        if (!needForeign || !list) return false;
        for (var i = 0; i < list.length; i++) if (hasCjk(list[i].text)) return true;
        return false;
      }
      function parse(t) {
        var o = parseJSON(t);
        return { diagnosis: (o && o.diagnosis) || null, list: (o && o.suggestions) || null };
      }
       function call(promptText) {
         /* temp 0.25：编造认证/年份类红线比多样性更要紧，压低随机性；
            max_tokens 1300→900（2026-10-14 提速）：3 条≤50词+诊断实际用不到 1300，砍掉无效尾段 */
          return fullSystem(buyer).then(function (sys) {
            return chat(sys, promptText, { max_tokens: 900, temp: 0.25, onChunk: onChunk, scope: buyer.scope });
          }).then(parse);
       }
      return call(Prompts.suggest(buyer)).then(function (r) {
        if (leak(r.list)) {
          return call(Prompts.suggest(buyer) + "\n\n[纠正] 上一次输出的 text 字段里出现了中文，这是错误的。text 必须是纯" + lang + "，只有 zh 字段允许中文。").then(function (r2) {
            return leak(r2.list) ? r : r2;
          });
        }
        return r;
      });
    },
    localize: function (text, buyer) {
      var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(buyer) : "英语";
      var needForeign = lang !== "中文";
      var user = Prompts.localize(buyer) + "\n\n中文原文：" + text;
      return fullSystem(buyer).then(function (sys) {
        return chat(sys, user, { max_tokens: 400, temp: 0.3, scope: buyer.scope })
          .then(function (t) {
            if (needForeign && /[一-龥]/.test(String(t || ""))) {
              return chat(sys, Prompts.localize(buyer) + "\n\n【纠正】上一次输出含中文，错误。正文必须为纯" + lang + "，不得出现任何中文。\n\n中文原文：" + text, { max_tokens: 400, temp: 0.2, scope: buyer.scope });
            }
            return t;
          });
      });
    },
    /* 按意图扩充：返回 {text, zh}；text 含中文时纠正重试一次 */
    expand: function (text, buyer) {
      var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(buyer) : "英语";
      var needForeign = lang !== "中文";
      var base = Prompts.expand(buyer) + "\n\n卖家写的意图：" + text;
      return fullSystem(buyer).then(function (sys) {
        return chat(sys, base, { max_tokens: 500, temp: 0.4, scope: buyer.scope })
          .then(function (t) {
            var o = parseJSON(t);
            if (!o || !o.text) throw new Error("扩充结果无法解析");
            if (needForeign && /[一-龥]/.test(String(o.text))) {
              return chat(sys, base + "\n\n【纠正】上一次 text 字段含中文，错误。text 必须为纯" + lang + "，只有 zh 允许中文。", { max_tokens: 500, temp: 0.2, scope: buyer.scope })
              .then(function (t2) {
                var o2 = parseJSON(t2);
                if (!o2 || !o2.text) throw new Error("扩充结果无法解析");
                return o2;
              });
          }
          return o;
        });
      });
    }
  };
})();
