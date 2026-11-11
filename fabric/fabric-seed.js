/* ===== 域种子：fabric/index.html 共享内核入口专用，替代 mock.js =====
 * mock.js 是「电动行李箱」的演示数据（TitanX 电池车、壁灯、定制彩盒、宠物用品），
 * 面料入口只要加载它，行李箱内容就进了内存，之后任何一处漏过滤都会显示出来。
 * 本文件按当前业务域生成同形状的干净种子：客户/跟进/演示建议全空，阶段名与看板口径来自域包。
 * 形状必须与 mock.js 的导出一致（store.js 读 seed.buyers/followups/suggestions/week/kpis/STAGES）。
 *
 * v1.15.0（共享内核切换）新增：v1.13/v1.14 手写工作台遗留数据的一次性迁移。
 * 旧形状 {v:1, savedAt, buyers, followups, deletedIds} 缺 seedV/persona，store.js 的
 * load() 会拒收并重建空种子，首次保存即覆盖旧 blob——存量客户就此丢失。
 * 迁移判据是「数据住在哪个命名空间」，不是「当前所选上下文」：这个 key 只被本工作台
 * 读写，其中的客户/跟进一律属于本域（与 11-09 终裁「不用当前上下文作默认填充」一致，
 * 此处用的是命名空间归属这一硬事实）。一次性、幂等：seedV 对齐后不再跑。
 */
(function () {
  "use strict";

  var KEY = "dd.fabric.v1";
  var SEED_V = "v4-w4-fresh2"; /* 必须与 store.js 的 SEED_V 一致；store 若升种子版本，内核按自身规则重建（与主工作台同规则） */
  var ENTRY_DOMAIN = "functional-fabric";
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      if (o && o.v === 1 && Array.isArray(o.buyers) && o.seedV !== SEED_V) {
        o.seedV = SEED_V;
        if (!o.persona) o.persona = { thoughts: "", scripts: "", updated: null, docs: [] };
        if (!Array.isArray(o.deletedIds)) o.deletedIds = [];
        (o.buyers || []).forEach(function (b) { if (b && !b.domainId) b.domainId = ENTRY_DOMAIN; });
        (o.followups || []).forEach(function (fp) { if (fp && !fp.domainId) fp.domainId = ENTRY_DOMAIN; });
        localStorage.setItem(KEY, JSON.stringify(o));
      }
    }
  } catch (e) { /* 迁移失败退回内核重建，不炸首屏；损坏数据仍可先导出备份 */ }

  var dom = window.DealDomain;
  /* 种子要在 store.js 之前就绪，所以这里先把登录态里的域绑上（store.js 里再绑一次是幂等的） */
  if (dom && dom.bindFromStorage) { try { dom.bindFromStorage(); } catch (e) {} }

  var pack = dom && dom.current ? dom.current() : null;
  var names = pack && dom.stageNames ? dom.stageNames(pack) : [];
  var dayIdx = (new Date().getDay() + 6) % 7; /* 一=0 … 日=6，与 mock.js 的 labels 对齐 */
  var zeroWeek = [0, 0, 0, 0, 0, 0, 0];

  var packName = pack ? pack.name : "本业务线";
  var emptyNote = "本域刚开始，暂无数据";

  window.Mock = {
    STAGES: names,
    buyers: [],
    followups: [],
    suggestions: [],
    week: { labels: ["一", "二", "三", "四", "五", "六", "日"], values: zeroWeek, todayIdx: dayIdx },
    /* KPI 不造数：面料域是空世界，指标一律 0 + 说明，避免出现"演示数字看起来在赚钱"的假象 */
    kpis: [
      { label: "本周新增询盘", value: 0, sub: emptyNote },
      { label: "24h 回复率", value: 0, suffix: "%", sub: "有沟通后自动统计" },
      { label: "进行中谈单", value: 0, sub: "新建客户后进入管道" },
      { label: "本月成交额", value: 0, prefix: "$", sub: "标成交后累计" }
    ],
    getBuyer: function () { return null; },
    /* 供界面显示"这是哪条业务线的工作台" */
    domainName: packName
  };
})();
