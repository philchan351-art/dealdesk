/* ===== 业务线选择 + 登录（v1.17.0，Phil「登入的时候，需要有个电动行李箱和面料选择」）=====
 * 根 index.html 是唯一总入口：选线 → 登录/新账号注册 → 直达该线工作台。
 * 登录契约与内核完全同口径（app.js 登录 + sync.js authCall，端点/字段/错误文案逐字一致）：
 *   POST {proxyUrl}/login   {name, password, mode:"login"|"register"[, token]}
 *   成功 {key, name, role, session, domain?}   失败 {error} / HTTP 401/403
 * 域优先级与内核登录＋entryState 同口径：
 *   服务端（管理员）指定 domain > 同账号已有客户端绑定 > 本次所选线
 * proxyUrl 先读共享设置（dealdesk.settings.v1 的 cloud.proxyUrl，与主工作台同源），没有则内置默认。
 * AUTH_KEY/SET_KEY 与 DealDomain.AUTH_KEY / store.js SET_KEY 同源字符串（不加载内核保持首屏轻，改 key 需两处同步）。
 */
(function () {
  "use strict";
  var AUTH_KEY = "dealdesk.auth.v1";
  var SET_KEY = "dealdesk.settings.v1";
  var DEFAULT_FC = "https://dealdes-clnhfkexse.cn-hangzhou.fcapp.run"; /* 与 app.js 登录页默认值同源 */
  var ROUTES = { "functional-fabric": "fabric/index.html", "e-scooter": "workbench.html" };
  var LINE_NAMES = { "e-scooter": "电动行李箱工作台", "functional-fabric": "功能性面料工作台" };
  var LINE_ACCENT = { "e-scooter": "#B97516", "functional-fabric": "#0f8f6b" };

  function readAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; } }

  /* 已登录的日常用户直达所绑线（不重复选）；选择+登录表单只服务未登录/未绑域的用户 */
  window.LandingRedirect = function () {
    var a = readAuth();
    if (a && a.domainId && ROUTES[a.domainId]) return ROUTES[a.domainId];
    return null;
  };

  /* 云地址：共享设置优先（与主工作台同源），没有则内置默认 */
  window.LandingFcUrl = function () {
    try {
      var s = JSON.parse(localStorage.getItem(SET_KEY)) || null;
      if (s && s.cloud && s.cloud.proxyUrl) return String(s.cloud.proxyUrl);
    } catch (e) {}
    return DEFAULT_FC;
  };

  /* 域优先级：服务端（管理员）指定 > 同账号已有绑定（不静默改绑）> 本次所选线 */
  window.LandingResolveDomain = function (j, chosen) {
    var cur = readAuth();
    if (j && j.domain) return j.domain;
    if (cur && cur.key && cur.key === (j && j.key) && cur.domainId) return cur.domainId;
    return chosen;
  };

  var target = window.LandingRedirect();
  if (target && typeof location !== "undefined" && typeof location.replace === "function") {
    location.replace(target);
  }
  if (target) return; /* 已跳转，不再接线 */

  /* node vm 测试环境没有表单元素：只暴露纯函数，跳过接线 */
  var which = document.getElementById("lWhich");
  var lNew = document.getElementById("lNew");
  var lTokWrap = document.getElementById("lTokWrap");
  var lGo = document.getElementById("lGo");
  var lMsg = document.getElementById("lMsg");
  if (!which || !lNew || !lTokWrap || !lGo || !lMsg) return;

  var selected = null;
  var cards = document.querySelectorAll(".l-dom[data-line]");
  Array.prototype.forEach.call(cards, function (c) {
    c.addEventListener("click", function () { pick(c); });
    c.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } });
  });
  function pick(c) {
    selected = c.getAttribute("data-line");
    Array.prototype.forEach.call(cards, function (x) {
      x.classList.remove("sel");
      var t = x.querySelector(".l-tick"); if (t) t.textContent = "";
    });
    c.classList.add("sel");
    var t = c.querySelector(".l-tick"); if (t) t.textContent = "✓";
    which.textContent = "登录到「" + LINE_NAMES[selected] + "」";
    lGo.style.background = LINE_ACCENT[selected];
  }
  lNew.addEventListener("change", function () { lTokWrap.style.display = lNew.checked ? "" : "none"; });
  lGo.addEventListener("click", submit);

  function msg(s) { lMsg.textContent = s; }

  function submit() {
    if (!selected) { msg("先选一条线（电动行李箱 或 功能性面料）"); return; }
    var name = document.getElementById("lName").value.trim();
    var pass = document.getElementById("lPass").value;
    var isNew = lNew.checked;
    var tok = document.getElementById("lTok").value.trim();
    if (!name || !pass) { msg("请填写账号和密码"); return; }
    if (isNew && !tok) { msg("创建新账号需要团队口令（找管理员要）"); return; }
    var body = { name: name, password: pass, mode: isNew ? "register" : "login" };
    if (isNew) body.token = tok;
    lGo.disabled = true;
    msg(isNew ? "创建中…" : "登录中…");
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    var opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    if (ctrl) opts.signal = ctrl.signal;
    fetch(window.LandingFcUrl().replace(/\/+$/, "") + "/login", opts)
      .then(function (r) { return r.text().then(function (t) {
        /* 错误形状与内核 sync.js wrap() 一致 */
        var j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
        if (r.status === 401) throw new Error((j && j.error) || "账号或密码不正确");
        if (r.status === 403) throw new Error((j && j.error) || "没有权限");
        if (!j || typeof j !== "object") throw new Error("云服务返回异常（HTTP " + r.status + "）");
        if (j.error) throw new Error(j.error);
        return j;
      }); })
      .then(function (j) {
        if (to) clearTimeout(to);
        var domain = window.LandingResolveDomain(j, selected);
        if (!ROUTES[domain]) throw new Error("这个账号的业务线暂未在此入口开放，请联系管理员");
        /* Auth 形状与内核登录逐字一致（key 用服务端下发的，不自报） */
        try { localStorage.setItem(AUTH_KEY, JSON.stringify({ key: j.key, name: j.name, role: j.role || "rep", session: j.session, domainId: domain })); } catch (e) {}
        /* 与内核一致：显示名同步进共享设置（只更新已有设置，不新建） */
        try {
          var s = JSON.parse(localStorage.getItem(SET_KEY));
          if (s && typeof s === "object") { s.name = j.name; localStorage.setItem(SET_KEY, JSON.stringify(s)); }
        } catch (e) {}
        location.replace(ROUTES[domain]);
      })
      .catch(function (e) {
        if (to) clearTimeout(to);
        lGo.disabled = false;
        msg(String((e && e.message) || e));
      });
  }
})();
