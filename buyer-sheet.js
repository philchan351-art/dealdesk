/* ===== "新增买家"弹层：把 WhatsApp / 广告 / 展会里遇到的客户 30 秒建档（2026-10-17 支持粘贴 FB 表单自动识别） ===== */
(function () {
  "use strict";

  var KNOWN = CountryProfiles.countries();
  /* 国家别名：FB 表单常提交英文/国家代码（AU / United States）→ 规范成画像库的中文标签 */
  var COUNTRY_ALIAS = {
    "au": "澳大利亚", "aus": "澳大利亚", "australia": "澳大利亚",
    "us": "美国", "usa": "美国", "u.s": "美国", "u.s.": "美国", "united states": "美国", "united states of america": "美国",
    "uk": "英国", "u.k": "英国", "u.k.": "英国", "united kingdom": "英国", "england": "英国", "gb": "英国",
    "de": "德国", "germany": "德国",
    "br": "巴西", "brazil": "巴西",
    "fr": "法国", "france": "法国",
    "es": "西班牙", "spain": "西班牙",
    "mx": "墨西哥", "mexico": "墨西哥",
    "in": "印度", "india": "印度",
    "jp": "日本", "japan": "日本",
    "kr": "韩国", "korea": "韩国", "south korea": "韩国",
    "tr": "土耳其", "turkey": "土耳其",
    "ru": "俄罗斯", "russia": "俄罗斯",
    "sa": "沙特阿拉伯", "saudi arabia": "沙特阿拉伯",
    "ae": "阿联酋", "uae": "阿联酋", "united arab emirates": "阿联酋",
    "th": "泰国", "thailand": "泰国",
    "ca": "加拿大", "canada": "加拿大",
    "it": "意大利", "italy": "意大利",
    "nl": "荷兰", "netherlands": "荷兰",
    "za": "南非", "south africa": "南非",
    "id": "印尼", "indonesia": "印尼"
  };
  function normCountry(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    for (var i = 0; i < KNOWN.length; i++) if (KNOWN[i].toLowerCase() === s.toLowerCase()) return KNOWN[i];
    var al = COUNTRY_ALIAS[s.toLowerCase()];
    if (al) return al;
    return s; /* 库外国家保留原文：建档后画像随沟通自动积累（addBuyer 已有兜底） */
  }

  function field(id, label, ph, required, list, val) {
    return '<label class="set-lbl">' + label + (required ? " *" : "") + "</label>" +
      '<input class="set-inp" id="' + id + '" type="text" placeholder="' + ph + '"' +
      (val ? ' value="' + val.replace(/"/g, "&quot;") + '"' : "") +
      (list ? ' list="' + id + 'List"' : "") + "/>" +
      (list ? '<datalist id="' + id + 'List">' + list.map(function (c) { return "<option>" + c + "</option>"; }).join("") + "</datalist>" : "");
  }
  function v(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  /* ---------- FB 表单粘贴识别（2026-10-17）----------
     两条链路：配了云代理 → AI 识别（长问题句/任意语言/CSV 通吃）；否则或 AI 失败 → 本地规则兜底 */
  var pendingCtx = []; /* 识别出的扩展档案要点（邮箱/首单计划/业务类型…），保存时随 addBuyer 入档 */

  var PARSE_SYS = "你是外贸 CRM 的表单解析器。用户粘贴了 Facebook 投流表单的客户信息（字段名可能是任何语言的长问题句，格式含\"字段: 值\"、\"问题?: 值\"或 CSV 两行）。" +
    "严格依据内容提取，绝不编造，只输出一个 JSON（不要解释、不要 markdown 代码块），字段：" +
    '{"name":"客户姓名","country":"国家（中文国家名，如 美国/澳大利亚；判断不了用原文）","company":"公司名","wa":"WhatsApp号（优先，含+原文）","phone":"普通电话（无则空）","product":"意向产品或采购需求（从答案归纳，无则空）","qty":"数量","email":"邮箱","budget":"预算","extra":[{"k":"简短中文标签(≤6字)","v":"值(原文)"}]}' +
    "extra 收录除上述字段外对跟进有价值的问答（如 首单计划/业务类型/采购类型），最多 5 条；不存在的字段输出空字符串，extra 无内容输出 []。出现多个客户时只输出第一个。";

  function extractJson(raw) {
    var m = String(raw || "").match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
  }
  function clean(vv) { return String(vv == null ? "" : vv).replace(/\s{2,}/g, " ").trim(); }

  /* 规则路径：逐行匹配已知标签（兼容 FB "问题?: 答案" 长标签与 CSV 头+数据行） */
  var RULES = [
    ["wa", /^\s*(?:whatsapp|wa)\s*(?:number|no\.?|号码?)?\s*\??\s*[:：]\s*(.+)$/i],
    ["name", /^\s*(?:full\s*name|name|姓名|名字|客户姓名)\s*\??\s*[:：]\s*(.+)$/i],
    ["company", /^\s*(?:company\s*(?:name|no\.?)?|公司|企业名称)\s*\??\s*[:：]\s*(.+)$/i],
    ["country", /^\s*(?:country|nation|国家|地区)\s*\??\s*[:：]\s*(.+)$/i],
    ["email", /^\s*(?:work\s*email|e-?mail|email|邮箱|邮件)\s*\??\s*[:：]\s*(.+)$/i],
    ["qty", /^\s*.*?(?:quantity|qty|数量)\s*\??\s*[:：]\s*(.+)$/i],
    ["phone", /^\s*(?:phone\s*number|phone|mobile|tel(?:ephone)?|电话|手机)\s*\??\s*[:：]\s*(.+)$/i],
    ["budget", /^\s*(?:budget|预算)\s*\??\s*[:：]\s*(.+)$/i],
    ["product", /^\s*.*?(?:product|interested\s*in|looking\s*for|需求|意向产品|感兴趣|采购)(?:\s+[^:：]{1,30})?\s*\??\s*[:：]\s*(.+)$/i]
  ];
  var EXTRA_RULES = [
    [/place.*order|first\s*order|首单|下单/i, "首单计划"],
    [/describes\s*your\s*business|business\s*type|type\s*of\s*business|业务类型/i, "业务类型"],
    [/business\s*or|personal\s*use|自用/i, "采购类型"],
    [/^message$|^remark$|^note$|^备注$|^留言$/i, "备注"]
  ];
  function assignRule(f, key, value) {
    value = clean(value);
    if (!value || value.length > 160) return;
    if (!f[key]) f[key] = value;
  }
  function ruleParse(text) {
    var f = { name: "", country: "", company: "", wa: "", phone: "", product: "", qty: "", email: "", budget: "" };
    var extra = [];
    var lines = String(text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var csv = lines.length >= 2 && (lines[0].match(/,/g) || []).length >= 2 && (lines[1].match(/,/g) || []).length >= 2;
    if (csv) {
      var head = lines[0].split(","), row = lines[1].split(",");
      for (var i = 0; i < head.length; i++) {
        var hv = row[i] ? row[i].trim() : "";
        if (!hv) continue;
        var mapped = null;
        for (var r0 = 0; r0 < RULES.length; r0++) if (RULES[r0][1].test(head[i].trim() + ": x")) { mapped = RULES[r0][0]; break; }
        if (mapped) assignRule(f, mapped, hv);
        else extra.push({ k: String(head[i]).trim().slice(0, 8), v: hv });
      }
    } else {
      for (var j = 0; j < lines.length; j++) {
        var hit = null;
        for (var r = 0; r < RULES.length; r++) {
          var m = lines[j].match(RULES[r][1]);
          if (m) { hit = { k: RULES[r][0], v: m[1] }; break; }
        }
        if (hit) { assignRule(f, hit.k, hit.v); continue; }
        /* 其余 "问题?: 答案"：尝试归入 extra 档案要点 */
        var qm = lines[j].match(/^(.{4,80}?)\s*\??\s*[:：]\s*(.{2,160})$/);
        if (qm) {
          var ek = null;
          for (var x = 0; x < EXTRA_RULES.length; x++) if (EXTRA_RULES[x][0].test(qm[1])) { ek = EXTRA_RULES[x][1]; break; }
          if (ek) extra.push({ k: ek, v: clean(qm[2]) });
        }
      }
    }
    /* 无标签电话：找独立号码（先剥邮箱防误判） */
    if (!f.wa && !f.phone) {
      var t = String(text).replace(/[a-z0-9._%+-]+@[a-z0-9.-]+/gi, " ");
      var pm = t.match(/\+\d{1,3}[\s-]?\d{6,14}|\b\d{8,14}\b/);
      if (pm) f.wa = clean(pm[0]);
    }
    f.country = normCountry(f.country);
    return { f: f, ctx: mergeCtx(f, extra) };
  }

  /* 扩展要点合并（两条路径共用）：邮箱/电话/预算 + 表单里其余有价值的问答 */
  function mergeCtx(f, extra) {
    var ctx = [];
    if (f.email) ctx.push({ k: "邮箱", v: f.email });
    if (f.phone && f.phone !== f.wa) ctx.push({ k: "电话", v: f.phone });
    if (f.budget) ctx.push({ k: "预算", v: f.budget });
    (extra || []).forEach(function (it) {
      if (ctx.length < 6 && it && it.k && it.v) ctx.push({ k: String(it.k).slice(0, 8), v: String(it.v).slice(0, 160) });
    });
    return ctx.slice(0, 6);
  }

  /* LLM 返回 → 统一结构 */
  function buildResult(j, via) {
    function g(k) { return clean(j[k]); }
    var f = {
      name: g("name"),
      country: normCountry(g("country")),
      company: g("company"),
      wa: g("wa") || g("phone"),
      phone: g("phone") && g("phone") !== g("wa") ? g("phone") : "",
      product: g("product"),
      qty: g("qty"),
      email: g("email"),
      budget: g("budget"),
      note: ""
    };
    var ex = j.extra;
    if (!ex || ex.constructor !== Array) ex = [];
    return { f: f, ctx: mergeCtx(f, ex), via: via };
  }

  /* 截图压缩（2026-10-17 表单图片识别）：≤1600px JPEG 0.82，控制 /import 请求体积；编码失败回退原始 base64 */
  function imgToB64(file, cb) {
    function raw() {
      var fr = new FileReader();
      fr.onload = function () { cb(String(fr.result || "").split(",")[1] || "", (file.type || "image/jpeg").split("/")[1] || "jpg"); };
      fr.onerror = function () { cb("", ""); };
      fr.readAsDataURL(file);
    }
    try {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var MAX = 1600, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          var scale = Math.min(1, MAX / Math.max(w, h));
          var cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h * scale));
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          var out = cv.toDataURL("image/jpeg", 0.82).split(",")[1] || "";
          URL.revokeObjectURL(url);
          cb(out, "jpg");
        } catch (e) { try { URL.revokeObjectURL(url); } catch (e2) {} raw(); }
      };
      img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} raw(); };
      img.src = url;
    } catch (e) { raw(); }
  }

  /* 表单截图识别：/import 视觉模型 → fields/convo 归一成 "标签: 值" 行 → 走既有 ruleParse，
     与粘贴文字共用同一套字段映射/国家归一/要点沉淀（2026-10-17，零 FC 改动）
     v1.20.0（Phil「等待中要很明确：字体小、没提示、还能上传；上传失败后第二次无法上传」）：
     · 旧 st() 每次调用都无条件 btn.disabled=false——识别一启动就把点击时设置的"置灰防重"
       解掉，5–15 秒等待期按钮可点，会发起第二次并发上传。现在按钮只由终态 end() 释放；
     · 等待提示升级：14px 加粗 busy 状态行＋按钮文案「⏳ 识别中…请稍候」；
     · 所有出口（缺配置/未登录/超限/读取失败/成功/失败）统一走 end()，经 finish 释放外层 busy 锁 */
  function parseFormImage(file, bd, btn, finish) {
    var fbpSt = bd.querySelector('[data-act="fbp-status"]');
    function st(cls, msg) {
      if (fbpSt) { fbpSt.className = "fbp-status " + cls; fbpSt.textContent = msg; }
    }
    function end(cls, msg) {
      st(cls, msg);
      if (btn) { btn.disabled = false; btn.textContent = "📷 上传表单截图识别"; }
      if (finish) finish();
    }
    st("busy", "⏳ 图片上传识别中…约 5–15 秒，请勿关闭本页");
    var stt = (window.Store && Store.getSettings) ? (Store.getSettings() || {}) : {};
    var c = stt.llm || {}, cl = stt.cloud || {};
    var proxy = c.proxyUrl || cl.proxyUrl;
    if (!proxy) { end("err", "未配置云同步/云代理，图片识别暂不可用（粘贴文字仍可用）"); return; }
    var au = window.Auth && Auth.get();
    if (!au || !au.session) { end("err", "请先登录后再使用图片识别"); return; }
    if (file.size > 15 * 1048576) { end("err", "图片太大（单张 ≤15MB），请截图小一点"); return; }
    imgToB64(file, function (b64, fmt) {
      if (!b64) { end("err", "图片读取失败，请换一张或改用粘贴文字"); return; }
      if (b64.length > 4 * 1048576) { end("err", "图片压缩后仍超限，请重新截图（单屏一张最好）"); return; }
      fetch(String(proxy).replace(/\/+$/, "") + "/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-dealdesk-session": au.session },
        body: JSON.stringify({ kind: "image", data: b64, format: fmt || "jpg", name: file.name })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.error) throw new Error(j.error);
        var lines = [];
        (j.fields || []).forEach(function (x) { if (x && x.v) lines.push((x.k || "字段") + ": " + x.v); });
        (j.convo || []).forEach(function (x) { if (x && x.text) lines.push(x.text); });
        var text = lines.join("\n");
        var r2 = ruleParse(text);
        var hasHit = r2.f.name || r2.f.wa || r2.f.email || r2.f.company || r2.f.country || r2.f.product;
        if (!hasHit && j.summary) {
          /* 模型有时把表单内容写进摘要：摘要拼回规则再试一次 */
          var r3 = ruleParse(j.summary + "\n" + text);
          if (r3.f.name || r3.f.wa || r3.f.email || r3.f.company || r3.f.country) r2 = r3;
        }
        if (!(r2.f.name || r2.f.wa || r2.f.email || r2.f.company || r2.f.country || r2.f.product)) {
          throw new Error("图片里没识别出客户字段（请确认为表单截图，或改用粘贴文字）");
        }
        pendingCtx = r2.ctx || [];
        var filled = fillFields(r2.f, bd);
        end(filled.length ? "ok" : "err",
          (filled.length ? "✅ 图片识别：已填入 " + filled.length + " 个字段" : "⚠️ 图片识别：字段没对上，请检查截图") +
          (pendingCtx.length ? "，" + pendingCtx.length + " 条要点将存入档案（" + pendingCtx.map(function (cc) { return cc.k; }).join("、") + "）" : "") +
          (filled.length ? " —— 请核对后保存" : "，也可改用粘贴文字"));
      }).catch(function (e) {
        end("err", "⚠️ 图片识别失败：" + String(e.message || e).slice(0, 60) + "（可改用粘贴文字，也可直接再传一次）");
      });
    });
  }

  function parseForm(text) {
    text = String(text || "").trim().slice(0, 6000);
    if (!text) return Promise.reject(new Error("先粘贴表单内容"));
    var nameHits = (text.match(/(?:full\s*name|name|姓名)\s*\??\s*[:：]/gi) || []).length;
    var multi = nameHits >= 2 ? "⚠️ 识别到多份表单，只取了第一份，其余请再粘贴建档。" : "";
    if (window.LLM && LLM.chat && LLM.configured()) {
      return LLM.chat(PARSE_SYS, "表单内容：\n" + text, { temp: 0, max_tokens: 500 }).then(function (raw) {
        var j = extractJson(raw);
        if (!j) throw new Error("模型未返回有效结构");
        return buildResult(j, multi + "AI 识别");
      }).catch(function (e) {
        var r = ruleParse(text);
        return { f: r.f, ctx: r.ctx, via: multi + "AI 失败已转规则识别（" + String(e.message || e).slice(0, 24) + "）" };
      });
    }
    var r2 = ruleParse(text);
    return Promise.resolve({ f: r2.f, ctx: r2.ctx, via: multi + "规则识别（未配云代理，AI 识别不可用）" });
  }

  /* 识别结果 → 表单预填（高亮闪烁提示哪些是机器填的） */
  function fillFields(f, bd) {
    var map = { nbName: f.name, nbCountry: f.country, nbCompany: f.company, nbWa: f.wa, nbProduct: f.product, nbQty: f.qty };
    var filled = [];
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !map[id]) return;
      el.value = map[id];
      el.classList.add("fbp-filled");
      setTimeout(function () { el.classList.remove("fbp-filled"); }, 2500);
      filled.push(id);
    });
    var sc = document.getElementById("nbScope");
    if (sc) {
      var p = (f.product || "").toLowerCase();
      /* 2026-11-09 多业务域：产品线只在「本域内部」细分，绝不跨域识别——
         面料客户写了 "suitcase fabric" 也不能被自动打到行李箱线上 */
      var dp = (window.DealDomain && DealDomain.current()) ? DealDomain.current() : null;
      var hit = "";
      if (!dp || !dp.productLines) {
        hit = /宠物|pet|dog|cat/.test(p) ? "pet" : /行李箱|suitcase|luggage/.test(p) ? "suitcase" : "";
      } else {
        dp.productLines.forEach(function (l) {
          if (!l.key || hit) return;
          if (l.key === "fabric" ? /面料|fabric|cloth|涤纶|锦纶|polyester|polyester|nylon/.test(p) : new RegExp(l.key, "i").test(p)) hit = l.key;
        });
        if (!hit && dp.primaryLine && /面料|fabric|cloth/.test(p)) hit = dp.primaryLine;
      }
      if (hit) {
        sc.value = hit;
        sc.classList.add("fbp-filled");
        setTimeout(function () { sc.classList.remove("fbp-filled"); }, 2500);
        filled.push("nbScope");
      }
    }
    return filled;
  }

  function build(bd, editB) {
    pendingCtx = [];
    var isEdit = !!editB;
    bd.innerHTML = '<div class="sheet">' +
      '<div class="sheet-head"><b>' + (isEdit ? "编辑档案" : "新增买家") + '</b><button class="sheet-x" data-act="x">✕</button></div>' +
      '<div class="sheet-sub">' + (isEdit
        ? "修改基础信息；保存后云端自动同步，对话与意向分不受影响"
        : "从 WhatsApp / 广告 / 展会来的客户，先建档再\"记一条\"，建档即套用国家沟通画像") + '</div>' +
      (isEdit ? "" : '<div class="fbp">' +
        '<div class="fbp-head"><span>📋 粘贴 FB 表单 · 自动识别填入</span><button class="fbp-x" data-act="fbp-x" type="button">收起</button></div>' +
        '<div class="fbp-body">' +
         '<textarea class="sl-text" id="fbpText" rows="4" placeholder="把表单整段贴进来（字段/问题 + 答案均可，如 Full name: … / Country: … / WhatsApp number: …）"></textarea>' +
         '<div class="fbp-imgrow"><button class="set-btn-inline" data-act="fbp-img" type="button">📷 上传表单截图识别</button><span class="fbp-img-note">没有文字时，截图也行（约 5–15 秒）</span></div>' +
         '<input type="file" id="fbpImg" accept="image/*" style="display:none"/>' +
         '<button class="fbp-go" data-act="fbp-go" type="button">✨ 识别并自动填入</button>' +
         '<div class="fbp-status" data-act="fbp-status"></div>' +
        "</div>" +
        "</div>") +
      field("nbName", "姓名", "如 Carla Mendes", true, null, isEdit ? editB.name : "") +
      field("nbCountry", "国家", "如 巴西（画像库已内置常用市场）", true, KNOWN, isEdit ? editB.country : "") +
      field("nbLang", "语言", "选填：留空=按国家自动；可输 英语/中文/西语…", false, CountryProfiles.langs(), isEdit ? (editB.msgLang || "") : "") +
       /* 2026-10-19（Phil「编辑键无法编辑」）：原把值错放进第 5 参 list（数组位）→ 编辑已有客户时
          editB.wa 等是字符串，list.map 抛 TypeError，面板渲染中断、点击无反应。值归位到第 6 参 val。 */
       field("nbCompany", "公司", "选填", null, null, isEdit ? (editB.company && editB.company !== "—" ? editB.company : "") : "") +
       field("nbWa", "WhatsApp / 电话", "+55 …（直达对话要填）", null, null, isEdit ? (editB.wa || "") : "") +
        field("nbQty", "数量", "选填：如 500 件", null, null, isEdit ? (editB.qty != null ? String(editB.qty) : "") : "") +
        /* 2026-10-23（Phil「报过价还显示待报价」）：金额首次有真实录入入口——报价/订单金额可录可改，
           客户卡/谈单页/详情优先显示金额，没录的按阶段证据显示"已报价/未报价" */
        field("nbAmount", "金额（美元）", "选填：报价或订单金额，如 111000", null, null, isEdit && editB.amount ? String(editB.amount) : "") +
        field("nbProduct", "产品线 / 意向产品", (function () {
          /* 示例文案跟域走：面料业务员不该在表单里被提示"如 电动行李箱" */
          var pd = (window.DealDomain && DealDomain.current()) ? DealDomain.current() : null;
          var hint = pd && pd.primaryLine ? (DealDomain.scopeLabel(pd.primaryLine) || pd.primaryLine) : "电动行李箱";
          return "选填：如 " + hint;
        })(), null, null, isEdit ? (editB.product && editB.product !== "待确认" ? editB.product : "") : "") +
      /* 2026-11-09 多业务域：产品线选项由当前域包给（面料域不会再看到"宠物用品/电动行李箱"），
         值顺序里第一个空值就是"未定"；跨域值即使被写进来，store.validScope 也会回落成未定 */
      '<label class="set-lbl">产品线（用于话术剧本 / 资料库隔离，可后补）</label>' +
      '<select class="set-inp" id="nbScope">' +
      (window.DealDomain && DealDomain.current() ? DealDomain.productLines() : [
        { key: "", label: "通用（全部产品线）" }, { key: "pet", label: "宠物用品（pet）" }, { key: "suitcase", label: "电动行李箱（suitcase）" }
      ]).map(function (l) {
        return '<option value="' + escHtml(l.key) + '" ' + (((isEdit ? editB.scope : "") || "") === l.key ? "selected" : "") + ">" + escHtml(l.label) + "</option>";
      }).join("") +
      "</select>" +
      field("nbNote", "备注", "如 价格敏感（选填，成为标签）", false, null, isEdit ? ((editB.tags && editB.tags[0] && editB.tags[0] !== "新客户") ? editB.tags[0] : "") : "") +
      (isEdit ? "" : field("nbIntent", "初始意向分", "0-100，默认 50（A≥80 / B≥55 / C）")) +
      '<button class="sl-save" data-act="save">' + (isEdit ? "保存修改" : "保存并进入详情") + '</button>' +
      "</div>";

    function closeIt() { bd.hidden = true; }
    bd.querySelector('[data-act="x"]').addEventListener("click", closeIt);
    bd.addEventListener("click", function (e) { if (e.target === bd) closeIt(); });
    bd.querySelector('[data-act="save"]').addEventListener("click", function () {
      var name = v("nbName"), country = v("nbCountry");
      if (!name || !country) { App.toast("姓名和国家必填"); return; }
      if (isEdit) {
        Store.updateBuyer(editB.id, {
          name: name,
          country: country,
          msgLang: v("nbLang"),
          company: v("nbCompany"),
          wa: String(v("nbWa") || "").trim().replace(/^\++/, "+"), /* 2026-10-22 录入多打的 + 折叠成一个 */
          qty: v("nbQty"),
          amount: v("nbAmount"),
          product: v("nbProduct"),
          note: v("nbNote")
        });
        closeIt();
        App.toast("已保存 · 档案已更新");
        App.refresh();
        return;
      }
      var intent = parseInt(v("nbIntent"), 10);
      if (isNaN(intent) || intent < 0 || intent > 100) intent = 50;
      var nb = Store.addBuyer({
        name: name,
        country: country,
        cc: CountryProfiles.cc(country),
        msgLang: v("nbLang"),
        company: v("nbCompany"),
        wa: String(v("nbWa") || "").trim().replace(/^\++/, "+"), /* 2026-10-22 录入多打的 + 折叠成一个 */
        qty: v("nbQty"),
        amount: v("nbAmount"),
        product: v("nbProduct"),
        intent: intent,
        note: v("nbNote"),
        scope: document.getElementById("nbScope") ? document.getElementById("nbScope").value : "",
        extraContext: pendingCtx
      });
      /* 2026-11-09 多业务域：账号未绑域时 addBuyer 返回 null（不给客户盖域标签就不建）。
         这里必须先判空——原来无条件 closeIt + "已建档" + nb.id 取值，会既报成功又抛 TypeError，
         表单里已经敲进去的内容还全丢了 */
      if (!nb) {
        App.toast("⚠ 这个账号还没绑定业务域，无法建档（域决定客户能看到哪套产品与话术）", 5000);
        return;
      }
      pendingCtx = [];
      closeIt();
      App.toast("已建档 · " + name);
      App.go("buyer", nb.id);
    });
    /* FB 识别交互 */
    if (!isEdit) {
      var fbpX = bd.querySelector('[data-act="fbp-x"]');
      var fbpGo = bd.querySelector('[data-act="fbp-go"]');
      var fbpSt = bd.querySelector('[data-act="fbp-status"]');
      var fbpBody = bd.querySelector(".fbp-body");
      fbpX.addEventListener("click", function () {
        fbpBody.hidden = !fbpBody.hidden;
        fbpX.textContent = fbpBody.hidden ? "展开" : "收起";
      });
      /* 表单截图识别（2026-10-17 上线）：
         v1.20.0 修两个真实 bug：① 选图弹窗 cancel 不触发 change → 按钮永久置灰"第二次无法上传"；
         ② 识别期间按钮可点（旧 st() 盲解锁）→ 等待期能并发再传。
         v1.23.0（Phil 实机「上传表单截图识别无法工作」）：v1.20.0 的修法①引入了新回归——
         .click() 之前把 input 置 disabled，而所有浏览器里 disabled 的 file input 对
         程序化点击是 no-op，选图弹窗根本不弹，功能整体失效。正确模型：选图弹窗是系统模态，
         打开期间页面本就点不到任何按钮，"防二次唤起"不需要禁用任何东西；
         唯一要锁的是识别进行中（fbpBusy）——按钮禁用＋「⏳ 识别中…请稍候」，终态 end() 统一释放。
         cancel = 什么都不发生 = 按钮仍在，随时可再点 */
      var fbpImgBtn = bd.querySelector('[data-act="fbp-img"]');
      var fbpImgIn = bd.querySelector("#fbpImg");
      if (fbpImgBtn && fbpImgIn) {
        var fbpBusy = false;
        fbpImgBtn.addEventListener("click", function () {
          if (fbpBusy) return; /* input 永远保持启用态——disabled 的 file input 不响应 .click() */
          fbpImgIn.click();
        });
        fbpImgIn.addEventListener("change", function (e) {
          var f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (!f || fbpBusy) return;
          fbpBusy = true;
          fbpImgBtn.disabled = true;
          fbpImgBtn.textContent = "⏳ 识别中…请稍候";
          parseFormImage(f, bd, fbpImgBtn, function () { fbpBusy = false; });
        });
      }
      fbpGo.addEventListener("click", function () {
        var ta = document.getElementById("fbpText");
        if (!ta || (ta.value || "").trim().length < 4) {
          fbpSt.className = "fbp-status err";
          fbpSt.textContent = "先把表单内容贴进来再点识别";
          return;
        }
        fbpGo.disabled = true;
        fbpGo.textContent = "识别中…（约 2-5 秒）";
        fbpSt.className = "fbp-status";
        fbpSt.textContent = "";
        parseForm(ta.value).then(function (r) {
          pendingCtx = r.ctx || [];
          var filled = fillFields(r.f, bd);
          if (filled.length) {
            fbpSt.className = "fbp-status ok";
            fbpSt.textContent = "✅ " + r.via + "：已填入 " + filled.length + " 个字段" +
              (pendingCtx.length ? "，" + pendingCtx.length + " 条要点将存入档案（" + pendingCtx.map(function (c) { return c.k; }).join("、") + "）" : "") +
              " —— 请核对后保存";
          } else {
            fbpSt.className = "fbp-status err";
            fbpSt.textContent = "⚠️ " + r.via + "：没识别出可填字段，请检查粘贴内容或手动填写";
          }
        }).catch(function (e) {
          fbpSt.className = "fbp-status err";
          fbpSt.textContent = "⚠️ 识别失败：" + String(e.message || e).slice(0, 60) + "（可手动填写）";
        }).then(function () {
          fbpGo.disabled = false;
          fbpGo.textContent = "✨ 识别并自动填入";
        });
      });
    }
  }

  window.BuyerSheet = {
    open: function (buyerId) {
      var bd = document.getElementById("buyerSheet");
      build(bd, buyerId && window.Mock && Mock.getBuyer ? Mock.getBuyer(buyerId) : null);
      bd.hidden = false;
    },
    parseForm: parseForm /* 内部调试/回归用 */
  };
})();
