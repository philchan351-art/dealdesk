/* ===== 资料文本提取（2026-10-15：Word/PDF 训练资料支持） =====
 * .docx —— 零依赖解析：内置最小 ZIP 读取器 + DecompressionStream 解压 word/document.xml
 * .pdf  —— 自托管 pdf.js（pdf.min.js，CSP 禁外网 CDN）；仅在用户选了 PDF 时才懒加载
 * 纯文本 —— FileReader 直读
 * 提取结果统一交给设置页预览确认，再进训练资料/公共资料。
 */
(function () {
  "use strict";

  function readAsBuffer(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error("文件读取失败")); };
      fr.readAsArrayBuffer(file);
    });
  }
  function readAsText(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result || "")); };
      fr.onerror = function () { rej(new Error("文件读取失败")); };
      fr.readAsText(file, "utf-8");
    });
  }
  function streamToText(stream) {
    var reader = stream.getReader();
    var dec = new TextDecoder("utf-8");
    var out = "";
    function pump() {
      return reader.read().then(function (p) {
        if (p.done) return out;
        out += dec.decode(p.value, { stream: true });
        return pump();
      });
    }
    return pump();
  }
  function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") return Promise.reject(new Error("此浏览器暂不支持解压，请换新版 Chrome/Edge 再传"));
    var ds = new DecompressionStream("deflate-raw");
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return streamToText(stream);
  }

  /* 最小 ZIP 中央目录读取：返回指定条目的 {method, data}（docx = ZIP，正文在 word/document.xml） */
  function zipEntry(buf, entryName) {
    var dv = new DataView(buf);
    var eocd = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("不是有效的 Word 文件（请确认是 .docx）");
    var count = dv.getUint16(eocd + 10, true);
    var off = dv.getUint32(eocd + 16, true);
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true);
      var csize = dv.getUint32(off + 20, true);
      var nlen = dv.getUint16(off + 28, true);
      var elen = dv.getUint16(off + 30, true);
      var clen = dv.getUint16(off + 32, true);
      var name = new TextDecoder("utf-8").decode(new Uint8Array(buf, off + 46, nlen));
      var lh = dv.getUint32(off + 42, true);
      var lnlen = dv.getUint16(lh + 26, true);
      var lelen = dv.getUint16(lh + 28, true);
      var dataStart = lh + 30 + lnlen + lelen;
      if (name === entryName) return { method: method, data: new Uint8Array(buf, dataStart, csize) };
      off += 46 + nlen + elen + clen;
    }
    return null;
  }
  function decodeXmlEntities(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
      .replace(/&amp;/g, "&");
  }
  function docxToText(buf) {
    var e;
    try { e = zipEntry(buf, "word/document.xml"); } catch (err) { return Promise.reject(err); }
    if (!e) return Promise.reject(new Error("没找到 Word 正文，文件可能损坏"));
    var xmlP = (e.method === 0) ? Promise.resolve(new TextDecoder("utf-8").decode(e.data)) : inflateRaw(e.data);
    return xmlP.then(function (xml) {
      xml = xml.replace(/<w:tab[^>]*\/>/g, "\t").replace(/<w:br[^>]*\/>/g, "\n").replace(/<\/w:p>/g, "\n");
      xml = xml.replace(/<[^>]+>/g, "");
      xml = decodeXmlEntities(xml);
      return xml.replace(/\n{3,}/g, "\n\n").trim();
    });
  }

  /* 懒加载自托管 pdf.js（选 PDF 才拉 ~320KB，worker ~1MB；CSP script-src 'self' 允许） */
  var _pdfjs = null;
  function loadPdfjs() {
    if (_pdfjs) return _pdfjs;
    _pdfjs = new Promise(function (res, rej) {
      if (window.pdfjsLib) return res(window.pdfjsLib);
      var s = document.createElement("script");
      s.src = "pdf.min.js?v=1";
      s.onload = function () {
        if (!window.pdfjsLib) return rej(new Error("pdf.js 加载失败，请刷新重试"));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.js?v=1";
        res(window.pdfjsLib);
      };
      s.onerror = function () { rej(new Error("pdf.js 加载失败，请检查上传是否完整后重试")); };
      document.head.appendChild(s);
    });
    return _pdfjs;
  }
  function pdfToText(buf) {
    return loadPdfjs().then(function (pdfjs) {
      /* pdf.js 会转移/改写传入的 buffer，给一份拷贝 */
      return pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
    }).then(function (doc) {
      var parts = [];
      function pageText(n) {
        return doc.getPage(n).then(function (page) { return page.getTextContent(); }).then(function (tc) {
          var lastY = null, txt = "";
          tc.items.forEach(function (it) {
            if (lastY != null && Math.abs(it.transform[5] - lastY) > 2) txt += "\n";
            txt += it.str;
            lastY = it.transform[5];
          });
          parts.push(txt);
          if (n < doc.numPages) return pageText(n + 1);
        });
      }
      return pageText(1).then(function () {
        var text = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
        try { doc.destroy(); } catch (e) {}
        return text;
      });
    });
  }

  window.DocExtract = {
    /* Promise<text>。支持 .txt/.md/.csv/.json/.html/.htm/.docx/.pdf；.doc 明确拒绝 */
    extract: function (file) {
      var ext = String(file.name || "").split(".").pop().toLowerCase();
      if (ext === "doc") return Promise.reject(new Error("旧版 .doc 不支持：请在 Word 里「另存为 .docx」后再传"));
      if (ext === "docx") return readAsBuffer(file).then(docxToText);
      if (ext === "pdf") return readAsBuffer(file).then(pdfToText);
      if (ext === "txt" || ext === "md" || ext === "csv" || ext === "json" || ext === "html" || ext === "htm") return readAsText(file);
      return Promise.reject(new Error("暂不支持「." + ext + "」，支持 Word(.docx)、PDF、纯文本(.txt/.md/.csv/.json)"));
    }
  };
})();
