(function () {
  "use strict";

  /* Runtime figures are the catalog's own appliance table (hours of use, rounded as printed). */
  var LOADS = [
    { name: "Зурагт", w: "150 Вт" },
    { name: "Усны халаагуур", w: "2200 Вт" },
    { name: "Агааржуулагч", w: "1500 Вт" },
    { name: "Хөргөгч", w: "140 Вт" }
  ];
  var RT = [
    { k: 2.56, h: [16, 1.1, 1.5, 17], m: [["Хананд өлгөх", "home-storage.html#wall-mounted"]] },
    { k: 3.17, h: [19, 1.3, 1.9, 20.1], m: [["Хананд өлгөх", "home-storage.html#wall-mounted"]] },
    { k: 5.12, h: [31, 2.1, 3.1, 33], m: [["Давхарладаг", "home-storage.html#stack-512"], ["Тавиурт", "home-storage.html#rack"], ["Нэгдсэн систем", "home-storage.html#all-in-one"], ["Хананд өлгөх", "home-storage.html#wall-mounted"]] },
    { k: 7.68, h: [46, 3.2, 4.6, 50], m: [["Давхарладаг", "home-storage.html#stack-768"], ["Тавиурт", "home-storage.html#rack"], ["Нэгдсэн систем", "home-storage.html#all-in-one"]] },
    { k: 10, h: [60, 4.1, 6, 64], m: [["Дугуйтай", "home-storage.html#leaning"], ["Нэгдсэн систем", "home-storage.html#all-in-one"], ["Хананд өлгөх", "home-storage.html#wall-mounted"]] },
    { k: 14.34, h: [86, 6, 9, 92], m: [["Дугуйтай", "home-storage.html#leaning"], ["Нэгдсэн систем", "home-storage.html#all-in-one"]] },
    { k: 16, h: [96, 7, 10, 103], m: [["Дугуйтай", "home-storage.html#leaning"]] },
    { k: 20, h: [120, 8.2, 12, 129], m: [["Нэгдсэн систем", "home-storage.html#all-in-one"], ["Давхарладаг IP65", "home-storage.html#stack-ip65"]] },
    { k: 32, h: [192, 14, 20, 206], m: [["Дугуйтай", "home-storage.html#leaning"], ["Нэгдсэн систем", "home-storage.html#all-in-one"]] }
  ];
  var MAX_K = 32;

  function fmt(n) {
    return (Math.round(n * 10) / 10).toString();
  }

  var root = document.getElementById("runtime");
  if (root) {
    var group = root.querySelector(".sizes");
    var level = root.querySelector(".level");
    var kwhText = root.querySelector(".kwh");
    var list = root.querySelector(".loads");
    var models = root.querySelector(".models");
    var DEFAULT_K = 10;

    RT.forEach(function (r, i) {
      var id = "rt-" + i;
      var label = document.createElement("label");
      label.setAttribute("for", id);
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "rt-size";
      input.id = id;
      input.value = String(i);
      if (r.k === DEFAULT_K) input.checked = true;
      var span = document.createElement("span");
      span.innerHTML = String(r.k) + "<small> кВт·ц</small>";
      label.appendChild(input);
      label.appendChild(span);
      group.appendChild(label);
    });

    function render(i) {
      var r = RT[i];
      var frac = Math.max(0.1, r.k / MAX_K);
      var inner = 112; /* inner height of the cell drawing */
      var h = Math.round(inner * frac);
      level.setAttribute("height", String(h));
      level.setAttribute("y", String(136 - h));
      kwhText.textContent = String(r.k);
      list.innerHTML = "";
      LOADS.forEach(function (l, j) {
        var li = document.createElement("li");
        li.innerHTML =
          '<span class="hours">' + fmt(r.h[j]) + "<small>цаг</small></span>" +
          '<span class="what">' + l.name + "</span>" +
          '<span class="watt">' + l.w + "</span>";
        list.appendChild(li);
      });
      models.innerHTML = "";
      r.m.forEach(function (m) {
        var a = document.createElement("a");
        a.href = m[1];
        a.textContent = m[0];
        models.appendChild(a);
      });
    }

    group.addEventListener("change", function (e) {
      if (e.target && e.target.name === "rt-size") render(Number(e.target.value));
    });
    render(RT.findIndex(function (r) { return r.k === DEFAULT_K; }));
  }

  /* Order buttons: copy the question text so it can be pasted into Messenger, then let the link open. */
  var toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  var timer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove("show"); }, 4200);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[data-copy]") : null;
    if (!a) return;
    var text = a.getAttribute("data-copy");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { say("Асуултын текст хуулагдлаа. Messenger дээр буулгаж илгээнэ үү."); },
          function () { say("Messenger дээр бүтээгдэхүүний нэрийг бичнэ үү: " + text); }
        );
      } else {
        say("Messenger дээр бүтээгдэхүүний нэрийг бичнэ үү: " + text);
      }
    } catch (err) {
      say("Messenger дээр бүтээгдэхүүний нэрийг бичнэ үү: " + text);
    }
  });
})();
