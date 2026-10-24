/* 谈单舱 · Word 导出（通用组件，v1.7.0 起所有报告页内置）
 * 用法：<button onclick="exportWord()">📥 下载 Word 版</button>
 * exportWord({filename:'标题', area:'#export-area'})
 * 原理：把当前页面可见内容序列化进 Word 兼容的 HTML 文档，存为 .doc（Word/WPS 直接打开，样式基本保留）。
 * 导出的是"当前屏幕状态"——包括已经跑出来的 AI 生成、你的判定和批注。
 */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  window.exportWord = function (opts) {
    var o = opts || {};
    var root = document;
    var area = o.area ? (typeof o.area === "string" ? document.querySelector(o.area) : o.area) : null;
    if (area && !area.innerHTML) { alert("页面内容还没加载好，稍等再试"); return; }
    var src = area || document.querySelector("main, .wrap, body") || document.body;
    var clone = src.cloneNode(true);
    /* 去掉交互控件，只留内容 */
    var strip = clone.querySelectorAll("script, button, select, .judge, .sum, input");
    for (var i = 0; i < strip.length; i++) strip[i].parentNode.removeChild(strip[i]);
    var styles = "";
    var ss = document.querySelectorAll("style");
    for (var j = 0; j < ss.length; j++) styles += ss[j].textContent + "\n";
    var title = o.filename ? String(o.filename).replace(/\.docx?$/i, "") : document.title;
    var doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
      + '<head><meta charset="utf-8"/><title>' + esc(title) + "</title>"
      + "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->"
      + "<style>"
      + " @page WordSection1 { size:595.45pt 841.7pt; margin:36pt 36pt 36pt 36pt; }"
      + " div.WordSection1 { page:WordSection1; }"
      + styles
      + ' body { font-family:"Microsoft YaHei","PingFang SC",-apple-system,sans-serif; color:#1a1d24; font-size:11pt; line-height:1.55; }'
      + " .top a { display:none; }"
      + "</style></head><body><div class='WordSection1'>"
      + "<h1 style='margin:0 0 4pt'>" + esc(title) + "</h1>"
      + "<p style='color:#6b7280;font-size:9pt;margin:0 0 14pt'>谈单舱 DealPilot · 导出时间 " + new Date().toLocaleString("zh-CN") + "</p>"
      + clone.innerHTML
      + "</div></body></html>";
    var blob = new Blob(["\ufeff", doc], { type: "application/msword;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = title + ".doc";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode && a.parentNode.removeChild(a); }, 800);
  };
})();
