/* ===== 业务域入口声明（必须第一个加载）=====
 * CSP 是 script-src 'self'，不能用内联脚本设全局量，所以入口身份单独成文件。
 * 面料工作台是「全新的域」：行李箱的模块（mock.js 演示数据、turns.js 回合库、skills.js 句式库、
 * kb.js 行李箱资料段）在本页根本不加载，隔离不再依赖"每条读取路径都记得过滤"。
 * 换业务线 = 复制一份本文件改 domainId，并把 fabric 专属的产品线词换掉。
 */
window.DEAL_DOMAIN_ENTRY = "functional-fabric";
window.DEAL_DOMAIN_ENTRY_LABEL = "功能性面料工作台";
/* 行李箱工作台入口：账号绑的是别的域时用它，别在两个入口之间来回切账号 */
window.DEAL_DOMAIN_OTHER_ENTRY = "index.html";
