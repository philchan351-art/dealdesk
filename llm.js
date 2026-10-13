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
      if (c.token) pheaders["x-dealdesk-token"] = c.token;
      return fetch(proxy, { method: "POST", headers: pheaders, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) throw new Error(j.error);
          return j.content || "";
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
      return chat(ctx(buyer), Prompts.translate + "\n\n消息：" + text, { max_tokens: 300, temp: 0.2 })
        .then(function (t) {
          var o = parseJSON(t);
          return (o && o.zh) || null;
        });
    },
    extract: function (text, buyer) {
      return chat(ctx(buyer), Prompts.extract + "\n\n消息：" + text, { max_tokens: 400, temp: 0.2 })
        .then(function (t) {
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
    suggest: function (buyer) {
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
        /* temp 0.25：编造认证/年份类红线比多样性更要紧，压低随机性 */
        return chat(ctx(buyer), promptText, { max_tokens: 1300, temp: 0.25 }).then(parse);
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
      return chat(ctx(buyer), user, { max_tokens: 400, temp: 0.3 })
        .then(function (t) {
          if (needForeign && /[一-龥]/.test(String(t || ""))) {
            return chat(ctx(buyer), Prompts.localize(buyer) + "\n\n【纠正】上一次输出含中文，错误。正文必须为纯" + lang + "，不得出现任何中文。\n\n中文原文：" + text, { max_tokens: 400, temp: 0.2 });
          }
          return t;
        });
    },
    /* 按意图扩充：返回 {text, zh}；text 含中文时纠正重试一次 */
    expand: function (text, buyer) {
      var lang = (window.Prompts && Prompts.langOf) ? Prompts.langOf(buyer) : "英语";
      var needForeign = lang !== "中文";
      var sys = ctx(buyer);
      var base = Prompts.expand(buyer) + "\n\n卖家写的意图：" + text;
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
    }
  };
})();
