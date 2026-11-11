/* ===== 面料业务线：网络层（登录会话 + LLM 通道）=====
 * 独立性：配置与会话只存面料自己的 key（dd.fabric.cfg.v1 / dd.fabric.auth.v1），
 * 不读写另一条业务线的任何存储；也不在这里放任何业务事实。
 * 通道约定（照现网已验证的做法抄）：
 *   - 身份只来自 x-dealdesk-session 头，服务端不接受客户端自报 key
 *   - 出稿一律带 x-dealdesk-nodocs: 1 → 服务端只做转发，不注入任何团队资料
 *     （团队资料是按产品线预打包的，本线没有自己的包，让服务端注入等于让别人线的资料进来）
 *   - 模型固定 qwen-flash：沿用 Phil 的成本指令，不在本线偷偷升档
 */
(function (global) {
  "use strict";

  var CFG_KEY = "dd.fabric.cfg.v1";
  var AUTH_KEY = "dd.fabric.auth.v1";
  var PREFIX = "fb-"; /* 面料账号前缀：账号列表里一眼分清是谁家的，且它不是记录上的归属字段 */
  /* 云服务地址内置默认（与主工作台同源）：入口页不让人填地址，地址这类配置不该出现在业务员面前 */
  var DEFAULT_FC = "https://dealdes-clnhfkexse.cn-hangzhou.fcapp.run";

  function read(key) {
    try { return JSON.parse(global.localStorage.getItem(key)) || null; } catch (e) { return null; }
  }
  function write(key, obj) {
    try { global.localStorage.setItem(key, JSON.stringify(obj)); return true; } catch (e) { return false; }
  }

  function full(name) {
    var n = String(name || "").trim();
    if (!n) return "";
    return n.indexOf(PREFIX) === 0 ? n : PREFIX + n;
  }

  function auth() { return read(AUTH_KEY); }
  function cfg() {
    var c = read(CFG_KEY) || {};
    return { proxyUrl: c.proxyUrl || DEFAULT_FC, model: c.model || "qwen-flash", temp: c.temp == null ? 0.7 : c.temp };
  }
  function hasCloud() { var c = cfg(); return !!(c && c.proxyUrl); }
  function session() { var a = auth(); return (a && a.session) || ""; }

  function base() {
    return String(cfg().proxyUrl || "").replace(/\/+$/, "");
  }
  function post(path, body, hdrs, timeoutMs) {
    var ctrl = typeof global.AbortController !== "undefined" ? new global.AbortController() : null;
    var to = ctrl ? global.setTimeout(function () { ctrl.abort(); }, timeoutMs || 30000) : null;
    var h = { "Content-Type": "application/json" };
    if (session()) h["x-dealdesk-session"] = session();
    Object.keys(hdrs || {}).forEach(function (k) { h[k] = hdrs[k]; });
    return global.fetch(base() + path, {
      method: "POST", headers: h, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (to) global.clearTimeout(to);
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { j = null; }
        if (r.status === 401) { clearAuth(); throw new Error("会话失效，请重新登录"); }
        if (!j) throw new Error("云服务返回异常（HTTP " + r.status + "）");
        if (j.error) throw new Error(j.error);
        return j;
      });
    }).catch(function (e) {
      if (to) global.clearTimeout(to);
      if (e && (e.name === "AbortError" || /abort/i.test(String(e.message)))) throw new Error("连接云服务超时，请检查网络后重试");
      throw e;
    });
  }

  function clearAuth() { try { global.localStorage.removeItem(AUTH_KEY); } catch (e) {} }

  global.FabricNet = {
    PREFIX: PREFIX, CFG_KEY: CFG_KEY, AUTH_KEY: AUTH_KEY,
    full: full, auth: auth, cfg: cfg, clearAuth: clearAuth,
    hasCloud: hasCloud, session: session,

    login: function (name, password) {
      if (!hasCloud()) return Promise.reject(new Error("先填云服务地址"));
      if (!String(name || "").trim() || !password) return Promise.reject(new Error("账号和密码都要填"));
      return post("/login", { name: full(name), password: password, mode: "login" }, null, 15000)
        .then(function (j) {
          if (!j.ok) throw new Error((j.error) || "账号或密码不对");
          write(AUTH_KEY, { name: j.name, key: j.key, role: j.role || "rep", session: j.session, at: new Date().toISOString() });
          return j;
        });
    },

    register: function (name, password, teamToken) {
      if (!hasCloud()) return Promise.reject(new Error("先填云服务地址"));
      if (!String(name || "").trim() || !password) return Promise.reject(new Error("账号和密码都必填"));
      if (!teamToken) return Promise.reject(new Error("创建新账号需要团队口令（找管理员要）"));
      return post("/login", { name: full(name), password: password, mode: "register", token: teamToken }, null, 15000)
        .then(function (j) {
          if (!j.ok) throw new Error(j.error || "注册失败");
          write(AUTH_KEY, { name: j.name, key: j.key, role: j.role || "rep", session: j.session, at: new Date().toISOString() });
          return j;
        });
    },

    /* 出稿通道：永远 nodocs；失败必须抛出可读原因，绝不静默返回空 */
    draft: function (system, user) {
      if (!hasCloud()) return Promise.reject(new Error("未配置云服务地址"));
      if (!session()) return Promise.reject(new Error("还没登录，先登录面料账号"));
      return post("/llm", {
        model: "qwen-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.4, max_tokens: 600, stream: false
      }, { "x-dealdesk-nodocs": "1" }, 60000);
    }
  };
})(window);
