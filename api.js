(function initApi(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};
  const config = App.config;
  const createMessage = App.createMessage;

  function copyPromptBlocks(blockIds) {
    return Array.isArray(blockIds) ? blockIds.slice() : [];
  }

  function resolveVoiceIntentSync(promptId) {
    const prompt = config.PROMPTS.find(function findPrompt(item) {
      return item.id === promptId;
    });

    if (!prompt) {
      return {
        nextTaskId: App.store.app.currentTaskId,
        selectedActorId: App.state.selectedActor(),
        selectedActor: App.state.selectedActor(),
        sceneId: App.state.ws().sceneId,
        suggestedBlocks: [],
        reply: "我先陪你继续搭积木吧。",
      };
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
    if (!context) {
      return createMessage("先拖几块积木来试试看吧。", "guide", "试试：开始时，再接一个会动的积木。");
    }

    if (context.type === "task") {
      return createMessage(config.TASKS[context.taskId].intro, "guide", context.suggestion || "");
    }

    if (context.type === "success") {
      return createMessage(config.TASKS[context.taskId].success, "success", context.suggestion || "");
    }

    if (context.type === "voice") {
      return createMessage(context.reply, "voice", context.suggestion || "");
    }

    if (context.type === "custom") {
      return createMessage(context.text, context.mood, context.suggestion, context.speakText);
    }

    return createMessage("先拖几块积木来试试看吧。", "guide", "试试：开始时，再接一个会动的积木。");
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
      if (App.render && typeof App.render.renderDebugPanel === "function") {
        App.render.renderDebugPanel();
      }
      throw new Error("Mock 适配器模拟失败：" + label);
    }

    return producer();
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

  let activeAdapter = mockAdapter;

  function getActiveAdapterName() {
    return activeAdapter && activeAdapter.name ? activeAdapter.name : "mock";
  }

  function setAdapter(adapter) {
    activeAdapter = adapter || mockAdapter;
    App.log("info", "已切换适配器。", { adapter: getActiveAdapterName() });
    if (App.render && typeof App.render.renderStatusBar === "function") {
      App.render.renderStatusBar();
    }
  }

  async function getTutorReply(context) {
    return activeAdapter.getTutorReply(context);
  }

  async function resolveVoiceIntent(input) {
    return activeAdapter.resolveVoiceIntent(input);
  }

  async function getHealth() {
    if (!activeAdapter.getHealth) {
      return {
        provider: getActiveAdapterName(),
        status: "unknown",
      };
    }

    return activeAdapter.getHealth();
  }

  App.api = {
    setAdapter: setAdapter,
    getActiveAdapterName: getActiveAdapterName,
    getTutorReply: getTutorReply,
    resolveVoiceIntent: resolveVoiceIntent,
    getHealth: getHealth,
    getTutorReplySync: getTutorReplySync,
    resolveVoiceIntentSync: resolveVoiceIntentSync,
    mockAdapter: mockAdapter,
  };
})(window);
