/**
 * Viewora Monetization v3.1
 * - Calculate → calc voice ("calculating…")
 * - Then music + amount UI
 * - $0 / < $1 → low-balance voice
 * - >= $1 → last 4s congrats voice + amount
 */
(function () {
  "use strict";
  if (window.__VIEWORA_MONO_V31__) return;
  window.__VIEWORA_MONO_V31__ = true;

  var MONEY_SOUND_SRC = "assets/sounds/money-circle.mp3";
  var $ = function (id) { return document.getElementById(id); };

  var VOICE = {
    calc: function (l) { return "assets/sounds/calc-" + l + ".mp3"; },
    low: function (l) { return "assets/sounds/low-" + l + ".mp3"; },
    congrats: function (l) { return "assets/sounds/voice-" + l + ".mp3"; }
  };

  var CURRENCIES = {
    USD:  { code: "USD",  symbol: "$",   name: "US Dollar",      rate: 1 },
    USDT: { code: "USDT", symbol: "₮",   name: "Tether",         rate: 1 },
    INR:  { code: "INR",  symbol: "₹",   name: "Indian Rupee",   rate: 84 },
    KRW:  { code: "KRW",  symbol: "₩",   name: "Korean Won",     rate: 1380 },
    EUR:  { code: "EUR",  symbol: "€",   name: "Euro",           rate: 0.92 },
    GBP:  { code: "GBP",  symbol: "£",   name: "British Pound",  rate: 0.79 },
    JPY:  { code: "JPY",  symbol: "¥",   name: "Japanese Yen",   rate: 150 },
    AED:  { code: "AED",  symbol: "د.إ", name: "UAE Dirham",     rate: 3.67 },
    BRL:  { code: "BRL",  symbol: "R$",  name: "Brazilian Real", rate: 5.1 },
    IDR:  { code: "IDR",  symbol: "Rp",  name: "Rupiah",         rate: 15800 },
    TRY:  { code: "TRY",  symbol: "₺",   name: "Turkish Lira",   rate: 34 },
    RUB:  { code: "RUB",  symbol: "₽",   name: "Russian Ruble",  rate: 95 },
    CNY:  { code: "CNY",  symbol: "¥",   name: "Chinese Yuan",   rate: 7.2 },
    VND:  { code: "VND",  symbol: "₫",   name: "Vietnamese Dong", rate: 25000 }
  };

  var CONGRATS = {
    en: "Congratulations! Your total earnings are {amount}.",
    hi: "बधाई हो! आपकी कुल कमाई {amount} है।",
    es: "¡Felicidades! Tus ganancias totales son {amount}.",
    pt: "Parabéns! Seus ganhos totais são {amount}.",
    fr: "Félicitations ! Vos gains totaux sont de {amount}.",
    de: "Herzlichen Glückwunsch! Ihre Gesamteinnahmen betragen {amount}.",
    ar: "تهانينا! إجمالي أرباحك هو {amount}.",
    id: "Selamat! Total penghasilan Anda adalah {amount}.",
    bn: "অভিনন্দন! আপনার মোট আয় {amount}।",
    ta: "வாழ்த்துகள்! உங்கள் மொத்த வருவாய் {amount}.",
    te: "అభినందనలు! మీ మొత్తం సంపాదన {amount}.",
    mr: "अभिनंदन! तुमची एकूण कमाई {amount} आहे.",
    gu: "અભિનંદન! તમારી કુલ કમાણી {amount} છે.",
    ja: "おめでとうございます！合計収益は {amount} です。",
    ko: "축하합니다! 총 수익은 {amount} 입니다.",
    zh: "恭喜！您的总收益是 {amount}。",
    ru: "Поздравляем! Ваш общий заработок — {amount}.",
    tr: "Tebrikler! Toplam kazancınız {amount}.",
    vi: "Chúc mừng! Tổng thu nhập của bạn là {amount}."
  };

  var state = {
    totalUsd: 0, monthUsd: 0, pendingUsd: 0, views: 0,
    giftsUsd: 0, adsUsd: 0, subsUsd: 0, tipsUsd: 0, productsUsd: 0,
    currency: localStorage.getItem("viewora_mono_cur") || "USD",
    busy: false,
    voiceTimer: null,
    stopTimer: null,
    countRaf: null,
    sfx: null
  };

  function cur() { return CURRENCIES[state.currency] || CURRENCIES.USD; }
  function toDisplay(usd) { return (Number(usd) || 0) * (cur().rate || 1); }
  function digits() {
    return (state.currency === "JPY" || state.currency === "KRW" || state.currency === "VND" || state.currency === "IDR") ? 0 : 2;
  }
  function fmtUsd(usd) {
    var n = toDisplay(usd);
    return cur().symbol + n.toLocaleString("en-US", { minimumFractionDigits: digits(), maximumFractionDigits: digits() });
  }
  function fmtNum(usd) {
    var n = toDisplay(usd);
    return n.toLocaleString("en-US", { minimumFractionDigits: digits(), maximumFractionDigits: digits() });
  }

  function detectLang() {
    try {
      var loc = (navigator.language || "en").toLowerCase();
      var p = loc.split("-")[0];
      if (CONGRATS[p]) return p;
      return "en";
    } catch (_) { return "en"; }
  }

  function amountSpeech() {
    var n = toDisplay(state.totalUsd);
    var code = cur().code;
    var whole = Math.floor(n);
    var frac = Math.round((n - whole) * 100);
    var lang = detectLang();
    if (lang === "hi") {
      return whole + (frac && digits() ? "." + String(frac).padStart(2, "0") : "") + (code === "INR" ? " रुपये" : " " + code);
    }
    return whole + (frac && digits() ? " point " + frac : "") + " " + code;
  }

  function congratsText() {
    var lang = detectLang();
    return (CONGRATS[lang] || CONGRATS.en).replace("{amount}", amountSpeech());
  }

  function showToast(text) {
    var old = document.getElementById("monoVoiceToast");
    if (old) old.remove();
    var el = document.createElement("div");
    el.id = "monoVoiceToast";
    el.style.cssText = "position:fixed;left:50%;bottom:calc(28px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:200;max-width:90%;background:rgba(18,18,28,.95);border:1px solid rgba(255,255,255,.12);color:#fff;padding:14px 18px;border-radius:16px;font-size:14px;font-weight:600;line-height:1.4;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.45)";
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .4s"; el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 450);
    }, 6000);
  }

  function stopSfx() {
    try {
      if (state.sfx) { state.sfx.pause(); state.sfx.src = ""; state.sfx = null; }
    } catch (_) {}
  }

  /** Play a voice mp3; resolves when ended or failed */
  function playVoiceFile(path) {
    return new Promise(function (resolve) {
      stopSfx();
      var a = new Audio(path);
      state.sfx = a;
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve(true);
      }
      a.onended = finish;
      a.onerror = function () { resolve(false); };
      a.oncanplaythrough = function () {
        a.play().catch(function () { resolve(false); });
      };
      setTimeout(function () { if (!done) resolve(false); }, 8000);
      try { a.load(); } catch (_) { resolve(false); }
    });
  }

  function refreshVoices() {
    try { return window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : []; }
    catch (_) { return []; }
  }

  function speakAmountTTS() {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      var lang = detectLang();
      var u = new SpeechSynthesisUtterance(amountSpeech());
      u.lang = lang === "hi" ? "hi-IN" : lang === "zh" ? "zh-CN" : lang === "en" ? "en-US" : lang;
      u.rate = 0.92;
      var voices = refreshVoices();
      for (var i = 0; i < voices.length; i++) {
        if ((voices[i].lang || "").toLowerCase().indexOf(lang) === 0) {
          u.voice = voices[i]; break;
        }
      }
      window.speechSynthesis.speak(u);
      setTimeout(function () {
        try { window.speechSynthesis.pause(); window.speechSynthesis.resume(); } catch (_) {}
      }, 40);
    } catch (e) { console.warn("[MONO] amount TTS", e); }
  }

  /** Congrats recorded + amount TTS — called in last 4s */
  function speakCongrats() {
    var lang = detectLang();
    var text = congratsText();
    showToast("🎉 " + text);
    var path = VOICE.congrats(lang);
    playVoiceFile(path).then(function (ok) {
      if (ok) {
        setTimeout(speakAmountTTS, 400);
      } else {
        // full TTS fallback
        try {
          if (!window.speechSynthesis) return;
          window.speechSynthesis.cancel();
          var u = new SpeechSynthesisUtterance(text);
          u.lang = lang === "hi" ? "hi-IN" : lang === "en" ? "en-US" : lang;
          u.rate = 0.92;
          window.speechSynthesis.speak(u);
        } catch (_) {}
      }
    });
  }

  function setEmptyHint(show) {
    var h = $("emptyHint");
    if (h) h.classList.toggle("hidden", !show);
  }

  function paint() {
    var c = cur();
    if ($("currencySymbol")) $("currencySymbol").textContent = c.symbol;
    if ($("btnCurrencyLabel")) $("btnCurrencyLabel").textContent = c.symbol;
    if ($("lblPeriod")) $("lblPeriod").textContent = "Available balance · " + c.code;
    if ($("statMonth")) $("statMonth").textContent = fmtUsd(state.monthUsd);
    if ($("statPending")) $("statPending").textContent = fmtUsd(state.pendingUsd);
    if ($("statViews")) $("statViews").textContent = String(state.views || 0);
    if ($("amtGifts")) $("amtGifts").textContent = fmtUsd(state.giftsUsd);
    if ($("amtAds")) $("amtAds").textContent = fmtUsd(state.adsUsd);
    if ($("amtSubs")) $("amtSubs").textContent = fmtUsd(state.subsUsd);
    if ($("amtTips")) $("amtTips").textContent = fmtUsd(state.tipsUsd);
    if ($("amtProducts")) $("amtProducts").textContent = fmtUsd(state.productsUsd);
    if ($("displayAmount") && !state.busy) $("displayAmount").textContent = fmtNum(state.totalUsd);
    setEmptyHint(!(state.totalUsd > 0));
  }

  function animateAmount(toUsd) {
    var el = $("displayAmount");
    if (!el) return;
    var from = parseFloat(String(el.textContent).replace(/,/g, "")) || 0;
    var to = toDisplay(toUsd);
    var start = performance.now(), dur = 1000;
    if (state.countRaf) cancelAnimationFrame(state.countRaf);
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var ease = 1 - Math.pow(1 - t, 3);
      var val = from + (to - from) * ease;
      el.textContent = val.toLocaleString("en-US", { minimumFractionDigits: digits(), maximumFractionDigits: digits() });
      if (t < 1) state.countRaf = requestAnimationFrame(step);
      else { el.textContent = fmtNum(toUsd); setEmptyHint(!(toUsd > 0)); }
    }
    state.countRaf = requestAnimationFrame(step);
  }

  var coins = [], coinAnim = null;
  
  function startCoinRain(ms) {
    var jar = $("moneyRing") || $("jar");
    var pile = $("jarCoins") || $("coins");
    var drop = $("dropZone");
    if (!jar) return;
    var end = Date.now() + (ms || 2500);
    var sym = (cur && cur().symbol) || "$";
    if (sym.length > 2) sym = "$";

    function dropOne() {
      if (Date.now() > end) return;
      if (drop) {
        var falling = document.createElement("div");
        falling.className = "falling-coin";
        falling.textContent = sym === "₹" ? "₹" : (sym === "€" ? "€" : "$");
        drop.appendChild(falling);
        setTimeout(function () { falling.remove(); }, 1050);
      }
      if (pile) {
        var coin = document.createElement("div");
        coin.className = "gullak-coin";
        coin.textContent = sym === "₹" ? "₹" : (sym === "€" ? "€" : "$");
        coin.style.left = (28 + Math.random() * 155) + "px";
        coin.style.top = (145 + Math.random() * 48) + "px";
        coin.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
        pile.appendChild(coin);
        // keep pile reasonable
        while (pile.children.length > 28) pile.removeChild(pile.firstChild);
      }
      jar.classList.remove("shake");
      void jar.offsetWidth;
      jar.classList.add("shake");
      if (Date.now() < end) setTimeout(dropOne, 380 + Math.random() * 220);
    }
    dropOne();
  }

  function resetRingFx() {
    try { var pile = $("jarCoins"); if (pile) pile.innerHTML = ""; } catch (_) {}
    var ring = $("moneyRing"), crack = $("glassCrack"), aura = $("greenAura");
    if (ring) ring.classList.remove("spinning", "magic-glow", "shattered");
    if (crack) { crack.classList.add("hidden"); crack.classList.remove("show"); }
    if (aura) aura.classList.remove("on");
  }

  function ensureMoneyAudio() {
    var audio = $("moneyAudio");
    if (!audio) return null;
    if (!audio.getAttribute("src") || String(audio.src).indexOf("money-circle") === -1) {
      audio.src = MONEY_SOUND_SRC;
    }
    return audio;
  }

  /**
   * Play circle music for `seconds`.
   * Voice callback fires at last 4 seconds (or near end if short).
   */
  function playSoundFor(seconds, onLast4, onDone) {
    var audio = ensureMoneyAudio();
    clearTimeout(state.voiceTimer);
    clearTimeout(state.stopTimer);
    if (!audio) {
      if (onLast4) onLast4();
      if (onDone) setTimeout(onDone, 500);
      return;
    }
    try { audio.pause(); audio.currentTime = 0; } catch (_) {}
    var dur = Math.max(2, seconds);
    // LAST 4 SECONDS — user request
    var voiceAt = Math.max(0.3, dur - 4);
    if (dur <= 5) voiceAt = Math.max(0.2, dur * 0.55);

    function arm() {
      if (onLast4) {
        state.voiceTimer = setTimeout(function () {
          try { onLast4(); } catch (e) { console.warn(e); }
        }, voiceAt * 1000);
      }
      state.stopTimer = setTimeout(function () {
        try { audio.pause(); } catch (_) {}
        if (onDone) onDone();
      }, dur * 1000);
    }

    var p = audio.play();
    if (p && p.then) {
      p.then(arm).catch(function () {
        if (onLast4) onLast4();
        if (onDone) onDone();
      });
    } else {
      arm();
    }
  }

  function musicSecondsFor(usd) {
    if (!(usd > 0)) return 5;
    if (usd < 1) return 8;
    var extra = Math.min(15, Math.log10(1 + usd) * 6);
    return Math.min(25, 10 + extra);
  }

  function unlockBtn() {
    var btn = $("btnCalculate");
    if (btn) {
      btn.disabled = false;
      var sp = btn.querySelector("span");
      if (sp) sp.textContent = "Calculate My Money";
    }
  }

  function runShow() {
    var usd = state.totalUsd;
    var ring = $("moneyRing");
    var crack = $("glassCrack");
    var aura = $("greenAura");
    var lang = detectLang();
    resetRingFx();

    if (!(usd > 0) || usd < 1) {
      // Low / zero — magic + green + low voice in last 4s
      if (ring) ring.classList.add("spinning", "magic-glow");
      if (aura) aura.classList.add("on");
      startCoinRain(usd > 0 ? 1800 : 1000);
      var sec = musicSecondsFor(usd);

      playSoundFor(sec, function () {
        // last 4s: low-balance message
        var path = VOICE.low(lang);
        showToast(lang === "hi"
          ? "आपका बैलेंस कम है। और मेहनत करो।"
          : "Balance low — keep creating, work a little harder.");
        playVoiceFile(path);
      }, function () {
        if (!(usd > 0)) {
          if (ring) { ring.classList.remove("spinning"); ring.classList.add("shattered"); }
          if (crack) { crack.classList.remove("hidden"); crack.classList.add("show"); }
        } else {
          if (ring) ring.classList.remove("spinning");
        }
        setTimeout(function () {
          if (aura) aura.classList.remove("on");
          if (ring) ring.classList.remove("magic-glow");
        }, 600);
        state.busy = false;
        unlockBtn();
      });
      return;
    }

    // >= $1
    if (ring) ring.classList.add("spinning", "magic-glow");
    if (aura) aura.classList.add("on");
    startCoinRain(3200);
    var sec2 = musicSecondsFor(usd);
    playSoundFor(sec2, function () {
      // LAST 4 SECONDS — congrats + amount
      speakCongrats();
    }, function () {
      if (ring) ring.classList.remove("spinning");
      setTimeout(function () {
        if (aura) aura.classList.remove("on");
        if (ring) ring.classList.remove("magic-glow");
      }, 800);
      state.busy = false;
      unlockBtn();
    });
  }

  function applyEarnings(e) {
    e = e || {};
    state.giftsUsd = Number(e.gifts || 0);
    state.adsUsd = Number(e.ads || 0);
    state.subsUsd = Number(e.subs || e.subscriptions || 0);
    state.tipsUsd = Number(e.tips || 0);
    state.productsUsd = Number(e.products || e.store || 0);
    state.monthUsd = Number(e.month || e.thisMonth || 0);
    state.pendingUsd = Number(e.pending || 0);
    state.views = Number(e.paidViews || e.views || 0);
    var sum = state.giftsUsd + state.adsUsd + state.subsUsd + state.tipsUsd + state.productsUsd;
    var reported = Number(e.total || e.balance || e.available || 0);
    state.totalUsd = reported > 0 ? reported : sum;
  }

  function calculateMyMoney() {
    if (state.busy) return;
    state.busy = true;
    var btn = $("btnCalculate");
    if (btn) {
      btn.disabled = true;
      var sp = btn.querySelector("span");
      if (sp) sp.textContent = "Calculating…";
    }
    resetRingFx();
    stopSfx();
    try { var ma = ensureMoneyAudio(); if (ma) ma.pause(); } catch (_) {}

    var lang = detectLang();
    // 1) First voice: calculating…
    showToast(lang === "hi"
      ? "आपकी कमाई कैलकुलेट की जा रही है…"
      : "Calculating your earnings…");

    playVoiceFile(VOICE.calc(lang)).then(function () {
      // 2) Fetch data then show
      function afterData() {
        paint();
        animateAmount(state.totalUsd);
        setTimeout(runShow, 350);
      }
      try {
        if (typeof firebase === "undefined" || !firebase.auth) {
          applyEarnings({}); afterData(); return;
        }
        var user = firebase.auth().currentUser;
        if (!user) { applyEarnings({}); afterData(); return; }
        firebase.database().ref("users/" + user.uid + "/earnings").once("value")
          .then(function (snap) { applyEarnings(snap.val() || {}); afterData(); })
          .catch(function () { applyEarnings({}); afterData(); });
      } catch (_) { applyEarnings({}); afterData(); }
    });
  }

  function buildCurrencyGrid() {
    var grid = $("currencyGrid");
    if (!grid) return;
    grid.innerHTML = "";
    Object.keys(CURRENCIES).forEach(function (key) {
      var c = CURRENCIES[key];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mono-lang-btn" + (key === state.currency ? " active" : "");
      btn.innerHTML = c.symbol + " " + c.code + "<small>" + c.name + "</small>";
      btn.addEventListener("click", function () {
        state.currency = key;
        try { localStorage.setItem("viewora_mono_cur", key); } catch (_) {}
        buildCurrencyGrid();
        paint();
        if ($("displayAmount")) $("displayAmount").textContent = fmtNum(state.totalUsd);
        closeCur();
      });
      grid.appendChild(btn);
    });
  }
  function openCur() { var s = $("currencySheet"); if (s) s.classList.remove("hidden"); }
  function closeCur() { var s = $("currencySheet"); if (s) s.classList.add("hidden"); }

  function wire() {
    if ($("btnBack")) {
      $("btnBack").onclick = function () {
        if (history.length > 1) history.back();
        else location.href = "settings.html";
      };
    }
    if ($("btnCurrency")) $("btnCurrency").onclick = openCur;
    if ($("btnCalculate")) $("btnCalculate").onclick = calculateMyMoney;
    if ($("btnWithdraw")) {
      $("btnWithdraw").onclick = function () {
        alert("Withdrawals (UPI, Binance, PayPal) unlock after live payment setup.");
      };
    }
    document.querySelectorAll("[data-close=cur]").forEach(function (el) {
      el.addEventListener("click", closeCur);
    });
    buildCurrencyGrid();
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = function () { window.speechSynthesis.getVoices(); };
      }
    } catch (_) {}
  }

  function boot() {
    wire();
    state.totalUsd = 0;
    paint();
    if ($("displayAmount")) $("displayAmount").textContent = "0.00";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.VieworaMonetization = { calculate: calculateMyMoney };
})();
