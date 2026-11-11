/* ===== 退出后回选线页（v1.18.0，Phil「退出账号后，界面上还是要有选择，是面料的还是电动行李箱；
 * 因为很有可能一个人做两个项目的」）=====
 * 内核的两条退出路径（设置页「切换账号 / 退出登录」、走错入口卡「退出，换账号」）都是冻结代码，
 * Auth.clear() 之后留在当前工作台的登录页——没有业务线选择。本脚本在内核之后挂载（内核零改动）：
 *   本页曾经有过有效登录态、现在消失了（退出 / 会话失效被清）→ 回根地址选线页
 *   （选线 → 用该线的账号登录 → 进入），支撑「一个人做两个项目」：每条线用独立账号，
 *   做完一线退出，回到选线页换另一条线继续。
 * hadAuth 标记区分「刚退出」（回选线）与「匿名直接打开工作台」（允许直接登录，不赶走）。
 * AUTH_KEY 与 DealDomain.AUTH_KEY 同源字符串（不加载内核保持首屏轻，改 key 需两处同步）。
 */
(function () {
  "use strict";
  var AUTH_KEY = "dealdesk.auth.v1";
  function readAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; } }

  window.LogoutWatch = {
    /* 选线页 = 根地址；fabric/ 深一层，相对路径回到上一层 */
    landingFor: function (pathname) {
      var p = String(pathname || "").replace(/\/+$/, "");
      return p.indexOf("/fabric") >= 0 ? "../index.html" : "index.html";
    },
    /* 有有效登录态 → 记下并留下；登录态消失 → 只有曾经有过的才离开（匿名直达不赶走） */
    shouldLeave: function (state, authNow) {
      if (authNow && authNow.session) { state.hadAuth = true; return false; }
      return !!state.hadAuth;
    }
  };

  if (typeof location === "undefined" || typeof location.replace !== "function" || typeof setInterval !== "function") return;
  var a0 = readAuth();
  var st = { hadAuth: !!(a0 && a0.session) };
  setInterval(function () {
    if (window.LogoutWatch.shouldLeave(st, readAuth())) {
      location.replace(window.LogoutWatch.landingFor(location.pathname));
    }
  }, 700);
})();
