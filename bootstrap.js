(function initBootstrap(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};
  const config = App.config;
  const createMessage = App.createMessage;

  function createLocalMessage(text, mood, suggestion, speakText) {
    if (typeof createMessage === "function") {
      return Object.assign(createMessage(text, mood, suggestion, speakText), {
        source: "fallback",
      });
    }

    return {
      text: text || "",
      mood: mood || "guide",
      suggestion: suggestion || "",
      speakText: speakText || text || "",
      source: "fallback",
    };
  }

  function buildLocalTutorMessage(context) {
    if (!context) {
      return createLocalMessage("先拖几块积木来试试看吧。", "guide", "试试先放一个开始积木。");
    }

    if (context.type === "task" && config.TASKS[context.taskId]) {
      return createLocalMessage(config.TASKS[context.taskId].intro, "guide", context.suggestion || "");
    }

    if (context.type === "success" && config.TASKS[context.taskId]) {
      return createLocalMessage(config.TASKS[context.taskId].success, "success", context.suggestion || "");
    }

    if (context.type === "voice") {
      return createLocalMessage(context.reply || "我听懂啦，我们继续搭积木吧。", "voice", context.suggestion || "");
    }

    if (context.type === "custom") {
      return createLocalMessage(context.text, context.mood, context.suggestion, context.speakText);
    }

    if (context.type === "error") {
      return createLocalMessage(context.text || "没关系，我们再试一次。", "error", context.suggestion || "先看看第一块积木放对了吗？");
    }

    return createLocalMessage("我们继续试试看吧。", "guide", context && context.suggestion ? context.suggestion : "先拖一个开始积木。");
  }

  function buildLocalVoiceIntent(promptId) {
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
      suggestedBlocks: Array.isArray(prompt.blocks) ? prompt.blocks.slice() : [],
      reply: prompt.reply || "我听懂啦。",
    };
  }

  function getApi() {
    return App.api && typeof App.api === "object" ? App.api : null;
  }

  function logApiWarn(message, meta) {
    if (typeof App.log === "function") {
      App.log("warn", message, meta);
    }
  }

  function getActiveAdapterNameSafe() {
    const api = getApi();

    if (api && typeof api.getActiveAdapterName === "function") {
      try {
        return api.getActiveAdapterName() || "mock";
      } catch (error) {
        logApiWarn("读取当前适配器名称失败，已回退到 mock。", { message: error.message });
      }
    }

    return "mock";
  }

  function getTutorReplySyncSafe(context) {
    const api = getApi();

    if (api && typeof api.getTutorReplySync === "function") {
      try {
        return api.getTutorReplySync(context);
      } catch (error) {
        logApiWarn("同步小老师提示不可用，已回退到本地默认提示。", { message: error.message });
      }
    } else {
      logApiWarn("AI 适配层尚未就绪，已回退到同步默认提示。", {
        method: "getTutorReplySync",
      });
    }

    return buildLocalTutorMessage(context);
  }

  function resolveVoiceIntentSyncSafe(promptId) {
    const api = getApi();

    if (api && typeof api.resolveVoiceIntentSync === "function") {
      try {
        return api.resolveVoiceIntentSync(promptId);
      } catch (error) {
        logApiWarn("同步语音意图解析不可用，已回退到本地默认方案。", { message: error.message });
      }
    } else {
      logApiWarn("AI 适配层尚未就绪，已回退到同步语音默认方案。", {
        method: "resolveVoiceIntentSync",
      });
    }

    return buildLocalVoiceIntent(promptId);
  }

  async function requestTutorReplySafe(context) {
    const api = getApi();

    if (api && typeof api.getTutorReply === "function") {
      try {
        return await api.getTutorReply(context);
      } catch (error) {
        logApiWarn("异步小老师提示失败，已回退到同步默认提示。", { message: error.message });
        return getTutorReplySyncSafe(context);
      }
    }

    logApiWarn("AI 适配层尚未就绪，已回退到同步默认提示。", {
      method: "getTutorReply",
    });
    return getTutorReplySyncSafe(context);
  }

  async function requestVoiceIntentSafe(promptId) {
    const api = getApi();

    if (api && typeof api.resolveVoiceIntent === "function") {
      try {
        return await api.resolveVoiceIntent(promptId);
      } catch (error) {
        logApiWarn("异步语音意图解析失败，已回退到同步默认方案。", { message: error.message });
        return resolveVoiceIntentSyncSafe(promptId);
      }
    }

    logApiWarn("AI 适配层尚未就绪，已回退到同步语音默认方案。", {
      method: "resolveVoiceIntent",
    });
    return resolveVoiceIntentSyncSafe(promptId);
  }

  async function requestProviderHealthSafe() {
    const api = getApi();

    if (api && typeof api.getHealth === "function") {
      try {
        return await api.getHealth();
      } catch (error) {
        logApiWarn("适配层健康检查失败，已回退到安全状态。", { message: error.message });
        return {
          provider: getActiveAdapterNameSafe(),
          status: "fallback",
        };
      }
    }

    logApiWarn("AI 适配层健康检查不可用，已回退到安全状态。", {
      method: "getHealth",
    });
    return {
      provider: "mock",
      status: "fallback",
    };
  }

  function applyAiCopy(copy) {
    App.store.app.aiMessage = copy.text || "";
    App.store.app.aiMode = copy.mood || "guide";
    App.store.app.aiSuggestion = copy.suggestion || "";
    App.store.app.lastTutorReplySource = copy && copy.source === "deepseek" ? "deepseek" : "fallback";
    App.announce(copy.mood === "error" ? "assertive" : "polite", copy.text || "");
    App.render.renderAI();
  }

  async function showTutorMessage(context, options) {
    const settings = Object.assign(
      {
        autoSpeak: false,
        waitForSpeech: false,
        loadingText: "",
        loadingDetail: "",
      },
      options || {}
    );

    let copy = await App.guard(
      "tutor-adapter",
      function requestTutorReply() {
        return requestTutorReplySafe(context);
      },
      {
        loadingText: settings.loadingText,
        loadingDetail: settings.loadingDetail,
      }
    );

    if (!copy) {
      copy = getTutorReplySyncSafe(context);
    }

    if (!copy) {
      copy = buildLocalTutorMessage(context);
    }

    if (!settings.autoSpeak) {
      applyAiCopy(copy);
      return copy;
    }

    const speechTask = App.speech.speak(copy.speakText || copy.text, {
      onStart: function onSpeechStart() {
        applyAiCopy(copy);
      },
    });

    if (settings.waitForSpeech) {
      await speechTask;
    }

    return copy;
  }

  function taskSpeech() {
    return App.state.task().type === "free" ? "自由实验室，想怎么搭都可以。" : App.state.task().title;
  }

  function speakTask() {
    App.speech.registerInteraction();
    App.speech.speak(taskSpeech());
  }

  function selectTask(taskId, options) {
    const settings = options || {};

    if (App.store.runtime.isRunning) {
      return;
    }

    App.speech.stop();
    App.runtime.clearUiArtifacts();
    App.state.setVoiceOpen(false);
    App.state.setCurrentTaskId(taskId);
    App.state.ensureWorkspace(taskId);
    App.runtime.resetStage(taskId);
    App.state.setKeyboardSlotTarget(App.state.selectedActor(), "start");
    App.setStatus({
      kind: "idle",
      text: "已切换到" + App.state.task().shortTitle + "。",
      detail: App.state.task().title,
      busy: false,
    });
    App.render.renderAll();
    showTutorMessage(
      {
        type: "task",
        taskId: taskId,
        suggestion: App.state.task().type === "free" ? "试试给三个角色都写一点。" : "先看当前角色的脚本槽。",
      },
      { autoSpeak: Boolean(settings.autoSpeak) }
    );
  }

  async function applyVoicePrompt(promptId) {
    const prompt = config.PROMPTS.find(function findPrompt(item) {
      return item.id === promptId;
    });
    const spokenLabel = prompt ? prompt.label : "继续搭积木";
    let info = await App.guard(
      "voice-intent",
      function resolveIntent() {
        return requestVoiceIntentSafe(promptId);
      },
      {
        loadingText: "正在理解这句话…",
      }
    );

    if (!info) {
      info = resolveVoiceIntentSyncSafe(promptId);
    }

    if (!info) {
      info = buildLocalVoiceIntent(promptId);
    }

    App.speech.stop();
    if (App.store.runtime.isRunning) {
      App.runtime.stopRun(true);
    }
    App.runtime.clearUiArtifacts({ keepVoiceText: true });
    App.state.setLastVoiceText(spokenLabel);
    App.state.setVoiceOpen(false);
    App.state.setCurrentTaskId(info.nextTaskId || App.store.app.currentTaskId);
    App.state.ensureWorkspace(App.store.app.currentTaskId);

    if (info.selectedActorId) {
      App.state.setSelectedActor(info.selectedActorId);
    }

    if (info.sceneId && App.state.task().type === "free" && config.SCENES[info.sceneId]) {
      App.state.ws().sceneId = info.sceneId;
      App.state.schedulePersist();
    }

    App.runtime.resetStage(App.store.app.currentTaskId);
    App.state.setKeyboardSlotTarget(App.state.selectedActor(), "start");
    App.runtime.glowBlocks(info.suggestedBlocks || []);
    App.setStatus({
      kind: "idle",
      text: "已根据语音提示更新当前编程上下文。",
      detail: spokenLabel,
      busy: false,
    });
    App.render.renderAll();

    await showTutorMessage(
      {
        type: "voice",
        reply: info.reply,
        suggestion: info.suggestedBlocks && info.suggestedBlocks.length ? "试试：" + info.suggestedBlocks.map(function mapBlock(id) { return config.BLOCKS[id].label; }).join(" → ") : "",
      },
      { autoSpeak: true }
    );
  }

  async function refreshProviderHealth() {
    const health = await App.guard("adapter-health", function getHealthSafe() {
      return requestProviderHealthSafe();
    });

    App.store.app.providerHealth = {
      provider: health && health.provider ? health.provider : "mock",
      status: health && health.status ? health.status : "fallback",
    };
    App.render.renderStatusBar();
    App.render.renderDebugPanel();
  }

  function bindActorTabArrows(event) {
    const tab = event.target.closest(".actor-tab");

    if (!tab || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
      return;
    }

    const tabs = Array.from(App.dom.actorTabs.querySelectorAll(".actor-tab"));
    const currentIndex = tabs.indexOf(tab);
    const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];

    event.preventDefault();
    nextTab.focus();
    nextTab.click();
  }

  function bind() {
    App.dom.taskList.addEventListener("click", function onTaskClick(event) {
      const card = event.target.closest(".task-card");
      if (!card) {
        return;
      }
      App.speech.registerInteraction();
      selectTask(card.dataset.taskId, { autoSpeak: true });
    });

    App.dom.readTaskBtn.addEventListener("click", speakTask);
    App.dom.skipSpeechBtn.addEventListener("click", function onSkipSpeech() {
      App.speech.registerInteraction();
      App.speech.skip();
    });
    App.dom.stopBtn.addEventListener("click", function onStopRun() {
      App.speech.registerInteraction();
      App.runtime.stopRun(false);
    });
    App.dom.soundToggleBtn.addEventListener("click", function onToggleSound() {
      App.speech.registerInteraction();
      App.state.setMuted(!App.store.app.isMuted);
      if (App.store.app.isMuted) {
        App.speech.stop();
      } else {
        App.speech.speak("声音回来啦。");
      }
      App.render.renderControls();
      App.render.renderStatusBar();
    });

    App.dom.voiceToggleBtn.addEventListener("click", function onToggleVoicePanel() {
      App.speech.registerInteraction();
      App.state.setVoiceOpen(!App.store.app.voiceOpen);
      App.render.renderVoice();
      App.render.renderControls();
      if (App.store.app.voiceOpen) {
        showTutorMessage(
          {
            type: "custom",
            text: "点一句试试，我会帮你切到对应任务。",
            mood: "guide",
            suggestion: "你也可以点我想自由搭积木。",
          },
          { autoSpeak: true }
        );
      }
    });

    App.dom.voiceSamples.addEventListener("click", function onVoicePromptClick(event) {
      const chip = event.target.closest(".voice-chip");
      if (!chip) {
        return;
      }
      App.speech.registerInteraction();
      applyVoicePrompt(chip.dataset.promptId);
    });

    App.dom.readAiBtn.addEventListener("click", function onReadAi() {
      App.speech.registerInteraction();
      App.speech.speak(App.store.app.aiMessage);
    });

    App.dom.sceneChips.addEventListener("click", function onSceneClick(event) {
      const chip = event.target.closest(".scene-chip");
      if (!chip || App.state.task().type !== "free" || App.store.runtime.isRunning) {
        return;
      }

      App.speech.registerInteraction();
      App.runtime.clearUiArtifacts({ keepVoiceText: true });
      App.state.ws().sceneId = chip.dataset.sceneId;
      App.state.schedulePersist();
      App.runtime.resetStage(App.store.app.currentTaskId);
      App.setStatus({
        kind: "idle",
        text: "已切换到" + config.SCENES[chip.dataset.sceneId].name + "场景。",
        detail: "",
        busy: false,
      });
      App.render.renderScenes();
      App.render.renderStage();
      App.render.renderStatusBar();
    });

    App.dom.actorTabs.addEventListener("click", function onActorTabClick(event) {
      const tab = event.target.closest(".actor-tab");
      if (!tab) {
        return;
      }

      App.state.setSelectedActor(tab.dataset.actorId);
      App.state.setKeyboardSlotTarget(tab.dataset.actorId, "start");
      App.render.renderActorTabs();
      App.render.renderScriptSlots();
      App.runtime.applyHint();
    });

    App.dom.actorTabs.addEventListener("keydown", bindActorTabArrows);

    App.dom.blockPool.addEventListener("pointerdown", function onPoolPointerDown(event) {
      const block = event.target.closest(".pool-block");
      if (!block || App.store.runtime.isRunning || event.target.closest(".block-param")) {
        return;
      }
      App.speech.registerInteraction();
      App.drag.beginDrag({ source: "pool", blockId: block.dataset.blockId }, block, event);
    });

    App.dom.blockPool.addEventListener("click", function onPoolClick(event) {
      const block = event.target.closest(".pool-block");
      if (!block || event.target.closest(".block-param")) {
        return;
      }
      App.speech.registerInteraction();
      App.drag.handlePoolClick(event, block);
    });

    App.dom.blockPool.addEventListener("keydown", function onPoolKeydown(event) {
      const block = event.target.closest(".pool-block");
      if (!block) {
        return;
      }
      App.speech.registerInteraction();
      App.drag.handlePoolKeydown(event, block);
    });

    App.dom.scriptSlots.addEventListener("pointerdown", function onProgramPointerDown(event) {
      const block = event.target.closest(".program-block");
      if (!block || App.store.runtime.isRunning || event.target.closest(".block-delete") || event.target.closest(".block-param")) {
        return;
      }

      App.speech.registerInteraction();
      const items = App.state.blocks(block.dataset.actorId, block.dataset.slotId);
      const index = items.findIndex(function findItem(item) {
        return item.instanceId === block.dataset.instanceId;
      });

      App.drag.beginDrag(
        {
          source: "slot",
          blockId: block.dataset.blockId,
          instanceId: block.dataset.instanceId,
          originActorId: block.dataset.actorId,
          originSlotId: block.dataset.slotId,
          originIndex: index,
        },
        block,
        event
      );
    });

    App.dom.scriptSlots.addEventListener("click", function onScriptSlotClick(event) {
      const deleteBtn = event.target.closest(".block-delete");
      if (deleteBtn && !App.store.runtime.isRunning) {
        const block = deleteBtn.closest(".program-block");
        App.drag.removeProgramBlock(block.dataset.actorId, block.dataset.slotId, block.dataset.instanceId);
        return;
      }

      const paramBtn = event.target.closest(".block-param");
      if (paramBtn && !App.store.runtime.isRunning) {
        const block = paramBtn.closest(".program-block");
        if (block) {
          App.drag.cycleProgramBlockParam(block.dataset.actorId, block.dataset.slotId, block.dataset.instanceId);
        }
        return;
      }

      const messageBtn = event.target.closest(".slot-message-button");
      if (messageBtn && !App.store.runtime.isRunning) {
        App.drag.cycleMessageBinding(messageBtn.dataset.actorId);
        return;
      }

      const slotList = event.target.closest(".slot-list");
      if (slotList) {
        App.state.setKeyboardSlotTarget(slotList.dataset.actorId, slotList.dataset.slotId);
      }
    });

    App.dom.scriptSlots.addEventListener("focusin", function onScriptSlotFocus(event) {
      const block = event.target.closest(".program-block");
      if (block) {
        App.state.setKeyboardSlotTarget(block.dataset.actorId, block.dataset.slotId);
        return;
      }

      const slotList = event.target.closest(".slot-list");
      if (slotList) {
        App.state.setKeyboardSlotTarget(slotList.dataset.actorId, slotList.dataset.slotId);
      }
    });

    App.dom.scriptSlots.addEventListener("keydown", function onProgramKeydown(event) {
      const block = event.target.closest(".program-block");
      if (!block) {
        return;
      }
      App.drag.handleProgramKeydown(event, block);
    });

    App.dom.runBtn.addEventListener("click", function onRun() {
      App.speech.registerInteraction();
      App.runtime.handleRun();
    });

    App.dom.resetBtn.addEventListener("click", function onReset() {
      App.speech.registerInteraction();
      App.runtime.handleReset();
    });

    App.dom.stageActors.addEventListener("click", function onStageActorClick(event) {
      const button = event.target.closest(".stage-actor");
      if (!button) {
        return;
      }

      const actorId = button.dataset.actorId;
      App.speech.registerInteraction();

      if (!App.store.runtime.isRunning) {
        showTutorMessage(
          {
            type: "custom",
            text: "先点运行，再来点角色吧。",
            mood: "guide",
            suggestion: "运行后，点角色时脚本就会动起来。",
          },
          { autoSpeak: true }
        );
        return;
      }

      if (!App.state.blocks(actorId, "click").length) {
        showTutorMessage(
          {
            type: "custom",
            text: "这个角色现在还没有点角色时脚本哦。",
            mood: "guide",
            suggestion: "试试切到这个角色的点角色时。",
          },
          { autoSpeak: true }
        );
        return;
      }

      if (App.state.task().type === "task") {
        App.store.runtime.waitingClicks = false;
        App.runtime.setHint("");
      }

      App.runtime.startScript(actorId, "click");
      App.render.renderStage();
    });

    App.dom.debugToggleBtn.addEventListener("click", function onToggleDebug() {
      App.store.debug.panelOpen = !App.store.debug.panelOpen;
      App.render.renderDebugPanel();
      App.render.renderControls();
    });

    App.dom.debugDelaySelect.addEventListener("change", function onChangeDelay() {
      App.store.debug.apiDelayMs = Number(App.dom.debugDelaySelect.value) || 0;
      App.log("info", "已更新 Mock 延迟。", { delayMs: App.store.debug.apiDelayMs });
      App.render.renderDebugPanel();
    });

    App.dom.debugFailBtn.addEventListener("click", function onFailNext() {
      App.store.debug.failNextApiCall = true;
      App.log("warn", "下一次 API 调用将被模拟为失败。");
      App.render.renderDebugPanel();
    });

    App.dom.debugClearLogsBtn.addEventListener("click", function onClearLogs() {
      App.store.logs = [];
      App.render.renderDebugPanel();
    });

    App.dom.debugClearStorageBtn.addEventListener("click", function onClearStorage() {
      App.state.clearPersistedState();
      App.render.renderDebugPanel();
    });

    global.addEventListener("beforeunload", function onBeforeUnload() {
      App.state.savePersistedState();
    });
  }

  function renderGameToText() {
    const payload = {
      coordinateSystem: "舞台原点在屏幕左下近地面区域；offsetX 向右为正，bottom 使用像素，scale 为 1 表示默认大小。",
      currentTaskId: App.store.app.currentTaskId,
      currentTaskTitle: App.state.task().title,
      sceneId: App.state.ws().sceneId,
      selectedActorId: App.state.selectedActor(),
      actors: {},
      scripts: {},
      runtime: {
        isRunning: App.store.runtime.isRunning,
        waitingClicks: App.store.runtime.waitingClicks,
        activeActors: Object.keys(App.store.runtime.activeActors),
        messages: App.store.runtime.messages.map(function mapMessage(item) {
          return item.text;
        }),
        highlight: App.store.runtime.highlight,
        success: App.store.runtime.success,
      },
      aiMessage: App.store.app.aiMessage,
      stageHint: App.store.stage.hint,
    };

    App.state.visibleActors().forEach(function snapshotActor(actorId) {
      payload.actors[actorId] = {
        offsetX: App.store.stage.actors[actorId].offsetX,
        scale: App.store.stage.actors[actorId].scale,
        rotation: App.store.stage.actors[actorId].rotation,
        bubble: App.store.stage.actors[actorId].bubble,
        face: App.store.stage.actors[actorId].face,
        forever: App.store.stage.actors[actorId].forever,
      };

      payload.scripts[actorId] = {
        start: App.state.blocks(actorId, "start").map(function mapBlock(item) {
          return { blockId: item.blockId, param: item.param };
        }),
        click: App.state.blocks(actorId, "click").map(function mapBlock(item) {
          return { blockId: item.blockId, param: item.param };
        }),
        messageName: App.state.messageName(actorId),
        message: App.state.blocks(actorId, "message").map(function mapBlock(item) {
          return { blockId: item.blockId, param: item.param };
        }),
      };
    });

    return JSON.stringify(payload);
  }

  function initialize() {
    App.render.cacheDom();
    App.state.loadPersistedState();
    App.state.ensureWorkspace(App.store.app.currentTaskId);
    App.runtime.resetStage(App.store.app.currentTaskId);
    App.state.setKeyboardSlotTarget(App.state.selectedActor(), "start");
    App.speech.initialize();
    App.render.loadBrandPhoto();
    bind();
    App.render.renderAll();
    App.runtime.applyHint();
    refreshProviderHealth();
    App.log("info", "应用初始化完成。", { taskId: App.store.app.currentTaskId });
  }

  App.applyAiCopy = applyAiCopy;
  App.showTutorMessage = showTutorMessage;
  global.tutorAdapter = {
    getMessage: function getMessage(context) {
      return getTutorReplySyncSafe(context);
    },
  };
  global.voiceInputAdapter = {
    resolvePrompt: function resolvePrompt(promptId) {
      return resolveVoiceIntentSyncSafe(promptId);
    },
  };
  global.advanceTime = function advanceTime(ms) {
    App.runtime.advanceManagedTime(ms || 0);
  };
  global.render_game_to_text = renderGameToText;

  initialize();
})(window);
