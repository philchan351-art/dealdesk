/* ===== 页面：设置（数据 / 备份 / LLM 引擎配置） ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  var DEFAULT_BASE = "https://llm-mackvrkxyhgmoftm.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  /* 2026-10-15：与 llm.js 同口径——按 updated 取最新 3 份才是 AI 真正引用的，其余是存档 */
  function activeDocKeys(docs) {
    return docs.slice().sort(function (a, b) { return String(b.updated || "") > String(a.updated || "") ? 1 : -1; }).slice(0, 3).map(function (d) { return d.key; });
  }
  function docRows(docs) {
    if (!docs.length) return '<div class="set-note">还没有资料</div>';
    var active = activeDocKeys(docs);
    return docs.map(function (d) {
      var kb = Math.round((d.size || 0) / 1024);
      var badge = active.indexOf(d.key) >= 0 ? '<span class="doc-badge on">AI 生效中</span>' : '<span class="doc-badge off">存档</span>';
      var link = (d.content != null) ? ' · <a data-act="view-doc" data-doc="' + esc(d.key) + '" style="color:var(--brand-deep)">查看</a>' : "";
      return '<div class="set-note" style="margin-bottom:4px">' + badge + " " + esc(d.name || d.key) + "（" + kb + "KB" + link + '）<a data-act="del-doc" data-doc="' + esc(d.key) + '" style="color:#e5484d">删除</a></div>';
    }).join("");
  }
  var SCOPE_LABEL = { suitcase: "行李箱", pet: "宠物", all: "通用" };
  /* 资料预览：格式化的文档卡（替代原来的裸文本倾倒，2026-10-15） */
  function showDocView(box, name, content, active) {
    if (!box) return;
    var total = String(content || "").length;
    var shown = String(content || "").slice(0, 3000);
    box.innerHTML =
      '<div class="card doc-view" style="margin:8px 0 0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px">' +
      "<b style='font-size:13px'>📄 " + esc(name) + " · " + total + " 字" + (active ? ' <span class="doc-badge on">AI 生效中</span>' : "") + "</b>" +
      '<button class="set-btn-inline" data-act="close-docview">关闭</button>' +
      "</div>" +
      '<div class="doc-view-body">' + esc(shown) + (total > 3000 ? '<div class="set-note" style="margin-top:8px">—— 只显示前 3000 字（AI 也只引用这么多） ——</div>' : "") + "</div>" +
      "</div>";
    var c = box.querySelector('[data-act="close-docview"]');
    if (c) c.addEventListener("click", function () { box.innerHTML = ""; });
  }

  window.Screens.settings = {
    title: "设置",

    render: function () {
      var s = Store.stats();
      var saved = s.savedAt ? new Date(s.savedAt).toLocaleString("zh-CN") : "—";
      var st = Store.getSettings() || {};
      var llm = st.llm || {};
      var cl = st.cloud || {};
      var p = (Store.getPersona ? Store.getPersona() : null) || { thoughts: "", scripts: "" };
      var personaOn = !!(p.thoughts || p.scripts);
      /* 部署在 FC 域名下时，云服务地址自动填当前站点（省一次手输、避免打错） */
      var autoUrl = (!cl.proxyUrl && typeof location !== "undefined" && location.protocol === "https:" && /\.fcapp\.run$/.test(location.hostname)) ? location.origin : "";
      var au0 = window.Auth && Auth.get();
      var isAdmin = !!(au0 && au0.role === "admin");
      /* P0：云同步状态 = 有会话且有地址（团队口令不再是长期凭证） */
      var cloudOn = !!(cl.proxyUrl && au0 && au0.session);
      var on = !!(llm.key && llm.baseUrl) || cloudOn;

      var modelOpts = (window.LLM ? LLM.MODELS : ["qwen-plus"]).map(function (m) {
        return "<option" + (m === (llm.model || "qwen-plus") ? " selected" : "") + ">" + m + "</option>";
      }).join("");

        var au = au0;
        return '<div class="topbar">' +
         '<div class="tb-back" data-act="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div>' +
          '<div class="tb-title"><h1>设置</h1><div class="tb-sub">账号 · 团队 · 数据</div></div>' +
         "</div>" +
         '<div class="set-stack">' +
         '<div class="card card-pad">' +
          '<div class="set-title">当前账号</div>' +
          '<div class="card set-row"><span class="set-k">业务员</span><b>' + esc(au ? au.name : "未登录") + (au && au.role === "admin" ? " · 管理员" : "") + "</b></div>" +
          '<div class="set-actions"><button class="set-btn-inline danger" data-act="logout">切换账号 / 退出登录</button></div>' +
          '<div class="set-note">退出后本机数据清空并回到登录页；你的客户数据安全存在云端，重新登录即可恢复。每个账号只看自己的客户</div>' +
          "</div>" +
            (isAdmin ? '<div class="card card-pad">' +
             '<div class="set-title">团队成员</div>' +
            '<div class="card" style="margin:0 0 8px;padding:8px 10px;background:var(--surface-2)">' +
            '<div class="set-note" style="margin:0 0 6px">增加新成员（免团队口令）：对方用 姓名+初始密码 登录</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<input class="set-inp" id="addName" type="text" maxlength="20" placeholder="姓名" style="flex:1;min-width:80px"/>' +
            '<input class="set-inp" id="addPass" type="text" maxlength="20" placeholder="初始密码（字母+数字）" style="flex:1.5;min-width:120px"/>' +
            '<select class="set-inp" id="addRole" style="flex:none;width:84px"><option value="rep">业务员</option><option value="admin">管理员</option></select>' +
            '<button class="set-btn" data-act="admin-add" style="flex:none">增加</button>' +
            "</div></div>" +
            '<div id="adminList"><div class="set-note">加载中…</div></div>' +
             '<div class="set-note">重置密码：对方旧密码立即作废。改名：登录账号改名，密码与客户数据全部保留（对方需重新登录）。停用：立即不能登录/同步（数据保留）。删除：账号删除，客户数据归档 30 天（可找管理员恢复），只是不能登录请用「停用」。设为管理员：对方也能管理成员和资料。</div>' +
             "</div>" +
             '<div class="card card-pad">' +
             '<div class="set-title">团队资料 & 剧本</div>' +
            '<div id="sharedList"><div class="set-note">加载中…</div></div>' +
            '<div class="set-actions" style="margin-top:8px;display:flex;gap:8px">' +
            '<button class="set-btn" data-act="shared-upload-script" style="flex:1">📜 上传话术剧本</button>' +
            '<button class="set-btn" data-act="shared-upload" style="flex:1">＋ 普通资料</button>' +
            "</div>" +
             '<input type="file" id="sharedFile" accept=".txt,.md,.csv,.json,.html,.htm,.docx,.pdf" style="display:none">' +
             '<input type="file" id="scriptFile" accept=".txt,.md,.csv,.json,.html,.htm,.docx" style="display:none">' +
             '<div id="scriptDraft"></div>' +
             '<label class="set-lbl" style="margin-top:8px">普通资料的产品线</label>' +
             '<select class="set-inp" id="sharedScope"><option value="all">通用（所有客户）</option><option value="suitcase">电动行李箱</option><option value="pet">宠物产品</option></select>' +
              '<div id="sharedPreview"></div>' +
               '<div class="set-note">📜 话术剧本：上传 Word/文本后按「一…五」自动拆步，确认后可编辑标题与文字；业务员在客户页一步步发给客户（署名自动换成发送人）。普通资料：按产品线打包给 AI（行李箱客户只吃行李箱+通用），每线最多 10 份、单份前 12,000 字、整线总预算 36,000 字，内容业务员不可见。「📌 置顶」的资料永远排在最前、优先进包——参数速查表、底线手册建议置顶。每份资料都带产品线，客户页只显示该产品线 + 通用的资料。支持 Word(.docx)/PDF/纯文本，旧 .doc 请先另存为 .docx。</div>' +
             "</div>" : "") +
         '<div class="card card-pad">' +
         '<div class="set-title" style="font-size:13px">我的称呼</div>' +
         '<div style="display:flex;gap:8px;align-items:center;margin-top:6px">' +
         '<input class="set-inp" id="setName" type="text" maxlength="10" placeholder="你的名字（首页问候用 · 只存本机）" style="flex:1;min-width:0" value="' + esc(s.name || "") + '"/>' +
         '<button class="set-btn-inline" data-act="save-name" style="flex:none">保存</button>' +
         "</div>" +
         "</div>" +
        '<div class="card card-pad">' +
        '<div class="set-title" data-act="toggle-persona" style="cursor:pointer">我的思路与话术（训练 AI）<span class="llm-dot ' + (personaOn ? "on" : "") + '" id="personaDot"></span></div>' +
        '<div id="personaSummary" class="set-note" style="margin:6px 0 0">' + (personaOn ? "已训练 · " + (p.updated ? new Date(p.updated).toLocaleString("zh-CN") : "") + (p.docs && p.docs.length ? " · " + p.docs.length + " 份资料" : "") : "还没训练 · 点进来写你的思路和话术，AI 就按你的风格说话") + "</div>" +
        '<div id="personaBody" style="display:none;margin-top:8px">' +
        '<label class="set-lbl">我的谈单思路（你怎么谈、先问什么、什么节奏）</label>' +
        '<textarea class="set-inp" id="personaThoughts" maxlength="4000" style="min-height:90px;padding:10px;font-family:inherit;line-height:1.5" placeholder="如：我先确认客户的用途和采购量，再报阶梯价；习惯先寄样品建立信任，不急着让下大单…">' + esc(p.thoughts || "") + "</textarea>" +
        '<button class="persona-mic" id="micThoughts" type="button">🎤 按住说话补充思路</button>' +
        '<label class="set-lbl">我的常用话术（怎么开头、怎么报价、怎么催单）</label>' +
        '<textarea class="set-inp" id="personaScripts" maxlength="6000" style="min-height:110px;padding:10px;font-family:inherit;line-height:1.5" placeholder="如：常用开头 Hi, thanks for your inquiry… ；报价时一定附交期和起订量；催单就说 the price is valid till end of this week…">' + esc(p.scripts || "") + "</textarea>" +
        '<button class="persona-mic" id="micScripts" type="button">🎤 按住说话补充话术</button>' +
        '<label class="set-lbl">参考资料（公司简介 / 价目表 / 认证清单，AI 报价和介绍公司时自动参考）</label>' +
        '<div id="docList">' + docRows(p.docs || []) + "</div>" +
         '<div id="docViewBox"></div>' +
         '<input type="file" id="docFile" accept=".txt,.md,.csv,.json,.html,.htm,.docx,.pdf" style="display:none"/>' +
         '<div class="set-actions"><button class="set-btn-inline" data-act="add-doc">＋ 上传资料</button></div>' +
         '<div class="set-note">单个不超过 3MB，最多 10 份。支持 Word(.docx) / PDF / 纯文本（.txt / .md / .csv / .json）；旧版 .doc 请先在 Word 里另存为 .docx</div>' +
         '<div class="set-note">AI 调取规则：每次生成自动带上你最新的 3 份资料（标「AI 生效中」的绿色徽章），各取前 3000 字；「存档」的不调取——想更新内容就删旧传新</div>' +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-persona">保存并训练 AI</button></div>' +
        '<div class="set-note" id="personaStatus">' + (p.updated ? "已训练 · " + new Date(p.updated).toLocaleString("zh-CN") : "还没训练 · AI 暂用通用风格") + "</div>" +
        '<div class="set-note">每个业务员各填各的，按账号单独保存在云端，互不串味；保存后 AI 翻译、扩充、回复建议都会自动贴近你的思路和语气</div>' +
        "</div>" +
        "</div>" +
         /* 2026-10-15 v62：数据同步 + 智能引擎合并为一卡（两行状态 + 常用按钮），细节全收进"高级设置" */
         '<div class="card card-pad">' +
         '<div class="set-title">数据同步 & 智能引擎</div>' +
         '<div style="display:flex;align-items:center;gap:6px;margin-top:2px"><span class="llm-dot ' + (cloudOn ? "on" : "") + '"></span><span class="set-note" id="cloudStatus" style="flex:1;min-width:0">' + (cloudOn ? "云同步 已连接 · 变更自动上云，开 App 自动拉取" : "云同步 未连接 · 单机模式（先登录账号）") + '</span></div>' +
         '<div class="set-note" style="margin:2px 0 6px">买家 <b>' + s.buyers + '</b> · 消息 <b>' + s.messages + '</b> · 最近保存 <b>' + saved + '</b></div>' +
         '<div style="display:flex;align-items:center;gap:6px"><span class="llm-dot ' + (on ? "on" : "") + '"></span><span class="set-note" id="llmStatus" style="flex:1;min-width:0">' + (on ? "AI 已配置 · " + (llm.model || "qwen-plus") : "AI 未配置 · 手动模式") + '</span></div>' +
         '<div class="set-actions" style="margin-top:8px"><button class="set-btn-inline ghost" data-act="cloud-pull">拉取最新</button><button class="set-btn-inline ghost" data-act="test-llm">测试连接</button><button class="set-btn-inline ghost" data-act="adv-toggle" data-target="syncAdvBody">高级设置</button></div>' +
         '<div id="syncAdvBody" style="display:none;margin-top:10px">' +
         '<label class="set-lbl">云服务地址（FC 触发器 URL）</label>' +
         '<input class="set-inp" id="cloudUrl" type="url" placeholder="https://….fcapp.run" value="' + esc(cl.proxyUrl || autoUrl) + '"/>' +
         '<div class="set-actions"><button class="set-btn-inline" data-act="save-cloud">保存</button><button class="set-btn-inline ghost" data-act="cloud-push">上云推送</button></div>' +
         '<div class="set-note" style="margin-bottom:10px">登录状态 30 天有效；身份由服务端会话判定，任何设备登录都只看本人客户</div>' +
         '<div style="border-top:1px dashed #e8dfc8;margin:10px 0"></div>' +
         '<label class="set-lbl">AI Base URL</label>' +
         '<input class="set-inp" id="llmBase" type="url" value="' + esc(llm.baseUrl || DEFAULT_BASE) + '"/>' +
         '<label class="set-lbl">AI Key</label>' +
         '<input class="set-inp" id="llmKey" type="password" placeholder="sk-ws-…（从百炼控制台下载 CSV 里的 apiKey）" value="' + esc(llm.key || "") + '"/>' +
         '<label class="set-lbl">模型</label>' +
         '<select class="set-inp" id="llmModel">' + modelOpts + "</select>" +
         '<div class="set-actions"><button class="set-btn-inline" data-act="save-llm">保存 AI 配置</button></div>' +
         '<div class="set-note">Key 只存这台设备浏览器本地，不上传。配置云同步后 Key 可留空（走云端代理）</div>' +
         "</div>" +
         "</div>" +
         (isAdmin ? '<div class="card card-pad">' +
         '<div class="set-title">数据恢复（管理员应急）</div>' +
         '<div class="set-note">怀疑数据出错（客户/成员丢了）时，恢复到某天的每日快照或异常备份；恢复前系统会自动再备份一次当前状态，恢复后该时间点之后的变更会丢失，建议全员重新登录</div>' +
         '<div class="set-actions" style="margin-top:6px"><button class="set-btn-inline ghost" data-act="recovery-load">查看可恢复点</button></div>' +
         '<div id="recoveryBox"></div>' +
         "</div>" : "") +
         '<div class="card card-pad">' +
         '<div class="set-title">数据备份</div>' +
        '<button class="set-btn" data-act="csv">导出备份（CSV）</button>' +
        '<button class="set-btn" data-act="imp">导入备份（CSV）</button>' +
        '<input type="file" id="impFile" accept=".csv,text/csv" hidden/>' +
        '<button class="set-btn danger" data-act="clear">清空全部买家（真实数据起步）</button>' +
        '<div class="set-note">清空会清除全部客户、跟进与手动记录的消息（LLM 配置保留）。清空后从"＋ 新增"开始录真实客户，建议先导出 CSV 备份</div>' +
        "</div>" +
        '<div class="card card-pad">' +
        '<div class="set-title">关于</div>' +
          '<div class="set-note">谈单舱 DealPilot · B2B 谈单工作台<br/>通道：WhatsApp 过渡模式（官方 wa.me 一键交接）<br/>数据：云端同步（多设备一致）+ 本机缓存</div>' +
          '<div class="set-actions" style="margin-top:10px"><button class="set-btn-inline ghost" data-act="open-manual" style="text-decoration:underline">📖 查看使用手册（长期有效网址）</button></div>' +
        "</div>" +
        "</div>";
    },

     init: function (param, root) {
       root.querySelector('[data-act="back"]').addEventListener("click", function () { App.go("home"); });

        root.querySelector('[data-act="logout"]').addEventListener("click", function () {
          if (confirm("退出当前账号？本机客户数据将清空（云端数据保留，重新登录可恢复）。")) {
            if (window.Auth) Auth.clear();
            location.reload();
          }
        });

        var manualBtn = root.querySelector('[data-act="open-manual"]');
        if (manualBtn) manualBtn.addEventListener("click", function () { window.open("manual.html?v=54", "_blank"); });

       root.querySelector('[data-act="save-name"]').addEventListener("click", function () {
         var stName = Store.getSettings() || {};
         stName.name = root.querySelector("#myName").value.trim();
         Store.saveSettings(stName);
         App.toast("称呼已更新");
       });

       root.querySelector('[data-act="save-persona"]').addEventListener("click", function () {
         var thoughts = root.querySelector("#personaThoughts").value;
         var scripts = root.querySelector("#personaScripts").value;
         Store.savePersona(thoughts, scripts);
         var el2 = root.querySelector("#personaStatus");
         var pp = Store.getPersona();
         if (el2) {
           el2.textContent = pp.updated ? "已训练 · " + new Date(pp.updated).toLocaleString("zh-CN") : "已清空";
           el2.className = "set-note ok";
         }
         var sum = root.querySelector("#personaSummary");
         if (sum) sum.textContent = "已训练 · " + (pp.updated ? new Date(pp.updated).toLocaleString("zh-CN") : "") + (pp.docs && pp.docs.length ? " · " + pp.docs.length + " 份资料" : "");
         App.toast("已保存，AI 生成会自动贴近你的风格");
       });

        /* 话术卡片默认折叠（内容不显露），点标题展开 */
        root.querySelector('[data-act="toggle-persona"]').addEventListener("click", function () {
          var body = root.querySelector("#personaBody");
          body.style.display = body.style.display === "none" ? "block" : "none";
        });

        /* 高级设置折叠（数据同步/智能引擎）：配一次的内容不占首屏 */
        var advBtns = root.querySelectorAll('[data-act="adv-toggle"]');
        for (var ai = 0; ai < advBtns.length; ai++) (function (btn) {
          btn.addEventListener("click", function () {
            var body = root.querySelector("#" + btn.getAttribute("data-target"));
            if (!body) return;
            var open = body.style.display !== "none";
            body.style.display = open ? "none" : "block";
            btn.textContent = open ? "高级设置" : "收起";
          });
        })(advBtns[ai]);

       /* 语音输入：按住说话 → 识别文字追加进对应框 */
       if (window.Voice) {
         Voice.attach(root.querySelector("#micThoughts"), root.querySelector("#personaThoughts"));
         Voice.attach(root.querySelector("#micScripts"), root.querySelector("#personaScripts"));
       }

       /* 资料上传 */
       var docFile = root.querySelector("#docFile");
       root.querySelector('[data-act="add-doc"]').addEventListener("click", function () { docFile.click(); });
        docFile.addEventListener("change", function () {
          var f = docFile.files && docFile.files[0];
          docFile.value = "";
          if (!f) return;
          if (f.size > 3 * 1024 * 1024) { App.toast("资料超过 3MB，请精简后再传"); return; }
          var pp0 = Store.getPersona();
          if ((pp0.docs || []).length >= 10) { App.toast("最多 10 份资料，先删旧的"); return; }
          /* 2026-10-15：先提取文字并给用户看预览，确认后再传——Word/PDF 不再"识别不出来"，上传前就知道 AI 会拿到什么 */
          App.toast("正在提取「" + f.name + "」的文字…");
          DocExtract.extract(f).then(function (content) {
            content = String(content || "").replace(/\u0000/g, "").trim();
            if (content.length < 20) { App.toast("没提取到有效文字：PDF 可能是扫描图片（需转文字版）；Word 请确认是 .docx"); return; }
            if (!confirm("《" + f.name + "》提取到约 " + content.length + " 字，将存为你的训练资料。\n\n预览前 120 字：\n…" + content.slice(0, 120).replace(/\n/g, " ") + "…\n\nAI 每次生成会自动引用最新 3 份资料的前 3000 字。确认上传？")) return;
            Sync.docUpload(f.name, f.size, content).then(function (j) {
              var next = (Store.getPersona().docs || []).filter(function (x) { return x.name !== f.name; });
              next.push({ key: j.key, name: f.name, size: f.size, updated: j.updated || new Date().toISOString(), content: content });
              Store.setPersonaDocs(next);
              root.querySelector("#docList").innerHTML = docRows(next);
              var sum2 = root.querySelector("#personaSummary");
              if (sum2) sum2.textContent = "已训练 · 资料 " + next.length + " 份";
              App.toast("已上传「" + f.name + "」，AI 生成时自动参考");
            }).catch(function (e) { App.toast("上传失败：" + e.message); });
          }).catch(function (e) { App.toast(e.message || "文件提取失败"); });
        });
       root.querySelector("#docList").addEventListener("click", function (e) {
         var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
         if (!t) return;
         var act = t.getAttribute("data-act");
         var dk = t.getAttribute("data-doc");
         var docs = Store.getPersona().docs || [];
         if (act === "del-doc") {
           Sync.docDelete(dk).then(function () {
             Store.setPersonaDocs(docs.filter(function (x) { return x.key !== dk; }));
             root.querySelector("#docList").innerHTML = docRows(Store.getPersona().docs);
             App.toast("已删除");
           }).catch(function (err) { App.toast("删除失败：" + err.message); });
          } else if (act === "view-doc") {
            var d = null;
            docs.forEach(function (x) { if (x.key === dk) d = x; });
            if (d && d.content != null) {
              showDocView(root.querySelector("#docViewBox"), d.name, d.content, activeDocKeys(docs).indexOf(d.key) >= 0);
            } else {
              App.toast("这份资料在当前设备没有缓存内容，换原来上传的设备看");
            }
          }
       });

      function readInputs() {
        var st = Store.getSettings() || {};
        st.llm = st.llm || {};
        st.llm.baseUrl = root.querySelector("#llmBase").value.trim();
        st.llm.key = root.querySelector("#llmKey").value.trim();
        st.llm.model = root.querySelector("#llmModel").value;
        return st;
      }
      function status(msg, ok) {
        var el = root.querySelector("#llmStatus");
        el.textContent = msg;
        el.className = "set-note" + (ok === false ? " err" : ok ? " ok" : "");
      }

      root.querySelector('[data-act="save-llm"]').addEventListener("click", function () {
        Store.saveSettings(readInputs());
        status("已保存 · " + (Store.getSettings().llm.key ? "已配置" : "未填 Key"), true);
        App.toast("引擎配置已保存");
      });

      root.querySelector('[data-act="test-llm"]').addEventListener("click", function () {
        Store.saveSettings(readInputs());
        status("连接中…");
        LLM.test()
          .then(function () { status("连接成功 · 模型 " + (Store.getSettings().llm.model || "qwen-plus") + " 可用", true); App.toast("LLM 连接成功"); })
          .catch(function (e) { status("失败：" + e.message, false); App.toast("连接失败：" + e.message); });
      });

       function readCloud() {
         var st2 = Store.getSettings() || {};
         st2.cloud = {
           proxyUrl: root.querySelector("#cloudUrl").value.trim(),
           token: (st2.cloud && st2.cloud.token) || "" /* 保留旧字段但不再编辑/使用 */
         };
         return st2;
       }
      function cloudStatus(msg, ok) {
        var el = root.querySelector("#cloudStatus");
        el.textContent = msg;
        el.className = "set-note" + (ok === false ? " err" : ok ? " ok" : "");
      }
       root.querySelector('[data-act="save-cloud"]').addEventListener("click", function () {
         Store.saveSettings(readCloud());
         var cl = Store.getSettings().cloud;
         var au2 = window.Auth && Auth.get();
         cloudStatus(cl.proxyUrl && au2 && au2.session ? "已连接 · 变更自动上云" : "未连接 · 当前为单机模式（先登录账号）", true);
         App.toast("云同步配置已保存");
       });

       /* ===== 管理员卡片：成员列表 / 重置密码 / 停用启用（仅 admin 可见可调）===== */
       var adminList = root.querySelector("#adminList");
       if (adminList) {
         function loadAdmin() {
           adminList.innerHTML = '<div class="set-note">加载中…</div>';
           Sync.adminUsers().then(function (j) {
             adminList.innerHTML = j.users.map(function (u) {
               var self = u.name === j.self;
               return '<div class="card set-row" style="margin:0 0 6px;padding:8px 10px">' +
                 '<span class="set-k">' + esc(u.name) + (self ? "（我）" : "") + (u.role === "admin" ? " · 管理员" : "") + (u.disabled ? ' · <b style="color:#e5484d">已停用</b>' : "") + "</span>" +
                 "<b>" + u.buyers + " 客户</b>" +
                   (self ? "" : '<div class="set-actions" style="margin-top:6px;flex-wrap:wrap">' +
                     '<button class="set-btn-inline ghost" data-act="admin-reset" data-name="' + esc(u.name) + '">重置密码</button>' +
                     '<button class="set-btn-inline ghost" data-act="admin-rename" data-name="' + esc(u.name) + '">改名</button>' +
                     '<button class="set-btn-inline ' + (u.disabled ? "" : "danger") + '" data-act="admin-disable" data-name="' + esc(u.name) + '" data-en="' + (u.disabled ? "1" : "0") + '">' + (u.disabled ? "启用" : "停用") + "</button>" +
                     '<button class="set-btn-inline danger" data-act="admin-del" data-name="' + esc(u.name) + '" data-buyers="' + (u.buyers || 0) + '">删除</button>' +
                     '<button class="set-btn-inline ghost" data-act="admin-role" data-name="' + esc(u.name) + '" data-role="' + (u.role === "admin" ? "rep" : "admin") + '">' + (u.role === "admin" ? "取消管理员" : "设为管理员") + "</button>" +
                     "</div>") +
                  "</div>";
             }).join("");
           }).catch(function (e) {
             adminList.innerHTML = '<div class="set-note" style="color:#e5484d">' + esc(e.message) + "</div>";
           });
         }
         adminList.addEventListener("click", function (e) {
           var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
           if (!t) return;
           var nm = t.getAttribute("data-name");
           if (t.getAttribute("data-act") === "admin-reset") {
             var np = prompt("给「" + nm + "」设置新密码（至少 6 位，且同时包含字母和数字）：");
             if (np == null) return;
             if (np.length < 6 || !/[a-zA-Z]/.test(np) || !/[0-9]/.test(np)) { App.toast("密码需至少 6 位且同时包含字母和数字"); return; }
             var np2 = prompt("再输入一次确认：");
             if (np2 !== np) { App.toast("两次输入不一致"); return; }
             if (!confirm("确定重置？对方旧密码立即作废，所有已登录设备会被强制重新登录。")) return;
             Sync.adminResetPassword(nm, np).then(function () {
               App.toast("已重置「" + nm + "」的密码");
               loadAdmin();
             }).catch(function (err) { App.toast("操作失败：" + err.message); });
           } else if (t.getAttribute("data-act") === "admin-disable") {
             var en = t.getAttribute("data-en") === "1";
             var msg = en ? "确定启用「" + nm + "」？启用后对方可正常登录。"
               : "确定停用「" + nm + "」？停用后对方立即不能登录和同步（数据保留，随时可恢复）。";
              if (!confirm(msg)) return;
              Sync.adminToggleDisable(nm, en).then(function () {
                App.toast(en ? "已启用「" + nm + "」" : "已停用「" + nm + "」");
                loadAdmin();
              }).catch(function (err) { App.toast("操作失败：" + err.message); });
             } else if (t.getAttribute("data-act") === "admin-role") {
               var toAdmin = t.getAttribute("data-role") === "admin";
               var msg2 = toAdmin ? "确定让「" + nm + "」成为管理员？他将能管理成员和团队公共资料。"
                 : "确定取消「" + nm + "」的管理员权限？他仍可正常使用账号，只是看不到管理功能。";
               if (!confirm(msg2)) return;
               Sync.adminSetRole(nm, toAdmin ? "admin" : "rep").then(function () {
                 App.toast(toAdmin ? "「" + nm + "」已是管理员" : "「" + nm + "」已取消管理员");
                 loadAdmin();
               }).catch(function (err) { App.toast("操作失败：" + err.message); });
             } else if (t.getAttribute("data-act") === "admin-rename") {
               /* 2026-10-15：登录账号改名（密码与全部客户数据保留），对方旧会话失效 */
               var nn = prompt("把「" + nm + "」的登录账号名改成（1-20 字；密码和全部数据保持不变）：");
               if (nn == null) return;
               nn = nn.trim();
               if (!nn || nn.length > 20) { App.toast("姓名需 1-20 字"); return; }
               if (nn.toLowerCase() === nm.toLowerCase()) { App.toast("新名字和原来一样"); return; }
               if (!confirm("确定把「" + nm + "」改名为「" + nn + "」？\n· 密码不变，客户数据全部保留\n· 对方旧登录立即失效，需用新名字重新登录")) return;
               Sync.adminRename(nm, nn).then(function () {
                 App.toast("已改名：" + nm + " → " + nn);
                 loadAdmin();
               }).catch(function (err) { App.toast("操作失败：" + err.message); });
             } else if (t.getAttribute("data-act") === "admin-del") {
               var bc = t.getAttribute("data-buyers") || "0";
               if (!confirm("删除成员「" + nm + "」？\n· 对方立即不能登录\n· 名下 " + bc + " 个客户的数据归档 30 天（可找管理员恢复），30 天后彻底删除\n· 只是想让他不能登录的话，「停用」更安全")) return;
               if (!confirm("再次确认：删除「" + nm + "」及其客户数据（30 天归档期）？")) return;
               Sync.adminDelete(nm).then(function () {
                 App.toast("已删除「" + nm + "」（数据归档 30 天）");
                 loadAdmin();
               }).catch(function (err) { App.toast("操作失败：" + err.message); });
             }
           });
           /* 2026-10-15：管理员直接开号（免团队口令） */
           var addBtn = root.querySelector('[data-act="admin-add"]');
           if (addBtn) addBtn.addEventListener("click", function () {
             var anEl = root.querySelector("#addName"), apEl = root.querySelector("#addPass");
             var an = (anEl.value || "").trim(), ap = (apEl.value || "").trim();
             if (!an || an.length > 20) { App.toast("请输入成员姓名（1-20 字）"); return; }
             if (ap.length < 6 || !/[a-zA-Z]/.test(ap) || !/[0-9]/.test(ap)) { App.toast("密码需至少 6 位且同时包含字母和数字"); return; }
             var ar = root.querySelector("#addRole").value;
             if (!confirm("增加成员「" + an + "」（" + (ar === "admin" ? "管理员" : "业务员") + "）？\n对方用 姓名「" + an + "」+ 你设置的初始密码登录。")) return;
             Sync.adminAdd(an, ap, ar).then(function () {
               App.toast("已增加「" + an + "」");
               anEl.value = ""; apEl.value = "";
               loadAdmin();
             }).catch(function (err) { App.toast("操作失败：" + err.message); });
           });
           loadAdmin();

          /* ===== 团队公共资料：管理员上传一次，所有人 AI 生成自动引用 ===== */
          var sharedListEl = root.querySelector("#sharedList");
          var sharedPreview = root.querySelector("#sharedPreview");
          var sharedFile = root.querySelector("#sharedFile");
          if (sharedListEl) {
            function loadShared() {
              sharedListEl.innerHTML = '<div class="set-note">加载中…</div>';
              sharedPreview.innerHTML = "";
              Sync.sharedList().then(function (j) {
                var docs = j.docs || [];
                var rev = docs.slice().reverse(); /* 新→旧 */
                sharedListEl.innerHTML = rev.length ? rev.map(function (d, idx) {
                  /* 2026-10-16 扩容：上限按产品线分桶（行李箱/宠物/通用各 10 份），徽章按本桶内新旧排序判定 */
                  var bucketPos = 0;
                  for (var p = 0; p < idx; p++) if ((rev[p].scope || "all") === (d.scope || "all")) bucketPos++;
                   var badge = bucketPos < 10 ? '<span class="doc-badge on">AI 生效中</span>' : '<span class="doc-badge off">存档</span>';
                   var pinB = d.pin ? ' <span class="doc-badge on">置顶</span>' : "";
                   var typeB = d.type === "script" ? ' <span class="doc-badge on">话术 ' + ((d.steps || []).length) + ' 步</span>' : "";
                   var scopeB = ' <span class="doc-badge off">' + (SCOPE_LABEL[d.scope] || "通用") + "</span>";
                   return '<div class="card set-row" style="margin:0 0 6px;padding:8px 10px">' +
                     "<span>" + pinB + badge + typeB + scopeB + " " + esc(d.name) + ' <span class="set-note">' + Math.round(d.size / 1024) + "KB</span></span>" +
                     '<div class="set-actions" style="margin-top:6px">' +
                     '<button class="set-btn-inline ghost" data-act="shared-pin" data-key="' + esc(d.key) + '" data-pin="' + (d.pin ? "1" : "0") + '">' + (d.pin ? "取消置顶" : "📌 置顶") + "</button>" +
                     '<button class="set-btn-inline ghost" data-act="shared-view" data-key="' + esc(d.key) + '" data-name="' + esc(d.name) + '">查看</button>' +
                     '<button class="set-btn-inline danger" data-act="shared-del" data-key="' + esc(d.key) + '" data-name="' + esc(d.name) + '">删除</button>' +
                     "</div></div>";
                }).join("") : '<div class="set-note">还没有公共资料。上传后所有人的 AI 都会引用（公司简介/付款方式/通用认证等放这里最合适）</div>';
              }).catch(function (e) {
                sharedListEl.innerHTML = '<div class="set-note" style="color:#e5484d">' + esc(e.message) + "</div>";
              });
            }
            sharedListEl.addEventListener("click", function (e) {
              var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
              if (!t) return;
              var k = t.getAttribute("data-key"), nm = t.getAttribute("data-name");
                if (t.getAttribute("data-act") === "shared-view") {
                  /* 2026-10-15 P0（H4）：/shared 对所有人只回元数据；管理员查看正文走 sharedRaw（?raw=1） */
                  Sync.sharedRaw().then(function (j) {
                    var d = (j.docs || []).filter(function (x) { return x.key === k; })[0];
                    if (!d) { App.toast("资料不存在"); return; }
                    sharedPreview.innerHTML = "";
                    showDocView(sharedPreview, d.name, d.content || "（该资料无正文）", true);
                  }).catch(function (err) { App.toast("读取失败：" + err.message); });
               } else if (t.getAttribute("data-act") === "shared-pin") {
                 var isPinned = t.getAttribute("data-pin") === "1";
                 Sync.sharedPin(k, !isPinned).then(function () {
                   App.toast(isPinned ? "已取消置顶「" + nm + "」" : "已置顶「" + nm + "」：AI 生成时永远优先带上它");
                   loadShared();
                 }).catch(function (err) { App.toast("操作失败：" + err.message); });
               } else if (t.getAttribute("data-act") === "shared-del") {
                 if (!confirm("确定删除公共资料「" + nm + "」？所有人的 AI 将不再引用它。")) return;
                 Sync.sharedDelete(k).then(function () {
                   App.toast("已删除「" + nm + "」");
                   loadShared();
                 }).catch(function (err) { App.toast("删除失败：" + err.message); });
               }
            });
            root.querySelector('[data-act="shared-upload"]').addEventListener("click", function () { sharedFile.click(); });
            sharedFile.addEventListener("change", function () {
              var f = sharedFile.files && sharedFile.files[0];
              sharedFile.value = "";
              if (!f) return;
              if (f.size > 3 * 1024 * 1024) { App.toast("文件超过 3MB"); return; }
              App.toast("正在提取「" + f.name + "」的文字…");
              DocExtract.extract(f).then(function (content) {
                content = String(content || "").replace(/\u0000/g, "").trim();
                if (content.length < 20) { App.toast("没提取到有效文字：PDF 可能是扫描图片（需转文字版）；Word 请确认是 .docx"); return; }
                 var sc = (root.querySelector("#sharedScope") || {}).value || "all";
                  if (!confirm("将上传《" + f.name + "》为团队公共资料（" + (SCOPE_LABEL[sc] || "通用") + "；提取到约 " + content.length + " 字）：之后所有" + (sc === "all" ? "" : (SCOPE_LABEL[sc] || "该") + "客户") + "的 AI 生成都会引用它（前 12,000 字，每产品线最多 10 份）。\n\n预览前 120 字：\n…" + content.slice(0, 120).replace(/\n/g, " ") + "…\n\n确认？")) return;
                 Sync.sharedUpload(f.name, content, null, sc).then(function () {
                   App.toast("已上传公共资料「" + f.name + "」，全员 AI 立即生效");
                   loadShared();
                 }).catch(function (err) { App.toast("上传失败：" + err.message); });
               }).catch(function (e) { App.toast(e.message || "文件提取失败"); });
             });
             /* ===== 话术剧本（2026-10-15）：上传 → 自动拆步 → 可编辑确认 → 保存 ===== */
             var scriptFile = root.querySelector("#scriptFile");
             var scriptDraft = root.querySelector("#scriptDraft");
             function renderScriptDraft(baseName, steps) {
               scriptDraft.innerHTML =
                 '<div class="card" style="margin-top:10px;padding:10px 12px">' +
                 "<b style='font-size:13px'>📜 确认剧本步骤（标题/文字都可以改）</b>" +
                 '<div class="set-note" style="margin:4px 0 8px">按「一…五」自动拆出 ' + steps.length + " 步。保存后业务员在客户页可一步步发给客户。</div>" +
                 '<label class="set-lbl">剧本名称</label>' +
                 '<input class="set-inp" id="scriptName" type="text" maxlength="60" value="' + esc(baseName) + '"/>' +
                 '<label class="set-lbl">产品线（客户页按此匹配显示）</label>' +
                 '<select class="set-inp" id="scriptScope"><option value="suitcase">电动行李箱</option><option value="pet">宠物产品</option><option value="all">通用（所有客户）</option></select>' +
                 '<div id="scriptSteps" style="margin-top:8px">' + steps.map(function (s, i) {
                   return '<div class="script-draft-step" style="margin-bottom:8px">' +
                     '<div style="display:flex;gap:6px;align-items:center">' +
                     "<b style='flex:none;font-size:12px'>" + (i + 1) + ".</b>" +
                     '<input class="set-inp sd-title" type="text" maxlength="40" value="' + esc(s.title) + '" style="flex:1"/>' +
                     "</div>" +
                     '<textarea class="set-inp sd-text" rows="4" style="margin-top:6px;font-family:inherit;line-height:1.6">' + esc(s.text) + "</textarea>" +
                     "</div>";
                 }).join("") + "</div>" +
                 '<div class="set-actions" style="display:flex;gap:8px"><button class="set-btn" data-act="save-script" style="flex:1">保存剧本（全员可用）</button><button class="set-btn-inline ghost" data-act="cancel-script">取消</button></div>' +
                 "</div>";
               scriptDraft.querySelector('[data-act="cancel-script"]').addEventListener("click", function () { scriptDraft.innerHTML = ""; });
               scriptDraft.querySelector('[data-act="save-script"]').addEventListener("click", function () {
                 var nm = scriptDraft.querySelector("#scriptName").value.trim();
                 var sc = scriptDraft.querySelector("#scriptScope").value;
                 var ss = [];
                 scriptDraft.querySelectorAll(".script-draft-step").forEach(function (el, i) {
                   var t = el.querySelector(".sd-title").value.trim() || ("第 " + (i + 1) + " 步");
                   var x = el.querySelector(".sd-text").value.trim();
                   if (x) ss.push({ title: t, text: x });
                 });
                 if (!nm || !ss.length) { App.toast("名称和步骤都要有内容"); return; }
                 var full = ss.map(function (s) { return s.title + "\n" + s.text; }).join("\n\n");
                 Sync.sharedUpload(nm, full, ss, sc).then(function () {
                   App.toast("剧本「" + nm + "」已保存（" + ss.length + " 步 · " + (SCOPE_LABEL[sc] || "通用") + "），业务员客户页立即可用");
                   scriptDraft.innerHTML = "";
                   loadShared();
                 }).catch(function (err) { App.toast("保存失败：" + err.message); });
               });
             }
             if (scriptFile) {
               root.querySelector('[data-act="shared-upload-script"]').addEventListener("click", function () { scriptFile.click(); });
               scriptFile.addEventListener("change", function () {
                 var f = scriptFile.files && scriptFile.files[0];
                 scriptFile.value = "";
                 if (!f) return;
                 if (f.size > 3 * 1024 * 1024) { App.toast("文件超过 3MB"); return; }
                 App.toast("正在提取「" + f.name + "」并自动拆步…");
                 DocExtract.extract(f).then(function (content) {
                   content = String(content || "").replace(/\u0000/g, "").trim();
                   if (content.length < 20) { App.toast("没提取到有效文字：Word 请确认是 .docx"); return; }
                   renderScriptDraft(String(f.name).replace(/\.[^.]+$/, ""), DocExtract.splitScript(content));
                 }).catch(function (e) { App.toast(e.message || "文件提取失败"); });
               });
             }
              loadShared();
              /* ===== 数据恢复（2026-10-15 P0，S1 配套）：列出异常备份+每日快照，二次确认后恢复 ===== */
              var recoveryBox = root.querySelector("#recoveryBox");
              var recoveryBtn = root.querySelector('[data-act="recovery-load"]');
              if (recoveryBox && recoveryBtn) {
                recoveryBtn.addEventListener("click", function () {
                  recoveryBox.innerHTML = '<div class="set-note">加载中…</div>';
                  Sync.adminRecovery().then(function (j) {
                    var rows = [];
                    (j.backups || []).forEach(function (b) {
                      rows.push({ obj: b.obj, label: "异常备份 · " + new Date(Number(b.at) || 0).toLocaleString("zh-CN"), bytes: b.bytes || 0 });
                    });
                    (j.snapshots || []).forEach(function (s) {
                      rows.push({ obj: s.obj, label: "每日快照 · " + s.day, bytes: s.bytes || 0 });
                    });
                    if (!rows.length) {
                      recoveryBox.innerHTML = '<div class="set-note" style="margin-top:6px">暂无可用备份点（每日快照在当天第一次数据写入前自动生成，保留 30 天）</div>';
                      return;
                    }
                    recoveryBox._rows = rows;
                    recoveryBox.innerHTML = '<div style="margin-top:6px">' + rows.map(function (r, i) {
                      return '<div class="card set-row" style="margin:0 0 6px;padding:8px 10px">' +
                        "<span class='set-k'>" + esc(r.label) + " <span class='set-note'>" + Math.round(r.bytes / 1024) + "KB</span></span>" +
                        '<div class="set-actions" style="margin-top:6px"><button class="set-btn-inline danger" data-act="recovery-restore" data-i="' + i + '">恢复到此点</button></div>' +
                        "</div>";
                    }).join("") + "</div>";
                  }).catch(function (e) {
                    recoveryBox.innerHTML = '<div class="set-note" style="color:#e5484d;margin-top:6px">' + esc(e.message) + "</div>";
                  });
                });
                recoveryBox.addEventListener("click", function (e) {
                  var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
                  if (!t || t.getAttribute("data-act") !== "recovery-restore") return;
                  var r = (recoveryBox._rows || [])[Number(t.getAttribute("data-i"))];
                  if (!r) return;
                  if (!confirm("恢复到「" + r.label + "」？\n· 恢复前会自动再备份一次当前状态\n· 该时间点之后的所有变更（新客户、消息、成员变动）都会丢失\n· 恢复后建议全员重新登录")) return;
                  if (!confirm("再次确认：确定恢复到该时间点？")) return;
                  Sync.adminRestore(r.obj).then(function (j) {
                    App.toast("已恢复（账号 " + (j.users || 0) + " 个），正在重新加载…");
                    location.reload();
                  }).catch(function (err) { App.toast("恢复失败：" + err.message); });
                });
              }
           }
         }
       root.querySelector('[data-act="cloud-pull"]').addEventListener("click", function () {
        Store.saveSettings(readCloud());
        cloudStatus("拉取中…");
        Sync.pull().then(function (server) {
          if (!server) { cloudStatus("云端还是空的（先在任一设备点\"上云推送\"建立基线）"); return; }
          /* 修复（审计 M3）：与启动拉取同口径，用云端版本号比较 */
          var localAt = (Store.getServerAt && Store.getServerAt()) || "";
          cloudStatus("云端最新：" + server.buyers.length + " 买家 · " + new Date(server.updatedAt).toLocaleString("zh-CN"));
          if (server.updatedAt > localAt) {
            Store.applySnapshot(server);
            App.refresh();
            App.toast("已拉取最新团队数据");
          } else {
            App.toast("本地已是最新");
          }
        }).catch(function (e) { cloudStatus("拉取失败：" + e.message, false); });
      });
      root.querySelector('[data-act="cloud-push"]').addEventListener("click", function () {
        Store.saveSettings(readCloud());
        cloudStatus("推送中…");
        Sync.pushNow().then(function (j) {
          cloudStatus("已上云 · " + j.buyers + " 买家 / " + j.followups + " 待办 · " + new Date(j.updatedAt).toLocaleString("zh-CN"), true);
          App.toast("已上云");
        }).catch(function (e) { cloudStatus("推送失败：" + e.message, false); });
      });

      root.querySelector('[data-act="csv"]').addEventListener("click", function () {
        Store.exportCSV();
        App.toast("备份已导出");
      });
      var fileEl = root.querySelector("#impFile");
      root.querySelector('[data-act="imp"]').addEventListener("click", function () { fileEl.click(); });
      fileEl.addEventListener("change", function () {
        var f = fileEl.files && fileEl.files[0];
        if (!f) return;
        Store.importCSV(f, function (n) {
          if (n < 0) App.toast("导入失败：文件格式不正确");
          else { App.toast(n > 0 ? "已导入 " + n + " 条消息" : "导入完成（无新增消息）"); App.refresh(); }
          fileEl.value = "";
        });
      });
      root.querySelector('[data-act="clear"]').addEventListener("click", function () {
        if (confirm("清空全部买家与跟进？此操作不可撤销，建议先点\"导出备份（CSV）\"。")) {
          Store.clearAll();
          App.refresh();
          App.toast("已清空，从\"买家 → ＋ 新增\"开始");
        }
      });
    }
  };
})();
