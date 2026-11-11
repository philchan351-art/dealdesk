/* ===== 退出后回选线页（v1.18.0 起，Phil「退出账号后，界面上还是要有选择，是面料的还是电动行李箱；
 * 因为很有可能一个人做两个项目的」；v1.19.0 修 reload 漏网）=====
 * 内核的两条退出路径都是冻结代码：
 *   · 设置页「切换账号 / 退出登录」＝ Auth.clear() + location.reload()（整页刷新！）
 *   · 走错入口卡「退出，换账号」＝ Auth.clear() + 就地渲染登录页
 * 两者之后都停在当前工作台的登录页——没有业务线选择。本脚本在内核之后挂载（内核零改动），
 * 用两层观察保证「退出 → 回根地址选线页」：
 *   1) 内存观察：本页曾有有效登录态、现在消失（不刷新的退出路径）→ 立即回选线；
 *   2) 持久标记（dealdesk.landed.v1，5 分钟有效）：桥接 reload——新页面无登录态但标记新鲜
 *      ＝刚退出（被刷新过）→ 清标记并回选线。
 * hadAuth + 标记 TTL 双重区分「刚退出」（回选线）与「匿名直接打开工作台」（允许直接登录，不赶走）。
 * AUTH_KEY 与 DealDomain.AUTH_KEY 同源字符串（不加载内核保持首屏轻，改 key 需两处同步）。
 */
(function () {
  "use strict";
  var AUTH_KEY = "dealdesk.auth.v1";
  var MARK_KEY = "dealdesk.landed.v1";
  var MARK_TTL = 5 * 60 * 1000; /* 标记有效期：退出→reload 是毫秒级，5 分钟足够桥接且不会误伤次日匿名打开 */

  function readAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; } }
  function readMark() { try { var m = JSON.parse(localStorage.getItem(MARK_KEY)); return (m && typeof m.at === "number") ? m : null; } catch (e) { return null; } }
  function writeMark() { try { localStorage.setItem(MARK_KEY, JSON.stringify({ at: Date.now() })); } catch (e) {} }
  function clearMark() { try { localStorage.removeItem(MARK_KEY); } catch (e) {} }

  window.LogoutWatch = {
    /* 选线页 = 根地址；fabric/ 深一层，相对路径回到上一层 */
    landingFor: function (pathname) {
      var p = String(pathname || "").replace(/\/+$/, "");
      return p.indexOf("/fabric") >= 0 ? "../index.html" : "index.html";
    },
    /* 内存观察：有有效登录态 → 记下并留下；登录态消失 → 只有曾经有过的才离开（匿名直达不赶走） */
    shouldLeave: function (state, authNow) {
      if (authNow && authNow.session) { state.hadAuth = true; return false; }
      return !!state.hadAuth;
    },
    /* reload 桥接：无登录态时，标记存在且未过期 ＝ 刚退出（内核退出会整页刷新）→ 回选线 */
    shouldLeaveAfterReload: function (mark) {
      return !!(mark && (Date.now() - mark.at) < MARK_TTL);
    }
  };

  if (typeof location === "undefined" || typeof location.replace !== "function" || typeof setInterval !== "function") return;

  /* 第二层：reload 之后的页面，用持久标记判断是否「刚退出」 */
  var a0 = readAuth();
  if (!(a0 && a0.session) && window.LogoutWatch.shouldLeaveAfterReload(readMark())) {
    clearMark();
    location.replace(window.LogoutWatch.landingFor(location.pathname));
    return;
  }

  /* 第一层：登录期间保标记新鲜（≤30s 一次），登录态消失（不刷新的退出路径）→ 回选线 */
  var st = { hadAuth: !!(a0 && a0.session) };
  var lastMark = 0;
  if (st.hadAuth) { writeMark(); lastMark = Date.now(); }
  setInterval(function () {
    var a = readAuth();
    if (a && a.session) {
      if (Date.now() - lastMark > 30000) { writeMark(); lastMark = Date.now(); }
      return;
    }
    if (window.LogoutWatch.shouldLeave(st, a)) {
      clearMark();
      location.replace(window.LogoutWatch.landingFor(location.pathname));
    }
  }, 700);
})();
