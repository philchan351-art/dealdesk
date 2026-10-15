/* ===== "新增买家"弹层：把 WhatsApp / 广告 / 展会里遇到的客户 30 秒建档 ===== */
(function () {
  "use strict";

  var KNOWN = CountryProfiles.countries();

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function field(id, label, ph, required, list, val) {
    return '<label class="set-lbl">' + label + (required ? " *" : "") + "</label>" +
      '<input class="set-inp" id="' + id + '" type="text" placeholder="' + ph + '" value="' + esc(val != null ? val : "") + '"' +
      (list ? ' list="' + id + 'List"' : "") + "/>" +
      (list ? '<datalist id="' + id + 'List">' + list.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</datalist>" : "");
  }

  function v(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  /* 产品线（2026-10-15）：决定该客户页显示哪套公共资料 / 新客话术剧本 */
  function scopeField(val) {
    function o(v2, l) { return '<option value="' + v2 + '"' + (val === v2 ? " selected" : "") + ">" + l + "</option>"; }
    return '<label class="set-lbl">产品线</label>' +
      '<select class="set-inp" id="nbScope">' + o("", "通用（显示全部公共资料）") + o("suitcase", "电动行李箱") + o("pet", "宠物产品") + "</select>" +
      '<div class="set-note">决定这个客户的「新客话术」和 AI 引用哪套公共资料：宠物客户不会看到行李箱话术</div>';
  }

  function build(bd, editB) {
    var isEdit = !!editB;
    bd.innerHTML = '<div class="sheet">' +
      '<div class="sheet-head"><b>' + (isEdit ? "编辑档案" : "新增买家") + '</b><button class="sheet-x" data-act="x">✕</button></div>' +
      '<div class="sheet-sub">' + (isEdit ? "修改姓名、WhatsApp 号码、国家等基础信息。对话记录、意向分、档案要点不受影响" : "登记新客户的来源（WhatsApp / 广告 / 展会）。保存后即可\"记一条\"、建档自动套用国家沟通画像") + "</div>" +
      field("nbName", "姓名", "如 Carla Mendes", true, null, isEdit ? editB.name : "") +
         field("nbCountry", "国家", "如 巴西（本地化画像库已收录常见市场）", true, KNOWN, isEdit ? editB.country : "") +
         scopeField(isEdit ? (editB.scope || "") : "") +
         field("nbLang", "语言", "选填：留空=按国家自动；可填 英语/中文/西班牙语…", false, CountryProfiles.langs(), isEdit ? editB.msgLang : "") +
        field("nbCompany", "公司", "选填", false, null, isEdit && editB.company && editB.company !== "—" ? editB.company : "") +
      field("nbWa", "WhatsApp 号码", "+55 …（选填，一键交接发送需要）", false, null, isEdit ? editB.wa : "") +
      field("nbProduct", "产品线 / 意向产品", "如 学生书包（选填，会进档案）", false, null, isEdit && editB.product && editB.product !== "待确认" ? editB.product : "") +
      field("nbQty", "数量", "如 50–200 件/月（选填）", false, null, isEdit && editB.qty && editB.qty !== "待确认" ? editB.qty : "") +
      (isEdit ? "" : field("nbIntent", "初始意向分", "0–100，默认 50（A≥80 / B≥55 / C）")) +
      field("nbNote", "备注", "如 价格敏感（选填，成为标签）", false, null, isEdit && editB.tags && editB.tags.length ? editB.tags[0] : "") +
      '<button class="sl-save" data-act="save">' + (isEdit ? "保存修改" : "保存并进入详情") + "</button>" +
      "</div>";

    function closeIt() { bd.hidden = true; }
    bd.querySelector('[data-act="x"]').addEventListener("click", closeIt);
    bd.addEventListener("click", function (e) { if (e.target === bd) closeIt(); });
    bd.querySelector('[data-act="save"]').addEventListener("click", function () {
      var name = v("nbName"), country = v("nbCountry");
      if (!name || !country) { App.toast("姓名和国家必填"); return; }
      if (isEdit) {
        Store.updateBuyer(editB.id, {
          name: name, country: country, msgLang: v("nbLang"), company: v("nbCompany"),
          wa: v("nbWa"), product: v("nbProduct"), qty: v("nbQty"), note: v("nbNote"), scope: v("nbScope")
        });
        closeIt();
        App.toast("已保存 · " + name);
        App.refresh();
        return;
      }
      var intent = parseInt(v("nbIntent"), 10);
      if (isNaN(intent) || intent < 0 || intent > 100) intent = 50;
      var b = Store.addBuyer({
        name: name, country: country, cc: CountryProfiles.cc(country), msgLang: v("nbLang"),
        company: v("nbCompany"), wa: v("nbWa"), product: v("nbProduct"), qty: v("nbQty"),
        intent: intent, note: v("nbNote"), scope: v("nbScope")
      });
      closeIt();
      App.toast("已建档 · " + name);
      App.go("buyer", b.id);
    });
  }

  window.BuyerSheet = {
    /* 不传参 = 新增；传 buyerId = 编辑该客户档案 */
    open: function (buyerId) {
      var bd = document.getElementById("buyerSheet");
      build(bd, buyerId ? (window.Mock && Mock.getBuyer(buyerId)) : null);
      bd.hidden = false;
    }
  };
})();
