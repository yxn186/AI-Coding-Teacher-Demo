(function initApi(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};
  const config = App.config;
  const createMessage = App.createMessage;

  const API_MODE_STORAGE_KEY = "jimu-app:api-mode";
  const DEFAULT_API_MODE = "auto";
  const DEFAULT_SERVER_BASE_URL = "http://localhost:3000";
  const REQUEST_TIMEOUT_MS = 12000;
  const KNOWN_MODES = ["mock", "server", "auto"];

  function copyPromptBlocks(blockIds) {
    return Array.isArray(blockIds) ? blockIds.slice() : [];
  }

  function withSource(reply, source) {
    return Object.assign({}, reply || {}, {
      source: source === "deepseek" ? "deepseek" : "fallback",
    });
  }

  function defaultTutorReply(context) {
    if (!context) {
      return withSource(createMessage("先拖几块积木来试试看吧。", "guide", "试试先放一个开始积木。"), "fallback");
    }

    if (context.type === "task" && config.TASKS[context.taskId]) {
      return withSource(createMessage(config.TASKS[context.taskId].intro, "guide", context.suggestion || ""), "fallback");
    }

    if (context.type === "success" && config.TASKS[context.taskId]) {
      return withSource(createMessage(config.TASKS[context.taskId].success, "success", context.suggestion || ""), "fallback");
    }

    if (context.type === "voice") {
      return withSource(createMessage(context.reply || "我听懂啦，我们继续搭积木吧。", "voice", context.suggestion || ""), "fallback");
    }

    if (context.type === "custom") {
      return withSource(createMessage(context.text, context.mood, context.suggestion, context.speakText), "fallback");
    }

    if (context.type === "error") {
      return withSource(createMessage(context.text || "没关系，我们再试一次。", "error", context.suggestion || "先看看第一块积木放对了吗？"), "fallback");
    }

    return withSource(createMessage("我们继续试试看吧。", "guide", context && context.suggestion ? context.suggestion : "先拖一个开始积木。"), "fallback");
  }

  function defaultVoiceIntent() {
    return {
      nextTaskId: App.store.app.currentTaskId,
      selectedActorId: App.state.selectedActor(),
      selectedActor: App.state.selectedActor(),
      sceneId: App.state.ws().sceneId,
      suggestedBlocks: [],
      reply: "我先陪你继续搭积木吧。",
    };
  }

  function resolveVoiceIntentSync(promptId) {
    const prompt = config.PROMPTS.find(function findPrompt(item) {
      return item.id === promptId;
    });

    if (!prompt) {
      return defaultVoiceIntent();
    }

    return {
      nextTaskId: prompt.taskId,
      selectedActorId: prompt.actorId || App.state.selectedActor(),
      selectedActor: prompt.actorId || App.state.selectedActor(),
      sceneId: prompt.sceneId || null,
      suggestedBlocks: copyPromptBlocks(prompt.blocks),
      reply: prompt.reply || "我听懂啦。",
    };
  }

  function getTutorReplySync(context) {
    return defaultTutorReply(context);
  }

  async function withMockBehavior(label, producer) {
    const delay = Number(App.store.debug.apiDelayMs) || 0;

    if (delay > 0) {
      await new Promise(function waitDelay(resolve) {
        global.setTimeout(resolve, delay);
      });
    }

    if (App.store.debug.failNextApiCall) {
      App.store.debug.failNextApiCall = false;
      if (App.render && typeof App.render.renderDebugPanel === "function" && isUiReady()) {
        App.render.renderDebugPanel();
      }
      throw new Error("Mock 适配器模拟失败：" + label);
    }

    return producer();
  }

  function normalizeTutorReply(raw, context) {
    const fallback = defaultTutorReply(context);
    const mood = raw && ["guide", "success", "error", "voice"].indexOf(raw.mood) !== -1 ? raw.mood : fallback.mood;
    const text = raw && typeof raw.text === "string" && raw.text.trim() ? raw.text.trim() : fallback.text;
    const suggestion = raw && typeof raw.suggestion === "string" ? raw.suggestion : fallback.suggestion;
    const speakText = raw && typeof raw.speakText === "string" && raw.speakText.trim() ? raw.speakText.trim() : text;

    return withSource({
      text: text,
      mood: mood,
      suggestion: suggestion || "",
      speakText: speakText,
    }, raw && raw.source === "deepseek" ? "deepseek" : "fallback");
  }

  function normalizeHealth(raw, fallbackProvider) {
    return {
      provider: raw && raw.provider ? raw.provider : fallbackProvider,
      status: raw && raw.status ? raw.status : "unknown",
    };
  }

  function isKnownMode(mode) {
    return KNOWN_MODES.indexOf(mode) !== -1;
  }

  function normalizeMode(mode) {
    return isKnownMode(mode) ? mode : DEFAULT_API_MODE;
  }

  function isUiReady() {
    return Boolean(App.dom && App.dom.statusStrip && App.dom.debugPanel);
  }

  function safeLog(level, message, meta) {
    if (typeof App.log === "function" && isUiReady()) {
      App.log(level, message, meta);
    }
  }

  function safeRenderStatusBar() {
    if (App.render && typeof App.render.renderStatusBar === "function" && isUiReady()) {
      App.render.renderStatusBar();
    }
  }

  function safeRenderDebugPanel() {
    if (App.render && typeof App.render.renderDebugPanel === "function" && isUiReady()) {
      App.render.renderDebugPanel();
    }
  }

  function getStoredMode() {
    try {
      return global.localStorage ? global.localStorage.getItem(API_MODE_STORAGE_KEY) || "" : "";
    } catch (error) {
      return "";
    }
  }

  function persistMode(mode) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(API_MODE_STORAGE_KEY, mode);
      }
    } catch (error) {
      safeLog("warn", "保存 API 模式失败。", { message: error.message });
    }
  }

  function getServerBaseUrl() {
    return (global.JimuAppServerBaseUrl || DEFAULT_SERVER_BASE_URL).replace(/\/+$/, "");
  }

  async function fetchJson(path, payload) {
    if (typeof global.fetch !== "function") {
      throw new Error("当前浏览器不支持 fetch。请使用现代浏览器打开页面。");
    }

    const controller = new AbortController();
    const timer = global.setTimeout(function abortRequest() {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await global.fetch(getServerBaseUrl() + path, {
        method: payload ? "POST" : "GET",
        headers: payload
          ? {
              "Content-Type": "application/json",
            }
          : {},
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("请求失败，状态码 " + response.status);
      }

      return response.json();
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("请求超时，请检查本地后端是否已启动。");
      }
      throw error;
    } finally {
      global.clearTimeout(timer);
    }
  }

  const mockAdapter = {
    name: "mock",
    async getTutorReply(context) {
      return withMockBehavior("getTutorReply", function produceTutorReply() {
        return getTutorReplySync(context);
      });
    },
    async resolveVoiceIntent(input) {
      return withMockBehavior("resolveVoiceIntent", function produceVoiceIntent() {
        return resolveVoiceIntentSync(input);
      });
    },
    async getHealth() {
      return withMockBehavior("getHealth", function produceHealth() {
        return {
          provider: "mock",
          status: "ready",
        };
      });
    },
  };

  const serverAdapter = {
    name: "server",
    async getTutorReply(context) {
      try {
        const raw = await fetchJson("/api/tutor-reply", {
          context: context || {},
        });
        return normalizeTutorReply(raw, context);
      } catch (error) {
        safeLog("warn", "真实 AI 请求失败，改用本地兜底文案。", {
          adapter: "server",
          message: error.message,
          baseUrl: getServerBaseUrl(),
        });
        return normalizeTutorReply(null, context);
      }
    },
    async resolveVoiceIntent(input) {
      return mockAdapter.resolveVoiceIntent(input);
    },
    async getHealth() {
      try {
        return normalizeHealth(await fetchJson("/api/health"), "deepseek");
      } catch (error) {
        safeLog("warn", "后端健康检查失败。", {
          adapter: "server",
          message: error.message,
          baseUrl: getServerBaseUrl(),
        });
        return {
          provider: "deepseek",
          status: "offline",
        };
      }
    },
  };

  const autoAdapter = {
    name: "auto",
    async getTutorReply(context) {
      try {
        const raw = await fetchJson("/api/tutor-reply", {
          context: context || {},
        });
        return normalizeTutorReply(raw, context);
      } catch (error) {
        safeLog("warn", "后端不可用，自动回退到 mock 文案。", {
          adapter: "auto",
          message: error.message,
          baseUrl: getServerBaseUrl(),
        });
        return mockAdapter.getTutorReply(context);
      }
    },
    async resolveVoiceIntent(input) {
      return mockAdapter.resolveVoiceIntent(input);
    },
    async getHealth() {
      try {
        return normalizeHealth(await fetchJson("/api/health"), "deepseek");
      } catch (error) {
        safeLog("warn", "后端不可用，健康状态切回 mock fallback。", {
          adapter: "auto",
          message: error.message,
          baseUrl: getServerBaseUrl(),
        });
        return {
          provider: "mock",
          status: "fallback",
        };
      }
    },
  };

  const modeAdapters = {
    mock: mockAdapter,
    server: serverAdapter,
    auto: autoAdapter,
  };

  let activeMode = DEFAULT_API_MODE;
  let activeAdapter = modeAdapters[DEFAULT_API_MODE] || mockAdapter;

  function getActiveAdapterName() {
    return activeAdapter && activeAdapter.name ? activeAdapter.name : "mock";
  }

  function notifyAdapterChange(message, options) {
    const settings = Object.assign(
      {
        log: true,
        render: true,
      },
      options || {}
    );

    if (settings.log) {
      safeLog("info", message, {
        mode: activeMode,
        adapter: getActiveAdapterName(),
        baseUrl: getServerBaseUrl(),
      });
    }

    if (settings.render) {
      safeRenderStatusBar();
      safeRenderDebugPanel();
    }
  }

  function applyMode(mode, options) {
    const settings = Object.assign(
      {
        persist: true,
        notify: true,
        message: "已切换 API 模式。",
      },
      options || {}
    );
    const nextMode = normalizeMode(mode);

    activeMode = nextMode;
    activeAdapter = modeAdapters[nextMode] || mockAdapter;

    if (settings.persist) {
      persistMode(nextMode);
    }

    if (settings.notify) {
      notifyAdapterChange(settings.message, {
        log: settings.log !== false,
        render: settings.render !== false,
      });
    }

    return nextMode;
  }

  function setAdapter(adapter, options) {
    const settings = Object.assign(
      {
        notify: true,
      },
      options || {}
    );

    activeAdapter = adapter || mockAdapter;
    activeMode = isKnownMode(activeAdapter.name) ? activeAdapter.name : "custom";

    if (settings.notify) {
      notifyAdapterChange("已切换适配器。", {
        log: settings.log !== false,
        render: settings.render !== false,
      });
    }

    return activeMode;
  }

  function setMode(mode, options) {
    const settings = Object.assign(
      {
        silent: false,
      },
      options || {}
    );

    return applyMode(mode, {
      persist: true,
      notify: !settings.silent,
      log: !settings.silent,
      render: !settings.silent,
      message: "已切换 API 模式。",
    });
  }

  function getMode() {
    return activeMode;
  }

  async function getTutorReply(context) {
    if (!activeAdapter || typeof activeAdapter.getTutorReply !== "function") {
      safeLog("warn", "当前适配器缺少 getTutorReply，已回退本地提示。", {
        mode: activeMode,
        adapter: getActiveAdapterName(),
      });
      return defaultTutorReply(context);
    }

    try {
      return await activeAdapter.getTutorReply(context);
    } catch (error) {
      safeLog("warn", "调用 getTutorReply 失败，已回退本地提示。", {
        mode: activeMode,
        adapter: getActiveAdapterName(),
        message: error.message,
      });
      return defaultTutorReply(context);
    }
  }

  async function resolveVoiceIntent(input) {
    if (!activeAdapter || typeof activeAdapter.resolveVoiceIntent !== "function") {
      safeLog("warn", "当前适配器缺少 resolveVoiceIntent，已回退同步语音意图。", {
        mode: activeMode,
        adapter: getActiveAdapterName(),
      });
      return resolveVoiceIntentSync(input);
    }

    try {
      return await activeAdapter.resolveVoiceIntent(input);
    } catch (error) {
      safeLog("warn", "调用 resolveVoiceIntent 失败，已回退同步语音意图。", {
        mode: activeMode,
        adapter: getActiveAdapterName(),
        message: error.message,
      });
      return resolveVoiceIntentSync(input);
    }
  }

  async function getHealth() {
    if (!activeAdapter || typeof activeAdapter.getHealth !== "function") {
      safeLog("warn", "当前适配器缺少 getHealth，已回退安全状态。", {
        mode: activeMode,
        adapter: getActiveAdapterName(),
      });
      return {
        provider: getActiveAdapterName(),
        status: "unknown",
      };
    }

    try {
      return await activeAdapter.getHealth();
    } catch (error) {
      safeLog("warn", "调用 getHealth 失败，已回退安全状态。", {
        mode: activeMode,
        adapter: getActiveAdapterName(),
        message: error.message,
      });
      return {
        provider: getActiveAdapterName(),
        status: "unknown",
      };
    }
  }

  const publicApi = {
    setAdapter: setAdapter,
    setMode: setMode,
    getMode: getMode,
    getActiveAdapterName: getActiveAdapterName,
    getServerBaseUrl: getServerBaseUrl,
    getTutorReply: getTutorReply,
    resolveVoiceIntent: resolveVoiceIntent,
    getHealth: getHealth,
    getTutorReplySync: getTutorReplySync,
    resolveVoiceIntentSync: resolveVoiceIntentSync,
    mockAdapter: mockAdapter,
    serverAdapter: serverAdapter,
    autoAdapter: autoAdapter,
    availableModes: KNOWN_MODES.slice(),
  };

  App.api = publicApi;
  applyMode(getStoredMode(), {
    persist: true,
    notify: false,
  });
})(window);
