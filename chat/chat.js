/* Partastar chat window. Talks to chat/server.mjs (which talks to a local Ollama).
   Stays hidden until ENDPOINT is set: put the public address of the chat server here,
   e.g. "https://chat.partastar.solar" (no trailing slash). */
(function () {
  "use strict";
  var ENDPOINT = "";
  var MESSENGER = "https://m.me/61595385219266";
  if (!ENDPOINT || !window.fetch || !window.TextDecoder) return;

  var STR = {
    mn: { open: "Чат", title: "Partastar туслах", close: "Хаах", hi: "Сайн байна уу! Partastar-ийн бүтээгдэхүүний талаар асуугаарай.", ph: "Асуултаа бичнэ үү…", send: "Илгээх", wait: "Бичиж байна…", err: "Одоогоор хариулах боломжгүй байна. Messenger-ээр бичнэ үү:", busy: "Хэт олон асуулт ирлээ. Түр хүлээгээд дахин оролдоно уу.", note: "AI хариулт. Үнэ, нөөцийг Messenger-ээр баталгаажуулна." },
    en: { open: "Chat", title: "Partastar assistant", close: "Close", hi: "Hello! Ask me about Partastar products.", ph: "Type your question…", send: "Send", wait: "Typing…", err: "I can't answer right now. Please write to us on Messenger:", busy: "Too many questions at once. Please wait a moment and try again.", note: "AI answers. Prices and stock are confirmed on Messenger." },
    zh: { open: "聊天", title: "Partastar 助手", close: "关闭", hi: "您好！欢迎咨询 Partastar 产品。", ph: "请输入您的问题…", send: "发送", wait: "正在输入…", err: "暂时无法回答，请通过 Messenger 联系我们：", busy: "提问过于频繁，请稍后再试。", note: "AI 回答。价格和库存请在 Messenger 确认。" },
    ru: { open: "Чат", title: "Помощник Partastar", close: "Закрыть", hi: "Здравствуйте! Спросите о продукции Partastar.", ph: "Напишите вопрос…", send: "Отправить", wait: "Печатает…", err: "Сейчас не могу ответить. Напишите нам в Messenger:", busy: "Слишком много вопросов. Подождите немного и попробуйте снова.", note: "Ответы ИИ. Цены и наличие уточняйте в Messenger." },
    kk: { open: "Чат", title: "Partastar көмекшісі", close: "Жабу", hi: "Сәлеметсіз бе! Partastar өнімдері туралы сұраңыз.", ph: "Сұрағыңызды жазыңыз…", send: "Жіберу", wait: "Жазып жатыр…", err: "Қазір жауап бере алмаймын. Messenger арқылы жазыңыз:", busy: "Сұрақ тым көп. Сәл күтіп, қайталап көріңіз.", note: "ЖИ жауабы. Баға мен қойманы Messenger арқылы нақтылаңыз." }
  };
  var lang = (document.documentElement.lang || "mn").slice(0, 2).toLowerCase();
  if (!STR[lang]) lang = "mn";
  var S = STR[lang];

  var css = [
    ".pc-btn{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom));z-index:75;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;min-height:48px;background:var(--btn-bg,#1d4c9f);color:var(--btn-fg,#fff);font:600 1rem var(--font,system-ui);box-shadow:0 8px 24px rgba(10,25,50,.25);cursor:pointer}",
    ".pc-btn svg{width:20px;height:20px}",
    ".pc-panel{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom));z-index:80;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 40px));display:none;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#0f1b2d);border:1px solid var(--line,#d7dfea);border-radius:14px;box-shadow:0 16px 40px rgba(10,25,50,.28);overflow:hidden;font-family:var(--font,system-ui)}",
    ".pc-panel.open{display:flex}",
    ".pc-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--navy,#0b1e3f);color:#fff;font-weight:700}",
    ".pc-x{background:none;border:0;color:#fff;font-size:1.5rem;line-height:1;min-width:44px;min-height:44px;cursor:pointer}",
    ".pc-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#f4f6f9)}",
    ".pc-m{max-width:85%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45;font-size:.9375rem}",
    ".pc-m.a{align-self:flex-start;background:var(--surface,#fff);border:1px solid var(--line,#d7dfea)}",
    ".pc-m.u{align-self:flex-end;background:var(--btn-bg,#1d4c9f);color:var(--btn-fg,#fff)}",
    ".pc-m a{color:var(--link,#1d4c9f);font-weight:600}",
    ".pc-m.wait{color:var(--muted,#526078);font-style:italic}",
    ".pc-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#d7dfea);background:var(--surface,#fff)}",
    ".pc-in{flex:1;min-width:0;resize:none;border:1px solid var(--line,#d7dfea);border-radius:10px;padding:10px;font:16px var(--font,system-ui);background:var(--bg,#f4f6f9);color:var(--ink,#0f1b2d);max-height:120px}",
    ".pc-send{border:0;border-radius:10px;padding:0 14px;min-height:44px;background:var(--btn-bg,#1d4c9f);color:var(--btn-fg,#fff);font-weight:700;cursor:pointer}",
    ".pc-send:disabled{opacity:.5;cursor:default}",
    ".pc-note{padding:0 12px 10px;font-size:.75rem;color:var(--muted,#526078);background:var(--surface,#fff)}",
    "@media (max-width:720px){.pc-btn{bottom:calc(88px + env(safe-area-inset-bottom))}.pc-panel{right:0;left:0;bottom:0;width:100%;height:min(85vh,640px);border-radius:14px 14px 0 0}}"
  ].join("");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Render text with clickable https links, without ever inserting HTML.
  function renderText(node, text) {
    node.textContent = "";
    var re = /https:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?)]/g, last = 0, m;
    while ((m = re.exec(text))) {
      node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el("a", null, m[0]);
      a.href = m[0]; a.target = "_blank"; a.rel = "noopener";
      node.appendChild(a);
      last = m.index + m[0].length;
    }
    node.appendChild(document.createTextNode(text.slice(last)));
  }

  var btn = el("button", "pc-btn");
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
  btn.appendChild(document.createTextNode(S.open));

  var panel = el("div", "pc-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", S.title);
  var head = el("div", "pc-head");
  head.appendChild(el("span", null, S.title));
  var x = el("button", "pc-x", "×");
  x.type = "button";
  x.setAttribute("aria-label", S.close);
  head.appendChild(x);
  var log = el("div", "pc-log");
  log.setAttribute("aria-live", "polite");
  var form = el("form", "pc-form");
  var input = el("textarea", "pc-in");
  input.rows = 1;
  input.maxLength = 1000;
  input.placeholder = S.ph;
  input.setAttribute("aria-label", S.ph);
  var send = el("button", "pc-send", S.send);
  send.type = "submit";
  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(form);
  panel.appendChild(el("div", "pc-note", S.note));
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var history = [];
  var busy = false;

  function add(role, text) {
    var n = el("div", "pc-m " + (role === "user" ? "u" : "a"));
    renderText(n, text);
    log.appendChild(n);
    log.scrollTop = log.scrollHeight;
    return n;
  }
  add("assistant", S.hi);

  function open() { panel.classList.add("open"); btn.style.display = "none"; input.focus(); }
  function close() { panel.classList.remove("open"); btn.style.display = ""; btn.focus(); }
  btn.addEventListener("click", open);
  x.addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true })); }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q || busy) return;
    busy = true; send.disabled = true;
    input.value = "";
    add("user", q);
    history.push({ role: "user", content: q });
    var out = add("assistant", S.wait);
    out.classList.add("wait");
    var text = "";

    fetch(ENDPOINT + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: lang, messages: history.slice(-12) })
    }).then(function (r) {
      if (r.status === 429 || r.status === 503) throw new Error("busy");
      if (!r.ok || !r.body) throw new Error("fail");
      var reader = r.body.getReader();
      var dec = new TextDecoder();
      function pump() {
        return reader.read().then(function (c) {
          if (c.done) return;
          text += dec.decode(c.value, { stream: true });
          out.classList.remove("wait");
          renderText(out, text);
          log.scrollTop = log.scrollHeight;
          return pump();
        });
      }
      return pump();
    }).then(function () {
      if (!text.trim()) throw new Error("empty");
      history.push({ role: "assistant", content: text });
    }).catch(function (err) {
      history.pop();
      out.classList.remove("wait");
      renderText(out, err && err.message === "busy" ? S.busy : S.err + " " + MESSENGER);
    }).then(function () {
      busy = false; send.disabled = false;
    });
  });
})();
