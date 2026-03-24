(function initRender(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};
  const config = App.config;

  const dom = {};

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function emojiMarkup(emoji, className) {
    return '<span class="' + escapeHtml(className || "emoji-glyph") + '" aria-hidden="true">' + escapeHtml(emoji || "🙂") + "</span>";
  }

  function assetMarkup(imageSrc, emoji, altText, options) {
    const settings = Object.assign(
      {
        wrapperClass: "",
        imageClass: "",
        emojiClass: "",
      },
      options || {}
    );

    return (
      '<span class="asset-media is-fallback ' +
      escapeHtml(settings.wrapperClass) +
      '" data-src="' +
      escapeHtml(imageSrc || "") +
      '">' +
      '<img class="asset-image ' +
      escapeHtml(settings.imageClass) +
      '" alt="' +
      escapeHtml(altText || "") +
      '" hidden>' +
      '<span class="asset-emoji ' +
      escapeHtml(settings.emojiClass) +
      '" aria-hidden="true">' +
      escapeHtml(emoji || "🙂") +
      "</span></span>"
    );
  }

  function bindAssetMedia(root) {
    const scope = root || document;

    Array.from(scope.querySelectorAll(".asset-media")).forEach(function bind(wrapper) {
      const img = wrapper.querySelector(".asset-image");
      const emoji = wrapper.querySelector(".asset-emoji");
      const src = wrapper.dataset.src || "";

      if (!img || !emoji) {
        return;
      }

      function showFallback() {
        wrapper.classList.add("is-fallback");
        wrapper.classList.remove("is-ready");
        img.hidden = true;
        emoji.hidden = false;
      }

      function showImage() {
        wrapper.classList.add("is-ready");
        wrapper.classList.remove("is-fallback");
        img.hidden = false;
        emoji.hidden = true;
      }

      if (!src) {
        showFallback();
        return;
      }

      if (wrapper.dataset.bound === "true" && img.getAttribute("src") === src) {
        if (img.complete) {
          if (img.naturalWidth > 0) {
            showImage();
          } else {
            showFallback();
          }
        }
        return;
      }

      wrapper.dataset.bound = "true";
      showFallback();
      img.onload = function onload() {
        if (img.naturalWidth > 0) {
          showImage();
        } else {
          showFallback();
        }
      };
      img.onerror = function onerror() {
        showFallback();
      };
      img.src = src;

      if (img.complete) {
        if (img.naturalWidth > 0) {
          showImage();
        } else {
          showFallback();
        }
      }
    });
  }

  function cacheDom() {
    dom.brandMark = document.getElementById("brand-photo") ? document.getElementById("brand-photo").parentElement : null;
    dom.brandPhoto = document.getElementById("brand-photo");
    dom.brandFallback = document.getElementById("brand-fallback");
    dom.livePolite = document.getElementById("live-polite");
    dom.liveAssertive = document.getElementById("live-assertive");
    dom.statusStrip = document.getElementById("status-strip");
    dom.statusKind = document.getElementById("status-kind");
    dom.statusText = document.getElementById("status-text");
    dom.providerStatus = document.getElementById("provider-status");
    dom.runtimeStatus = document.getElementById("runtime-status");
    dom.saveStatus = document.getElementById("save-status");
    dom.debugToggleBtn = document.getElementById("debug-toggle-btn");
    dom.debugToggleText = document.getElementById("debug-toggle-text");
    dom.taskList = document.getElementById("task-list");
    dom.readTaskBtn = document.getElementById("read-task-btn");
    dom.skipSpeechBtn = document.getElementById("skip-speech-btn");
    dom.stopBtn = document.getElementById("stop-btn");
    dom.soundToggleBtn = document.getElementById("sound-toggle-btn");
    dom.soundToggleIcon = document.getElementById("sound-toggle-icon");
    dom.soundToggleText = document.getElementById("sound-toggle-text");
    dom.voiceToggleBtn = document.getElementById("voice-toggle-btn");
    dom.voiceSamples = document.getElementById("voice-samples");
    dom.voiceUserBubble = document.getElementById("voice-user-bubble");
    dom.stageWorld = document.getElementById("stage-world");
    dom.stageActors = document.getElementById("stage-actors");
    dom.stageHint = document.getElementById("stage-hint");
    dom.taskBadge = document.getElementById("task-badge");
    dom.sceneBadge = document.getElementById("scene-badge");
    dom.sceneChips = document.getElementById("scene-chips");
    dom.readAiBtn = document.getElementById("read-ai-btn");
    dom.aiAvatar = document.getElementById("ai-avatar");
    dom.aiMessage = document.getElementById("ai-message");
    dom.aiMoodChip = document.getElementById("ai-mood-chip");
    dom.aiSuggestion = document.getElementById("ai-suggestion");
    dom.triggerStrip = document.getElementById("trigger-strip");
    dom.blockPool = document.getElementById("block-pool");
    dom.actorTabs = document.getElementById("actor-tabs");
    dom.scriptSlots = document.getElementById("script-slots");
    dom.resetBtn = document.getElementById("reset-btn");
    dom.runBtn = document.getElementById("run-btn");
    dom.debugPanel = document.getElementById("debug-panel");
    dom.debugDelaySelect = document.getElementById("debug-delay-select");
    dom.debugFailBtn = document.getElementById("debug-fail-btn");
    dom.debugClearLogsBtn = document.getElementById("debug-clear-logs-btn");
    dom.debugClearStorageBtn = document.getElementById("debug-clear-storage-btn");
    dom.debugSummary = document.getElementById("debug-summary");
    dom.debugLogList = document.getElementById("debug-log-list");
  }

  function taskBadge() {
    return App.state.task().type === "free" ? "自由实验室" : "课堂任务";
  }

  function moodLabel(mode) {
    if (mode === "success") {
      return "成功鼓励";
    }

    if (mode === "error") {
      return "耐心纠错";
    }

    if (mode === "voice") {
      return "我听懂啦";
    }

    return "温柔提示";
  }

  function visiblePrompts() {
    const activeTaskId = App.store.app.currentTaskId;

    if (App.state.task().type === "free") {
      return config.PROMPTS.filter(function filterFreePrompt(item) {
        return item.taskId === "freeLab" || item.id === "p8";
      });
    }

    return config.PROMPTS.filter(function filterPrompt(item) {
      return item.taskId === activeTaskId || item.taskId === "freeLab";
    });
  }

  function blockAriaLabel(blockId, instance, isProgram) {
    const meta = config.BLOCKS[blockId];
    const tag = App.state.paramLabel(blockId, instance ? instance.param : App.state.defaultParam(blockId));
    const extra = tag ? "，参数 " + tag : "";
    return (isProgram ? "程序积木：" : "积木池：") + meta.label + extra;
  }

  function blockMarkup(blockId, instance, isProgram) {
    const meta = config.BLOCKS[blockId];
    const tag = App.state.paramLabel(blockId, instance ? instance.param : App.state.defaultParam(blockId));
    const visualTitle = meta.displayLabel || meta.label;
    const titleMarkup = meta.tagText
      ? '<span class="block-title-row"><span class="block-title">' +
        visualTitle +
        '</span><span class="block-speech-tag" aria-hidden="true">' +
        meta.tagText +
        "</span></span>"
      : '<span class="block-title">' + visualTitle + "</span>";
    const el = document.createElement("div");

    el.className = (isProgram ? "program-block " : "pool-block ") + meta.colorClass + " block-kind-" + meta.kind + (meta.tagText ? " has-block-tag" : "");
    el.dataset.blockId = blockId;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", blockAriaLabel(blockId, instance, isProgram));

    if (isProgram) {
      el.dataset.instanceId = instance.instanceId;
    } else if (App.store.app.highlightBlocks.indexOf(blockId) !== -1) {
      el.classList.add("block-glow");
    }

    el.innerHTML =
      '<span class="block-icon" aria-hidden="true">' + emojiMarkup(meta.emoji, "emoji-glyph block-emoji") + "</span>" +
      '<span class="block-content">' + titleMarkup +
      '<span class="block-sub">' + meta.subText + "</span></span>" +
      (tag
        ? isProgram
          ? '<button class="block-param" type="button" aria-label="切换参数">' + tag + "</button>"
          : '<span class="block-param block-param-static" aria-hidden="true">' + tag + "</span>"
        : "") +
      (isProgram ? '<button class="block-delete" type="button" aria-label="删除积木">×</button>' : "");

    return el;
  }

  function renderTasks() {
    dom.taskList.innerHTML = "";

    config.TASK_ORDER.forEach(function renderTaskCard(taskId) {
      const task = config.TASKS[taskId];
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "task-card" + (taskId === App.store.app.currentTaskId ? " is-active" : "") + (App.store.runtime.isRunning && taskId !== App.store.app.currentTaskId ? " is-running-lock" : "");
      btn.dataset.taskId = taskId;
      if (taskId === App.store.app.currentTaskId) {
        btn.setAttribute("aria-current", "true");
      }
      btn.innerHTML =
        '<span class="task-main"><span class="task-icon" aria-hidden="true">' +
        assetMarkup(task.imageSrc, task.emoji, task.shortTitle + "任务图", {
          wrapperClass: "task-media",
          imageClass: "task-media-image",
          emojiClass: "task-media-emoji",
        }) +
        '</span><span class="task-copy"><span class="task-title">' +
        task.shortTitle +
        "</span><span class=\"task-sub\">" +
        (task.type === "free" ? "自由搭积木" : task.title) +
        "</span></span></span>";
      dom.taskList.appendChild(btn);
    });

    bindAssetMedia(dom.taskList);
  }

  function renderVoice() {
    dom.voiceSamples.innerHTML = "";
    dom.voiceSamples.classList.toggle("is-open", App.store.app.voiceOpen);
    dom.voiceToggleBtn.setAttribute("aria-expanded", App.store.app.voiceOpen ? "true" : "false");

    visiblePrompts().forEach(function renderPrompt(prompt) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "voice-chip";
      chip.dataset.promptId = prompt.id;
      chip.innerHTML =
        '<span class="voice-icon" aria-hidden="true">' +
        emojiMarkup(prompt.emoji, "emoji-glyph voice-emoji") +
        '</span><span class="voice-chip-label">' +
        prompt.label +
        "</span>";
      dom.voiceSamples.appendChild(chip);
    });

    dom.voiceUserBubble.textContent = App.store.app.lastVoiceText ? "我说：" + App.store.app.lastVoiceText : "";
    dom.voiceUserBubble.classList.toggle("is-visible", Boolean(App.store.app.lastVoiceText));
  }

  function renderScenes() {
    dom.sceneChips.innerHTML = "";

    Object.keys(config.SCENES).forEach(function renderSceneChip(sceneId) {
      const btn = document.createElement("button");
      const active = App.state.ws().sceneId === sceneId;
      const disabled = App.state.task().type !== "free" || App.store.runtime.isRunning;

      btn.type = "button";
      btn.className = "scene-chip" + (active ? " is-active" : "");
      btn.dataset.sceneId = sceneId;
      btn.textContent = config.SCENES[sceneId].name;
      btn.disabled = disabled;
      btn.setAttribute("aria-pressed", active ? "true" : "false");

      if (disabled) {
        btn.classList.add("is-disabled");
      }

      dom.sceneChips.appendChild(btn);
    });
  }

  function renderActorTabs() {
    dom.actorTabs.innerHTML = "";

    App.state.visibleActors().forEach(function renderActorTab(actorId, index) {
      const actor = config.ACTORS[actorId];
      const active = App.state.selectedActor() === actorId;
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "actor-tab" + (active ? " is-active" : "") + (App.store.runtime.activeActors[actorId] ? " is-running" : "");
      btn.dataset.actorId = actorId;
      btn.id = "actor-tab-" + actorId;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.setAttribute("aria-controls", "script-slots");
      btn.tabIndex = active || (!App.state.selectedActor() && index === 0) ? 0 : -1;
      btn.innerHTML =
        '<span class="actor-tab-icon" aria-hidden="true">' +
        assetMarkup(actor.imageSrc, actor.emoji, actor.name + "头像", {
          wrapperClass: "actor-tab-media",
          imageClass: "actor-tab-image",
          emojiClass: "actor-tab-emoji",
        }) +
        '</span><span class="actor-tab-label">' +
        actor.name +
        "</span>";
      dom.actorTabs.appendChild(btn);
    });

    bindAssetMedia(dom.actorTabs);
  }

  function renderTriggers() {
    dom.triggerStrip.innerHTML = "";

    config.SLOTS.forEach(function renderTrigger(slot) {
      const chip = document.createElement("div");
      chip.className = "trigger-chip";
      chip.innerHTML =
        '<span class="trigger-icon" aria-hidden="true">' +
        emojiMarkup(slot.emoji, "emoji-glyph trigger-emoji") +
        "</span><span>" +
        slot.label +
        "</span>";
      dom.triggerStrip.appendChild(chip);
    });
  }

  function renderBlockPool() {
    dom.blockPool.innerHTML = "";

    App.state.task().allowed.forEach(function renderBlock(blockId) {
      dom.blockPool.appendChild(blockMarkup(blockId, null, false));
    });
  }

  function renderScriptSlots() {
    const actorId = App.state.selectedActor();
    const keyboardTarget = App.state.getKeyboardSlotTarget();

    dom.scriptSlots.innerHTML = "";

    config.SLOTS.forEach(function renderSlot(slot) {
      const slotKey = actorId + ":" + slot.id;
      const section = document.createElement("section");
      const activeHighlight = App.store.runtime.highlight && App.store.runtime.highlight.actorId === actorId && App.store.runtime.highlight.slotId === slot.id;

      section.className = "script-slot" + (activeHighlight || App.store.app.slotHint === slotKey ? " is-active" : "") + (keyboardTarget === slotKey ? " is-targeted" : "");
      section.dataset.slotId = slot.id;

      const right =
        slot.id === "message"
          ? '<button class="slot-message-button is-active" type="button" data-actor-id="' + actorId + '" aria-label="切换收到的消息">' + App.state.messageName(actorId) + "</button>"
          : '<span class="slot-tip">' + slot.tip + "</span>";

      section.innerHTML =
        '<div class="slot-head"><div class="slot-title"><i class="slot-title-icon" aria-hidden="true">' +
        escapeHtml(slot.emoji) +
        "</i><span>" +
        slot.label +
        "</span></div>" +
        right +
        '</div><div class="slot-list" data-actor-id="' + actorId + '" data-slot-id="' + slot.id + '" tabindex="0" role="list" aria-label="' + config.ACTORS[actorId].name + "的" + slot.label + '脚本槽"></div>';

      const list = section.querySelector(".slot-list");
      const items = App.state.blocks(actorId, slot.id);

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "slot-empty";
        empty.textContent = "把积木拖到这里";
        list.appendChild(empty);
      } else {
        items.forEach(function renderProgramBlock(item) {
          const block = blockMarkup(item.blockId, item, true);
          block.dataset.actorId = actorId;
          block.dataset.slotId = slot.id;
          block.setAttribute("role", "group");
          if (App.store.runtime.highlight && App.store.runtime.highlight.instanceId === item.instanceId) {
            block.classList.add("is-active");
          }
          if (App.store.runtime.isRunning) {
            block.style.cursor = "default";
          }
          list.appendChild(block);
        });
      }

      dom.scriptSlots.appendChild(section);
    });
  }

  function renderStage() {
    dom.stageWorld.className = "stage-world " + config.SCENES[App.state.ws().sceneId].className;
    dom.taskBadge.textContent = taskBadge();
    dom.sceneBadge.textContent = config.SCENES[App.state.ws().sceneId].name;
    dom.stageHint.textContent = App.store.stage.hint;
    dom.stageHint.classList.toggle("is-visible", Boolean(App.store.stage.hint));
    dom.stageActors.innerHTML = "";

    Object.keys(config.ACTORS).forEach(function renderActor(actorId) {
      const meta = config.ACTORS[actorId];
      const state = App.store.stage.actors[actorId];
      const clickable = App.store.runtime.isRunning && App.state.visibleActors().indexOf(actorId) !== -1 && App.state.blocks(actorId, "click").length > 0;
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className =
        "stage-actor" +
        (state.visible ? "" : " is-hidden") +
        (clickable ? " is-clickable" : "") +
        (App.store.runtime.activeActors[actorId] ? " is-running is-active" : "") +
        (state.hop ? " is-hop" : "") +
        (state.spin ? " is-spin" : "") +
        (state.flash ? " is-flash" : "") +
        (state.forever ? " is-forever" : "");
      btn.dataset.actorId = actorId;
      btn.style.left = meta.left;
      btn.style.bottom = meta.bottom + "px";
      btn.setAttribute("aria-disabled", clickable ? "false" : "true");
      btn.setAttribute("aria-label", meta.name + (clickable ? "，运行中可点击触发脚本" : "，当前没有可点击脚本"));
      btn.innerHTML =
        '<span class="stage-actor-bubble' +
        (state.bubble ? " is-visible" : "") +
        '">' +
        state.bubble +
        '</span><span class="stage-actor-shadow" aria-hidden="true"></span><span class="stage-actor-figure" style="--actor-offset:' +
        state.offsetX +
        "px; --actor-scale:" +
        state.scale +
        "; --actor-rotate:" +
        state.rotation +
        'deg;"><span class="stage-actor-icon" aria-hidden="true">' +
        assetMarkup(meta.imageSrc, meta.emoji, meta.name + "角色图", {
          wrapperClass: "stage-actor-media",
          imageClass: "stage-actor-image",
          emojiClass: "stage-actor-emoji",
        }) +
        '</span></span><span class="stage-actor-meta"><span class="stage-actor-face">' +
        state.face +
        '</span><span class="stage-actor-label">' +
        meta.name +
        "</span></span>";
      dom.stageActors.appendChild(btn);
    });

    bindAssetMedia(dom.stageActors);
  }

  function renderAI() {
    if (dom.aiAvatar) {
      dom.aiAvatar.innerHTML = assetMarkup(config.UI_ASSETS.teacher.imageSrc, config.UI_ASSETS.teacher.emoji, "积木老师头像", {
        wrapperClass: "ai-avatar-media",
        imageClass: "ai-avatar-image",
        emojiClass: "ai-avatar-emoji",
      });
      bindAssetMedia(dom.aiAvatar);
    }
    dom.aiMessage.textContent = App.store.app.aiMessage;
    dom.aiMessage.dataset.mode = App.store.app.aiMode;
    dom.aiSuggestion.textContent = App.store.app.aiSuggestion || "";
    dom.aiMoodChip.textContent = moodLabel(App.store.app.aiMode);
  }

  function renderControls() {
    const canSkip = Boolean(App.speech && App.speech.isPending());
    const soundEmoji = App.store.app.isMuted ? config.CONTROL_EMOJIS.soundOff : config.CONTROL_EMOJIS.soundOn;

    dom.runBtn.disabled = App.store.runtime.isRunning;
    dom.resetBtn.disabled = App.store.runtime.isRunning;
    dom.stopBtn.disabled = !App.store.runtime.isRunning;
    dom.skipSpeechBtn.disabled = !canSkip || App.store.app.isMuted;
    dom.soundToggleIcon.textContent = soundEmoji;
    dom.soundToggleText.textContent = App.store.app.isMuted ? "静音" : "有声";
    dom.soundToggleBtn.setAttribute("aria-pressed", App.store.app.isMuted ? "true" : "false");
    dom.voiceToggleBtn.setAttribute("aria-expanded", App.store.app.voiceOpen ? "true" : "false");
    dom.debugToggleBtn.setAttribute("aria-expanded", App.store.debug.panelOpen ? "true" : "false");
  }

  function renderStatusBar() {
    const statusKind = App.store.status.kind || "idle";
    const providerHealth = App.store.app.providerHealth || { provider: "mock", status: "unknown" };

    dom.statusStrip.setAttribute("aria-busy", App.store.status.busy ? "true" : "false");
    dom.statusKind.className = "status-kind status-" + statusKind;
    dom.statusKind.textContent = statusKind === "loading" ? "加载中" : statusKind === "error" ? "已拦截异常" : "本地原型";
    dom.statusText.textContent = App.store.status.text;
    dom.statusText.title = App.store.status.detail || App.store.status.text;
    dom.providerStatus.textContent = "适配器：" + providerHealth.provider + " · " + providerHealth.status;
    dom.runtimeStatus.textContent = App.store.runtime.isRunning ? "运行中" : "未运行";
    dom.saveStatus.textContent = "最近保存：" + App.formatTime(App.store.storage.lastSavedAt);
  }

  function ensureDebugControls() {
    if (dom.debugDelaySelect.options.length) {
      return;
    }

    config.DEBUG_DELAY_OPTIONS.forEach(function renderDelayOption(delay) {
      const option = document.createElement("option");
      option.value = String(delay);
      option.textContent = delay === 0 ? "即时返回" : delay + "ms";
      dom.debugDelaySelect.appendChild(option);
    });
  }

  function renderDebugPanel() {
    ensureDebugControls();

    dom.debugPanel.hidden = !App.store.debug.panelOpen;
    if (dom.debugToggleText) {
      dom.debugToggleText.textContent = App.store.debug.panelOpen ? "收起" : "调试";
    }
    dom.debugDelaySelect.value = String(App.store.debug.apiDelayMs);

    dom.debugSummary.innerHTML = "";
    [
      "任务：" + App.state.task().shortTitle,
      "场景：" + config.SCENES[App.state.ws().sceneId].name,
      "静音：" + (App.store.app.isMuted ? "开" : "关"),
      "运行：" + (App.store.runtime.isRunning ? "中" : "否"),
      "适配器：" + (App.store.app.providerHealth ? App.store.app.providerHealth.provider : "mock"),
      "最近提示来源：" + (App.store.app.lastTutorReplySource || "unknown"),
      "最近朗读来源：" + (App.store.app.lastTtsSource || "unknown"),
      "最近朗读错误：" + (App.store.app.lastTtsError || "无"),
      "最近错误：" + (App.store.app.lastError ? App.store.app.lastError.message : "无"),
      "最近保存：" + App.formatTime(App.store.storage.lastSavedAt),
    ].forEach(function renderSummary(text) {
      const item = document.createElement("span");
      item.textContent = text;
      dom.debugSummary.appendChild(item);
    });

    dom.debugLogList.innerHTML = "";

    if (!App.store.logs.length) {
      const empty = document.createElement("div");
      empty.className = "debug-empty";
      empty.textContent = "还没有日志，继续操作我会记录关键状态。";
      dom.debugLogList.appendChild(empty);
      return;
    }

    App.store.logs.slice(0, 30).forEach(function renderLog(entry) {
      const item = document.createElement("article");
      const meta = document.createElement("div");
      const message = document.createElement("div");

      item.className = "debug-log-item level-" + entry.level;
      meta.className = "debug-log-meta";
      meta.textContent = App.formatTime(entry.at) + " · " + entry.level.toUpperCase();
      message.className = "debug-log-message";
      message.textContent = entry.message;
      item.appendChild(meta);
      item.appendChild(message);

      if (entry.meta) {
        const detail = document.createElement("pre");
        detail.className = "debug-log-detail";
        detail.textContent = JSON.stringify(entry.meta, null, 2);
        item.appendChild(detail);
      }

      dom.debugLogList.appendChild(item);
    });
  }

  function renderLiveRegions() {
    dom.livePolite.textContent = App.store.live.polite;
    dom.liveAssertive.textContent = App.store.live.assertive;
  }

  function showBrandFallback() {
    if (!dom.brandMark || !dom.brandPhoto || !dom.brandFallback) {
      return;
    }

    dom.brandFallback.textContent = config.UI_ASSETS.brandFallbackEmoji;
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

    (function tryLoad(index) {
      if (index >= config.UI_ASSETS.brandPhotoCandidates.length) {
        return;
      }

      const src = config.UI_ASSETS.brandPhotoCandidates[index];
      const image = new Image();

      image.onload = function onload() {
        dom.brandPhoto.src = src;
        dom.brandPhoto.hidden = false;
        dom.brandPhoto.classList.add("is-visible");
        dom.brandFallback.classList.add("is-hidden");
        dom.brandMark.classList.add("has-photo");
      };

      image.onerror = function onerror() {
        tryLoad(index + 1);
      };

      image.src = src;
    })(0);
  }

  function renderAll() {
    renderTasks();
    renderVoice();
    renderScenes();
    renderActorTabs();
    renderTriggers();
    renderBlockPool();
    renderScriptSlots();
    renderStage();
    renderAI();
    renderControls();
    renderStatusBar();
    renderDebugPanel();
    renderLiveRegions();
    bindAssetMedia(document);
  }

  App.dom = dom;
  App.render = {
    cacheDom: cacheDom,
    loadBrandPhoto: loadBrandPhoto,
    blockMarkup: blockMarkup,
    renderTasks: renderTasks,
    renderVoice: renderVoice,
    renderScenes: renderScenes,
    renderActorTabs: renderActorTabs,
    renderTriggers: renderTriggers,
    renderBlockPool: renderBlockPool,
    renderScriptSlots: renderScriptSlots,
    renderStage: renderStage,
    renderAI: renderAI,
    renderControls: renderControls,
    renderStatusBar: renderStatusBar,
    renderDebugPanel: renderDebugPanel,
    renderLiveRegions: renderLiveRegions,
    bindAssetMedia: bindAssetMedia,
    renderAll: renderAll,
    moodLabel: moodLabel,
  };
})(window);
