/* ===== 业务域入口声明（必须第一个加载）=====
 * CSP 是 script-src 'self'，不能用内联脚本设全局量，所以入口身份单独成文件。
 * 共享内核切换（v1.15.0，Phil「共享内核，直接做」）：本页与主工作台（../index.html）
 * 跑同一套内核文件——界面、一客一对话框、AI 回复与体检、语音、云同步全部同源。
 * 两个工作台只差两处，都在本文件与 fabric-seed.js 里声明，内核零分叉：
 *   1. 大脑：本页声明 functional-fabric 域 → domain.js 域包驱动阶段管道/事实/守卫/
 *      术语/学徒期覆盖；主工作台的 mock.js 演示数据、turns.js 回合库、skills.js 句式库、
 *      kb.js 资料段在本页根本不加载，隔离不依赖"每条读取路径都记得过滤"。
 *   2. 数据：window.DEALDESK_KEY 让 store 换到本域命名空间（dd.fabric.v1），
 *      客户/跟进/设置/云同步与主工作台互不可见；云同步身份是账号会话（一人一域），
 *      入口即身份——在哪个工作台注册就属于哪条线。
 * 换业务线 = 复制本文件改域 id 与命名空间两个值。
 */
window.DEAL_DOMAIN_ENTRY = "functional-fabric";
window.DEAL_DOMAIN_ENTRY_LABEL = "功能性面料工作台";
/* 主工作台入口：账号绑的是别的域时用它（本页在 fabric/ 子目录，回上一层） */
window.DEAL_DOMAIN_OTHER_ENTRY = "../index.html";
/* 数据命名空间：本页只读写这个 key；主工作台不声明 → 走 store.js 默认值（原 key 不变） */
window.DEALDESK_KEY = "dd.fabric.v1";
/* v1.20.0 云槽线戳：本工作台推送的快照携带 line=functional-fabric（槽的归属证书）。
   内核拉取时核对"该账号云端槽属于哪条线"与入口线是否一致，不一致当场拦下——
   行李箱账号（槽无 line 或 line=e-scooter）进本页不会再拉到行李箱客户。
   主工作台不声明此值 → 默认 e-scooter（本来的线，行为不变）。 */
window.DEALDESK_LINE = "functional-fabric";
