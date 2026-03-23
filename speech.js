(function initSpeech(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};

  let speechVoice = null;
  let currentUtterance = null;
  let currentSpeechItem = null;
  let speechToken = 0;
  const queue = [];

  function renderControls() {
    if (App.render && typeof App.render.renderControls === "function") {
      App.render.renderControls();
    }
  }

  function registerInteraction() {
    App.store.app.hasUserInteracted = true;
  }

  function loadVoices() {
    if (!("speechSynthesis" in global)) {
      return;
    }

    const voices = global.speechSynthesis.getVoices();
    speechVoice =
      voices.find(function findZhCn(voice) {
        return /zh/i.test(voice.lang) && /CN|Hans|Chinese/i.test(voice.lang + voice.name);
      }) ||
      voices.find(function findZh(voice) {
        return /zh/i.test(voice.lang);
      }) ||
      null;
  }

  function finalizeSpeech(token) {
    if (token !== speechToken) {
      return;
    }

    const finished = currentSpeechItem;
    speechToken = 0;
    currentUtterance = null;
    currentSpeechItem = null;
    renderControls();

    if (finished && typeof finished.resolve === "function") {
      finished.resolve();
    }

    playNext();
  }

  function playNext() {
    if (App.store.app.isMuted || !App.store.app.hasUserInteracted) {
      renderControls();
      return;
    }

    if (!("speechSynthesis" in global)) {
      while (queue.length) {
        const item = queue.shift();
        if (typeof item.onStart === "function") {
          item.onStart();
        }
        if (typeof item.resolve === "function") {
          item.resolve();
        }
      }
      currentSpeechItem = null;
      renderControls();
      return;
    }

    if (currentSpeechItem || !queue.length) {
      renderControls();
      return;
    }

    const item = queue.shift();
    const utterance = new SpeechSynthesisUtterance(item.text);

    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.pitch = 1.08;

    if (speechVoice) {
      utterance.voice = speechVoice;
    }

    speechToken += 1;
    const token = speechToken;
    currentUtterance = utterance;
    currentSpeechItem = item;

    if (typeof item.onStart === "function") {
      item.onStart();
    }

    utterance.onend = function onend() {
      finalizeSpeech(token);
    };

    utterance.onerror = function onerror() {
      finalizeSpeech(token);
    };

    renderControls();

    try {
      global.speechSynthesis.speak(utterance);
    } catch (error) {
      App.log("warn", "浏览器朗读失败，已降级继续。", { message: error.message });
      finalizeSpeech(token);
    }
  }

  function speak(text, options) {
    const settings = options || {};
    const normalized = (text || "").trim();

    if (!normalized || App.store.app.isMuted || !App.store.app.hasUserInteracted) {
      if (typeof settings.onStart === "function") {
        settings.onStart();
      }
      return Promise.resolve();
    }

    if (!("speechSynthesis" in global)) {
      if (typeof settings.onStart === "function") {
        settings.onStart();
      }
      return Promise.resolve();
    }

    const lastQueued = queue.length ? queue[queue.length - 1].text : "";
    const current = currentSpeechItem ? currentSpeechItem.text : "";

    if (normalized === lastQueued || normalized === current) {
      if (typeof settings.onStart === "function") {
        settings.onStart();
      }
      return Promise.resolve();
    }

    return new Promise(function enqueue(resolve) {
      queue.push({
        text: normalized,
        onStart: settings.onStart || null,
        resolve: resolve,
      });
      playNext();
    });
  }

  function stop() {
    const pending = queue.slice();
    const active = currentSpeechItem;

    queue.length = 0;
    currentSpeechItem = null;
    currentUtterance = null;
    speechToken = 0;
    renderControls();

    if (active && typeof active.resolve === "function") {
      active.resolve();
    }

    pending.forEach(function resolvePending(item) {
      if (typeof item.resolve === "function") {
        item.resolve();
      }
    });

    if ("speechSynthesis" in global) {
      global.speechSynthesis.cancel();
    }
  }

  function skip() {
    if (!currentSpeechItem) {
      return;
    }

    const token = speechToken;

    if ("speechSynthesis" in global) {
      global.speechSynthesis.cancel();
    }

    global.setTimeout(function skipDone() {
      finalizeSpeech(token);
    }, 0);
  }

  function initialize() {
    loadVoices();
    if ("speechSynthesis" in global) {
      global.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  function isPending() {
    return Boolean(currentSpeechItem || queue.length);
  }

  App.speech = {
    initialize: initialize,
    registerInteraction: registerInteraction,
    speak: speak,
    stop: stop,
    skip: skip,
    isPending: isPending,
  };
})(window);
