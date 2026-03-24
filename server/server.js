const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createDeepSeekClient, buildFallbackTutorReply } = require("./deepseek");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3000;
const deepseek = createDeepSeekClient(process.env);
const configSummary = deepseek.getConfigSummary();

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

  res.status(500).json({
    provider: "deepseek",
    status: "error"
  });
});

app.listen(port, function onListen() {
  console.log("DeepSeek server running at http://localhost:" + port);
  console.log("Provider: deepseek");
  console.log("Model: " + configSummary.model);
  console.log("Base URL: " + configSummary.baseUrl);

  if (!configSummary.hasKey) {
    console.warn("[config] 未检测到可用的 DeepSeek API Key。");
    console.warn("[config] 请复制 server/.env.example 为 server/.env，然后填写 DEEPSEEK_API_KEY。");
  } else {
    console.log("[config] DeepSeek API Key 已配置。前端现在可以通过 /api/tutor-reply 调用真实文字能力。");
  }

  console.log("[note] 当前语音仍使用浏览器原生 speechSynthesis，豆包 TTS 位置暂未接入。");
});
