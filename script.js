const BLOCKS = {
  clickCharacter: {
    label: "点角色时",
    icon: "👆",
    category: "trigger",
    colorClass: "block-trigger",
    speakText: "点击角色时",
    subText: "点它才开始",
  },
  start: {
    label: "开始时",
    icon: "🚀",
    category: "trigger",
    colorClass: "block-trigger",
    speakText: "开始时",
    subText: "一开始就动",
  },
  sayHello: {
    label: "说你好",
    icon: "💬",
    category: "action",
    colorClass: "block-action",
    speakText: "说你好",
    subText: "开口打招呼",
  },
  moveForward: {
    label: "向前走",
    icon: "👣",
    category: "action",
    colorClass: "block-action",
    speakText: "向前走",
    subText: "往前一点点",
  },
  repeat: {
    label: "重复",
    icon: "🔁",
    category: "loop",
    colorClass: "block-loop",
    speakText: "重复",
    subText: "多做几次",
  },
  jump: {
    label: "跳跃",
    icon: "🦘",
    category: "action",
    colorClass: "block-action",
    speakText: "跳跃",
    subText: "蹦起来",
  },
};

const TASKS = {
  cat: {
    id: "cat",
    title: "点击小猫，说“你好”",
    shortTitle: "小猫说你好",
    icon: "🐱",
    actorEmoji: "🐱",
    stageTheme: "cat-theme",
    stageBadge: "小猫",
    goalReadText: "任务一，点击小猫，说你好。",
    introTip: "先把点角色时放进来吧。",
    availableBlocks: ["clickCharacter", "start", "sayHello", "moveForward", "repeat"],
    solution: ["clickCharacter", "sayHello"],
    successTip: "太棒啦！小猫会说你好啦！",
    extraSuccessTip: "太棒啦！前面两块就让小猫说你好啦！",
    voiceReply: "我听懂啦，你想让小猫说你好。试试先放点角色时，再放说你好。",
  },
  rabbit: {
    id: "rabbit",
    title: "小兔子重复跳跃",
    shortTitle: "小兔子跳跳跳",
    icon: "🐰",
    actorEmoji: "🐰",
    stageTheme: "rabbit-theme",
    stageBadge: "小兔子",
    goalReadText: "任务二，让小兔子重复跳跃。",
    introTip: "先让小兔子知道什么时候出发吧。",
    availableBlocks: ["start", "jump", "repeat", "sayHello", "clickCharacter"],
    solution: ["start", "repeat", "jump"],
    successTip: "真棒！你已经学会让动作重复起来了！",
    extraSuccessTip: "真棒！前面三块已经让小兔子跳起来啦！",
    voiceReply: "我听懂啦，你想让小兔子一直跳。试试开始时、重复、跳跃。",
  },
};

const VOICE_COMMANDS = [
  { text: "让小猫说你好", taskId: "cat" },
  { text: "让小兔子一直跳", taskId: "rabbit" },
  { text: "我想试试小兔子跳跃", taskId: "rabbit" },
];

const BRAND_PHOTO_CANDIDATES = [
  "assets/brand/brand-photo.png",
  "assets/brand/brand-photo.jpg",
  "assets/brand/brand-photo.jpeg",
  "assets/brand/brand-photo.webp",
];

const appState = {
  currentTaskId: "cat",
  aiMessage: TASKS.cat.introTip,
  aiMode: "intro",
  isMuted: false,
  hasUserInteracted: false,
  isRunning: false,
  waitingForStageClick: false,
  voiceOpen: false,
  lastVoiceText: "",
  runningIndex: -1,
  highlightPoolBlocks: [],
  stageBubble: "",
  stageGuide: "",
  rabbitLooping: false,
  dragState: null,
  completePendingRun: null,
  speechQueue: [],
  isSpeaking: false,
  currentSpeechText: "",
};

const taskPrograms = {
  cat: [],
  rabbit: [],
};

let instanceCounter = 0;
let speechVoice = null;
let stageResetTimer = null;
let glowTimer = null;
let currentUtterance = null;
let currentSpeechItem = null;
let speechToken = 0;

const dom = {
  brandMark: document.getElementById("brand-photo")?.parentElement,
  brandPhoto: document.getElementById("brand-photo"),
  brandFallback: document.getElementById("brand-fallback"),
  taskList: document.getElementById("task-list"),
  readTaskBtn: document.getElementById("read-task-btn"),
  skipSpeechBtn: document.getElementById("skip-speech-btn"),
  soundToggleBtn: document.getElementById("sound-toggle-btn"),
  soundToggleIcon: document.getElementById("sound-toggle-icon"),
  soundToggleText: document.getElementById("sound-toggle-text"),
  voiceToggleBtn: document.getElementById("voice-toggle-btn"),
  voiceSamples: document.getElementById("voice-samples"),
  voiceUserBubble: document.getElementById("voice-user-bubble"),
  stageWorld: document.getElementById("stage-world"),
  stageBadge: document.getElementById("stage-badge"),
  stageActor: document.getElementById("stage-actor"),
  actorCore: document.getElementById("actor-core"),
  stageBubble: document.getElementById("stage-bubble"),
  stageGuide: document.getElementById("stage-guide"),
  readAiBtn: document.getElementById("read-ai-btn"),
  aiMessage: document.getElementById("ai-message"),
  blockPool: document.getElementById("block-pool"),
  programTrack: document.getElementById("program-track"),
  programList: document.getElementById("program-list"),
  resetBtn: document.getElementById("reset-btn"),
  runBtn: document.getElementById("run-btn"),
};

function registerInteraction() {
  appState.hasUserInteracted = true;
}

function showBrandFallback() {
  if (!dom.brandMark || !dom.brandPhoto || !dom.brandFallback) {
    return;
  }
  dom.brandMark.classList.remove("has-photo");
  dom.brandPhoto.classList.remove("is-visible");
  dom.brandPhoto.hidden = true;
  dom.brandPhoto.removeAttribute("src");
  dom.brandFallback.classList.remove("is-hidden");
}

function loadBrandPhoto() {
  if (!dom.brandMark || !dom.brandPhoto || !dom.brandFallback) {
    return;
  }

  showBrandFallback();

  const tryLoad = (index) => {
    if (index >= BRAND_PHOTO_CANDIDATES.length) {
      return;
    }

    const src = BRAND_PHOTO_CANDIDATES[index];
    const image = new Image();
    image.onload = () => {
      dom.brandPhoto.src = src;
      dom.brandPhoto.hidden = false;
      dom.brandPhoto.classList.add("is-visible");
      dom.brandFallback.classList.add("is-hidden");
      dom.brandMark.classList.add("has-photo");
    };
    image.onerror = () => {
      tryLoad(index + 1);
    };
    image.src = src;
  };

  tryLoad(0);
}

function loadVoices() {
  if (!("speechSynthesis" in window)) {
    return;
  }
  const voices = window.speechSynthesis.getVoices();
  speechVoice =
    voices.find((voice) => /zh/i.test(voice.lang) && /CN|Hans|Chinese/i.test(voice.lang + voice.name)) ||
    voices.find((voice) => /zh/i.test(voice.lang)) ||
    null;
}

function finalizeSpeech(token) {
  if (token !== speechToken) {
    return;
  }
  const finishedItem = currentSpeechItem;
  speechToken = 0;
  currentUtterance = null;
  currentSpeechItem = null;
  appState.isSpeaking = false;
  appState.currentSpeechText = "";
  renderControls();
  if (finishedItem && typeof finishedItem.resolve === "function") {
    finishedItem.resolve();
  }
  playNextSpeech();
}

function playNextSpeech() {
  if (appState.isMuted || !appState.hasUserInteracted) {
    return;
  }
  if (!("speechSynthesis" in window)) {
    const pendingQueue = appState.speechQueue.slice();
    appState.speechQueue = [];
    appState.isSpeaking = false;
    appState.currentSpeechText = "";
    currentSpeechItem = null;
    pendingQueue.forEach((item) => {
      if (typeof item.onStart === "function") {
        item.onStart();
      }
      if (typeof item.resolve === "function") {
        item.resolve();
      }
    });
    renderControls();
    return;
  }
  if (appState.isSpeaking || !appState.speechQueue.length) {
    renderControls();
    return;
  }

  const nextItem = appState.speechQueue.shift();
  const utterance = new SpeechSynthesisUtterance(nextItem.text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.95;
  utterance.pitch = 1.08;
  if (speechVoice) {
    utterance.voice = speechVoice;
  }

  speechToken += 1;
  const activeToken = speechToken;
  currentUtterance = utterance;
  currentSpeechItem = nextItem;
  appState.isSpeaking = true;
  appState.currentSpeechText = nextItem.text;
  if (typeof nextItem.onStart === "function") {
    nextItem.onStart();
  }
  utterance.onend = () => finalizeSpeech(activeToken);
  utterance.onerror = () => finalizeSpeech(activeToken);
  renderControls();

  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    finalizeSpeech(activeToken);
  }
}

function speak(text, options = {}) {
  const { onStart = null } = options;
  if (!text || appState.isMuted || !appState.hasUserInteracted) {
    if (typeof onStart === "function") {
      onStart();
    }
    return Promise.resolve();
  }
  if (!("speechSynthesis" in window)) {
    if (typeof onStart === "function") {
      onStart();
    }
    return Promise.resolve();
  }

  const normalizedText = text.trim();
  const lastQueuedItem = appState.speechQueue[appState.speechQueue.length - 1];
  const lastQueuedText = lastQueuedItem ? lastQueuedItem.text : "";
  if (!normalizedText) {
    if (typeof onStart === "function") {
      onStart();
    }
    return Promise.resolve();
  }
  if (normalizedText === appState.currentSpeechText && !appState.speechQueue.length) {
    return Promise.resolve();
  }
  if (normalizedText === lastQueuedText) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    appState.speechQueue.push({
      text: normalizedText,
      onStart,
      resolve,
    });
    renderControls();
    playNextSpeech();
  });
}

function stopSpeaking() {
  const pendingQueue = appState.speechQueue.slice();
  const activeItem = currentSpeechItem;
  appState.speechQueue = [];
  appState.isSpeaking = false;
  appState.currentSpeechText = "";
  speechToken = 0;
  currentUtterance = null;
  currentSpeechItem = null;
  if (activeItem && typeof activeItem.resolve === "function") {
    activeItem.resolve();
  }
  pendingQueue.forEach((item) => {
    if (typeof item.resolve === "function") {
      item.resolve();
    }
  });
  renderControls();
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      // 忽略取消失败。
    }
  }
}

function skipCurrentSpeech() {
  if (appState.isMuted) {
    return;
  }
  if (appState.isSpeaking && currentUtterance && "speechSynthesis" in window) {
    const activeToken = speechToken;
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      // 忽略取消失败。
    }
    window.setTimeout(() => finalizeSpeech(activeToken), 0);
    return;
  }
  if (appState.speechQueue.length) {
    playNextSpeech();
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createInstance(blockId) {
  instanceCounter += 1;
  return {
    instanceId: `inst-${instanceCounter}`,
    blockId,
  };
}

function getCurrentTask() {
  return TASKS[appState.currentTaskId];
}

function getCurrentProgram() {
  return taskPrograms[appState.currentTaskId];
}

function setCurrentProgram(nextProgram) {
  taskPrograms[appState.currentTaskId] = nextProgram;
}

function getBuilderHint(taskId, program) {
  const ids = program.map((item) => item.blockId);
  if (taskId === "cat") {
    if (!ids.length) {
      return "先把点角色时放进来吧。";
    }
    if (ids[0] !== "clickCharacter") {
      return "点角色时要放在最前面哦。";
    }
    if (ids.length === 1) {
      return "做得好，再放一个说你好。";
    }
    if (ids[1] !== "sayHello") {
      return "把说你好放在第二块吧。";
    }
    return ids.length > 2 ? "前面两块已经够啦，点运行试试。" : "搭好啦，点运行后再点小猫。";
  }

  if (!ids.length) {
    return "先让小兔子知道什么时候开始。";
  }
  if (ids[0] !== "start") {
    return "开始时要放在最前面。";
  }
  if (ids.length === 1) {
    return "再放重复，让它多做几次。";
  }
  if (ids[1] !== "repeat") {
    return "把重复放到第二块。";
  }
  if (ids.length === 2) {
    return "最后加一个跳跃吧。";
  }
  if (ids[2] !== "jump") {
    return "让跳跃跟在重复后面。";
  }
  return ids.length > 3 ? "前面三块已经够啦，点运行看看。" : "积木排好了，点运行吧。";
}

function applyAiMessage(message, mode = "guide") {
  appState.aiMessage = message;
  appState.aiMode = mode;
  dom.aiMessage.textContent = message;
  dom.aiMessage.dataset.mode = mode;
}

function setAiMessage(message, mode = "guide", options = {}) {
  const { autoSpeak = false, waitForSpeech = false } = options;
  if (!autoSpeak) {
    applyAiMessage(message, mode);
    return Promise.resolve();
  }
  const speechTask = speak(message, {
    onStart: () => {
      applyAiMessage(message, mode);
    },
  });
  return waitForSpeech ? speechTask : Promise.resolve();
}

function speakCurrentTask() {
  const task = getCurrentTask();
  speak(`${task.goalReadText} ${getBuilderHint(task.id, taskPrograms[task.id])}`);
}

function renderTaskList() {
  dom.taskList.innerHTML = "";
  Object.values(TASKS).forEach((task) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `task-card${task.id === appState.currentTaskId ? " is-active" : ""}`;
    button.dataset.taskId = task.id;
    button.disabled = appState.isRunning;
    button.innerHTML = `
      <div class="task-top">
        <div class="task-icon" aria-hidden="true">${task.icon}</div>
        <span class="panel-badge">${task.id === "cat" ? "任务 1" : "任务 2"}</span>
      </div>
      <strong>${task.shortTitle}</strong>
      <p>${task.id === "cat" ? "点一点击小猫" : "让它跳三次"}</p>
    `;
    dom.taskList.appendChild(button);
  });
}

function renderVoicePanel() {
  dom.voiceUserBubble.classList.toggle("is-empty", !appState.lastVoiceText);
  dom.voiceUserBubble.textContent = appState.lastVoiceText || "点麦克风，试着说需求。";
  dom.voiceSamples.className = `voice-samples${appState.voiceOpen ? " is-open" : ""}`;
  dom.voiceSamples.innerHTML = "";

  VOICE_COMMANDS.forEach((command) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "voice-chip";
    button.dataset.taskId = command.taskId;
    button.dataset.voiceText = command.text;
    button.textContent = command.text;
    dom.voiceSamples.appendChild(button);
  });
}

function createBlockMarkup(instanceOrTemplate, index, isProgramBlock) {
  const block = BLOCKS[instanceOrTemplate.blockId || instanceOrTemplate];
  const wrapper = document.createElement(isProgramBlock ? "div" : "button");

  wrapper.className = `${isProgramBlock ? "program-block" : "pool-block"} ${block.colorClass}`;
  if (isProgramBlock) {
    wrapper.dataset.instanceId = instanceOrTemplate.instanceId;
    wrapper.dataset.blockId = instanceOrTemplate.blockId;
    wrapper.setAttribute("role", "listitem");
  } else {
    wrapper.type = "button";
    wrapper.dataset.blockId = instanceOrTemplate;
    if (appState.highlightPoolBlocks.includes(instanceOrTemplate)) {
      wrapper.classList.add("block-glow");
    }
  }

  wrapper.innerHTML = `
    ${isProgramBlock ? `<span class="block-index">${index + 1}</span>` : ""}
    <span class="block-icon" aria-hidden="true">${block.icon}</span>
    <span class="block-content">
      <span class="block-title">${block.label}</span>
      <span class="block-sub">${block.subText}</span>
    </span>
    ${isProgramBlock ? '<button class="block-delete" type="button" aria-label="删除积木">×</button>' : ""}
  `;
  return wrapper;
}

function renderBlockPool() {
  const task = getCurrentTask();
  dom.blockPool.innerHTML = "";
  task.availableBlocks.forEach((blockId) => {
    dom.blockPool.appendChild(createBlockMarkup(blockId, 0, false));
  });
}

function renderProgram() {
  const program = getCurrentProgram();
  dom.programList.innerHTML = "";

  if (!program.length) {
    const empty = document.createElement("div");
    empty.className = "program-empty";
    empty.innerHTML = "<div>把积木拖来<br>排成一条路</div>";
    dom.programList.appendChild(empty);
    return;
  }

  program.forEach((instance, index) => {
    const blockElement = createBlockMarkup(instance, index, true);
    if (index === appState.runningIndex) {
      blockElement.classList.add("is-active");
    }
    if (appState.isRunning) {
      blockElement.style.cursor = "default";
    }
    dom.programList.appendChild(blockElement);
  });
}

function renderStage() {
  const task = getCurrentTask();
  const actorLocked = appState.isRunning && !(appState.waitingForStageClick && task.id === "cat");
  dom.stageWorld.className = `stage-world ${task.stageTheme}`;
  dom.stageBadge.textContent = task.stageBadge;
  dom.actorCore.textContent = task.actorEmoji;
  dom.actorCore.classList.toggle("rabbit-loop", task.id === "rabbit" && appState.rabbitLooping);
  dom.stageBubble.textContent = appState.stageBubble;
  dom.stageBubble.classList.toggle("is-visible", Boolean(appState.stageBubble));
  dom.stageGuide.textContent = appState.stageGuide;
  dom.stageGuide.classList.toggle("is-visible", Boolean(appState.stageGuide));
  dom.stageActor.classList.toggle("is-clickable", appState.waitingForStageClick && task.id === "cat");
  dom.stageActor.classList.toggle("is-locked", actorLocked);
  dom.stageActor.setAttribute("aria-disabled", actorLocked ? "true" : "false");
}

function renderControls() {
  const isWaitingCat = appState.waitingForStageClick && appState.currentTaskId === "cat";
  const canSkipSpeech = (appState.isSpeaking || appState.speechQueue.length > 0) && !appState.isMuted;
  dom.runBtn.disabled = appState.isRunning;
  dom.resetBtn.disabled = appState.isRunning;
  dom.runBtn.textContent = isWaitingCat ? "等点猫" : "运行";
  dom.soundToggleIcon.textContent = appState.isMuted ? "🔇" : "🔈";
  dom.soundToggleText.textContent = appState.isMuted ? "已静音" : "有声音";
  dom.skipSpeechBtn.disabled = !canSkipSpeech;
}

function renderAll() {
  renderTaskList();
  renderVoicePanel();
  renderBlockPool();
  renderProgram();
  renderStage();
  renderControls();
  dom.aiMessage.textContent = appState.aiMessage;
  dom.aiMessage.dataset.mode = appState.aiMode;
}

function clearStageFeedback() {
  appState.stageBubble = "";
  appState.stageGuide = "";
  appState.waitingForStageClick = false;
  appState.rabbitLooping = false;
  dom.actorCore.classList.remove("cat-pop", "rabbit-hop", "rabbit-loop");
  if (stageResetTimer) {
    window.clearTimeout(stageResetTimer);
    stageResetTimer = null;
  }
}

function triggerPoolGlow(blockIds) {
  appState.highlightPoolBlocks = [...new Set(blockIds)];
  renderBlockPool();
  if (glowTimer) {
    window.clearTimeout(glowTimer);
  }
  glowTimer = window.setTimeout(() => {
    appState.highlightPoolBlocks = [];
    renderBlockPool();
  }, 1200);
}

function updateBuilderHint(autoSpeak = false) {
  if (appState.isRunning) {
    return;
  }
  setAiMessage(getBuilderHint(appState.currentTaskId, getCurrentProgram()), "guide", { autoSpeak });
}

function switchTask(taskId, options = {}) {
  const { autoSpeak = false } = options;
  if (appState.isRunning) {
    return;
  }
  stopSpeaking();
  appState.currentTaskId = taskId;
  clearStageFeedback();
  const nextMessage = getBuilderHint(taskId, taskPrograms[taskId]);
  if (!autoSpeak) {
    applyAiMessage(nextMessage, taskPrograms[taskId].length ? "guide" : "intro");
  }
  renderAll();
  if (autoSpeak) {
    setAiMessage(nextMessage, taskPrograms[taskId].length ? "guide" : "intro", { autoSpeak: true });
  }
}

function updateProgramAndHint(nextProgram) {
  setCurrentProgram(nextProgram);
  renderProgram();
  updateBuilderHint();
}

function evaluateCurrentProgram() {
  const taskId = appState.currentTaskId;
  const program = getCurrentProgram();
  const ids = program.map((item) => item.blockId);

  if (taskId === "cat") {
    if (!ids.includes("clickCharacter")) {
      return {
        ok: false,
        message: "小猫还不知道什么时候开始哦。",
        poolBlocks: ["clickCharacter"],
      };
    }
    if (ids[0] !== "clickCharacter") {
      if (ids[0] === "start") {
        return {
          ok: false,
          message: "现在要点小猫才开始，不是直接开始哦。",
          poolBlocks: ["clickCharacter"],
        };
      }
      return {
        ok: false,
        message: "把点角色时放到最前面呀。",
        poolBlocks: ["clickCharacter"],
      };
    }
    if (!ids.includes("sayHello")) {
      return {
        ok: false,
        message: "已经知道什么时候开始啦，那它要说什么呢？",
        poolBlocks: ["sayHello"],
      };
    }
    if (ids[1] !== "sayHello") {
      return {
        ok: false,
        message: "让说你好紧紧跟在点角色时后面吧。",
        poolBlocks: ["sayHello"],
      };
    }
    return {
      ok: true,
      message: ids.length > 2 ? TASKS.cat.extraSuccessTip : TASKS.cat.successTip,
      poolBlocks: [],
    };
  }

  if (!ids.includes("start")) {
    return {
      ok: false,
      message: "小兔子还不知道什么时候出发呢。",
      poolBlocks: ["start"],
    };
  }
  if (ids[0] !== "start") {
    if (ids[0] === "clickCharacter") {
      return {
        ok: false,
        message: "这次不用点小兔，直接开始就好。",
        poolBlocks: ["start"],
      };
    }
    return {
      ok: false,
      message: "把开始时放在最前面呀。",
      poolBlocks: ["start"],
    };
  }
  if (!ids.includes("repeat")) {
    return {
      ok: false,
      message: "如果只跳一次，就不是一直跳啦。",
      poolBlocks: ["repeat"],
    };
  }
  if (ids[1] !== "repeat") {
    return {
      ok: false,
      message: "把重复放到第二块，会更像连跳哦。",
      poolBlocks: ["repeat"],
    };
  }
  if (!ids.includes("jump")) {
    return {
      ok: false,
      message: "已经会重复啦，那要重复做什么动作呢？",
      poolBlocks: ["jump"],
    };
  }
  if (ids[2] !== "jump") {
    return {
      ok: false,
      message: "让跳跃跟在重复后面呀。",
      poolBlocks: ["jump"],
    };
  }
  return {
    ok: true,
    message: ids.length > 3 ? TASKS.rabbit.extraSuccessTip : TASKS.rabbit.successTip,
    poolBlocks: [],
  };
}

async function highlightProgramIndex(index, message, pauseAfterSpeech = 160) {
  appState.runningIndex = index;
  renderProgram();
  await setAiMessage(message, "guide", { autoSpeak: true, waitForSpeech: true });
  await wait(pauseAfterSpeech);
}

function shakeTrack() {
  dom.programTrack.classList.remove("track-shake");
  void dom.programTrack.offsetWidth;
  dom.programTrack.classList.add("track-shake");
}

function resetStageSoon() {
  if (stageResetTimer) {
    window.clearTimeout(stageResetTimer);
  }
  stageResetTimer = window.setTimeout(() => {
    dom.actorCore.classList.remove("cat-pop", "rabbit-hop");
  }, 900);
}

function playCatCelebrate() {
  dom.actorCore.classList.remove("cat-pop");
  void dom.actorCore.offsetWidth;
  dom.actorCore.classList.add("cat-pop");
  resetStageSoon();
}

function playRabbitHop() {
  appState.rabbitLooping = false;
  dom.actorCore.classList.remove("rabbit-hop", "rabbit-loop");
  void dom.actorCore.offsetWidth;
  dom.actorCore.classList.add("rabbit-hop");
  resetStageSoon();
}

function startRabbitLoop() {
  appState.rabbitLooping = true;
  dom.actorCore.classList.remove("rabbit-hop");
  renderStage();
}

function finishRun() {
  appState.isRunning = false;
  appState.waitingForStageClick = false;
  appState.runningIndex = -1;
  appState.stageGuide = "";
  appState.completePendingRun = null;
  renderAll();
}

async function runCatTask(successMessage) {
  appState.isRunning = true;
  appState.runningIndex = -1;
  clearStageFeedback();
  renderAll();
  appState.runningIndex = 0;
  renderProgram();
  appState.waitingForStageClick = true;
  appState.stageGuide = "点一下小猫";
  renderStage();
  renderControls();
  setAiMessage("准备好啦，点一下小猫吧。", "guide", { autoSpeak: true });

  appState.completePendingRun = async () => {
    appState.waitingForStageClick = false;
    appState.stageGuide = "";
    appState.runningIndex = 1;
    renderProgram();
    appState.stageBubble = "你好！";
    renderStage();
    playCatCelebrate();
    await setAiMessage(successMessage, "success", { autoSpeak: true, waitForSpeech: true });
    await wait(180);
    finishRun();
  };
}

async function runRabbitTask(successMessage) {
  appState.isRunning = true;
  appState.runningIndex = -1;
  clearStageFeedback();
  renderAll();
  appState.runningIndex = 0;
  renderProgram();
  setAiMessage("先出发。", "guide", { autoSpeak: true });
  await wait(240);
  appState.runningIndex = 1;
  renderProgram();
  setAiMessage("再让它一直跳。", "guide", { autoSpeak: true });
  await wait(260);

  appState.runningIndex = 2;
  renderProgram();
  playRabbitHop();
  await wait(620);
  appState.stageBubble = "一直跳！";
  startRabbitLoop();
  const jumpSpeechTask = setAiMessage("看，小兔子开始一直跳啦！", "guide", { autoSpeak: true, waitForSpeech: true });
  await jumpSpeechTask;
  await setAiMessage(successMessage, "success", { autoSpeak: true, waitForSpeech: true });
  finishRun();
}

async function handleRun() {
  registerInteraction();
  if (appState.isRunning) {
    return;
  }
  stopSpeaking();
  clearStageFeedback();
  appState.completePendingRun = null;
  const result = evaluateCurrentProgram();
  if (!result.ok) {
    setAiMessage(result.message, "error", { autoSpeak: true });
    triggerPoolGlow(result.poolBlocks);
    shakeTrack();
    renderStage();
    return;
  }

  if (appState.currentTaskId === "cat") {
    await runCatTask(result.message);
    return;
  }

  await runRabbitTask(result.message);
}

function updatePointerGhostPosition(clientX, clientY) {
  if (!appState.dragState || !appState.dragState.ghost) {
    return;
  }
  appState.dragState.ghost.style.left = `${clientX}px`;
  appState.dragState.ghost.style.top = `${clientY}px`;
}

function ensurePlaceholder() {
  if (appState.dragState.placeholder) {
    return appState.dragState.placeholder;
  }
  const placeholder = document.createElement("div");
  placeholder.className = "program-placeholder";
  appState.dragState.placeholder = placeholder;
  return placeholder;
}

function removePlaceholder() {
  if (appState.dragState && appState.dragState.placeholder && appState.dragState.placeholder.parentNode) {
    appState.dragState.placeholder.parentNode.removeChild(appState.dragState.placeholder);
  }
}

function computeInsertIndex(clientY) {
  const placeholder = ensurePlaceholder();
  const blocks = [...dom.programList.querySelectorAll(".program-block")].filter((element) => {
    if (!appState.dragState) {
      return true;
    }
    return element.dataset.instanceId !== appState.dragState.instanceId;
  });

  let insertBefore = null;
  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      insertBefore = block;
      break;
    }
  }

  if (insertBefore) {
    dom.programList.insertBefore(placeholder, insertBefore);
    return blocks.indexOf(insertBefore);
  }

  dom.programList.appendChild(placeholder);
  return blocks.length;
}

function pointerInsideTrack(clientX, clientY) {
  const rect = dom.programTrack.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function beginDrag(sourceType, sourceElement, payload, event) {
  if (appState.isRunning) {
    return;
  }
  event.preventDefault();
  registerInteraction();
  const ghost = sourceElement.cloneNode(true);
  ghost.classList.add("drag-ghost");
  const deleteButton = ghost.querySelector(".block-delete");
  if (deleteButton) {
    deleteButton.remove();
  }
  document.body.appendChild(ghost);

  appState.dragState = {
    sourceType,
    blockId: payload.blockId,
    instanceId: payload.instanceId || null,
    originIndex: payload.originIndex,
    ghost,
    insertIndex: null,
    placeholder: null,
    originElement: sourceElement,
  };

  if (sourceType === "program") {
    sourceElement.classList.add("drag-origin");
  }

  updatePointerGhostPosition(event.clientX, event.clientY);
  window.addEventListener("pointermove", handleGlobalPointerMove);
  window.addEventListener("pointerup", handleGlobalPointerUp, { once: true });
}

function finishDrag(commitDrop) {
  if (!appState.dragState) {
    return;
  }
  const dragState = appState.dragState;
  removePlaceholder();

  if (commitDrop && Number.isInteger(dragState.insertIndex)) {
    const currentProgram = getCurrentProgram();
    let nextProgram = currentProgram.slice();
    if (dragState.sourceType === "pool") {
      nextProgram.splice(dragState.insertIndex, 0, createInstance(dragState.blockId));
    } else {
      const movingItem = currentProgram.find((item) => item.instanceId === dragState.instanceId);
      nextProgram = currentProgram.filter((item) => item.instanceId !== dragState.instanceId);
      if (movingItem) {
        nextProgram.splice(dragState.insertIndex, 0, movingItem);
      }
    }
    updateProgramAndHint(nextProgram);
  } else if (dragState.originElement) {
    dragState.originElement.classList.remove("drag-origin");
    renderProgram();
  }

  if (dragState.ghost && dragState.ghost.parentNode) {
    dragState.ghost.parentNode.removeChild(dragState.ghost);
  }

  appState.dragState = null;
  window.removeEventListener("pointermove", handleGlobalPointerMove);
}

function handleGlobalPointerMove(event) {
  if (!appState.dragState) {
    return;
  }
  updatePointerGhostPosition(event.clientX, event.clientY);
  if (pointerInsideTrack(event.clientX, event.clientY)) {
    if (dom.programList.querySelector(".program-empty")) {
      dom.programList.innerHTML = "";
    }
    appState.dragState.insertIndex = computeInsertIndex(event.clientY);
  } else {
    appState.dragState.insertIndex = null;
    removePlaceholder();
    if (!getCurrentProgram().length) {
      renderProgram();
    }
  }
}

function handleGlobalPointerUp(event) {
  if (!appState.dragState) {
    return;
  }
  const shouldCommit = pointerInsideTrack(event.clientX, event.clientY) && Number.isInteger(appState.dragState.insertIndex);
  finishDrag(shouldCommit);
}

function handleTaskClick(event) {
  const button = event.target.closest(".task-card");
  if (!button) {
    return;
  }
  registerInteraction();
  switchTask(button.dataset.taskId, { autoSpeak: true });
}

function handleVoiceSampleClick(event) {
  const button = event.target.closest(".voice-chip");
  if (!button) {
    return;
  }
  registerInteraction();
  const { voiceText, taskId } = button.dataset;
  appState.lastVoiceText = `我说：${voiceText}`;
  appState.voiceOpen = true;
  switchTask(taskId, { autoSpeak: false });
  renderVoicePanel();
  setAiMessage(TASKS[taskId].voiceReply, "guide", { autoSpeak: true });
}

function handleBlockPoolPointerDown(event) {
  const blockElement = event.target.closest(".pool-block");
  if (!blockElement || event.button !== 0) {
    return;
  }
  beginDrag(
    "pool",
    blockElement,
    { blockId: blockElement.dataset.blockId, originIndex: -1 },
    event,
  );
}

function handleProgramPointerDown(event) {
  if (event.target.closest(".block-delete")) {
    return;
  }

  const blockElement = event.target.closest(".program-block");
  if (!blockElement || event.button !== 0 || appState.isRunning) {
    return;
  }
  const currentProgram = getCurrentProgram();
  const originIndex = currentProgram.findIndex((item) => item.instanceId === blockElement.dataset.instanceId);
  beginDrag(
    "program",
    blockElement,
    {
      blockId: blockElement.dataset.blockId,
      instanceId: blockElement.dataset.instanceId,
      originIndex,
    },
    event,
  );
}

function handleProgramClick(event) {
  const deleteButton = event.target.closest(".block-delete");
  if (!deleteButton || appState.isRunning) {
    return;
  }
  const blockElement = deleteButton.closest(".program-block");
  const instanceId = blockElement.dataset.instanceId;
  const nextProgram = getCurrentProgram().filter((item) => item.instanceId !== instanceId);
  registerInteraction();
  updateProgramAndHint(nextProgram);
}

function handleVoiceToggle() {
  registerInteraction();
  appState.voiceOpen = !appState.voiceOpen;
  renderVoicePanel();
  if (appState.voiceOpen) {
    setAiMessage("点一句试试，我会帮你切到任务。", "guide", { autoSpeak: true });
  }
}

function handleReset() {
  registerInteraction();
  if (appState.isRunning) {
    return;
  }
  clearStageFeedback();
  setCurrentProgram([]);
  appState.runningIndex = -1;
  renderProgram();
  renderStage();
  setAiMessage(getCurrentTask().introTip, "intro", { autoSpeak: true });
}

async function handleStageActorClick() {
  registerInteraction();
  if (appState.currentTaskId === "cat" && appState.waitingForStageClick && appState.completePendingRun) {
    const pendingRun = appState.completePendingRun;
    appState.completePendingRun = null;
    await pendingRun();
    return;
  }
  if (!appState.isRunning) {
    setAiMessage(appState.currentTaskId === "cat" ? "先点运行，再来点小猫。" : "先搭好积木，再点运行。", "guide", {
      autoSpeak: true,
    });
  }
}

function handleSoundToggle() {
  registerInteraction();
  appState.isMuted = !appState.isMuted;
  if (appState.isMuted) {
    stopSpeaking();
  }
  renderControls();
  if (!appState.isMuted) {
    speak("声音回来啦。");
  }
}

function bindEvents() {
  dom.taskList.addEventListener("click", handleTaskClick);
  dom.readTaskBtn.addEventListener("click", () => {
    registerInteraction();
    speakCurrentTask();
  });
  dom.skipSpeechBtn.addEventListener("click", () => {
    registerInteraction();
    skipCurrentSpeech();
  });
  dom.soundToggleBtn.addEventListener("click", handleSoundToggle);
  dom.voiceToggleBtn.addEventListener("click", handleVoiceToggle);
  dom.voiceSamples.addEventListener("click", handleVoiceSampleClick);
  dom.readAiBtn.addEventListener("click", () => {
    registerInteraction();
    speak(appState.aiMessage);
  });
  dom.blockPool.addEventListener("pointerdown", handleBlockPoolPointerDown);
  dom.programList.addEventListener("pointerdown", handleProgramPointerDown);
  dom.programList.addEventListener("click", handleProgramClick);
  dom.resetBtn.addEventListener("click", handleReset);
  dom.runBtn.addEventListener("click", handleRun);
  dom.stageActor.addEventListener("click", handleStageActorClick);
}

function initialize() {
  loadVoices();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  loadBrandPhoto();
  bindEvents();
  renderAll();
}

window.render_game_to_text = function renderGameToText() {
  return JSON.stringify({
    coordinateNote: "舞台原点在左上角，角色在舞台中央附近。",
    currentTaskId: appState.currentTaskId,
    currentTaskTitle: getCurrentTask().title,
    program: getCurrentProgram().map((item) => item.blockId),
    aiMessage: appState.aiMessage,
    stageBubble: appState.stageBubble,
    waitingForStageClick: appState.waitingForStageClick,
    rabbitLooping: appState.rabbitLooping,
    isRunning: appState.isRunning,
    isSpeaking: appState.isSpeaking,
    speechQueueLength: appState.speechQueue.length,
  });
};

initialize();

















