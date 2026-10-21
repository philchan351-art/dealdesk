/* ===== 云同步：变更自动上云（2.5s 防抖）+ 启动/手动拉取 =====
 * P0（2026-10-13）：身份改为服务端会话。登录成功后拿到 session，
 * 之后所有请求带 x-dealdesk-session；服务端不再接受客户端自报 key（旧 ?key= 全部移除）。
 * 团队口令只剩一个用途：新账号创建（注册），且不再持久化保存。
 */
(function () {
  "use strict";

  var timer = null;

  function cfg() {
    var s = Store.getSettings();
    return (s && s.cloud) || null;
  }
  function session() {
    var a = window.Auth && Auth.get();
    return (a && a.session) || "";
  }
  function headers(extra) {
    var h = { "Content-Type": "application/json" };
    var s = session();
    if (s) h["x-dealdesk-session"] = s;
    return Object.assign(h, extra || {});
  }
  function url(p) {
    return cfg().proxyUrl.replace(/\/+$/, "") + p;
  }
  /* 统一响应处理：401=会话失效（触发重新登录），403=无权限/已停用，其余按业务 error 抛出 */
  function wrap(r) {
    return r.text().then(function (t) {
      var j = null;
      try { j = JSON.parse(t); } catch (e) { j = null; }
      if (r.status === 401) throw new Error("会话失效，请重新登录");
      if (r.status === 403) throw new Error((j && j.error) || "没有权限");
      if (!j || typeof j !== "object") throw new Error("云服务返回异常（HTTP " + r.status + "）");
      if (j.error) throw new Error(j.error);
      return j;
    });
  }

  var Sync = {
    enabled: function () {
      var c = cfg();
      return !!(c && c.proxyUrl && session());
    },
    /* 会话是否有效（登录流程在还没有 session 时用 proxyUrl 判断） */
    hasCloud: function () {
      var c = cfg();
      return !!(c && c.proxyUrl);
    },
    session: session,
    apiHeaders: headers,
    key: function () {
      var a = window.Auth && Auth.get();
      return (a && a.key) || "";
    },
    dataUrl: function () {
      return url("/data"); /* 身份只来自会话头，不再拼 ?key= */
    },
    authCall: function (name, password, mode, teamToken, timeoutMs) {
      if (!this.hasCloud()) return Promise.reject(new Error("未配置云服务：请展开下方「云服务设置」填地址"));
      if (mode === "register" && !teamToken) return Promise.reject(new Error("创建新账号需要团队口令（找管理员要）"));
      var ctrl = (timeoutMs && typeof AbortController !== "undefined") ? new AbortController() : null;
      var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
      var body = { name: name, password: password, mode: mode };
      if (mode === "register") body.token = teamToken;
      var opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
      if (ctrl) opts.signal = ctrl.signal;
      return fetch(url("/login"), opts)
        .then(function (r) {
          if (to) clearTimeout(to);
          return wrap(r);
        }).catch(function (e) {
          if (to) clearTimeout(to);
          if (e && (e.name === "AbortError" || /abort/i.test(String(e.message)))) throw new Error("连接云服务超时，请检查网络后重试");
          throw e;
        });
    },
    pushNow: function () {
      if (!this.enabled()) return Promise.resolve(null);
      var snap = Store.snapshot();
      var body = { data: snap, clientAt: new Date().toISOString() };
      if (snap && snap.deletedIds && snap.deletedIds.length) body.deletedIds = snap.deletedIds;
      return fetch(this.dataUrl(), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body)
      }).then(function (r) { return wrap(r); });
    },
    push: function () {
      if (!this.enabled()) return;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        self.pushNow().catch(function (e) { console.warn("云同步推送失败：", e.message); });
      }, 2500);
    },
    pull: function () {
      if (!this.enabled()) return Promise.resolve(null);
      return fetch(this.dataUrl(), { headers: headers() })
        .then(function (r) { return wrap(r).then(function (j) { return j.data || null; }); });
    },
    /* ===== 个人训练资料（按账号存云端，供 AI 生成时参考）；身份走会话头，只传 doc ===== */
    docUrl: function (p, docKey) {
      return url(p) + "?doc=" + encodeURIComponent(docKey);
    },
    docUpload: function (name, size, content) {
      if (!this.enabled()) return Promise.reject(new Error("未配置云服务或会话已失效，请重新登录"));
      return fetch(url("/doc/upload"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: name, size: size, content: content })
      }).then(function (r) { return wrap(r); });
    },
    docFetch: function (docKey) {
      if (!this.enabled()) return Promise.reject(new Error("未配置云服务或会话已失效"));
      return fetch(this.docUrl("/doc", docKey), { headers: headers() }).then(function (r) { return wrap(r); });
    },
    docDelete: function (docKey) {
      if (!this.enabled()) return Promise.reject(new Error("未配置云服务或会话已失效"));
      return fetch(this.docUrl("/doc/delete", docKey), { method: "POST", headers: headers() }).then(function (r) { return wrap(r); });
    },
    /* ===== 管理员 API（仅 admin 会话可调，其余人得到 403）===== */
    adminUsers: function () {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/users"), { headers: headers() }).then(function (r) { return wrap(r); });
    },
    adminResetPassword: function (name, password) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/user/reset-password"), {
        method: "POST", headers: headers(), body: JSON.stringify({ name: name, password: password })
      }).then(function (r) { return wrap(r); });
    },
    adminToggleDisable: function (name, enabled) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/user/disable"), {
        method: "POST", headers: headers(), body: JSON.stringify({ name: name, enabled: enabled })
      }).then(function (r) { return wrap(r); });
    },
    adminSetRole: function (name, role) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/user/role"), {
        method: "POST", headers: headers(), body: JSON.stringify({ name: name, role: role })
      }).then(function (r) { return wrap(r); });
    },
    /* ===== 2026-10-15 成员管理增强：增加 / 改名 / 删除（仅管理员）===== */
    adminAdd: function (name, password, role) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/user/add"), {
        method: "POST", headers: headers(), body: JSON.stringify({ name: name, password: password, role: role })
      }).then(function (r) { return wrap(r); });
    },
    adminRename: function (from, to) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/user/rename"), {
        method: "POST", headers: headers(), body: JSON.stringify({ from: from, to: to })
      }).then(function (r) { return wrap(r); });
    },
    adminDelete: function (name) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/user/delete"), {
        method: "POST", headers: headers(), body: JSON.stringify({ name: name })
      }).then(function (r) { return wrap(r); });
    },
    /* ===== 2026-10-15 P0（S1）：数据恢复（管理员）：异常备份 + 每日快照，受控恢复 ===== */
    adminRecovery: function () {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/recovery"), { headers: headers() }).then(function (r) { return wrap(r); });
    },
    adminRestore: function (obj) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/recovery/restore"), {
        method: "POST", headers: headers(), body: JSON.stringify({ obj: obj })
      }).then(function (r) { return wrap(r); });
    },
    /* ===== 团队公共资料（2026-10-14）：管理员维护 =====
       2026-10-15 P0（H4）：/shared 只回元数据（正文保密）；AI 注入改由 /llm 服务端完成；
       管理员"查看"走 sharedRaw（?raw=1，仅管理员有内容） */
    sharedDocs: function () {
      if (!this.enabled()) return Promise.resolve({ docs: [] });
      return fetch(url("/shared"), { headers: headers() }).then(function (r) { return wrap(r); });
    },
    sharedRaw: function () {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/shared?raw=1"), { headers: headers() }).then(function (r) { return wrap(r); });
    },
    sharedList: function () {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/shared"), { headers: headers() }).then(function (r) { return wrap(r); });
    },
    /* 2026-10-15：steps 非空即存为话术剧本；scope = suitcase / pet / all（产品线隔离） */
    sharedUpload: function (name, content, steps, scope) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      var p = { name: name, content: content || "", scope: scope || "all" };
      if (steps && steps.length) p.steps = steps;
      return fetch(url("/admin/shared"), {
        method: "POST", headers: headers(), body: JSON.stringify(p)
      }).then(function (r) { return wrap(r); });
    },
    /* 2026-10-16 置顶：核心资料（参数速查表/底线手册）永远排在线资料包最前；服务端随即重新打包 */
    sharedPin: function (doc, pin) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/shared/pin"), {
        method: "POST", headers: headers(), body: JSON.stringify({ doc: doc, pin: !!pin })
      }).then(function (r) { return wrap(r); });
    },
    sharedAll: function () {
      /* 业务员可读：剧本含完整步骤；普通资料只回名称（内容保密规则不变） */
      if (!this.enabled()) return Promise.resolve({ docs: [] });
      return fetch(url("/shared/all"), { headers: headers() }).then(function (r) { return wrap(r); });
    },
    /* 2026-10-20（v1.2.7）：话术卡专用轻量通道——只回元数据（剧本带 steps，正文不落响应），
       比 /shared/all 少一次会话校验的云端往返，卡片渲染更快。返回形状与 /shared/all 兼容。 */
    sharedMeta: function () {
      if (!this.enabled()) return Promise.resolve({ docs: [] });
      /* 2026-10-21（Phil「新客话术有时有有时没有」根因）：/admin/shared 只对管理员开放（adminGuard），
         业务员（rep）拿到 403 → 话术卡静默消失；管理员走轻量通道，业务员改走 /shared/all（任意会话可读），
         管理员路径万一失败也回退 /shared/all。 */
      var au = (window.Auth && Auth.get) ? (Auth.get() || {}) : {};
      function g(path) { return fetch(url(path), { headers: headers() }).then(function (r) { return wrap(r); }); }
      if (au.role === "admin") return g("/admin/shared").catch(function () { return g("/shared/all"); });
      return g("/shared/all");
    },
    sharedDelete: function (doc) {
      if (!this.enabled()) return Promise.reject(new Error("会话已失效，请重新登录"));
      return fetch(url("/admin/shared/delete"), {
        method: "POST", headers: headers(), body: JSON.stringify({ doc: doc })
      }).then(function (r) { return wrap(r); });
    }
  };

  window.Sync = Sync;
})();
