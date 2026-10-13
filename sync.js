/* ===== 云同步：变更自动上云（2.5s 防抖）+ 启动/手动拉取 ===== */
(function () {
  "use strict";

  var timer = null;

  function cfg() {
    var s = Store.getSettings();
    return (s && s.cloud) || null;
  }

  function headers() {
    var c = cfg();
    return { "Content-Type": "application/json", "x-dealdesk-token": c.token || "" };
  }
  function url(p) {
    return cfg().proxyUrl.replace(/\/+$/, "") + p;
  }

  var Sync = {
    enabled: function () {
      var c = cfg();
      return !!(c && c.proxyUrl && c.token);
    },
    key: function () {
      var a = window.Auth && Auth.get();
      return (a && a.key) || "";
    },
    dataUrl: function () {
      var k = this.key();
      return url("/data") + (k ? "?key=" + encodeURIComponent(k) : "");
    },
    authCall: function (name, password, mode, timeoutMs) {
      if (!this.enabled()) return Promise.reject(new Error("未配置云服务：请展开下方「云服务设置」填地址和团队口令"));
      var ctrl = (timeoutMs && typeof AbortController !== "undefined") ? new AbortController() : null;
      var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
      var opts = { method: "POST", headers: headers(), body: JSON.stringify({ name: name, password: password, mode: mode }) };
      if (ctrl) opts.signal = ctrl.signal;
      return fetch(url("/auth"), opts)
        .then(function (r) {
          if (to) clearTimeout(to);
          return r.text().then(function (t) {
            var j = null;
            try { j = JSON.parse(t); } catch (e) { j = null; }
            if (!j || typeof j !== "object") throw new Error("云服务返回异常（HTTP " + r.status + "），请检查地址和团队口令");
            if (j.error) throw new Error(j.error);
            return j;
          });
        }).catch(function (e) {
          if (to) clearTimeout(to);
          if (e && (e.name === "AbortError" || /abort/i.test(String(e.message)))) throw new Error("连接云服务超时，请检查网络后重试");
          throw e;
        });
    },
    pushNow: function () {
      if (!this.enabled()) return Promise.resolve(null);
      if (!this.key()) return Promise.resolve(null);
      return fetch(this.dataUrl(), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ data: Store.snapshot(), clientAt: new Date().toISOString() })
      }).then(function (r) {
        return r.json();
      }).then(function (j) {
        if (j.error) throw new Error(j.error);
        return j;
      });
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
      if (!this.key()) return Promise.resolve(null);
      return fetch(this.dataUrl(), { headers: headers() })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) throw new Error(j.error);
          return j.data || null;
        });
    }
  };

  window.Sync = Sync;
})();
