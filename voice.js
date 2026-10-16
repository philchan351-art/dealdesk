/* ===== 语音输入组件：按住说话 → 云端 /stt 识别 → 回调文字（各输入框复用，与买家页麦克风同一套链路） ===== */
(function () {
  "use strict";
  var MediaRec = window.MediaRecorder || window.webkitMediaRecorder;
  var MIME_PREF = ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/aac", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  var actx = null;
  /* 2026-10-16 修正：录音流一律每次现取、用完即停。
     之前"会话级复用"会拿到已 stop 的死流 → 录出来是静音（iPhone 上表现为语音时好时坏）。
     同一浏览器会话内权限已授权时，现取不会再次弹系统授权框，无额外成本 */
  function beep(freq, dur) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === "suspended") actx.resume();
      var t0 = actx.currentTime;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function fmtOf(mime) {
    mime = String(mime || "").toLowerCase();
    if (mime.indexOf("mp4") >= 0 || mime.indexOf("aac") >= 0) return "m4a";
    if (mime.indexOf("mp3") >= 0 || mime.indexOf("mpeg") >= 0) return "mp3";
    if (mime.indexOf("wav") >= 0 || mime.indexOf("pcm") >= 0) return "wav";
    if (mime.indexOf("ogg") >= 0 || mime.indexOf("opus") >= 0) return "ogg";
    if (mime.indexOf("webm") >= 0) return "webm";
    return "m4a";
  }
  function b64(blob, cb) {
    var fr = new FileReader();
    fr.onload = function () { cb(String(fr.result || "").split(",")[1] || ""); };
    fr.onerror = function () { cb(""); };
    fr.readAsDataURL(blob);
  }

  /* ---- 麦克风权限状态 & "被禁止"常驻恢复面板（2026-10-16）----
     toast 6.5 秒就消失，业务员根本没看完就没了；面板常驻，
     去设置里改完回来点"测试"，形成闭环 */
  var deniedPanel = null;
  function micState() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        return navigator.permissions.query({ name: "microphone" }).then(function (st) { return st.state; }).catch(function () { return "unknown"; });
      }
    } catch (e) {}
    return Promise.resolve("unknown");
  }
  function hideDeniedPanel() {
    if (deniedPanel) { deniedPanel.remove(); deniedPanel = null; }
  }
  function showDeniedPanel() {
    if (deniedPanel) return;
    var phone = document.querySelector(".phone");
    if (!phone) { App.toast("麦克风被禁止：iPhone 去 设置→Safari→最下方网站→麦克风→允许", 8000); return; }
    var el = document.createElement("div");
    el.className = "mic-denied";
    el.innerHTML =
      '<div class="md-head">🎤 麦克风被禁用 <button class="md-x" type="button">✕</button></div>' +
      '<div class="md-sub">这是浏览器层的设置，不是软件坏了。iPhone 四步解决：</div>' +
      '<ol class="md-steps">' +
      '<li>手机桌面打开 <b>「设置」</b>（灰色齿轮）</li>' +
      '<li>一直滑到最底部，点 <b>「Safari 浏览器」</b></li>' +
      '<li>再往下滑到「网站」区，点 <b>「麦克风」</b></li>' +
      '<li>把 <b>DealDesk</b> 那行拨成 <b>允许</b></li>' +
      '</ol>' +
      '<button class="md-retry" type="button">✅ 我设置好了，点我测试</button>';
    phone.appendChild(el);
    deniedPanel = el;
    el.querySelector(".md-x").addEventListener("click", hideDeniedPanel);
    el.querySelector(".md-retry").addEventListener("click", function () {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        s.getTracks().forEach(function (t) { t.stop(); });
        hideDeniedPanel();
        App.toast("麦克风已恢复，按住说话即可");
      }).catch(function () {
        App.toast("还没成功：确认改的是 dealdesk 这个网站的麦克风（列表里找带 dealdesk 的地址）", 5000);
      });
    });
  }

  /* 预热：进系统后第一次触摸（用户手势）时申请一次权限，弹窗只出现一次且在最平静的时刻；
     万一这一刻被点了"拒绝"，立刻弹恢复面板教学，不让业务员自己瞎找 */
  function warmup() {
    try {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        s.getTracks().forEach(function (t) { t.stop(); });
      }).catch(function (err) {
        if (/NotAllowed|Permission|Security/i.test(String((err && err.message) || (err && err.name)))) showDeniedPanel();
      });
    } catch (e) {}
  }

  /* attach(btnEl, targetEl, opts)：
     targetEl 是 <input> 或 <textarea>；识别出的文字默认追加到 target
     opts: { onResult(text, target), placeholder(默认"🎤 按住说话"), busyText } */
  function attach(btn, target, opts) {
    opts = opts || {};
    var DEFAULT = opts.placeholder || "🎤 按住说话";
    var busyText = opts.busyText || "识别中…";
    var rec = null, busy = false, pendingStop = false;
    function setLabel(t) { if (btn) btn.textContent = t; }
    function setCls(on, which) {
      if (!btn) return;
      btn.classList.remove("rec", "busy");
      if (on) btn.classList.add(which || "rec");
    }
    function stopStream() {
      if (rec && rec.stream) { try { rec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    }
    function stopMic() {
      if (rec && rec.state === "recording") { try { rec.stop(); } catch (e) {} }
      else pendingStop = true;
    }
    if (!btn) return { setBusy: function () {} };
    btn.type = "button";
    btn.textContent = DEFAULT;
    setLabel(!MediaRec ? "🎤 此浏览器不支持" : DEFAULT);
    btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    btn.addEventListener("dragstart", function (e) { e.preventDefault(); });
    btn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      if (busy) return;
      if (!MediaRec) { App.toast("此浏览器不支持录音，请直接打字"); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { App.toast("当前环境不支持麦克风（试试 Safari/Chrome）"); return; }
      busy = true;
      pendingStop = false;
      micState().then(function (st) {
        if (st === "denied") { busy = false; showDeniedPanel(); return; }
        beep(880, 0.12);
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
          var mime = "";
          for (var i = 0; i < MIME_PREF.length; i++) {
            if (MediaRec.isTypeSupported && MediaRec.isTypeSupported(MIME_PREF[i])) { mime = MIME_PREF[i]; break; }
          }
          var chunks = [];
          try {
            rec = mime ? new MediaRec(stream, { mimeType: mime }) : new MediaRec(stream);
          } catch (err) {
            stopStream(); busy = false;
            App.toast("录音启动失败：" + err.message);
            return;
          }
          rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
          rec.onstop = function () {
            var blob = new Blob(chunks, { type: (rec && rec.mimeType) || mime || "audio/mp4" });
            var fmt = fmtOf((rec && rec.mimeType) || mime);
            stopStream();
            beep(520, 0.12);
            if (!blob.size) {
              busy = false; setCls(false); setLabel(DEFAULT);
              App.toast("没录到声音，再按住说一次");
              return;
            }
            busy = false; setCls(true, "busy"); setLabel(busyText);
            b64(blob, function (b64) {
              var st = Store.getSettings() || {};
              var c = st.llm || {}, cl = st.cloud || {};
              if (!c.proxyUrl && cl.proxyUrl) c.proxyUrl = cl.proxyUrl;
              if (!c.proxyUrl) { setCls(false); setLabel(DEFAULT); App.toast("先在设置里配置云代理地址"); return; }
              var au = window.Auth && Auth.get();
              if (!au || !au.session) { setCls(false); setLabel(DEFAULT); App.toast("请先登录后再使用语音"); return; }
              var p = {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-dealdesk-session": au.session },
                body: JSON.stringify({ audio: b64, format: fmt })
              };
              fetch(String(c.proxyUrl).replace(/\/+$/, "") + "/stt", p)
                .then(function (r) { return r.json(); })
                .then(function (j) {
                  setCls(false); setLabel(DEFAULT);
                  if (j && j.text) {
                    if (opts.onResult) opts.onResult(j.text, target);
                    else if (target && "value" in target) {
                      var v = target.value || "";
                      target.value = v ? v.replace(/\s+$/, "") + " " + j.text : j.text;
                    }
                  } else {
                    App.toast((j && j.error ? j.error : "没识别到内容，再按住说一次").slice(0, 80));
                  }
                })
                .catch(function (err) {
                  setCls(false); setLabel(DEFAULT);
                  App.toast("识别失败：" + err.message);
                });
            });
          };
          rec.onerror = function () {
            stopStream(); busy = false; setCls(false); setLabel(DEFAULT);
            App.toast("录音出错，再试一次");
          };
          try {
            rec.start();
            if (pendingStop) { pendingStop = false; try { rec.stop(); } catch (err2) {} }
          } catch (err) {
            stopStream(); busy = false;
            App.toast("录音启动失败：" + err.message);
          }
          setCls(true, "rec"); setLabel("松手结束");
        }).catch(function (err) {
          busy = false; setCls(false); setLabel(DEFAULT);
          if (/NotAllowed|Permission|Security/i.test(String(err.message || err.name))) showDeniedPanel();
          else App.toast("打不开麦克风：" + err.message);
        });
      });
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      btn.addEventListener(ev, function () { stopMic(); });
    });
    return {
      setBusy: function (on) { busy = !!on; setCls(on, "busy"); setLabel(on ? busyText : DEFAULT); }
    };
  }
  window.Voice = { attach: attach, warmup: warmup, showDeniedPanel: showDeniedPanel };
})();
