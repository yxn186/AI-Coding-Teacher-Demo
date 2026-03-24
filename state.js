(function initState(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};
  const config = App.config;
  const createMessage = App.createMessage;

  let instanceCounter = 0;
  let persistTimer = 0;

  function nowIso() {
    return new Date().toISOString();
  }

  function formatTime(timestamp) {
    if (!timestamp) {
      return "未记录";
    }

    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function defaultMessageName(taskId, actorId) {
    if (taskId === "task7" && actorId === "dog") {
      return "来打招呼";
    }

    if (taskId === "task8" && (actorId === "dog" || actorId === "rabbit")) {
      return "一起动";
    }

    return config.MSGS[0];
  }

  function createActorStageState(actorId) {
    return {
      offsetX: 0,
      scale: 1,
      rotation: 0,
      bubble: "",
      face: config.ACTORS[actorId].face,
      flash: false,
      hop: false,
      spin: false,
      forever: false,
      visible: true,
    };
  }

  function createStageState() {
    const actors = {};

    Object.keys(config.ACTORS).forEach(function buildActorState(actorId) {
      actors[actorId] = createActorStageState(actorId);
    });

    return {
      hint: "",
      actors: actors,
    };
  }

  function createActorWorkspace(taskId, actorId) {
    return {
      start: [],
      click: [],
      message: [],
      messageName: defaultMessageName(taskId, actorId),
    };
  }

  function createWorkspace(taskId) {
    const task = config.TASKS[taskId];

    return {
      taskId: taskId,
      sceneId: task.sceneId,
      selectedActorId: task.actors[0],
      actors: {
        cat: createActorWorkspace(taskId, "cat"),
        rabbit: createActorWorkspace(taskId, "rabbit"),
        dog: createActorWorkspace(taskId, "dog"),
      },
    };
  }

  function createAppState() {
    return {
      currentTaskId: "task1",
      aiMessage: config.TASKS.task1.intro,
      aiMode: "guide",
      aiSuggestion: "先看程序区里的点角色时。",
      isMuted: false,
      hasUserInteracted: false,
      voiceOpen: false,
      lastVoiceText: "",
      highlightBlocks: [],
      slotHint: "",
      keyboardSlotTarget: "",
      drag: null,
      lastError: null,
      providerHealth: { provider: "mock", status: "ready" },
      lastTutorReplySource: "unknown",
      lastTtsSource: "unknown",
      lastTtsError: "",
      ignorePoolClickUntil: 0,
    };
  }

  function createRuntimeState() {
    return {
      isRunning: false,
      sessionId: 0,
      activeScripts: 0,
      scriptTokens: {},
      waitingClicks: false,
      autoEnd: false,
      success: false,
      goals: {},
      history: [],
      messages: [],
      activeActors: {},
      highlight: null,
    };
  }

  const store = {
    app: createAppState(),
    runtime: createRuntimeState(),
    stage: createStageState(),
    workspaces: {},
    logs: [],
    live: {
      polite: "",
      assertive: "",
    },
    status: {
      kind: "idle",
      text: "本地原型已准备好。",
      detail: "",
      busy: false,
      updatedAt: Date.now(),
    },
    debug: {
      panelOpen: false,
      apiDelayMs: 0,
      failNextApiCall: false,
    },
    storage: {
      key: config.STORAGE_KEY,
      version: config.STORAGE_VERSION,
      lastSavedAt: 0,
      restored: false,
    },
    loadingCount: 0,
  };

  function renderIfPossible(methodName) {
    if (App.render && typeof App.render[methodName] === "function") {
      App.render[methodName]();
    }
  }

  function log(level, message, meta) {
    store.logs.unshift({
      id: "log-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      level: level,
      message: message,
      meta: meta || null,
      at: Date.now(),
      iso: nowIso(),
    });
    store.logs = store.logs.slice(0, config.MAX_LOGS);
    renderIfPossible("renderDebugPanel");
  }

  function announce(channel, text) {
    store.live[channel] = text || "";
    renderIfPossible("renderLiveRegions");
  }

  function setStatus(nextStatus) {
    store.status = Object.assign({}, store.status, nextStatus, {
      updatedAt: Date.now(),
    });
    renderIfPossible("renderStatusBar");
  }

  function startLoading(text, detail) {
    store.loadingCount += 1;
    setStatus({
      kind: "loading",
      text: text || "处理中…",
      detail: detail || "",
      busy: true,
    });
  }

  function finishLoading() {
    store.loadingCount = Math.max(0, store.loadingCount - 1);

    if (!store.loadingCount && store.status.kind === "loading") {
      setStatus({
        kind: "idle",
        text: "本地原型已准备好。",
        detail: "",
        busy: false,
      });
    }
  }

  function schedulePersist() {
    if (!global.localStorage) {
      return;
    }

    global.clearTimeout(persistTimer);
    persistTimer = global.setTimeout(savePersistedState, 120);
  }

  function ensureWorkspace(taskId) {
    const task = config.TASKS[taskId];

    if (!store.workspaces[taskId]) {
      store.workspaces[taskId] = createWorkspace(taskId);
    }

    const workspace = store.workspaces[taskId];

    if (task.type !== "free") {
      workspace.sceneId = task.sceneId;
    }

    if (task.actors.indexOf(workspace.selectedActorId) === -1) {
      workspace.selectedActorId = task.actors[0];
    }

    Object.keys(config.ACTORS).forEach(function ensureActorWorkspace(actorId) {
      if (!workspace.actors[actorId]) {
        workspace.actors[actorId] = createActorWorkspace(taskId, actorId);
      }

      ["start", "click", "message"].forEach(function ensureSlot(slotId) {
        if (!Array.isArray(workspace.actors[actorId][slotId])) {
          workspace.actors[actorId][slotId] = [];
        }
      });

      if (!config.MSGS.includes(workspace.actors[actorId].messageName)) {
        workspace.actors[actorId].messageName = defaultMessageName(taskId, actorId);
      }
    });

    return workspace;
  }

  function task() {
    return config.TASKS[store.app.currentTaskId];
  }

  function ws() {
    return ensureWorkspace(store.app.currentTaskId);
  }

  function visibleActors() {
    return task().actors.slice();
  }

  function selectedActor() {
    return ws().selectedActorId;
  }

  function blocks(actorId, slotId) {
    return ensureWorkspace(store.app.currentTaskId).actors[actorId][slotId];
  }

  function blockIds(actorId, slotId) {
    return blocks(actorId, slotId).map(function mapBlockIds(item) {
      return item.blockId;
    });
  }

  function cloneBlocks(items) {
    return items.map(function cloneBlock(item) {
      return {
        instanceId: item.instanceId,
        blockId: item.blockId,
        param: item.param,
      };
    });
  }

  function paramOptions(blockId) {
    const type = config.BLOCKS[blockId].paramType;

    if (type === "wait") {
      return config.WAITS.map(function waitValue(item) {
        return item.value;
      });
    }

    if (type === "message") {
      return config.MSGS.slice();
    }

    if (type === "face") {
      return config.FACES.slice();
    }

    return [];
  }

  function defaultParam(blockId, taskId) {
    const type = config.BLOCKS[blockId].paramType;
    const activeTaskId = taskId || store.app.currentTaskId;

    if (type === "wait") {
      return 1000;
    }

    if (type === "message") {
      if (activeTaskId === "task7") {
        return "来打招呼";
      }

      if (activeTaskId === "task8") {
        return "一起动";
      }

      return config.MSGS[0];
    }

    if (type === "face") {
      return config.FACES[0];
    }

    return null;
  }

  function paramLabel(blockId, value) {
    const block = config.BLOCKS[blockId];

    if (block.badge) {
      return block.badge;
    }

    if (block.paramType === "wait") {
      const found = config.WAITS.find(function findWait(item) {
        return item.value === value;
      });
      return found ? found.label : "1秒";
    }

    if (block.paramType) {
      return value || defaultParam(blockId);
    }

    return "";
  }

  function sanitizeParam(blockId, value, taskId) {
    const block = config.BLOCKS[blockId];
    const fallback = defaultParam(blockId, taskId);

    if (!block || !block.paramType) {
      return fallback;
    }

    const options = paramOptions(blockId);
    return options.indexOf(value) !== -1 ? value : fallback;
  }

  function nextParam(blockId, value) {
    const options = paramOptions(blockId);

    if (!options.length) {
      return value;
    }

    const index = options.indexOf(value);
    return options[(index + 1 + options.length) % options.length] || options[0];
  }

  function createInstance(blockId, explicitParam) {
    return {
      instanceId: "b" + String(++instanceCounter),
      blockId: blockId,
      param: explicitParam === undefined ? defaultParam(blockId) : sanitizeParam(blockId, explicitParam),
    };
  }

  function countBlocks() {
    return visibleActors().reduce(function count(sum, actorId) {
      return sum + blocks(actorId, "start").length + blocks(actorId, "click").length + blocks(actorId, "message").length;
    }, 0);
  }

  function setCurrentTaskId(taskId) {
    store.app.currentTaskId = taskId;
    ensureWorkspace(taskId);
    schedulePersist();
  }

  function setSelectedActor(actorId) {
    ws().selectedActorId = actorId;
    schedulePersist();
  }

  function setBlocks(actorId, slotId, nextBlocks) {
    ws().actors[actorId][slotId] = nextBlocks;
    schedulePersist();
  }

  function setMessageName(actorId, value) {
    ws().actors[actorId].messageName = value;
    schedulePersist();
  }

  function messageName(actorId) {
    return ws().actors[actorId].messageName;
  }

  function setVoiceOpen(value) {
    store.app.voiceOpen = Boolean(value);
  }

  function setMuted(value) {
    store.app.isMuted = Boolean(value);
    schedulePersist();
  }

  function setLastVoiceText(text) {
    store.app.lastVoiceText = text || "";
  }

  function setKeyboardSlotTarget(actorId, slotId) {
    store.app.keyboardSlotTarget = actorId + ":" + slotId;
    renderIfPossible("renderScriptSlots");
  }

  function getKeyboardSlotTarget() {
    return store.app.keyboardSlotTarget;
  }

  function clearPersistedState() {
    if (!global.localStorage) {
      return;
    }

    global.localStorage.removeItem(config.STORAGE_KEY);
    store.storage.lastSavedAt = 0;
    store.storage.restored = false;
    log("warn", "已清空本地存档。");
    setStatus({
      kind: "idle",
      text: "本地存档已清空，当前页面状态不变。",
      detail: "",
      busy: false,
    });
    renderIfPossible("renderStatusBar");
  }

  function serializeBlocks(items) {
    return items.map(function serializeBlock(item) {
      return {
        blockId: item.blockId,
        param: item.param,
      };
    });
  }

  function sanitizeBlocks(taskId, items) {
    const taskConfig = config.TASKS[taskId];

    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(function filterBlock(item) {
        return item && config.BLOCKS[item.blockId] && taskConfig.allowed.indexOf(item.blockId) !== -1;
      })
      .map(function hydrateBlock(item) {
        return createInstance(item.blockId, sanitizeParam(item.blockId, item.param, taskId));
      });
  }

  function hydrateWorkspace(taskId, rawWorkspace) {
    const workspace = createWorkspace(taskId);
    const taskConfig = config.TASKS[taskId];
    const raw = rawWorkspace || {};

    if (taskConfig.type === "free" && config.SCENES[raw.sceneId]) {
      workspace.sceneId = raw.sceneId;
    }

    if (taskConfig.actors.indexOf(raw.selectedActorId) !== -1) {
      workspace.selectedActorId = raw.selectedActorId;
    }

    Object.keys(config.ACTORS).forEach(function hydrateActor(actorId) {
      const rawActor = raw.actors && raw.actors[actorId] ? raw.actors[actorId] : {};
      workspace.actors[actorId].start = sanitizeBlocks(taskId, rawActor.start);
      workspace.actors[actorId].click = sanitizeBlocks(taskId, rawActor.click);
      workspace.actors[actorId].message = sanitizeBlocks(taskId, rawActor.message);

      if (config.MSGS.includes(rawActor.messageName)) {
        workspace.actors[actorId].messageName = rawActor.messageName;
      }
    });

    return workspace;
  }

  function serializeState() {
    const workspaces = {};

    Object.keys(store.workspaces).forEach(function serializeWorkspace(taskId) {
      const workspace = store.workspaces[taskId];
      workspaces[taskId] = {
        sceneId: workspace.sceneId,
        selectedActorId: workspace.selectedActorId,
        actors: {},
      };

      Object.keys(config.ACTORS).forEach(function serializeActor(actorId) {
        workspaces[taskId].actors[actorId] = {
          start: serializeBlocks(workspace.actors[actorId].start),
          click: serializeBlocks(workspace.actors[actorId].click),
          message: serializeBlocks(workspace.actors[actorId].message),
          messageName: workspace.actors[actorId].messageName,
        };
      });
    });

    return {
      version: config.STORAGE_VERSION,
      currentTaskId: store.app.currentTaskId,
      isMuted: store.app.isMuted,
      workspaces: workspaces,
    };
  }

  function savePersistedState() {
    if (!global.localStorage) {
      return;
    }

    try {
      global.localStorage.setItem(config.STORAGE_KEY, JSON.stringify(serializeState()));
      store.storage.lastSavedAt = Date.now();
      renderIfPossible("renderStatusBar");
      renderIfPossible("renderDebugPanel");
    } catch (error) {
      log("error", "写入本地存档失败。", { message: error.message });
      store.app.lastError = {
        label: "storage",
        message: error.message,
        at: Date.now(),
      };
      announce("assertive", "保存失败，但页面仍然可以继续使用。");
      setStatus({
        kind: "error",
        text: "保存失败，但页面仍然可以继续使用。",
        detail: error.message,
        busy: false,
      });
    }
  }

  function loadPersistedState() {
    if (!global.localStorage) {
      log("warn", "当前环境不支持 localStorage。");
      return;
    }

    let rawText = "";

    try {
      rawText = global.localStorage.getItem(config.STORAGE_KEY) || "";
      if (!rawText) {
        return;
      }

      const parsed = JSON.parse(rawText);

      if (parsed.version !== config.STORAGE_VERSION) {
        log("warn", "本地存档版本不匹配，已忽略旧数据。", { version: parsed.version });
        return;
      }

      if (config.TASKS[parsed.currentTaskId]) {
        store.app.currentTaskId = parsed.currentTaskId;
      }

      store.app.isMuted = Boolean(parsed.isMuted);

      Object.keys(parsed.workspaces || {}).forEach(function loadWorkspace(taskId) {
        if (!config.TASKS[taskId]) {
          return;
        }

        store.workspaces[taskId] = hydrateWorkspace(taskId, parsed.workspaces[taskId]);
      });

      store.storage.restored = true;
      log("info", "已恢复本地存档。", { taskId: store.app.currentTaskId });
    } catch (error) {
      store.workspaces = {};
      store.app.currentTaskId = "task1";
      store.app.isMuted = false;
      log("error", "读取本地存档失败，已回退到默认状态。", {
        message: error.message,
        rawText: rawText.slice(0, 120),
      });
      store.app.lastError = {
        label: "storage",
        message: error.message,
        at: Date.now(),
      };
      announce("assertive", "本地存档损坏，已自动回退到默认状态。");
      setStatus({
        kind: "error",
        text: "本地存档损坏，已自动回退到默认状态。",
        detail: error.message,
        busy: false,
      });
    }
  }

  function resetWorkspaceForTask(taskId) {
    const keepScene = config.TASKS[taskId].type === "free" && store.workspaces[taskId];
    const previousScene = keepScene ? store.workspaces[taskId].sceneId : config.TASKS[taskId].sceneId;
    store.workspaces[taskId] = createWorkspace(taskId);
    if (keepScene && config.SCENES[previousScene]) {
      store.workspaces[taskId].sceneId = previousScene;
    }
    schedulePersist();
    return store.workspaces[taskId];
  }

  function handleError(error, label) {
    const message = error && error.message ? error.message : String(error || "未知错误");

    store.loadingCount = 0;
    store.app.lastError = {
      label: label || "runtime",
      message: message,
      at: Date.now(),
    };

    log("error", (label || "runtime") + " 发生异常。", { message: message });

    if (typeof App.abortRuntimeForError === "function") {
      App.abortRuntimeForError();
    }

    setStatus({
      kind: "error",
      text: "出现了一点小问题，已经帮你停下来。",
      detail: message,
      busy: false,
    });
    announce("assertive", "出现了一点小问题，已经帮你停下来。");

    if (typeof App.applyAiCopy === "function") {
      App.applyAiCopy(createMessage("出了点小问题，我先帮你停下来。", "error", "可以点重置后再试一次。"));
    }
  }

  async function guard(label, runner, options) {
    const settings = Object.assign(
      {
        loadingText: "",
        loadingDetail: "",
      },
      options || {}
    );

    if (settings.loadingText) {
      startLoading(settings.loadingText, settings.loadingDetail);
    }

    try {
      return await runner();
    } catch (error) {
      handleError(error, label);
      return null;
    } finally {
      if (settings.loadingText) {
        finishLoading();
      }
    }
  }

  App.store = store;
  App.log = log;
  App.announce = announce;
  App.setStatus = setStatus;
  App.startLoading = startLoading;
  App.finishLoading = finishLoading;
  App.guard = guard;
  App.handleError = handleError;
  App.formatTime = formatTime;
  App.state = {
    ensureWorkspace: ensureWorkspace,
    task: task,
    ws: ws,
    visibleActors: visibleActors,
    selectedActor: selectedActor,
    blocks: blocks,
    blockIds: blockIds,
    cloneBlocks: cloneBlocks,
    paramOptions: paramOptions,
    defaultParam: defaultParam,
    paramLabel: paramLabel,
    nextParam: nextParam,
    sanitizeParam: sanitizeParam,
    createInstance: createInstance,
    countBlocks: countBlocks,
    defaultMessageName: defaultMessageName,
    createWorkspace: createWorkspace,
    resetWorkspaceForTask: resetWorkspaceForTask,
    setCurrentTaskId: setCurrentTaskId,
    setSelectedActor: setSelectedActor,
    setBlocks: setBlocks,
    setMessageName: setMessageName,
    messageName: messageName,
    setVoiceOpen: setVoiceOpen,
    setMuted: setMuted,
    setLastVoiceText: setLastVoiceText,
    setKeyboardSlotTarget: setKeyboardSlotTarget,
    getKeyboardSlotTarget: getKeyboardSlotTarget,
    loadPersistedState: loadPersistedState,
    savePersistedState: savePersistedState,
    schedulePersist: schedulePersist,
    clearPersistedState: clearPersistedState,
  };
})(window);
