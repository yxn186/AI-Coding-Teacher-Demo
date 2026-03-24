(function initSpeech(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};
  const TTS_SEGMENT_LIMIT = 900;

  let speechVoice = null;
  let currentUtterance = null;
  let currentSpeechItem = null;
  let currentAudioElement = null;
  let currentAudioUrl = "";
  let currentRemoteAudioDone = null;
  let currentLocalDone = null;
  let currentFetchController = null;
  let speechToken = 0;
  const queue = [];
  const textEncoder = typeof global.TextEncoder === "function" ? new global.TextEncoder() : null;

  function renderControls() {
    if (App.render && typeof App.render.renderControls === "function") {
      App.render.renderControls();
    }
  }

  function renderDebugPanel() {
    if (App.render && typeof App.render.renderDebugPanel === "function") {
      App.render.renderDebugPanel();
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

  function isAbortError(error) {
    return Boolean(error && (error.name === "AbortError" || /已取消/.test(error.message || "")));
  }

  function setTtsDebug(source, error) {
    App.store.app.lastTtsSource = source || "unknown";
    App.store.app.lastTtsError = error || "";
    renderDebugPanel();
  }

  function utf8ByteLength(text) {
    const value = String(text || "");

    if (textEncoder) {
      return textEncoder.encode(value).length;
    }

    return unescape(encodeURIComponent(value)).length;
  }

  function splitTextForTts(text) {
    const normalized = String(text || "").trim();
    if (!normalized) {
      return [];
    }

    const sentences = [];
    let currentSentence = "";

    Array.from(normalized).forEach(function pushChar(char) {
      currentSentence += char;
      if (/[。！？!?；;\n]/.test(char)) {
        sentences.push(currentSentence);
        currentSentence = "";
      }
    });

    if (currentSentence) {
      sentences.push(currentSentence);
    }

    const segments = [];
    let currentSegment = "";

    sentences.forEach(function appendSentence(sentence) {
      if (!sentence) {
        return;
      }

      if (utf8ByteLength(sentence) > TTS_SEGMENT_LIMIT) {
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = "";
        }

        let chunk = "";
        Array.from(sentence).forEach(function splitChar(char) {
          const candidate = chunk + char;
          if (chunk && utf8ByteLength(candidate) > TTS_SEGMENT_LIMIT) {
            segments.push(chunk);
            chunk = char;
            return;
          }

          chunk = candidate;
        });

        if (chunk) {
          segments.push(chunk);
        }
        return;
      }

      if (!currentSegment) {
        currentSegment = sentence;
        return;
      }

      if (utf8ByteLength(currentSegment + sentence) <= TTS_SEGMENT_LIMIT) {
        currentSegment += sentence;
        return;
      }

      segments.push(currentSegment);
      currentSegment = sentence;
    });

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments.length ? segments : [normalized];
  }

  function isCurrentItemActive(token, item) {
    return token === speechToken && currentSpeechItem === item;
  }

  function clearFetchController() {
    currentFetchController = null;
  }

  function cancelCurrentFetch() {
    if (currentFetchController) {
      currentFetchController.abort();
      currentFetchController = null;
    }
  }

  function releaseRemoteAudioResources() {
    if (currentAudioElement) {
      currentAudioElement.onended = null;
      currentAudioElement.onerror = null;
      currentAudioElement.pause();
      currentAudioElement.removeAttribute("src");
      currentAudioElement.load();
    }

    if (currentAudioUrl) {
      global.URL.revokeObjectURL(currentAudioUrl);
    }

    currentAudioElement = null;
    currentAudioUrl = "";
    currentRemoteAudioDone = null;
  }

  function cancelCurrentRemoteAudio() {
    const done = currentRemoteAudioDone;
    releaseRemoteAudioResources();
    if (typeof done === "function") {
      done(false);
    }
  }

  function cancelCurrentLocalSpeech() {
    const done = currentLocalDone;

    if (currentUtterance) {
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
    }

    currentUtterance = null;
    currentLocalDone = null;

    if ("speechSynthesis" in global) {
      global.speechSynthesis.cancel();
    }

    if (typeof done === "function") {
      done(false);
    }
  }

  function cancelActivePlayback() {
    cancelCurrentFetch();
    cancelCurrentRemoteAudio();
    cancelCurrentLocalSpeech();
  }

  function finalizeSpeech(token) {
    if (token !== speechToken) {
      return;
    }

    const finished = currentSpeechItem;
    currentSpeechItem = null;
    currentUtterance = null;
    currentLocalDone = null;
    clearFetchController();
    releaseRemoteAudioResources();
    renderControls();

    if (finished && typeof finished.resolve === "function") {
      finished.resolve();
    }

    playNext();
  }

  function decodeBase64ToBlob(base64, format) {
    const binary = global.atob(base64);
    const bytes = new Uint8Array(binary.length);
    let index = 0;

    while (index < binary.length) {
      bytes[index] = binary.charCodeAt(index);
      index += 1;
    }

    return new Blob([bytes], {
      type: format === "wav" ? "audio/wav" : format === "ogg" ? "audio/ogg" : "audio/mpeg",
    });
  }

  function playRemoteAudioSegment(audioBase64, format) {
    return new Promise(function startRemotePlayback(resolve) {
      let settled = false;
      const blob = decodeBase64ToBlob(audioBase64, format || "mp3");
      const url = global.URL.createObjectURL(blob);
      const audio = new Audio();

      function done(value) {
        if (settled) {
          return;
        }
        settled = true;
        releaseRemoteAudioResources();
        resolve(value);
      }

      currentAudioElement = audio;
      currentAudioUrl = url;
      currentRemoteAudioDone = done;

      audio.preload = "auto";
      audio.src = url;
      audio.onended = function onended() {
        done(true);
      };
      audio.onerror = function onerror() {
        done(false);
      };

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(function onPlayError() {
          done(false);
        });
      }
    });
  }

  function playLocalSpeech(text) {
    return new Promise(function startLocalSpeech(resolve) {
      if (!("speechSynthesis" in global)) {
        resolve(true);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      let settled = false;

      function done(value) {
        if (settled) {
          return;
        }
        settled = true;
        currentUtterance = null;
        currentLocalDone = null;
        resolve(value);
      }

      utterance.lang = "zh-CN";
      utterance.rate = 0.95;
      utterance.pitch = 1.08;

      if (speechVoice) {
        utterance.voice = speechVoice;
      }

      currentUtterance = utterance;
      currentLocalDone = done;

      utterance.onend = function onend() {
        done(true);
      };

      utterance.onerror = function onerror() {
        done(true);
      };

      try {
        global.speechSynthesis.speak(utterance);
      } catch (error) {
        App.log("warn", "浏览器朗读失败，已降级继续。", { message: error.message });
        done(true);
      }
    });
  }

  async function requestRemoteAudio(text) {
    if (!App.api || typeof App.api.getTtsAudio !== "function") {
      return {
        audioBase64: "",
        format: "mp3",
        source: "fallback",
        error: "tts_api_unavailable",
      };
    }

    const controller = new AbortController();
    currentFetchController = controller;

    try {
      return await App.api.getTtsAudio(text, { signal: controller.signal });
    } finally {
      if (currentFetchController === controller) {
        clearFetchController();
      }
    }
  }

  async function speakRemainingLocally(text) {
    setTtsDebug("fallback", App.store.app.lastTtsError || "browser_tts_fallback");
    return playLocalSpeech(text);
  }

  async function processSpeechItem(item, token) {
    const fullText = item.text;
    const segments = splitTextForTts(fullText);

    if (!segments.length) {
      finalizeSpeech(token);
      return;
    }

    for (let index = 0; index < segments.length; index += 1) {
      if (!isCurrentItemActive(token, item)) {
        return;
      }

      const segment = segments[index];
      let ttsResult = null;

      try {
        ttsResult = await requestRemoteAudio(segment);
      } catch (error) {
        if (isAbortError(error) || !isCurrentItemActive(token, item)) {
          return;
        }

        App.log("warn", "远程 TTS 中断，已回退浏览器朗读。", { message: error.message });
        setTtsDebug("fallback", error.message || "request_aborted");

        const localFinished = await speakRemainingLocally(segments.slice(index).join(""));
        if (localFinished && isCurrentItemActive(token, item)) {
          finalizeSpeech(token);
        }
        return;
      }

      if (!isCurrentItemActive(token, item)) {
        return;
      }

      if (ttsResult && ttsResult.source === "doubao" && ttsResult.audioBase64) {
        let remoteFinished = false;

        try {
          setTtsDebug("doubao", "");
          remoteFinished = await playRemoteAudioSegment(ttsResult.audioBase64, ttsResult.format || "mp3");
        } catch (error) {
          App.log("warn", "远程音频解码失败，已回退浏览器朗读。", {
            message: error && error.message ? error.message : "audio_decode_failed",
            format: ttsResult.format || "mp3",
          });
          setTtsDebug("fallback", error && error.message ? error.message : "audio_decode_failed");

          const decodeFallbackFinished = await speakRemainingLocally(segments.slice(index).join(""));
          if (decodeFallbackFinished && isCurrentItemActive(token, item)) {
            finalizeSpeech(token);
          }
          return;
        }

        if (!isCurrentItemActive(token, item)) {
          return;
        }

        if (remoteFinished) {
          continue;
        }

        App.log("warn", "远程音频播放失败，已回退浏览器朗读。", {
          message: "audio_playback_failed",
          format: ttsResult.format || "mp3",
        });
        setTtsDebug("fallback", "audio_playback_failed");

        const fallbackFinished = await speakRemainingLocally(segments.slice(index).join(""));
        if (fallbackFinished && isCurrentItemActive(token, item)) {
          finalizeSpeech(token);
        }
        return;
      }

      App.log("warn", "豆包 TTS 不可用，已回退浏览器朗读。", {
        reason: ttsResult && ttsResult.error ? ttsResult.error : "fallback",
      });
      setTtsDebug("fallback", ttsResult && ttsResult.error ? ttsResult.error : "fallback");

      const localFinished = await speakRemainingLocally(segments.slice(index).join(""));
      if (localFinished && isCurrentItemActive(token, item)) {
        finalizeSpeech(token);
      }
      return;
    }

    if (isCurrentItemActive(token, item)) {
      finalizeSpeech(token);
    }
  }

  function playNext() {
    if (App.store.app.isMuted || !App.store.app.hasUserInteracted) {
      renderControls();
      return;
    }

    if (currentSpeechItem || !queue.length) {
      renderControls();
      return;
    }

    const item = queue.shift();
    speechToken += 1;
    const token = speechToken;
    currentSpeechItem = item;

    if (typeof item.onStart === "function") {
      item.onStart();
    }

    renderControls();
    processSpeechItem(item, token);
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
    speechToken += 1;
    cancelActivePlayback();
    currentSpeechItem = null;
    renderControls();

    if (active && typeof active.resolve === "function") {
      active.resolve();
    }

    pending.forEach(function resolvePending(item) {
      if (typeof item.resolve === "function") {
        item.resolve();
      }
    });
  }

  function skip() {
    if (!currentSpeechItem) {
      return;
    }

    const active = currentSpeechItem;

    speechToken += 1;
    cancelActivePlayback();
    currentSpeechItem = null;
    renderControls();

    if (active && typeof active.resolve === "function") {
      active.resolve();
    }

    playNext();
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
