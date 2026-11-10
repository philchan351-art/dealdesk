/* ===== 业务域入口声明：电动行李箱工作台（必须第一个加载）=====
 * 两个入口各自声明自己的域，账号域与入口不符时 app.js 会拦住。
 * 不这么做的话，绑了面料的账号只要改一下网址（index.html）就能把行李箱模块全部加载进来，
 * 隔离又退回到"每条读取路径都得记得过滤"。入口即边界。
 */
window.DEAL_DOMAIN_ENTRY = "e-scooter";
window.DEAL_DOMAIN_ENTRY_LABEL = "电动行李箱工作台";
/* 面料业务线请用独立工作台：那边不加载本域的演示数据、回合库、句式库与资料段 */
window.DEAL_DOMAIN_OTHER_ENTRY = "fabric.html";
