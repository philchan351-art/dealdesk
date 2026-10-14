/* ===== 页面：设置（数据 / 备份 / LLM 引擎配置） ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  var DEFAULT_BASE = "https://llm-mackvrkxyhgmoftm.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function docRows(docs) {
    if (!docs.length) return '<div class="set-note">还没有资料</div>';
    return docs.map(function (d) {
      var kb = Math.round((d.size || 0) / 1024);
      var link = (d.content != null) ? ' · <a data-act="view-doc" data-doc="' + esc(d.key) + '" style="color:var(--brand)">看</a>' : "";
      return '<div class="set-note">' + esc(d.name || d.key) + "（" + kb + "KB" + link + '）<a data-act="del-doc" data-doc="' + esc(d.key) + '" style="color:#e5484d">删除</a></div>';
    }).join("");
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
         '<div class="tb-title"><h1>设置</h1><div class="tb-sub">数据 · 备份 · 智能引擎</div></div>' +
         "</div>" +
         '<div class="set-stack">' +
         '<div class="card card-pad">' +
          '<div class="set-title">当前账号</div>' +
          '<div class="card set-row"><span class="set-k">业务员</span><b>' + esc(au ? au.name : "未登录") + (au && au.role === "admin" ? " · 管理员" : "") + "</b></div>" +
          '<div class="set-actions"><button class="set-btn-inline danger" data-act="logout">切换账号 / 退出登录</button></div>' +
          '<div class="set-note">退出后本机数据清空并回到登录页；你的客户数据安全存在云端，重新登录即可恢复。每个账号只看自己的客户</div>' +
          "</div>" +
          (isAdmin ? '<div class="card card-pad">' +
          '<div class="set-title">团队成员（管理员）</div>' +
          '<div id="adminList"><div class="set-note">加载中…</div></div>' +
          '<div class="set-note">重置密码：对方旧密码立即作废，下次登录用新密码。停用：对方立即不能登录/同步（数据保留，随时可启用）。新成员注册时把团队口令告诉他（在服务器端设置，不显示在这里）</div>' +
          "</div>" : "") +
         '<div class="card card-pad">' +
         '<div class="set-title">我的称呼</div>' +
        '<label class="set-lbl">你的名字（首页问候用 · 只存本机）</label>' +
        '<input class="set-inp" id="myName" type="text" maxlength="20" placeholder="如 Cherry" value="' + esc(st.name || "Cherry") + '"/>' +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-name">保存</button></div>' +
        '<div class="set-note">每人各填各的，只保存在这台设备，不会同步给别人</div>' +
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
        '<input type="file" id="docFile" accept=".txt,.md,.csv,.json,.html,.htm" style="display:none"/>' +
        '<div class="set-actions"><button class="set-btn-inline" data-act="add-doc">＋ 上传资料</button></div>' +
        '<div class="set-note">单个不超过 3MB，最多 10 份；纯文本类（.txt / .md / .csv / .json）</div>' +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-persona">保存并训练 AI</button></div>' +
        '<div class="set-note" id="personaStatus">' + (p.updated ? "已训练 · " + new Date(p.updated).toLocaleString("zh-CN") : "还没训练 · AI 暂用通用风格") + "</div>" +
        '<div class="set-note">每个业务员各填各的，按账号单独保存在云端，互不串味；保存后 AI 翻译、扩充、回复建议都会自动贴近你的思路和语气</div>' +
        "</div>" +
        "</div>" +
        '<div class="card card-pad">' +
        '<div class="set-title">智能引擎（LLM）<span class="llm-dot ' + (on ? "on" : "") + '"></span></div>' +
        '<label class="set-lbl">Base URL</label>' +
        '<input class="set-inp" id="llmBase" type="url" value="' + esc(llm.baseUrl || DEFAULT_BASE) + '"/>' +
        '<label class="set-lbl">API Key</label>' +
        '<input class="set-inp" id="llmKey" type="password" placeholder="sk-ws-…（从百炼控制台下载 CSV 里的 apiKey）" value="' + esc(llm.key || "") + '"/>' +
        '<label class="set-lbl">模型</label>' +
        '<select class="set-inp" id="llmModel">' + modelOpts + "</select>" +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-llm">保存配置</button><button class="set-btn-inline ghost" data-act="test-llm">测试连接</button></div>' +
        '<div class="set-note" id="llmStatus">' + (on ? "已配置 · 记一条将自动翻译 / 提取字段 / 更新意向分" : "未配置 · 当前为手动模式") + "</div>" +
        '<div class="set-note">Key 只保存在这台设备的浏览器本地（localStorage），不会上传、不会进代码库；随时可在上方重新填写或清空。配置云同步后，本卡 Key 可留空（走云端代理）</div>' +
        "</div>" +
        '<div class="card card-pad">' +
        '<div class="set-title">云同步（团队多设备）<span class="llm-dot ' + (cloudOn ? "on" : "") + '"></span></div>' +
        '<label class="set-lbl">云服务地址（FC 触发器 URL）</label>' +
        '<input class="set-inp" id="cloudUrl" type="url" placeholder="https://….fcapp.run" value="' + esc(cl.proxyUrl || autoUrl) + '"/>' +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-cloud">保存</button><button class="set-btn-inline ghost" data-act="cloud-pull">拉取最新</button><button class="set-btn-inline ghost" data-act="cloud-push">上云推送</button></div>' +
        '<div class="set-note" id="cloudStatus">' + (cloudOn ? "已连接 · 变更 2.5 秒自动上云，开 App 自动拉取" : "未连接 · 当前为单机模式（先登录账号）") + "</div>" +
        "<div class=\"set-note\">登录状态 30 天有效；身份由服务端会话判定，任何设备登录都只看本人客户</div>" +
        "</div>" +
        '<div class="card set-row"><span class="set-k">买家档案</span><b>' + s.buyers + "</b></div>" +
        '<div class="card set-row"><span class="set-k">已记录消息</span><b>' + s.messages + "</b></div>" +
        '<div class="card set-row"><span class="set-k">最近保存</span><b class="set-time">' + saved + "</b></div>" +
        '<div class="card card-pad">' +
        '<div class="set-title">数据备份</div>' +
        '<button class="set-btn" data-act="csv">导出备份（CSV）</button>' +
        '<button class="set-btn" data-act="imp">导入备份（CSV）</button>' +
        '<input type="file" id="impFile" accept=".csv,text/csv" hidden/>' +
        '<button class="set-btn danger" data-act="reset">恢复示例数据</button>' +
        '<button class="set-btn danger" data-act="clear">清空全部买家（真实数据起步）</button>' +
        '<div class="set-note">恢复/清空都会清除手动记录的消息、沉淀字段与意向分变动（LLM 配置保留）。清空后从"＋ 新增"开始录真实客户，建议先导出 CSV 备份</div>' +
        "</div>" +
        '<div class="card card-pad">' +
        '<div class="set-title">关于</div>' +
        '<div class="set-note">DealDesk 谈单工作台 · MVP H5 · v0.3（W2：LLM 管线）<br/>通道：WhatsApp 过渡模式（官方 wa.me 一键交接）<br/>数据：本机 localStorage（方案 A）</div>' +
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
         if (!/\.(txt|md|csv|json|html|htm)$/i.test(f.name)) { App.toast("只支持纯文本类文件（.txt/.md/.csv/.json）"); return; }
         if (f.size > 3 * 1024 * 1024) { App.toast("资料超过 3MB，请精简后再传"); return; }
         var pp0 = Store.getPersona();
         if ((pp0.docs || []).length >= 10) { App.toast("最多 10 份资料，先删旧的"); return; }
         var rd = new FileReader();
         rd.onload = function () {
           var content = String(rd.result || "");
           App.toast("上传中…");
           Sync.docUpload(f.name, f.size, content).then(function (j) {
             var next = (Store.getPersona().docs || []).filter(function (x) { return x.name !== f.name; });
             next.push({ key: j.key, name: f.name, size: f.size, updated: j.updated || new Date().toISOString(), content: content });
             Store.setPersonaDocs(next);
             root.querySelector("#docList").innerHTML = docRows(next);
             var sum2 = root.querySelector("#personaSummary");
             if (sum2) sum2.textContent = "已训练 · 资料 " + next.length + " 份";
             App.toast("已上传「" + f.name + "」，AI 生成时自动参考");
           }).catch(function (e) { App.toast("上传失败：" + e.message); });
         };
         rd.onerror = function () { App.toast("文件读取失败"); };
         rd.readAsText(f);
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
             var u = URL.createObjectURL(new Blob([d.content], { type: "text/plain;charset=utf-8" }));
             window.open(u, "_blank");
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
                   '<button class="set-btn-inline ' + (u.disabled ? "" : "danger") + '" data-act="admin-disable" data-name="' + esc(u.name) + '" data-en="' + (u.disabled ? "1" : "0") + '">' + (u.disabled ? "启用" : "停用") + "</button>" +
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
           }
         });
         loadAdmin();
       }
      root.querySelector('[data-act="cloud-pull"]').addEventListener("click", function () {
        Store.saveSettings(readCloud());
        cloudStatus("拉取中…");
        Sync.pull().then(function (server) {
          if (!server) { cloudStatus("云端还是空的（先在任一设备点\"上云推送\"建立基线）"); return; }
          var localAt = Store.snapshot().updatedAt || "";
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
      root.querySelector('[data-act="reset"]').addEventListener("click", function () {
        if (confirm("恢复示例数据？手动记录的记录将清除（LLM 配置保留）。")) Store.reset();
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
