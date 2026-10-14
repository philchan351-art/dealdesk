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
    }
  };

  window.Sync = Sync;
})();
