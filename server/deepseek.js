const DEFAULT_PROVIDER = "deepseek";
const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_TIMEOUT_MS = 15000;
const ALLOWED_MOODS = ["guide", "success", "error", "voice"];

const SYSTEM_PROMPT = [
  "你是‘积木小老师’项目里的编程启蒙老师，面向 5 到 9 岁儿童。",
  "你要根据前端传来的 context，生成温柔、鼓励、简短的中文提示。",
  "请始终输出 json，并且只输出一个 json object。",
  "json 字段固定为：text、mood、suggestion、speakText。",
  "mood 只能是 guide、success、error、voice 其中之一。",
  "text 用 1 到 2 句短句，适合孩子听。",
  "suggestion 只给一个下一步动作，尽量具体。",
  "speakText 适合浏览器朗读，可以与 text 相同。",
  "不要输出 markdown，不要输出代码块，不要输出额外解释。",
  "不要使用复杂术语，不要讲太长，不要制造压力。",
  "如果 context.type 是 success，要先夸奖。",
  "如果 context.type 是 error，要先安抚，再给一个小提示。",
  "如果 context.type 是 task，要帮助孩子开始搭积木。",
  "如果 context.type 是 voice，要像老师听懂孩子的话一样回应。",
  'json 示例：{"text":"我们先试一小步吧。","mood":"guide","suggestion":"先拖一个开始积木。","speakText":"我们先试一小步吧。"}'
].join("\n");

function nowIso() {
  return new Date().toISOString();
}

function logDeepSeek(level, message) {
  const writer = level === "warn" ? console.warn : console.log;
  writer("[deepseek] " + message);
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

function isMissingKey(apiKey) {
  const value = String(apiKey || "").trim();
  return !value || value === "YOUR_DEEPSEEK_API_KEY_HERE";
}

function clipText(value, fallback, maxLength) {
  const text = String(value || fallback || "").trim();
  if (!text) {
    return String(fallback || "").trim();
  }

  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function withSource(reply, source) {
  return Object.assign({}, reply || {}, {
    source: source === "deepseek" ? "deepseek" : "fallback"
  });
}

function buildFallbackTutorReply(context) {
  const safeContext = context && typeof context === "object" ? context : {};

  if (safeContext.type === "success") {
    return withSource({
      text: "太棒啦，我们做到了。",
      mood: "success",
      suggestion: safeContext.suggestion || "想不想再试一个新任务？",
      speakText: "太棒啦，我们做到了。"
    }, "fallback");
  }

  if (safeContext.type === "voice") {
    return withSource({
      text: safeContext.reply || "我听懂啦，我们继续搭积木吧。",
      mood: "voice",
      suggestion: safeContext.suggestion || "先把想做的第一块积木拖进去。",
      speakText: safeContext.reply || "我听懂啦，我们继续搭积木吧。"
    }, "fallback");
  }

  if (safeContext.type === "error") {
    return withSource({
      text: safeContext.text || "没关系，我们再试一次。",
      mood: "error",
      suggestion: safeContext.suggestion || "先看看第一块积木放对了吗？",
      speakText: safeContext.text || "没关系，我们再试一次。"
    }, "fallback");
  }

  if (typeof safeContext.text === "string" && safeContext.text.trim()) {
    return withSource({
      text: safeContext.text.trim(),
      mood: ALLOWED_MOODS.includes(safeContext.mood) ? safeContext.mood : "guide",
      suggestion: safeContext.suggestion || "先拖一个开始积木。",
      speakText: safeContext.speakText || safeContext.text.trim()
    }, "fallback");
  }

  return withSource({
    text: "我们继续试试看吧。",
    mood: "guide",
    suggestion: safeContext.suggestion || "先拖一个开始积木。",
    speakText: "我们继续试试看吧。"
  }, "fallback");
}

function buildUserPrompt(context) {
  const safeContext = context && typeof context === "object" ? context : {};

  return [
    "请根据下面的 context 生成 json。",
    "只返回一个 json object，不要返回 markdown。",
    "context json:",
    JSON.stringify(safeContext, null, 2)
  ].join("\n");
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  const withoutFence = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const direct = safeJsonParse(withoutFence);
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct;
  }

  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const sliced = withoutFence.slice(firstBrace, lastBrace + 1);
    const parsed = safeJsonParse(sliced);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeTutorReply(raw, context, source) {
  const fallback = buildFallbackTutorReply(context);
  const input = raw && typeof raw === "object" ? raw : {};
  const mood = ALLOWED_MOODS.includes(input.mood) ? input.mood : fallback.mood;
  const text = clipText(input.text, fallback.text, 80);
  const suggestion = clipText(input.suggestion, fallback.suggestion, 60);
  const speakText = clipText(input.speakText, text, 100);

  return withSource({
    text,
    mood,
    suggestion,
    speakText
  }, source);
}

function createFallbackResult(context, reason, error) {
  const message = error && error.message ? error.message : "";
  logDeepSeek("warn", "upstream fallback-prep at=" + nowIso() + " reason=" + (reason || "unknown_error") + " message=" + (message || "-"));

  return {
    reply: buildFallbackTutorReply(context),
    meta: {
      source: "fallback",
      reason: reason || "unknown_error",
      message: message
    }
  };
}

function classifyFailure(error) {
  const message = error && error.message ? error.message : "";

  if (/未配置/.test(message)) {
    return "missing_key";
  }

  if (/超时/.test(message)) {
    return "timeout";
  }

  if (/可解析的 JSON/.test(message)) {
    return "json_parse_error";
  }

  if (/HTTP\s+\d+/.test(message)) {
    return "http_error";
  }

  if (error && error.name === "TypeError") {
    return "network_error";
  }

  return "unknown_error";
}

function createDeepSeekClient(env) {
  const apiKey = String(env.DEEPSEEK_API_KEY || "").trim();
  const baseUrl = normalizeBaseUrl(env.DEEPSEEK_BASE_URL);
  const model = String(env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const timeoutMs = Number(env.DEEPSEEK_TIMEOUT_MS) > 0 ? Number(env.DEEPSEEK_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;

  async function callDeepSeek(context) {
    if (isMissingKey(apiKey)) {
      throw new Error("DeepSeek API Key 未配置。请先在 server/.env 中填写 DEEPSEEK_API_KEY。");
    }

    if (typeof fetch !== "function") {
      throw new Error("当前 Node.js 版本不支持全局 fetch，请使用 Node.js 18 或更高版本。");
    }

    const controller = new AbortController();
    const timer = setTimeout(function abortRequest() {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
          model,
          max_tokens: 220,
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(context) }
          ]
        }),
        signal: controller.signal
      });

      const data = await response.json().catch(function fallbackJsonParse() {
        return null;
      });

      if (!response.ok) {
        const serverMessage = data && data.error && data.error.message ? data.error.message : "DeepSeek 返回了异常状态。";
        throw new Error("DeepSeek 请求失败：HTTP " + response.status + " - " + serverMessage);
      }

      const content = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
      const parsed = extractJsonObject(content);
      if (!parsed) {
        throw new Error("DeepSeek 返回内容不是可解析的 JSON。");
      }

      logDeepSeek("info", "upstream request success at=" + nowIso() + " model=" + model);
      return {
        reply: normalizeTutorReply(parsed, context, "deepseek"),
        meta: {
          source: "deepseek",
          reason: "",
          message: ""
        }
      };
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("DeepSeek 请求超时，请稍后再试。");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    provider: DEFAULT_PROVIDER,
    getHealth() {
      if (isMissingKey(apiKey)) {
        return { provider: DEFAULT_PROVIDER, status: "missing_key" };
      }

      return { provider: DEFAULT_PROVIDER, status: "ready" };
    },
    getConfigSummary() {
      return {
        provider: DEFAULT_PROVIDER,
        baseUrl,
        model,
        timeoutMs,
        hasKey: !isMissingKey(apiKey)
      };
    },
    async getTutorReply(context) {
      try {
        return await callDeepSeek(context);
      } catch (error) {
        return createFallbackResult(context, classifyFailure(error), error);
      }
    }
  };
}

module.exports = {
  createDeepSeekClient,
  buildFallbackTutorReply
};
