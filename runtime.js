(function initRuntime(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};
  const config = App.config;
  const createMessage = App.createMessage;
  const timers = new Map();

  function render(methodName) {
    if (App.render && typeof App.render[methodName] === "function") {
      App.render[methodName]();
    }
  }

  function scheduleTimer(callback, delay, group) {
    const id = "t" + Date.now() + Math.random().toString(16).slice(2);
    const timer = {
      id: id,
      callback: callback,
      remaining: delay,
      group: group,
      handle: null,
    };

    timer.run = function runTimer() {
      if (!timers.has(id)) {
        return;
      }
      timers.delete(id);
      callback();
    };

    timer.handle = global.setTimeout(timer.run, delay);
    timers.set(id, timer);
    return id;
  }

  function clearTimer(id) {
    const timer = timers.get(id);
    if (!timer) {
      return;
    }

    global.clearTimeout(timer.handle);
    timers.delete(id);
  }

  function clearTimerGroup(group) {
    Array.from(timers.values()).forEach(function clearGroupTimer(timer) {
      if (timer.group === group) {
        clearTimer(timer.id);
      }
    });
  }

  function advanceManagedTime(ms) {
    const snapshot = Array.from(timers.values());
    const due = [];

    snapshot.forEach(function advanceTimer(timer) {
      if (!timers.has(timer.id)) {
        return;
      }

      global.clearTimeout(timer.handle);
      timer.remaining -= ms;

      if (timer.remaining <= 0) {
        timers.delete(timer.id);
        due.push(timer);
      } else {
        timer.handle = global.setTimeout(timer.run, timer.remaining);
      }
    });

    due.sort(function sortDue(a, b) {
      return a.remaining - b.remaining;
    }).forEach(function runDue(timer) {
      timer.callback();
    });
  }

  function wait(ms, group) {
    return new Promise(function waitPromise(resolve) {
      scheduleTimer(resolve, ms, group);
    });
  }

  function resetStage(taskId) {
    const activeTask = config.TASKS[taskId || App.store.app.currentTaskId];

    Object.keys(App.store.stage.actors).forEach(function resetActor(actorId) {
      App.store.stage.actors[actorId].offsetX = 0;
      App.store.stage.actors[actorId].scale = 1;
      App.store.stage.actors[actorId].rotation = 0;
      App.store.stage.actors[actorId].bubble = "";
      App.store.stage.actors[actorId].face = config.ACTORS[actorId].face;
      App.store.stage.actors[actorId].flash = false;
      App.store.stage.actors[actorId].hop = false;
      App.store.stage.actors[actorId].spin = false;
      App.store.stage.actors[actorId].forever = false;
      App.store.stage.actors[actorId].visible = activeTask.actors.indexOf(actorId) !== -1;
    });

    App.store.stage.hint = "";
    render("renderStage");
  }

  function pulseFlag(actorId, flag, duration) {
    App.store.stage.actors[actorId][flag] = true;
    render("renderStage");
    scheduleTimer(function clearFlag() {
      App.store.stage.actors[actorId][flag] = false;
      render("renderStage");
    }, duration, "ui");
  }

  function setForever(actorId, active) {
    App.store.stage.actors[actorId].forever = active;
    render("renderStage");
  }

  function setBubble(actorId, text, duration) {
    App.store.stage.actors[actorId].bubble = text;
    render("renderStage");

    if (duration) {
      scheduleTimer(function clearBubble() {
        if (App.store.stage.actors[actorId].bubble === text) {
          App.store.stage.actors[actorId].bubble = "";
          render("renderStage");
        }
      }, duration, "ui");
    }
  }

  function setHint(text) {
    App.store.stage.hint = text || "";
    App.announce("polite", App.store.stage.hint);
    render("renderStage");
  }

  function glowBlocks(blockIds) {
    App.store.app.highlightBlocks = blockIds ? blockIds.slice() : [];
    render("renderBlockPool");
    clearTimerGroup("glow");

    if (App.store.app.highlightBlocks.length) {
      scheduleTimer(function clearGlow() {
        App.store.app.highlightBlocks = [];
        render("renderBlockPool");
      }, 1200, "glow");
    }
  }

  function hintSlot(actorId, slotId) {
    const slotKey = actorId + ":" + slotId;
    App.store.app.slotHint = slotKey;
    render("renderScriptSlots");

    scheduleTimer(function clearSlotHint() {
      if (App.store.app.slotHint === slotKey) {
        App.store.app.slotHint = "";
        render("renderScriptSlots");
      }
    }, 1200, "ui");
  }

  function shakeScripts() {
    if (!App.dom || !App.dom.scriptSlots) {
      return;
    }

    App.dom.scriptSlots.classList.remove("track-shake");
    void App.dom.scriptSlots.offsetWidth;
    App.dom.scriptSlots.classList.add("track-shake");
  }

  function clearUiArtifacts(options) {
    const settings = options || {};

    clearTimerGroup("glow");
    clearTimerGroup("ui");

    if (App.store.app.drag && App.drag && typeof App.drag.cleanup === "function") {
      App.drag.cleanup();
    }

    App.store.app.highlightBlocks = [];
    App.store.app.slotHint = "";
    App.store.runtime.highlight = null;
    App.store.stage.hint = "";

    if (!settings.keepVoiceText) {
      App.store.app.lastVoiceText = "";
    }

    if (App.dom && App.dom.scriptSlots) {
      App.dom.scriptSlots.classList.remove("track-shake");
    }
  }

  function markRunning(actorId, delta) {
    const next = Math.max(0, (App.store.runtime.activeActors[actorId] || 0) + delta);

    if (next === 0) {
      delete App.store.runtime.activeActors[actorId];
    } else {
      App.store.runtime.activeActors[actorId] = next;
    }

    render("renderStage");
    render("renderActorTabs");
  }

  function highlight(actorId, slotId, instanceId) {
    App.store.runtime.highlight = {
      actorId: actorId,
      slotId: slotId,
      instanceId: instanceId,
    };
    render("renderScriptSlots");
  }

  function clearHighlight() {
    App.store.runtime.highlight = null;
    render("renderScriptSlots");
  }

  function validationError(message, focusTarget, highlightBlocks, suggestion) {
    return {
      ok: false,
      message: message,
      focusTarget: focusTarget || null,
      highlightBlocks: highlightBlocks || [],
      suggestion: suggestion || "再看一眼角色和脚本槽。",
    };
  }

  function resolveValue(value, context) {
    return typeof value === "function" ? value(context) : value;
  }

  function resolveHighlightBlocks(rule, context) {
    const value = resolveValue(rule.highlightBlocks, context);
    return Array.isArray(value) ? value : [];
  }

  function evaluateMisplaced(rule, context) {
    if (!Array.isArray(rule.misplaced)) {
      return null;
    }

    for (let index = 0; index < rule.misplaced.length; index += 1) {
      const candidate = rule.misplaced[index];
      const ids = App.state.blockIds(candidate.actorId, candidate.slotId);
      const hasMatch = (candidate.matchBlockIds || []).some(function hasBlock(blockId) {
        return ids.indexOf(blockId) !== -1;
      });

      if (!hasMatch) {
        continue;
      }

      return validationError(
        resolveValue(candidate.message, context),
        { actorId: rule.actorId, slotId: rule.slotId },
        resolveHighlightBlocks(rule, context),
        resolveValue(candidate.suggestion || rule.suggestion, context)
      );
    }

    return null;
  }

  function evaluateRequiredSequence(rule) {
    const slotBlocks = App.state.blockIds(rule.actorId, rule.slotId);
    const context = {
      rule: rule,
      slotBlocks: slotBlocks,
    };

    if (!slotBlocks.length) {
      const misplaced = evaluateMisplaced(rule, context);
      if (misplaced) {
        return misplaced;
      }

      return validationError(
        resolveValue(rule.emptyMessage, context),
        { actorId: rule.actorId, slotId: rule.slotId },
        resolveHighlightBlocks(rule, context),
        resolveValue(rule.suggestion, context)
      );
    }

    for (let index = 0; index < rule.sequence.length; index += 1) {
      if (slotBlocks[index] !== rule.sequence[index]) {
        return validationError(
          resolveValue(rule.wrongMessages && rule.wrongMessages[index] ? rule.wrongMessages[index] : rule.emptyMessage, context),
          { actorId: rule.actorId, slotId: rule.slotId },
          resolveHighlightBlocks(rule, context),
          resolveValue(rule.suggestion, context)
        );
      }
    }

    return null;
  }

  function evaluateBlockParam(rule) {
    const items = App.state.blocks(rule.actorId, rule.slotId);
    const target = items[rule.index || 0];

    if (!target || target.blockId !== rule.blockId) {
      return null;
    }

    if (target.param !== rule.expectedParam) {
      return validationError(
        rule.message,
        { actorId: rule.actorId, slotId: rule.slotId },
        Array.isArray(rule.highlightBlocks) ? rule.highlightBlocks : [],
        rule.suggestion
      );
    }

    return null;
  }

  function evaluateMessageBinding(rule) {
    if (App.state.messageName(rule.actorId) !== rule.expectedMessage) {
      return validationError(rule.message, { actorId: rule.actorId, slotId: "message" }, [], rule.suggestion);
    }

    return null;
  }

  function validateCurrentTask() {
    const taskConfig = App.state.task();

    if (taskConfig.type === "free") {
      return { ok: true };
    }

    for (let index = 0; index < taskConfig.validationPlan.length; index += 1) {
      const rule = taskConfig.validationPlan[index];
      const result =
        rule.type === "requiredSequence"
          ? evaluateRequiredSequence(rule)
          : rule.type === "blockParam"
          ? evaluateBlockParam(rule)
          : rule.type === "messageBinding"
          ? evaluateMessageBinding(rule)
          : null;

      if (result) {
        return result;
      }
    }

    return { ok: true };
  }

  function historyLabel(entry) {
    const actorName = config.ACTORS[entry.actorId].name;
    const map = {
      sayHello: actorName + "说了你好",
      sayGreat: actorName + "夸了一句太棒了",
      sayPlay: actorName + "说了一起玩",
      moveForward: actorName + "往前走了",
      hopOnce: actorName + "跳了一下",
      backCenter: actorName + "回到中间了",
      spinAround: actorName + "转了一圈",
      grow: actorName + "变大了",
      shrink: actorName + "变小了",
      changeFace: actorName + "换成了" + entry.param + "表情",
      blink: actorName + "闪了一下",
      sendMessage: actorName + "发了“" + entry.param + "”",
    };
    return map[entry.blockId] || actorName + "动了一下";
  }

  function freeSummary(prefix) {
    const seen = [];

    App.store.runtime.history.forEach(function collectHistory(item) {
      const label = historyLabel(item);
      if (seen.indexOf(label) === -1) {
        seen.push(label);
      }
    });

    if (!seen.length) {
      return createMessage((prefix ? prefix + "，" : "") + "不过这次还没有角色动起来。", "guide", "试试在开始时里放一个会动的积木。");
    }

    return createMessage((prefix ? prefix + "，" : "我看到") + seen.slice(0, 3).join("，") + "。", "success", "还能试试发送消息，让朋友一起动。");
  }

  function goalKey(key) {
    const taskConfig = App.state.task();

    App.store.runtime.goals[key] = true;

    if (taskConfig.type !== "task" || App.store.runtime.success) {
      return;
    }

    const ok = taskConfig.goal.every(function checkGoal(goal) {
      return App.store.runtime.goals[goal];
    });

    if (!ok) {
      return;
    }

    App.store.runtime.success = true;
    App.store.runtime.autoEnd = taskConfig.stopOnSuccess;

    if (typeof App.showTutorMessage === "function") {
      App.showTutorMessage(
        {
          type: "success",
          taskId: taskConfig.id,
          suggestion: taskConfig.stopOnSuccess ? "做得真棒。" : "现在你可以点停止让它休息。",
        },
        { autoSpeak: true }
      );
    }

    if (taskConfig.stopOnSuccess && App.store.runtime.activeScripts === 0) {
      finishRun(false);
    }
  }

  function recordAction(actorId, slotId, instance) {
    App.store.runtime.history.push({
      actorId: actorId,
      slotId: slotId,
      blockId: instance.blockId,
      param: instance.param,
    });
    goalKey(actorId + ":" + slotId + ":" + instance.blockId);
    if (instance.blockId === "sendMessage") {
      goalKey("broadcast:" + actorId + ":" + instance.param);
    }
  }

  function recordLoop(actorId, slotId, target, countType) {
    goalKey(countType + ":" + actorId + ":" + slotId + ":" + target.blockId);
  }

  function live(token) {
    return App.store.runtime.isRunning && token && token.sessionId === App.store.runtime.sessionId && App.store.runtime.scriptTokens[token.key] === token.index;
  }

  function loopTarget(instance) {
    if (!instance) {
      return false;
    }

    const kind = config.BLOCKS[instance.blockId].kind;
    return kind === "speech" || kind === "motion" || kind === "looks";
  }

  function dispatchMessage(text, fromActorId) {
    App.store.runtime.messages.push({
      from: fromActorId,
      text: text,
    });

    scheduleTimer(function clearMessageRecord() {
      App.store.runtime.messages.shift();
    }, 900, "ui");

    App.state.visibleActors().forEach(function fanOut(actorId) {
      if (App.state.messageName(actorId) === text && App.state.blocks(actorId, "message").length) {
        startScript(actorId, "message");
      }
    });
  }

  async function act(actorId, slotId, instance, token) {
    const state = App.store.stage.actors[actorId];
    const bubbles = {
      sayHello: "你好！",
      sayGreat: "太棒了！",
      sayPlay: "一起玩！",
    };

    if (!live(token)) {
      return;
    }

    recordAction(actorId, slotId, instance);

    switch (instance.blockId) {
      case "wait":
        await wait(instance.param || 1000, "runtime");
        return;
      case "sendMessage":
        setBubble(actorId, instance.param, 900);
        dispatchMessage(instance.param, actorId);
        await wait(260, "runtime");
        return;
      case "sayHello":
      case "sayGreat":
      case "sayPlay":
        setBubble(actorId, bubbles[instance.blockId], 1100);
        await wait(520, "runtime");
        return;
      case "moveForward":
        state.offsetX = Math.max(-68, Math.min(68, state.offsetX + 34));
        render("renderStage");
        await wait(280, "runtime");
        return;
      case "hopOnce":
        pulseFlag(actorId, "hop", 760);
        await wait(760, "runtime");
        return;
      case "backCenter":
        state.offsetX = 0;
        state.rotation = 0;
        render("renderStage");
        await wait(260, "runtime");
        return;
      case "spinAround":
        pulseFlag(actorId, "spin", 740);
        await wait(740, "runtime");
        return;
      case "grow":
        state.scale = Math.max(0.7, Math.min(1.7, state.scale + 0.18));
        render("renderStage");
        await wait(220, "runtime");
        return;
      case "shrink":
        state.scale = Math.max(0.7, Math.min(1.7, state.scale - 0.18));
        render("renderStage");
        await wait(220, "runtime");
        return;
      case "changeFace":
        state.face = instance.param || config.FACES[0];
        render("renderStage");
        await wait(200, "runtime");
        return;
      case "blink":
        pulseFlag(actorId, "flash", 520);
        await wait(420, "runtime");
        return;
      default:
        await wait(120, "runtime");
    }
  }

  async function runLoop(actorId, slotId, loopBlock, target, token) {
    if (!loopTarget(target)) {
      if (typeof App.showTutorMessage === "function") {
        App.showTutorMessage(
          {
            type: "custom",
            text: "重复积木后面要接一个会动的积木哦。",
            mood: "error",
            suggestion: "把跳一下、说话或外观积木放在重复后面。",
          },
          { autoSpeak: true }
        );
      }
      return;
    }

    if (loopBlock.blockId === "repeatThree") {
      recordLoop(actorId, slotId, target, "loop3");
      for (let count = 0; count < 3; count += 1) {
        if (!live(token)) {
          return;
        }
        highlight(actorId, slotId, loopBlock.instanceId);
        await wait(100, "runtime");
        highlight(actorId, slotId, target.instanceId);
        await act(actorId, slotId, target, token);
      }
      return;
    }

    recordLoop(actorId, slotId, target, "loop");
    setForever(actorId, true);

    while (live(token)) {
      highlight(actorId, slotId, loopBlock.instanceId);
      await wait(120, "runtime");
      if (!live(token)) {
        break;
      }
      highlight(actorId, slotId, target.instanceId);
      await act(actorId, slotId, target, token);
    }

    setForever(actorId, false);
  }

  async function runScript(actorId, slotId, token) {
    const list = App.state.cloneBlocks(App.state.blocks(actorId, slotId));

    if (!list.length) {
      return;
    }

    App.store.runtime.activeScripts += 1;
    markRunning(actorId, 1);
    render("renderControls");

    try {
      for (let index = 0; index < list.length; index += 1) {
        if (!live(token)) {
          return;
        }

        const instance = list[index];
        highlight(actorId, slotId, instance.instanceId);

        if (instance.blockId === "repeatThree" || instance.blockId === "forever") {
          const target = list[index + 1];
          await runLoop(actorId, slotId, instance, target, token);
          index += 1;
          if (instance.blockId === "forever") {
            return;
          }
          continue;
        }

        await act(actorId, slotId, instance, token);
      }
    } finally {
      App.store.runtime.activeScripts = Math.max(0, App.store.runtime.activeScripts - 1);
      markRunning(actorId, -1);
      if (App.store.runtime.isRunning) {
        maybeFinish();
      }
    }
  }

  function startScript(actorId, slotId) {
    if (!App.store.runtime.isRunning || !App.state.blocks(actorId, slotId).length) {
      return;
    }

    const key = actorId + ":" + slotId;
    const index = (App.store.runtime.scriptTokens[key] || 0) + 1;

    App.store.runtime.scriptTokens[key] = index;
    runScript(actorId, slotId, {
      sessionId: App.store.runtime.sessionId,
      key: key,
      index: index,
    });
  }

  function maybeFinish() {
    if (!App.store.runtime.isRunning || App.store.runtime.activeScripts > 0) {
      return;
    }

    if (App.state.task().type === "task") {
      if (App.store.runtime.waitingClicks && !App.store.runtime.autoEnd) {
        return;
      }

      if (App.store.runtime.autoEnd || !App.store.runtime.waitingClicks) {
        finishRun(false);
      }
      return;
    }

    if (App.store.runtime.waitingClicks) {
      return;
    }

    const copy = freeSummary("");
    finishRun(false);
    if (typeof App.showTutorMessage === "function") {
      App.showTutorMessage(
        {
          type: "custom",
          text: copy.text,
          mood: copy.mood,
          suggestion: copy.suggestion,
          speakText: copy.speakText,
        },
        { autoSpeak: true }
      );
    }
  }

  function finishRun(resetStageState) {
    clearTimerGroup("runtime");
    App.store.runtime.isRunning = false;
    App.store.runtime.activeScripts = 0;
    App.store.runtime.scriptTokens = {};
    App.store.runtime.waitingClicks = false;
    App.store.runtime.autoEnd = false;
    App.store.runtime.activeActors = {};
    App.store.runtime.messages = [];
    clearUiArtifacts({ keepVoiceText: true });

    if (resetStageState) {
      resetStage(App.store.app.currentTaskId);
    } else {
      Object.keys(App.store.stage.actors).forEach(function clearActorFlags(actorId) {
        App.store.stage.actors[actorId].hop = false;
        App.store.stage.actors[actorId].spin = false;
        App.store.stage.actors[actorId].flash = false;
        App.store.stage.actors[actorId].forever = false;
      });
    }

    render("renderAll");
  }

  function beginRun() {
    App.speech.stop();
    clearTimerGroup("runtime");
    clearUiArtifacts({ keepVoiceText: true });
    App.setStatus({
      kind: "idle",
      text: "正在运行当前程序。",
      detail: App.state.task().title,
      busy: false,
    });
    App.store.runtime.sessionId += 1;
    App.store.runtime.isRunning = true;
    App.store.runtime.activeScripts = 0;
    App.store.runtime.scriptTokens = {};
    App.store.runtime.waitingClicks = false;
    App.store.runtime.autoEnd = false;
    App.store.runtime.success = false;
    App.store.runtime.goals = {};
    App.store.runtime.history = [];
    App.store.runtime.messages = [];
    App.store.runtime.activeActors = {};
    resetStage(App.store.app.currentTaskId);

    const hasClicks = App.state.visibleActors().some(function hasClickScript(actorId) {
      return App.state.blocks(actorId, "click").length;
    });

    App.store.runtime.waitingClicks = hasClicks;

    if (typeof App.showTutorMessage === "function") {
      if (App.state.task().type === "free") {
        if (hasClicks && !App.state.visibleActors().some(function hasStart(actorId) { return App.state.blocks(actorId, "start").length; })) {
          App.showTutorMessage(
            {
              type: "custom",
              text: "运行中啦，点一点击角色也会有反应。",
              mood: "guide",
              suggestion: "试试给不同角色各写一条点角色时脚本。",
            },
            { autoSpeak: true }
          );
          setHint("点角色也会有反应");
        } else {
          App.showTutorMessage(
            {
              type: "custom",
              text: "开始啦，看看舞台会发生什么。",
              mood: "guide",
              suggestion: hasClicks ? "如果放了点角色时，运行中也可以去点角色。" : "观察舞台，看看角色会做什么。",
            },
            { autoSpeak: true }
          );
          if (hasClicks) {
            setHint("点角色也会有反应");
          } else {
            setHint("");
          }
        }
      } else if (hasClicks) {
        const actorName = config.ACTORS[App.state.task().actors[0]].name;
        App.showTutorMessage(
          {
            type: "custom",
            text: "准备好啦，点一下" + actorName + "吧。",
            mood: "guide",
            suggestion: "运行中点击角色，就会触发点角色时。",
          },
          { autoSpeak: true }
        );
        setHint("点一下" + actorName);
      } else {
        App.showTutorMessage(
          {
            type: "custom",
            text: "开始啦，看看会不会成功。",
            mood: "guide",
            suggestion: "观察舞台，看看角色会做什么。",
          },
          { autoSpeak: false }
        );
        setHint("");
      }
    }

    render("renderAll");

    App.state.visibleActors().forEach(function bootStartScripts(actorId) {
      if (App.state.blocks(actorId, "start").length) {
        startScript(actorId, "start");
      }
    });

    if (!App.state.visibleActors().some(function hasAnyStart(actorId) { return App.state.blocks(actorId, "start").length; })) {
      maybeFinish();
    }
  }

  function stopRun(silent) {
    App.speech.stop();

    if (!App.store.runtime.isRunning) {
      clearUiArtifacts({ keepVoiceText: true });
      resetStage(App.store.app.currentTaskId);
      render("renderAll");
      return;
    }

    const copy = App.state.task().type === "free" ? freeSummary("我先帮你停下来啦") : createMessage("我先帮你停下来啦。", "guide", "可以改一改积木，再试一次。");
    finishRun(true);

    if (!silent && typeof App.showTutorMessage === "function") {
      App.showTutorMessage(
        {
          type: "custom",
          text: copy.text,
          mood: copy.mood,
          suggestion: copy.suggestion,
          speakText: copy.speakText,
        },
        { autoSpeak: true }
      );
    }
  }

  function applyHint() {
    if (App.store.runtime.isRunning || typeof App.showTutorMessage !== "function") {
      return;
    }

    const taskConfig = App.state.task();

    if (!App.state.countBlocks()) {
      App.showTutorMessage(
        {
          type: "task",
          taskId: taskConfig.id,
          suggestion: taskConfig.type === "free" ? "试试给三个角色都写一点。" : "先看当前角色的脚本槽。",
        },
        { autoSpeak: false }
      );
      return;
    }

    if (taskConfig.type === "free") {
      App.showTutorMessage(
        {
          type: "custom",
          text: config.ACTORS[App.state.selectedActor()].name + "的脚本准备好了，可以点运行看看。",
          mood: "guide",
          suggestion: "如果想让角色合作，试试发送消息和收到消息。",
        },
        { autoSpeak: false }
      );
      return;
    }

    const validation = validateCurrentTask();
    if (validation.ok) {
      App.showTutorMessage(
        {
          type: "custom",
          text: "看起来已经搭得不错啦，按运行试试看。",
          mood: "guide",
          suggestion: "运行后记得观察舞台。",
        },
        { autoSpeak: false }
      );
      return;
    }

    App.showTutorMessage(
      {
        type: "custom",
        text: validation.message,
        mood: "guide",
        suggestion: validation.suggestion || "再看一眼要放在哪个脚本槽里。",
      },
      { autoSpeak: false }
    );
  }

  function handleRun() {
    if (App.store.runtime.isRunning) {
      return;
    }

    if (!App.state.countBlocks()) {
      if (typeof App.showTutorMessage === "function") {
        App.showTutorMessage(
          {
            type: "custom",
            text: "先拖几块积木来试试看吧。",
            mood: "guide",
            suggestion: "试试：开始时，再接一个会动的积木。",
          },
          { autoSpeak: true }
        );
      }
      glowBlocks(App.state.task().allowed.slice(0, 2));
      return;
    }

    const validation = validateCurrentTask();

    if (!validation.ok) {
      if (validation.focusTarget) {
        App.state.setSelectedActor(validation.focusTarget.actorId);
        App.state.setKeyboardSlotTarget(validation.focusTarget.actorId, validation.focusTarget.slotId);
        hintSlot(validation.focusTarget.actorId, validation.focusTarget.slotId);
      }

      if (validation.highlightBlocks && validation.highlightBlocks.length) {
        glowBlocks(validation.highlightBlocks);
      }

      shakeScripts();
      render("renderAll");

      if (typeof App.showTutorMessage === "function") {
        App.showTutorMessage(
          {
            type: "custom",
            text: validation.message,
            mood: "error",
            suggestion: validation.suggestion,
          },
          { autoSpeak: true }
        );
      }

      return;
    }

    beginRun();
  }

  function handleReset() {
    if (App.store.runtime.isRunning) {
      return;
    }

    App.speech.stop();
    clearUiArtifacts();
    App.state.resetWorkspaceForTask(App.store.app.currentTaskId);
    App.state.setKeyboardSlotTarget(App.state.task().actors[0], "start");
    resetStage(App.store.app.currentTaskId);
    App.setStatus({
      kind: "idle",
      text: "已重置当前任务的积木和舞台。",
      detail: "",
      busy: false,
    });
    render("renderAll");

    if (typeof App.showTutorMessage === "function") {
      App.showTutorMessage(
        {
          type: "task",
          taskId: App.store.app.currentTaskId,
          suggestion: "先看当前角色的脚本槽。",
        },
        { autoSpeak: true }
      );
    }
  }

  function abortRuntimeForError() {
    App.speech.stop();
    clearTimerGroup("runtime");
    clearTimerGroup("ui");
    clearTimerGroup("glow");
    App.store.runtime.isRunning = false;
    App.store.runtime.activeScripts = 0;
    App.store.runtime.scriptTokens = {};
    App.store.runtime.waitingClicks = false;
    App.store.runtime.autoEnd = false;
    App.store.runtime.activeActors = {};
    App.store.runtime.messages = [];
    clearUiArtifacts({ keepVoiceText: true });
    resetStage(App.store.app.currentTaskId);
    render("renderAll");
  }

  App.abortRuntimeForError = abortRuntimeForError;
  App.runtime = {
    scheduleTimer: scheduleTimer,
    clearTimerGroup: clearTimerGroup,
    advanceManagedTime: advanceManagedTime,
    wait: wait,
    resetStage: resetStage,
    setHint: setHint,
    glowBlocks: glowBlocks,
    hintSlot: hintSlot,
    clearUiArtifacts: clearUiArtifacts,
    clearHighlight: clearHighlight,
    validateCurrentTask: validateCurrentTask,
    applyHint: applyHint,
    handleRun: handleRun,
    handleReset: handleReset,
    beginRun: beginRun,
    stopRun: stopRun,
    startScript: startScript,
  };
})(window);
