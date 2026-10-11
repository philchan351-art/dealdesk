/* ===== "新增买家"弹层：把 WhatsApp / 广告 / 展会里遇到的客户 30 秒建档 ===== */
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

  function build(bd) {
    bd.innerHTML = '<div class="sheet">' +
      '<div class="sheet-head"><b>新增买家</b><button class="sheet-x" data-act="x">✕</button></div>' +
      '<div class="sheet-sub">登记新客户的来源（WhatsApp / 广告 / 展会）。保存后即可"记一条"、建档自动套用国家沟通画像</div>' +
      field("nbName", "姓名", "如 Carla Mendes", true) +
        field("nbCountry", "国家", "如 巴西（本地化画像库已收录常见市场）", true, KNOWN) +
        field("nbLang", "语言", "选填：留空=按国家自动；可填 英语/中文/西班牙语…", false, CountryProfiles.langs()) +
        field("nbCompany", "公司", "选填") +
      field("nbWa", "WhatsApp 号码", "+55 …（选填，一键交接发送需要）") +
      field("nbProduct", "产品线 / 意向产品", "如 学生书包（选填，会进档案）") +
      field("nbIntent", "初始意向分", "0–100，默认 50（A≥80 / B≥55 / C）") +
      field("nbNote", "备注", "如 价格敏感（选填，成为标签）") +
      '<button class="sl-save" data-act="save">保存并进入详情</button>' +
      "</div>";

    function closeIt() { bd.hidden = true; }
    bd.querySelector('[data-act="x"]').addEventListener("click", closeIt);
    bd.addEventListener("click", function (e) { if (e.target === bd) closeIt(); });
    bd.querySelector('[data-act="save"]').addEventListener("click", function () {
      var name = v("nbName"), country = v("nbCountry");
      if (!name || !country) { App.toast("姓名和国家必填"); return; }
      var intent = parseInt(v("nbIntent"), 10);
      if (isNaN(intent) || intent < 0 || intent > 100) intent = 50;
      var b = Store.addBuyer({
        name: name, country: country, cc: CountryProfiles.cc(country), msgLang: v("nbLang"),
        company: v("nbCompany"), wa: v("nbWa"), product: v("nbProduct"),
        intent: intent, note: v("nbNote")
      });
      closeIt();
      App.toast("已建档 · " + name);
      App.go("buyer", b.id);
    });
  }

  window.BuyerSheet = {
    open: function () {
      var bd = document.getElementById("buyerSheet");
      build(bd);
      bd.hidden = false;
    }
  };
})();
