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
    pushNow: function () {
      if (!this.enabled()) return Promise.resolve(null);
      return fetch(url("/data"), {
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
      return fetch(url("/data"), { headers: headers() })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) throw new Error(j.error);
          return j.data || null;
        });
    }
  };

  window.Sync = Sync;
})();
