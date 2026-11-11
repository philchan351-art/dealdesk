/* ===== 业务线选择落地页跳转（v1.16.0，Phil「先选功能面料还是电动行李箱，选完进下一步」）=====
 * 根 index.html 只干一件事：选线。跳转规则与内核 entryState 同口径——
 *   账号已绑域 → 直达该域工作台（日常用户不再重复选）；
 *   未登录 / 老账号没绑域 / 绑了未知域 → 留在选择页（选完进入后由内核登录与
 *   「入口即身份」完成绑定，本文件不写任何业务数据）。
 * AUTH_KEY 与 domain.js 的 DealDomain.AUTH_KEY 同源（这里不加载内核保持首屏轻，改 key 需两处同步）。
 */
(function () {
  "use strict";
  var AUTH_KEY = "dealdesk.auth.v1";
  var ROUTES = { "functional-fabric": "fabric/index.html", "e-scooter": "workbench.html" };

  window.LandingRedirect = function () {
    var a = null;
    try { a = JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { a = null; }
    if (a && ROUTES[a.domainId]) return ROUTES[a.domainId];
    return null;
  };

  var target = window.LandingRedirect();
  /* 测试环境（node vm）可能没有 location；浏览器里 location.replace 无历史记录残留，回退仍落回本页 */
  if (target && typeof location !== "undefined" && typeof location.replace === "function") {
    location.replace(target);
  }
})();
