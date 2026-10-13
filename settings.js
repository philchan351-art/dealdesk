/* ===== 页面：设置（数据 / 备份 / LLM 引擎配置） ===== */
(function () {
  "use strict";
  window.Screens = window.Screens || {};

  var DEFAULT_BASE = "https://llm-mackvrkxyhgmoftm.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

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
      var cloudOn = !!(cl.proxyUrl && cl.token);
      var on = !!(llm.key && llm.baseUrl) || cloudOn;

      var modelOpts = (window.LLM ? LLM.MODELS : ["qwen-plus"]).map(function (m) {
        return "<option" + (m === (llm.model || "qwen-plus") ? " selected" : "") + ">" + m + "</option>";
      }).join("");

       var au = window.Auth && Auth.get();
       return '<div class="topbar">' +
         '<div class="tb-back" data-act="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></div>' +
         '<div class="tb-title"><h1>设置</h1><div class="tb-sub">数据 · 备份 · 智能引擎</div></div>' +
         "</div>" +
         '<div class="set-stack">' +
         '<div class="card card-pad">' +
         '<div class="set-title">当前账号</div>' +
         '<div class="card set-row"><span class="set-k">业务员</span><b>' + (au ? au.name : "未登录") + "</b></div>" +
         '<div class="set-actions"><button class="set-btn-inline danger" data-act="logout">切换账号 / 退出登录</button></div>' +
         '<div class="set-note">退出后本机数据清空并回到登录页；你的客户数据安全存在云端，重新登录即可恢复。每个账号只看自己的客户</div>' +
         "</div>" +
         '<div class="card card-pad">' +
         '<div class="set-title">我的称呼</div>' +
        '<label class="set-lbl">你的名字（首页问候用 · 只存本机）</label>' +
        '<input class="set-inp" id="myName" type="text" maxlength="20" placeholder="如 Cherry" value="' + (st.name || "Cherry") + '"/>' +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-name">保存</button></div>' +
        '<div class="set-note">每人各填各的，只保存在这台设备，不会同步给别人</div>' +
        "</div>" +
        '<div class="card card-pad">' +
        '<div class="set-title">我的思路与话术（训练 AI）<span class="llm-dot ' + (personaOn ? "on" : "") + '"></span></div>' +
        '<label class="set-lbl">我的谈单思路（你怎么谈、先问什么、什么节奏）</label>' +
        '<textarea class="set-inp" id="personaThoughts" maxlength="4000" style="min-height:90px;padding:10px;font-family:inherit;line-height:1.5" placeholder="如：我先确认客户的用途和采购量，再报阶梯价；习惯先寄样品建立信任，不急着让下大单…">' + (p.thoughts || "") + "</textarea>" +
        '<label class="set-lbl">我的常用话术（你习惯怎么开头、怎么报价、怎么催单）</label>' +
        '<textarea class="set-inp" id="personaScripts" maxlength="6000" style="min-height:110px;padding:10px;font-family:inherit;line-height:1.5" placeholder="如：常用开头 Hi, thanks for your inquiry… ；报价时一定附交期和起订量；催单就说 the price is valid till end of this week…">' + (p.scripts || "") + "</textarea>" +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-persona">保存并训练 AI</button></div>' +
        '<div class="set-note" id="personaStatus">' + (p.updated ? "已训练 · " + new Date(p.updated).toLocaleString("zh-CN") : "还没训练 · AI 暂用通用风格") + "</div>" +
        '<div class="set-note">每个业务员各填各的，按账号单独保存在云端，互不串味；保存后 AI 翻译、扩充、回复建议都会自动贴近你的思路和语气</div>' +
        "</div>" +
        '<div class="card card-pad">' +
        '<div class="set-title">智能引擎（LLM）<span class="llm-dot ' + (on ? "on" : "") + '"></span></div>' +
        '<label class="set-lbl">Base URL</label>' +
        '<input class="set-inp" id="llmBase" type="url" value="' + (llm.baseUrl || DEFAULT_BASE) + '"/>' +
        '<label class="set-lbl">API Key</label>' +
        '<input class="set-inp" id="llmKey" type="password" placeholder="sk-ws-…（从百炼控制台下载 CSV 里的 apiKey）" value="' + (llm.key || "") + '"/>' +
        '<label class="set-lbl">模型</label>' +
        '<select class="set-inp" id="llmModel">' + modelOpts + "</select>" +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-llm">保存配置</button><button class="set-btn-inline ghost" data-act="test-llm">测试连接</button></div>' +
        '<div class="set-note" id="llmStatus">' + (on ? "已配置 · 记一条将自动翻译 / 提取字段 / 更新意向分" : "未配置 · 当前为手动模式") + "</div>" +
        '<div class="set-note">Key 只保存在这台设备的浏览器本地（localStorage），不会上传、不会进代码库；随时可在上方重新填写或清空。配置云同步后，本卡 Key 可留空（走云端代理）</div>' +
        "</div>" +
        '<div class="card card-pad">' +
        '<div class="set-title">云同步（团队多设备）<span class="llm-dot ' + (cloudOn ? "on" : "") + '"></span></div>' +
        '<label class="set-lbl">云服务地址（FC 触发器 URL）</label>' +
        '<input class="set-inp" id="cloudUrl" type="url" placeholder="https://….fcapp.run（部署指引：server/FC部署指引.md）" value="' + (cl.proxyUrl || autoUrl) + '"/>' +
        '<label class="set-lbl">团队口令（token）</label>' +
        '<input class="set-inp" id="cloudToken" type="password" value="' + (cl.token || "") + '"/>' +
        '<div class="set-actions"><button class="set-btn-inline" data-act="save-cloud">保存</button><button class="set-btn-inline ghost" data-act="cloud-pull">拉取最新</button><button class="set-btn-inline ghost" data-act="cloud-push">上云推送</button></div>' +
        '<div class="set-note" id="cloudStatus">' + (cloudOn ? "已配置 · 变更 2.5 秒自动上云，开 App 自动拉取" : "未配置 · 当前为单机模式") + "</div>" +
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
         var el = root.querySelector("#personaStatus");
         var pp = Store.getPersona();
         if (el) {
           el.textContent = pp.updated ? "已训练 · " + new Date(pp.updated).toLocaleString("zh-CN") : "已清空";
           el.className = "set-note ok";
         }
         App.toast("已保存，AI 生成会自动贴近你的风格");
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
          token: root.querySelector("#cloudToken").value.trim()
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
        cloudStatus(cl.proxyUrl && cl.token ? "已配置 · 变更自动上云" : "未配置 · 当前为单机模式", true);
        App.toast("云同步配置已保存");
      });
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
