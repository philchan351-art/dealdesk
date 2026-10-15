/* ===== LLM 客户端：OpenAI 兼容接口（百炼工作区） =====
 * W2 直连模式：Key 存于本机 localStorage（设置页配置），不进代码库。
 * W3 团队规模化后可切 FC 代理模式（接口不变，换 endpoint）。
 */
(function () {
  "use strict";

  var MODELS = ["qwen-plus", "qwen3.8-flash", "qwen3.8-max-0902"];

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

  /* 团队公共资料（2026-10-14）：管理员上传一次，所有成员的 AI 生成自动引用。
     5 分钟内存缓存，避免每次生成都多一次网络请求；失败时退回上次缓存不阻塞生成。 */
  var _sharedCache = { at: 0, docs: [] };
  function getSharedDocs() {
    var now = Date.now();
    if (now - _sharedCache.at < 5 * 60 * 1000) return Promise.resolve(_sharedCache.docs);
    if (!window.Sync || !Sync.enabled()) return Promise.resolve(_sharedCache.docs);
    return Sync.sharedDocs().then(function (j) {
      _sharedCache = { at: Date.now(), docs: (j && j.docs) || [] };
      return _sharedCache.docs;
    }).catch(function () { return _sharedCache.docs; });
  }

  /* 训练资料：团队公共资料（管理员）+ 本人个人资料（各最新 3 份、各截 3000 字）叠加并入系统提示 */
  function withDocs(system) {
    var p = Store.getPersona ? Store.getPersona() : null;
    var docs = (p && p.docs) || [];
    docs = docs.slice().sort(function (a, b) { return String(b.updated || "") > String(a.updated || "") ? 1 : -1; }).slice(0, 3);
    var hasPersonal = docs.length && window.Sync && Sync.enabled();
    var jobs = [getSharedDocs()];
    if (hasPersonal) {
      jobs.push(Promise.all(docs.map(function (d) {
        return (d && d.content != null ? Promise.resolve(d.content) : Sync.docFetch(d.key))
          .then(function (v) { return String((v && v.content) || "").slice(0, 3000); })
          .catch(function () { return ""; });
      })));
    }
    return Promise.all(jobs).then(function (res) {
      var shared = res[0] || [];
      var personal = hasPersonal ? (res[1] || []) : [];
      var out = "";
      for (var i = 0; i < shared.length; i++) {
        if (shared[i] && shared[i].content) out += "\n【团队资料·" + (shared[i].name || "文件") + "】\n" + shared[i].content;
      }
      for (var j2 = 0; j2 < docs.length; j2++) {
        if (personal[j2]) out += "\n【资料·" + (docs[j2].name || "文件") + "】\n" + personal[j2];
      }
      return system + out + factRule(out.length > 0);
    });
  }

  function chat(system, user, opt) {
    opt = opt || {};
    var c = cfg();
    if (!c || !(c.key || c.proxyUrl)) return Promise.reject(new Error("LLM 未配置（设置里填 Key 或云代理地址）"));
    var payload = {
      model: opt.model || c.model || "qwen-plus",
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
      return withDocs(ctx(buyer)).then(function (sys) {
        return chat(sys, Prompts.translate + "\n\n消息：" + text, { max_tokens: 300, temp: 0.2 });
      }).then(function (t) {
        var o = parseJSON(t);
        return (o && o.zh) || null;
      });
    },
    extract: function (text, buyer) {
      return withDocs(ctx(buyer)).then(function (sys) {
        return chat(sys, Prompts.extract + "\n\n消息：" + text, { max_tokens: 400, temp: 0.2 });
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
         return withDocs(ctx(buyer)).then(function (sys) {
           return chat(sys, promptText, { max_tokens: 900, temp: 0.25, onChunk: onChunk });
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
      return withDocs(ctx(buyer)).then(function (sys) {
        return chat(sys, user, { max_tokens: 400, temp: 0.3 })
          .then(function (t) {
            if (needForeign && /[一-龥]/.test(String(t || ""))) {
              return chat(sys, Prompts.localize(buyer) + "\n\n【纠正】上一次输出含中文，错误。正文必须为纯" + lang + "，不得出现任何中文。\n\n中文原文：" + text, { max_tokens: 400, temp: 0.2 });
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
      return withDocs(ctx(buyer)).then(function (sys) {
        return chat(sys, base, { max_tokens: 500, temp: 0.4 })
          .then(function (t) {
            var o = parseJSON(t);
            if (!o || !o.text) throw new Error("扩充结果无法解析");
            if (needForeign && /[一-龥]/.test(String(o.text))) {
              return chat(sys, base + "\n\n【纠正】上一次 text 字段含中文，错误。text 必须为纯" + lang + "，只有 zh 允许中文。", { max_tokens: 500, temp: 0.2 })
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
