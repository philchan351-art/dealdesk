/* ===== "新增/编辑买家"弹层：新增客户 30 秒建档；已有客户可改姓名 / WhatsApp / 国家等 ===== */
(function () {
  "use strict";

  var KNOWN = CountryProfiles.countries();

  function field(id, label, ph, required, list) {
    return '<label class="set-lbl">' + label + (required ? " *" : "") + "</label>" +
      '<input class="set-inp" id="' + id + '" type="text" placeholder="' + ph + '"' +
      (list ? ' list="' + id + 'List"' : "") + "/>" +
      (list ? '<datalist id="' + id + 'List">' + list.map(function (c) { return "<option>" + c + "</option>"; }).join("") + "</datalist>" : "");
  }

  function v(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function build(bd, buyerId) {
    var b = buyerId && window.Mock && Mock.getBuyer ? Mock.getBuyer(buyerId) : null;
    var edit = !!b;
    bd.innerHTML = '<div class="sheet">' +
      '<div class="sheet-head"><b>' + (edit ? "编辑客户" : "新增买家") + '</b><button class="sheet-x" data-act="x">✕</button></div>' +
      '<div class="sheet-sub">' + (edit
        ? "修改姓名 / WhatsApp / 国家等资料，保存后立即生效并同步云端。意向分由 AI 管理，此处不改动"
        : '登记新客户的来源（WhatsApp / 广告 / 展会）。保存后即可"记一条"、建档自动套用国家沟通画像') + '</div>' +
      field("nbName", "姓名", "如 Carla Mendes", true) +
        field("nbCountry", "国家", "如 巴西（本地化画像库已收录常见市场）", true, KNOWN) +
        field("nbLang", "语言", "选填：留空=按国家自动；可填 英语/中文/西班牙语…", false, CountryProfiles.langs()) +
        field("nbCompany", "公司", "选填") +
      field("nbWa", "WhatsApp 号码", "+55 …（选填，一键交接发送需要）") +
      field("nbProduct", "产品线 / 意向产品", "如 学生书包（选填，会进档案）") +
      (edit ? "" : field("nbIntent", "初始意向分", "0–100，默认 50（A≥80 / B≥55 / C）")) +
      field("nbNote", "备注", edit ? "留空=保持原备注；填写=替换原备注" : "如 价格敏感（选填，成为标签）") +
      '<button class="sl-save" data-act="save">' + (edit ? "保存修改" : "保存并进入详情") + '</button>' +
      "</div>";

    if (edit) {
      document.getElementById("nbName").value = b.name || "";
      document.getElementById("nbCountry").value = b.country || "";
      document.getElementById("nbLang").value = b.msgLang || "";
      document.getElementById("nbCompany").value = (b.company && b.company !== "—") ? b.company : "";
      document.getElementById("nbWa").value = b.wa || "";
      document.getElementById("nbProduct").value = (b.product && b.product !== "待确认") ? b.product : "";
      document.getElementById("nbNote").value = (b.tags && b.tags[0] && b.tags[0] !== "新客户") ? b.tags[0] : "";
    }

    function closeIt() { bd.hidden = true; }
    bd.querySelector('[data-act="x"]').addEventListener("click", closeIt);
    bd.addEventListener("click", function (e) { if (e.target === bd) closeIt(); });
    bd.querySelector('[data-act="save"]').addEventListener("click", function () {
      var name = v("nbName"), country = v("nbCountry");
      if (!name || !country) { App.toast("姓名和国家必填"); return; }
      if (edit) {
        Store.updateBuyer(b.id, {
          name: name, country: country, cc: CountryProfiles.cc(country), msgLang: v("nbLang"),
          company: v("nbCompany"), wa: v("nbWa"), product: v("nbProduct"),
          note: v("nbNote")
        });
        closeIt();
        App.toast("已保存 · 客户资料已更新");
        App.refresh();
        return;
      }
      var intent = parseInt(v("nbIntent"), 10);
      if (isNaN(intent) || intent < 0 || intent > 100) intent = 50;
      var nb = Store.addBuyer({
        name: name, country: country, cc: CountryProfiles.cc(country), msgLang: v("nbLang"),
        company: v("nbCompany"), wa: v("nbWa"), product: v("nbProduct"),
        intent: intent, note: v("nbNote")
      });
      closeIt();
      App.toast("已建档 · " + name);
      App.go("buyer", nb.id);
    });
  }

  window.BuyerSheet = {
    open: function (buyerId) {
      var bd = document.getElementById("buyerSheet");
      build(bd, buyerId);
      bd.hidden = false;
    }
  };
})();
