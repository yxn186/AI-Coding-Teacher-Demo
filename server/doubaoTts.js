const crypto = require("crypto");

const DEFAULT_TTS_URL = "https://openspeech.bytedance.com/api/v1/tts";
const DEFAULT_FORMAT = "mp3";
const DEFAULT_RATE = 24000;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TTS_BYTES = 1024;
const SUCCESS_CODE = 3000;

function nowIso() {
  return new Date().toISOString();
}

function logTts(level, message) {
  const writer = level === "warn" ? console.warn : console.log;
  writer("[tts] " + message);
}

function trimEnv(value) {
  return String(value || "").trim();
}

function isMissingValue(value) {
  const normalized = trimEnv(value);
  return !normalized || /YOUR_.+_HERE/.test(normalized);
}

function utf8ByteLength(text) {
  return Buffer.byteLength(String(text || ""), "utf8");
}

function clipText(value, maxLength) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function buildFallbackReply(reason, error) {
  const message = error && error.message ? error.message : "";
  return {
    audioBase64: "",
    format: DEFAULT_FORMAT,
    source: "fallback",
    error: reason ? reason + (message ? ": " + message : "") : (message || "unknown_error")
  };
}

function buildFallbackResult(reason, error) {
  const message = error && error.message ? error.message : "";
  logTts("warn", "fallback-prep at=" + nowIso() + " reason=" + (reason || "unknown_error") + " message=" + (message || "-"));

  return {
    reply: buildFallbackReply(reason || "unknown_error", error),
    meta: {
      source: "fallback",
      reason: reason || "unknown_error",
      message: message || ""
    }
  };
}

function normalizeEncoding(value) {
  return trimEnv(value) || DEFAULT_FORMAT;
}

function classifyFailure(error) {
  const message = error && error.message ? error.message : "";

  if (/未完成|未配置/.test(message)) {
    return "missing_config";
  }

  if (/为空/.test(message)) {
    return "text_empty";
  }

  if (/过长/.test(message)) {
    return "text_too_long";
  }

  if (/超时/.test(message)) {
    return "timeout";
  }

  if (/HTTP\s+\d+/.test(message)) {
    return "request_failed";
  }

  if (/无效响应|返回数据/.test(message)) {
    return "invalid_response";
  }

  if (error && (error.name === "TypeError" || error.name === "AbortError")) {
    return "request_failed";
  }

  return "request_failed";
}

function createDoubaoTtsClient(env) {
  const appId = trimEnv(env.DOUBAO_TTS_APPID);
  const token = trimEnv(env.DOUBAO_TTS_TOKEN);
  const cluster = trimEnv(env.DOUBAO_TTS_CLUSTER);
  const voiceType = trimEnv(env.DOUBAO_TTS_VOICE_TYPE);
  const rate = Number(env.DOUBAO_TTS_RATE) > 0 ? Number(env.DOUBAO_TTS_RATE) : DEFAULT_RATE;
  const encoding = normalizeEncoding(env.DOUBAO_TTS_ENCODING);
  const speedRatio = Number(env.DOUBAO_TTS_SPEED_RATIO) > 0 ? Number(env.DOUBAO_TTS_SPEED_RATIO) : 1.0;
  const volumeRatio = Number(env.DOUBAO_TTS_VOLUME_RATIO) > 0 ? Number(env.DOUBAO_TTS_VOLUME_RATIO) : 1.0;
  const pitchRatio = Number(env.DOUBAO_TTS_PITCH_RATIO) > 0 ? Number(env.DOUBAO_TTS_PITCH_RATIO) : 1.0;
  const timeoutMs = Number(env.DOUBAO_TTS_TIMEOUT_MS) > 0 ? Number(env.DOUBAO_TTS_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;

  function hasRequiredConfig() {
    return !isMissingValue(appId) && !isMissingValue(token) && !isMissingValue(cluster) && !isMissingValue(voiceType);
  }

  function getConfigSummary() {
    return {
      hasConfig: hasRequiredConfig(),
      cluster: cluster || "",
      voiceType: voiceType || "",
      encoding: encoding,
      rate: rate,
      timeoutMs: timeoutMs
    };
  }

  function validateText(text) {
    const normalized = clipText(text, 5000);
    if (!normalized) {
      throw new Error("TTS 文本为空。");
    }

    const bytes = utf8ByteLength(normalized);
    if (bytes > MAX_TTS_BYTES) {
      throw new Error("TTS 文本过长，已超过单次上限。");
    }

    return normalized;
  }

  function buildRequestBody(text) {
    return {
      app: {
        appid: appId,
        token: token,
        cluster: cluster
      },
      user: {
        uid: "jimu-local-user"
      },
      audio: {
        voice_type: voiceType,
        encoding: encoding,
        speed_ratio: speedRatio,
        volume_ratio: volumeRatio,
        pitch_ratio: pitchRatio,
        rate: rate
      },
      request: {
        reqid: crypto.randomUUID(),
        text: text,
        text_type: "plain",
        operation: "query"
      }
    };
  }

  async function callDoubao(text) {
    if (!hasRequiredConfig()) {
      throw new Error("豆包 TTS 配置未完成。请填写 appid、token、cluster、voice_type。");
    }

    if (typeof fetch !== "function") {
      throw new Error("当前 Node.js 版本不支持全局 fetch，请使用 Node.js 18 或更高版本。");
    }

    const normalizedText = validateText(text);
    const controller = new AbortController();
    const timer = setTimeout(function abortRequest() {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(DEFAULT_TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer;" + token
        },
        body: JSON.stringify(buildRequestBody(normalizedText)),
        signal: controller.signal
      });

      const data = await response.json().catch(function onParseError() {
        return null;
      });

      if (!response.ok) {
        const serverMessage = data && data.message ? data.message : "豆包 TTS 返回了异常状态。";
        throw new Error("豆包 TTS 请求失败：HTTP " + response.status + " - " + serverMessage);
      }

      if (!data || typeof data !== "object") {
        throw new Error("豆包 TTS 返回数据为空。");
      }

      if (Number(data.code) !== SUCCESS_CODE || !trimEnv(data.data)) {
        throw new Error("豆包 TTS 返回无效响应。code=" + String(data.code));
      }

      logTts("info", "upstream request success at=" + nowIso() + " voice_type=" + voiceType + " bytes=" + utf8ByteLength(normalizedText));
      return {
        reply: {
          audioBase64: trimEnv(data.data),
          format: encoding,
          source: "doubao"
        },
        meta: {
          source: "doubao",
          reason: "",
          message: ""
        }
      };
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("豆包 TTS 请求超时，请稍后再试。");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    getConfigSummary: getConfigSummary,
    async getTtsAudio(text) {
      try {
        return await callDoubao(text);
      } catch (error) {
        return buildFallbackResult(classifyFailure(error), error);
      }
    }
  };
}

module.exports = {
  createDoubaoTtsClient,
  utf8ByteLength,
  buildFallbackReply
};
