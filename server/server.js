const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createDeepSeekClient, buildFallbackTutorReply } = require("./deepseek");
const { createDoubaoTtsClient, buildFallbackReply, utf8ByteLength } = require("./doubaoTts");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3000;
const deepseek = createDeepSeekClient(process.env);
const deepseekConfigSummary = deepseek.getConfigSummary();
const doubaoTts = createDoubaoTtsClient(process.env);
const ttsConfigSummary = doubaoTts.getConfigSummary();

function nowIso() {
  return new Date().toISOString();
}

function summarizeContext(context) {
  return {
    at: nowIso(),
    type: context && context.type ? String(context.type) : "-",
    taskId: context && context.taskId ? String(context.taskId) : "-"
  };
}

function summarizeTtsRequest(text) {
  const normalized = String(text || "");
  return {
    at: nowIso(),
    chars: normalized.length,
    bytes: utf8ByteLength(normalized)
  };
}

function logTutorRequest(summary) {
  console.log("[tutor-reply] request at=" + summary.at + " type=" + summary.type + " taskId=" + summary.taskId);
}

function logTutorResult(summary, meta) {
  const at = nowIso();
  const source = meta && meta.source ? meta.source : "fallback";

  if (source === "deepseek") {
    console.log("[deepseek] tutor-reply success at=" + at + " type=" + summary.type + " taskId=" + summary.taskId);
    return;
  }

  console.warn(
    "[deepseek] tutor-reply fallback at=" +
      at +
      " type=" +
      summary.type +
      " taskId=" +
      summary.taskId +
      " reason=" +
      (meta && meta.reason ? meta.reason : "unknown_error") +
      " message=" +
      (meta && meta.message ? meta.message : "-")
  );
}

function logTtsRequest(summary) {
  console.log("[tts] request at=" + summary.at + " chars=" + summary.chars + " bytes=" + summary.bytes);
}

function logTtsResult(summary, meta) {
  const at = nowIso();
  const source = meta && meta.source ? meta.source : "fallback";

  if (source === "doubao") {
    console.log("[tts] success at=" + at + " chars=" + summary.chars + " bytes=" + summary.bytes);
    return;
  }

  console.warn(
    "[tts] fallback at=" +
      at +
      " chars=" +
      summary.chars +
      " bytes=" +
      summary.bytes +
      " reason=" +
      (meta && meta.reason ? meta.reason : "unknown_error") +
      " message=" +
      (meta && meta.message ? meta.message : "-")
  );
}

app.use(cors());
app.use(express.json({ limit: "200kb" }));

app.get("/api/health", function handleHealth(req, res) {
  try {
    res.json(deepseek.getHealth());
  } catch (error) {
    console.error("[health]", error.message);
    res.json({
      provider: "deepseek",
      status: "error"
    });
  }
});

app.post("/api/tutor-reply", async function handleTutorReply(req, res) {
  const context = req.body && typeof req.body.context === "object" ? req.body.context : {};
  const summary = summarizeContext(context);

  logTutorRequest(summary);

  try {
    const result = await deepseek.getTutorReply(context);
    const reply = result && result.reply ? result.reply : buildFallbackTutorReply(context);
    const meta = result && result.meta
      ? result.meta
      : {
          source: reply.source || "fallback",
          reason: reply.source === "deepseek" ? "" : "unknown_error",
          message: "missing meta"
        };

    logTutorResult(summary, meta);
    res.json(reply);
  } catch (error) {
    const reply = buildFallbackTutorReply(context);
    logTutorResult(summary, {
      source: "fallback",
      reason: "server_handler_error",
      message: error && error.message ? error.message : "unknown error"
    });
    res.json(reply);
  }
});

app.post("/api/tts", async function handleTts(req, res) {
  const text = req.body && typeof req.body.text === "string" ? req.body.text : "";
  const summary = summarizeTtsRequest(text);

  logTtsRequest(summary);

  try {
    const result = await doubaoTts.getTtsAudio(text);
    const reply = result && result.reply ? result.reply : buildFallbackReply("unknown_error");
    const meta = result && result.meta
      ? result.meta
      : {
          source: reply.source || "fallback",
          reason: reply.source === "doubao" ? "" : "unknown_error",
          message: reply.error || "missing meta"
        };

    logTtsResult(summary, meta);
    res.json(reply);
  } catch (error) {
    const reply = buildFallbackReply("server_handler_error", error);
    logTtsResult(summary, {
      source: "fallback",
      reason: "server_handler_error",
      message: error && error.message ? error.message : "unknown error"
    });
    res.json(reply);
  }
});

app.use(function handleJsonError(error, req, res, next) {
  if (!error) {
    next();
    return;
  }

  console.error("[request-error]", error.message);

  if (req.path === "/api/tutor-reply") {
    const summary = summarizeContext({});
    const reply = buildFallbackTutorReply({});
    logTutorResult(summary, {
      source: "fallback",
      reason: "request_parse_error",
      message: error.message
    });
    res.json(reply);
    return;
  }

  if (req.path === "/api/tts") {
    const summary = summarizeTtsRequest("");
    const reply = buildFallbackReply("request_parse_error", error);
    logTtsResult(summary, {
      source: "fallback",
      reason: "request_parse_error",
      message: error.message
    });
    res.json(reply);
    return;
  }

  res.status(500).json({
    provider: "deepseek",
    status: "error"
  });
});

app.listen(port, function onListen() {
  console.log("DeepSeek server running at http://localhost:" + port);
  console.log("Provider: deepseek");
  console.log("Model: " + deepseekConfigSummary.model);
  console.log("Base URL: " + deepseekConfigSummary.baseUrl);

  if (!deepseekConfigSummary.hasKey) {
    console.warn("[config] 未检测到可用的 DeepSeek API Key。");
    console.warn("[config] 请复制 server/.env.example 为 server/.env，然后填写 DEEPSEEK_API_KEY。");
  } else {
    console.log("[config] DeepSeek API Key 已配置。前端现在可以通过 /api/tutor-reply 调用真实文字能力。");
  }

  if (!ttsConfigSummary.hasConfig) {
    console.warn("[config] 豆包 TTS 配置未完成，将自动回退到浏览器原生朗读。");
    console.warn("[config] 请在 server/.env 中填写 DOUBAO_TTS_APPID / TOKEN / CLUSTER / VOICE_TYPE。");
  } else {
    console.log("[config] 豆包 TTS 已配置。voice_type=" + ttsConfigSummary.voiceType + " cluster=" + ttsConfigSummary.cluster);
  }

  console.log("[note] 页面朗读现在会优先请求 /api/tts；失败时自动回退浏览器原生 speechSynthesis。");
});
