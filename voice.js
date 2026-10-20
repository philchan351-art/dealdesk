/* ===== 语音输入组件：按一下开始聆听、再按一下结束 → 云端 /stt 识别 → 回调文字（各输入框复用，与买家页麦克风同一套链路） ===== */
(function () {
  "use strict";
  var MediaRec = window.MediaRecorder || window.webkitMediaRecorder;
  var MIME_PREF = ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/aac", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  var actx = null;
  /* 2026-10-18（Phil："点了 Allow 第二次还要 Allow"＋"以为是录音"）：
     ① 页面级"保温流"：在系统不持久记忆授权的环境（微信内置浏览器/无痕模式）里，
        每次 getUserMedia 都会弹系统框。改为首次按压取得流后保持（不立即停），
        20 秒内的后续按压直接复用 → 同一次进页最多弹 1 次；切后台/锁屏/离页立即释放。
     ② 10-16 死流教训照旧生效：只在 track live 时复用；复用到空录音立即丢弃保温流重新现取 */
  var warmStream = null, warmTimer = null, WARM_TTL = 20000;
  var warmUsers = 0;    /* 正在用保温流录音的数量（2026-10-19 点按模式：聆听可持续超过 20s，空闲计时不得掐断录音） */
  var activeRec = null; /* 正在录音的 MediaRecorder（切后台/离页先停它，绝不让麦克风指示标后台常亮） */
  function warmLive() {
    if (!warmStream) return false;
    try { var t = warmStream.getAudioTracks()[0]; return !!(t && t.readyState === "live"); } catch (e) { return false; }
  }
  function releaseWarm() {
    if (warmTimer) { clearTimeout(warmTimer); warmTimer = null; }
    if (warmUsers > 0) { refreshWarm(); return; }
    if (warmStream) { try { warmStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} warmStream = null; }
  }
  function refreshWarm() {
    if (warmTimer) clearTimeout(warmTimer);
    warmTimer = setTimeout(releaseWarm, WARM_TTL);
  }
  function acquireStream() {
    if (warmLive()) { refreshWarm(); return Promise.resolve(warmStream); }
    if (warmStream) releaseWarm(); /* 保温流已死（iOS 挂后台会杀流）：丢弃重新现取 */
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      warmStream = s; refreshWarm();
      return s;
    });
  }
  try {
    /* 切后台/锁屏/离页：先停掉进行中的录音（走 onstop 正常收口），再强制释放保温流
       （warmUsers 守卫只防"页面内使用中"被 20s 空闲计时掐断；离页时直接清零强放——
       绝不让麦克风指示标在后台亮着） */
    window.addEventListener("pagehide", function () { try { if (activeRec) activeRec.stop(); } catch (e) {} warmUsers = 0; releaseWarm(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) { try { if (activeRec) activeRec.stop(); } catch (e) {} warmUsers = 0; releaseWarm(); } });
  } catch (e) {}
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
   /* 2026-10-17「每次都要重新 Allow」根因修复：iOS 麦克风权限是网站级持久设置
      （设置→Safari→网站设置→麦克风）。反复弹窗 = ① 无痕模式（永不记忆）② 站点没设"总是允许"。
      首次授权成功后每天提醒一次去系统设置设"总是允许"，从根上消灭反复弹窗 */
    function noteGrant(repeat) {
      /* repeat=true：本会话刚授权过但系统又弹窗（= 环境不记忆授权，如微信/无痕）→ 给更准的诊断 */
      try {
        localStorage.setItem("dd_mic_ever_granted", String(Date.now()));
        var today = new Date().toDateString();
        if (localStorage.getItem("dd_mic_perm_hint") === today) return;
        localStorage.setItem("dd_mic_perm_hint", today);
        setTimeout(function () {
          if (repeat) {
            App.toast("系统没记住刚才的 Allow——多半用了隐私模式（Safari 地址栏紫色 Private / Chrome「私密标签页」，都不记授权），或该浏览器里没把本站设为允许。彻底解法：Chrome 点地址栏左侧 ⓘ→网站设置→麦克风→允许；Safari 去 设置→Safari→网站→麦克风→允许", 20000);
          } else {
            App.toast("麦克风已记住。若以后还反复弹 Allow：多半是隐私模式（不记授权）或浏览器里没设允许——Chrome：地址栏左侧 ⓘ→网站设置→麦克风→允许", 16000);
          }
        }, 1500);
      } catch (e) {}
    }
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
    if (!phone) { App.toast("麦克风被禁止：Chrome 点地址栏左侧 ⓘ→网站设置→麦克风→允许；Safari 去 设置→Safari→网站→麦克风→允许", 10000); return; }
    var el = document.createElement("div");
    el.className = "mic-denied";
    /* 2026-10-18（Phil 主用 Chrome）：Chrome 与 Safari 的网站权限互不相通，按你用的浏览器走对应路径 */
    var gtStyle = "font-size:12px;font-weight:800;margin:9px 0 3px;color:var(--brand-deep,#9a6a10)";
    el.innerHTML =
      '<div class="md-head">🎤 麦克风被禁用 <button class="md-x" type="button">✕</button></div>' +
      '<div class="md-sub">这是浏览器层的设置，不是软件坏了。按你用的浏览器选一路：</div>' +
      '<div style="' + gtStyle + '">Chrome（你的常用浏览器）</div>' +
      '<ol class="md-steps">' +
      '<li>点地址栏<b>左侧的 ⓘ 图标</b>（有的版本显示成字母 a）</li>' +
      '<li>点 <b>「网站设置」</b>（或「网站权限」）</li>' +
      '<li>把 <b>麦克风</b> 拨成 <b>允许</b>（= 总是允许，以后永不再弹）</li>' +
      '</ol>' +
      '<div style="' + gtStyle + '">Safari</div>' +
      '<ol class="md-steps">' +
      '<li>桌面打开 <b>「设置」</b>（灰色齿轮）→ 滑到底点 <b>「Safari 浏览器」</b></li>' +
      '<li>再滑到「网站」区点 <b>「麦克风」</b>，把 <b>DealDesk</b> 拨成 <b>允许</b></li>' +
      '</ol>' +
      '<div class="md-sub">若<b>每次</b>都要重新点 Allow：先确认没开隐私模式——Safari 的无痕（地址栏紫色 Private）和 Chrome 的「私密标签页」都永不记忆授权。</div>' +
      '<button class="md-retry" type="button">✅ 我设置好了，点我测试</button>';
    phone.appendChild(el);
    deniedPanel = el;
    el.querySelector(".md-x").addEventListener("click", hideDeniedPanel);
     el.querySelector(".md-retry").addEventListener("click", function () {
       acquireStream().then(function (s) {
         noteGrant(false);
         hideDeniedPanel();
          App.toast("麦克风已恢复，按一下说话即可（本会话内无需再点 Allow）");
       }).catch(function () {
        App.toast("还没成功：确认改的是 dealdesk 这个网站的麦克风（列表里找带 dealdesk 的地址）", 5000);
      });
    });
  }

  /* 2026-10-17：移除 warmup（首次触摸自动申请麦克风）——Phil 反馈"重新进入软件一定会弹、还会自动打开录音，这是bug"。
     麦克风只在按下「按住说话」时申请；被点 Cancel 时走常驻恢复面板兜底 */

  /* attach(btnEl, targetEl, opts)：
     targetEl 是 <input> 或 <textarea>；识别出的文字默认追加到 target
     opts: { onResult(text, target), placeholder(默认"🎤 按一下说话"), busyText }
     2026-10-19（Phil：「调整为按一下就直接语音，再按一下结束这样的模式」）：
     "按住说话"改"点按开关"——第 1 下=开始聆听（按钮转绿+提示音），第 2 下=结束并转成文字；
     转文字期间再按无效；单次录入硬上限 60 秒（绿色按钮上实时倒计时，说话的人看得见进度）；
     保温流/权限恢复面板/只转写不存录音 全部沿用。 */
  function attach(btn, target, opts) {
    opts = opts || {};
    /* 2026-10-18 文案（Phil："我只是想让系统听到我说话，把我的话翻译为文字，而不是录音"；
       10-18 二次反馈"怎么还有录音"→ 全部"录音"措辞清除，统一"聆听/语音转文字"口径） */
    var DEFAULT = opts.placeholder || "🎤 按一下说话 · 语音转文字";
    var LISTEN = "正在听… 再按一下结束";
    var busyText = opts.busyText || "听到了，正在转成文字…";
    var MAX_MS = 60000; /* 2026-10-19（Phil）：语音录入硬上限 60 秒，绿色按钮上实时倒计时让说话的人知道进度 */
    var rec = null, phase = "idle", pendingStop = false, graceStop = false, wasWarm = false, maxTimer = null, remain = 0;
    function setLabel(t) { if (btn) btn.textContent = t; }
    function setCls(on, which) {
      if (!btn) return;
      btn.classList.remove("rec", "busy");
      if (on) btn.classList.add(which || "rec");
    }
    function stopCountdown() { if (maxTimer) { clearInterval(maxTimer); maxTimer = null; } }
    function startCountdown() {
      stopCountdown();
      remain = MAX_MS / 1000;
      setLabel(LISTEN + " · " + remain + "s");
      maxTimer = setInterval(function () {
        remain--;
        if (remain <= 0) { stopCountdown(); if (phase === "listening") stopMic(); return; }
        if (phase === "listening") setLabel(LISTEN + " · " + remain + "s");
      }, 1000);
    }
    function resetUI() { stopCountdown(); phase = "idle"; setCls(false); setLabel(DEFAULT); }
    function stopStream() {
      if (rec && rec.stream) {
        if (rec.stream === warmStream) return; /* 保温流由页面级统一管理（TTL/切后台释放），每次录完不停——停了下次又要弹授权 */
        try { rec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      }
    }
    function stopMic() {
      /* 第 2 下=结束。录音还没真正开始就按（典型：权限弹窗还没关）→ 标记为"被中断"，
         开始后立刻停；空录音的提示要说明原因，免得用户以为软件坏了 */
      if (rec && rec.state === "recording") { try { rec.stop(); } catch (e) {} }
      else { graceStop = true; pendingStop = true; }
    }
    /* 2026-10-19（Phil「语音转文字慢」实测定位）：云端识别本身 <1s（15-45s 音频 server 680-850ms），
       慢的是 FC 实例闲置(>60s)后冷启动 + 手机上传。第 1 下点按开麦的瞬间先打一个免鉴权 /healthz
       ——用户说话的这 3-60 秒里实例必然预热完成，第 2 下的 STT 请求直接命中热实例。 */
    function prewarm() {
      try {
        var s = Store.getSettings() || {};
        var c = s.llm || {}, cl = s.cloud || {};
        if (!c.proxyUrl && cl.proxyUrl) c.proxyUrl = cl.proxyUrl;
        if (c.proxyUrl) fetch(String(c.proxyUrl).replace(/\/+$/, "") + "/healthz", { method: "GET" }).catch(function () {});
      } catch (e) {}
    }
    function startMic() {
      if (!MediaRec) { App.toast("此浏览器用不了麦克风，请直接打字"); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { App.toast("当前环境不支持麦克风（试试 Safari/Chrome）"); return; }
      prewarm();
      phase = "starting";
      pendingStop = false;
      graceStop = false;
      wasWarm = warmLive();
      setCls(true, "rec"); setLabel("正在开启麦克风…");
      micState().then(function (st) {
        if (st === "denied") { resetUI(); showDeniedPanel(); return; }
        var repeat = false;
        try { repeat = st === "prompt" && !!localStorage.getItem("dd_mic_ever_granted"); } catch (e) {}
        beep(880, 0.12);
        acquireStream().then(function (stream) {
          noteGrant(repeat);
          var mime = "";
          for (var i = 0; i < MIME_PREF.length; i++) {
            if (MediaRec.isTypeSupported && MediaRec.isTypeSupported(MIME_PREF[i])) { mime = MIME_PREF[i]; break; }
          }
          var chunks = [];
          /* 2026-10-20（Phil「15 秒语音等 10 秒以上」）：实测热实例识别仅 1.2-1.4s、冷启动也只 +1.2s，
             大头是手机上传——默认 AAC 码率下 15s 音频 b64 后约 200KB，上行 200kbps 就要 8s。
             压到 32kbps 单声道（语音识别足够，模型内部还会重采样）→ 上传量约 1/3。
             个别内核不认 audioBitsPerSecond 时回退无参构造 */
          try {
            rec = mime ? new MediaRec(stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : new MediaRec(stream, { audioBitsPerSecond: 32000 });
          } catch (err) {
            try { rec = mime ? new MediaRec(stream, { mimeType: mime }) : new MediaRec(stream); }
            catch (err2) { stopStream(); resetUI(); App.toast("没听清你的声音：" + err2.message); return; }
          }
          rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
          rec.onstop = function () {
            stopCountdown();
            if (activeRec === rec) activeRec = null;
            if (rec.stream === warmStream && warmUsers > 0) warmUsers--; /* 离页已强清零时兜底，避免负数 */
            var blob = new Blob(chunks, { type: (rec && rec.mimeType) || mime || "audio/mp4" });
            var fmt = fmtOf((rec && rec.mimeType) || mime);
            stopStream();
            beep(520, 0.12);
            if (!blob.size) {
              if (wasWarm && !graceStop) releaseWarm(); /* 保温流录出空录音 = 流已死（10-16 同款）：丢弃，下次点按重新现取 */
              resetUI();
              /* 2026-10-20（Phil「生成不出来」）：点按模式下空录音主因是"两下点得太近"（旧按住模式的肌肉记忆），
                 提示按这个口径说；授权弹窗打断同样表现为空录音，建议相同（再按一次） */
              App.toast(graceStop ? "这次停得有点快，还没收到声音——按一下开始，说完再按一下" : "没听到声音，再按一下说一次", 4000);
              return;
            }
            phase = "stt"; setCls(true, "busy"); setLabel(busyText);
            b64(blob, function (b64v) {
              var s2 = Store.getSettings() || {};
              var c = s2.llm || {}, cl = s2.cloud || {};
              if (!c.proxyUrl && cl.proxyUrl) c.proxyUrl = cl.proxyUrl;
              if (!c.proxyUrl) { resetUI(); App.toast("先在设置里配置云代理地址"); return; }
              var au = window.Auth && Auth.get();
              if (!au || !au.session) { resetUI(); App.toast("请先登录后再使用语音"); return; }
              var p = {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-dealdesk-session": au.session },
                body: JSON.stringify({ audio: b64v, format: fmt })
              };
              /* 2026-10-20（Phil「生成不出来」）：手机信号差时上传会卡死——原来 fetch 无超时，
                 按钮永远停在"正在转成文字…"。加 45s 熔断：超时报错并复位按钮，可立刻重说 */
              var ac = (window.AbortController ? new AbortController() : null);
              var sttTimer = ac ? setTimeout(function () { ac.abort(); }, 45000) : null;
              function unarmStt() { if (sttTimer) { clearTimeout(sttTimer); sttTimer = null; } }
              fetch(String(c.proxyUrl).replace(/\/+$/, "") + "/stt", ac ? Object.assign(p, { signal: ac.signal }) : p)
                .then(function (r) { return r.json(); })
                .then(function (j) {
                  unarmStt();
                  resetUI();
                  if (j && j.text) {
                    if (opts.onResult) opts.onResult(j.text, target);
                    else if (target && "value" in target) {
                      var v = target.value || "";
                      target.value = v ? v.replace(/\s+$/, "") + " " + j.text : j.text;
                      /* 2026-10-18（Phil「语音转化的文字，AI 没有自动扩充」）：程序改 value 不触发 input 事件
                         → 买家页「停笔 2 秒自动扩充」监听器永远不启动。补发 input 事件，与手敲完全同一条链路 */
                      target.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                  } else {
                    App.toast((j && j.error ? j.error : "没识别到内容，再按一下说一次").slice(0, 80));
                  }
                })
                .catch(function (err) {
                  unarmStt();
                  resetUI();
                  App.toast(err && err.name === "AbortError" ? "识别超时了，信号可能不好——再按一下说一次" : "识别失败：" + (err && err.message), 5000);
                });
            });
          };
          rec.onerror = function () {
            stopCountdown();
            if (activeRec === rec) activeRec = null;
            if (rec.stream === warmStream && warmUsers > 0) warmUsers--;
            stopStream(); resetUI();
            App.toast("聆听被打断，再试一次");
          };
          try {
            rec.start();
            activeRec = rec;
            if (rec.stream === warmStream) { warmUsers++; refreshWarm(); }
            if (pendingStop) { pendingStop = false; try { rec.stop(); } catch (err2) {} return; }
            phase = "listening";
            setCls(true, "rec");
            startCountdown();
          } catch (err) {
            stopStream(); resetUI();
            App.toast("没听清你的声音：" + err.message);
          }
        }).catch(function (err) {
          resetUI();
          if (/NotAllowed|Permission|Security/i.test(String(err.message || err.name))) showDeniedPanel();
          else App.toast("打不开麦克风：" + err.message);
        });
      });
    }
    if (!btn) return { setBusy: function () {} };
    btn.type = "button";
    btn.textContent = DEFAULT;
    setLabel(!MediaRec ? "🎤 此浏览器不支持" : DEFAULT);
    btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    btn.addEventListener("dragstart", function (e) { e.preventDefault(); });
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (phase === "stt") return; /* 转文字中：等文字进输入框，别乱按 */
      if (phase === "starting" || phase === "listening") { stopMic(); return; } /* 第 2 下 = 结束 */
      startMic(); /* 第 1 下 = 开始 */
    });
    return {
      setBusy: function (on) { if (on) { phase = "stt"; setCls(true, "busy"); setLabel(busyText); } else resetUI(); }
    };
  }
  window.Voice = { attach: attach, showDeniedPanel: showDeniedPanel, noteGrant: noteGrant };
})();
