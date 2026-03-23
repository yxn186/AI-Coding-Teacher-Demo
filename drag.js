(function initDrag(global) {
  "use strict";

  const App = global.JimuApp = global.JimuApp || {};

  function targetKey(actorId, slotId) {
    return actorId + ":" + slotId;
  }

  function parseTarget(key) {
    if (!key || key.indexOf(":") === -1) {
      return null;
    }

    const parts = key.split(":");
    return {
      actorId: parts[0],
      slotId: parts[1],
    };
  }

  function ensureKeyboardSlotTarget() {
    const current = parseTarget(App.state.getKeyboardSlotTarget());

    if (current && App.state.visibleActors().indexOf(current.actorId) !== -1) {
      return current;
    }

    const next = {
      actorId: App.state.selectedActor(),
      slotId: "start",
    };

    App.state.setKeyboardSlotTarget(next.actorId, next.slotId);
    return next;
  }

  function setKeyboardSlotTarget(actorId, slotId) {
    App.state.setKeyboardSlotTarget(actorId, slotId);
  }

  function announceMutation(text) {
    App.announce("polite", text);
  }

  function afterMutation() {
    if (App.render && typeof App.render.renderAll === "function") {
      App.render.renderAll();
    }

    if (App.runtime && typeof App.runtime.applyHint === "function") {
      App.runtime.applyHint();
    }
  }

  function appendBlockToSlot(actorId, slotId, blockId) {
    const items = App.state.cloneBlocks(App.state.blocks(actorId, slotId));
    items.push(App.state.createInstance(blockId));
    App.state.setBlocks(actorId, slotId, items);
    App.state.setKeyboardSlotTarget(actorId, slotId);
    afterMutation();
    announceMutation("已把“" + App.config.BLOCKS[blockId].label + "”放进" + App.config.ACTORS[actorId].name + "的" + App.config.SLOTS.find(function findSlot(slot) { return slot.id === slotId; }).label + "。");
  }

  function appendPoolBlockToCurrentSlot(blockId) {
    const target = ensureKeyboardSlotTarget();
    appendBlockToSlot(target.actorId, target.slotId, blockId);
  }

  function removeProgramBlock(actorId, slotId, instanceId) {
    App.state.setBlocks(
      actorId,
      slotId,
      App.state.blocks(actorId, slotId).filter(function filterBlock(item) {
        return item.instanceId !== instanceId;
      })
    );
    App.state.setKeyboardSlotTarget(actorId, slotId);
    afterMutation();
    announceMutation("已删除一个积木。");
  }

  function cycleProgramBlockParam(actorId, slotId, instanceId) {
    const items = App.state.cloneBlocks(App.state.blocks(actorId, slotId));
    const target = items.find(function findItem(item) {
      return item.instanceId === instanceId;
    });

    if (!target) {
      return;
    }

    target.param = App.state.nextParam(target.blockId, target.param);
    App.state.setBlocks(actorId, slotId, items);
    afterMutation();
    announceMutation("已切换参数为" + App.state.paramLabel(target.blockId, target.param) + "。");
  }

  function cycleMessageBinding(actorId) {
    App.state.setMessageName(actorId, App.state.nextParam("sendMessage", App.state.messageName(actorId)));
    afterMutation();
    announceMutation(App.config.ACTORS[actorId].name + "现在会监听“" + App.state.messageName(actorId) + "”。");
  }

  function moveProgramBlock(actorId, slotId, fromIndex, toIndex) {
    const items = App.state.cloneBlocks(App.state.blocks(actorId, slotId));

    if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
      return;
    }

    const moved = items.splice(fromIndex, 1)[0];
    items.splice(toIndex, 0, moved);
    App.state.setBlocks(actorId, slotId, items);
    App.state.setKeyboardSlotTarget(actorId, slotId);
    afterMutation();
    announceMutation("已调整积木顺序。");
  }

  function moveProgramBlockByInstance(actorId, slotId, instanceId, offset) {
    const items = App.state.blocks(actorId, slotId);
    const index = items.findIndex(function findItem(item) {
      return item.instanceId === instanceId;
    });

    if (index === -1) {
      return;
    }

    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= items.length) {
      return;
    }

    moveProgramBlock(actorId, slotId, index, nextIndex);
  }

  function createPlaceholder() {
    const el = document.createElement("div");
    el.className = "program-placeholder";
    return el;
  }

  function clearDropHighlight(drag) {
    if (drag && drag.currentSlotSection) {
      drag.currentSlotSection.classList.remove("is-drop-target");
      drag.currentSlotSection = null;
    }
  }

  function cleanup() {
    const drag = App.store.app.drag;

    if (!drag) {
      return;
    }

    if (drag.sourceElement) {
      drag.sourceElement.classList.remove("drag-origin");
    }

    if (drag.ghost && drag.ghost.parentNode) {
      drag.ghost.parentNode.removeChild(drag.ghost);
    }

    if (drag.placeholder && drag.placeholder.parentNode) {
      drag.placeholder.parentNode.removeChild(drag.placeholder);
    }

    clearDropHighlight(drag);
    document.removeEventListener("pointermove", onGlobalMove);
    document.removeEventListener("pointerup", onGlobalUp);
    document.removeEventListener("pointercancel", onGlobalUp);
    App.store.app.drag = null;
  }

  function activateDrag(event) {
    const drag = App.store.app.drag;

    if (!drag || drag.active) {
      return;
    }

    const ghost = drag.sourceElement.cloneNode(true);
    ghost.classList.remove("is-active", "is-targeted");
    ghost.classList.add("drag-ghost");
    ghost.style.left = event.clientX + "px";
    ghost.style.top = event.clientY + "px";
    document.body.appendChild(ghost);

    drag.active = true;
    drag.pending = false;
    drag.ghost = ghost;
    drag.placeholder = createPlaceholder();
    drag.sourceElement.classList.add("drag-origin");
  }

  function beginDrag(meta, sourceElement, event) {
    if (App.store.runtime.isRunning) {
      return;
    }

    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    App.store.app.drag = {
      pending: true,
      active: false,
      pointerType: event.pointerType || "",
      startX: event.clientX,
      startY: event.clientY,
      source: meta.source,
      blockId: meta.blockId,
      instanceId: meta.instanceId || "",
      originActorId: meta.originActorId || "",
      originSlotId: meta.originSlotId || "",
      originIndex: typeof meta.originIndex === "number" ? meta.originIndex : -1,
      sourceElement: sourceElement,
      ghost: null,
      placeholder: null,
      currentSlotSection: null,
    };

    document.addEventListener("pointermove", onGlobalMove);
    document.addEventListener("pointerup", onGlobalUp);
    document.addEventListener("pointercancel", onGlobalUp);
  }

  function dropSlotAt(x, y) {
    const element = document.elementFromPoint(x, y);
    return element ? element.closest(".slot-list") : null;
  }

  function insertIndex(slotList, y) {
    const items = Array.from(slotList.querySelectorAll(".program-block:not(.drag-origin)"));

    for (let index = 0; index < items.length; index += 1) {
      const rect = items[index].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        return index;
      }
    }

    return items.length;
  }

  function placePlaceholder(slotList, index) {
    const drag = App.store.app.drag;
    const empty = slotList.querySelector(".slot-empty");
    const items = Array.from(slotList.querySelectorAll(".program-block:not(.drag-origin)"));

    if (empty) {
      empty.remove();
    }

    if (index >= items.length) {
      slotList.appendChild(drag.placeholder);
    } else {
      slotList.insertBefore(drag.placeholder, items[index]);
    }

    clearDropHighlight(drag);
    drag.currentSlotSection = slotList.closest(".script-slot");
    if (drag.currentSlotSection) {
      drag.currentSlotSection.classList.add("is-drop-target");
    }
  }

  function onGlobalMove(event) {
    const drag = App.store.app.drag;

    if (!drag) {
      return;
    }

    if (drag.pending) {
      const movedX = Math.abs(event.clientX - drag.startX);
      const movedY = Math.abs(event.clientY - drag.startY);
      if (Math.max(movedX, movedY) < 8) {
        return;
      }
      activateDrag(event);
    }

    if (!drag.active) {
      return;
    }

    drag.ghost.style.left = event.clientX + "px";
    drag.ghost.style.top = event.clientY + "px";

    const slotList = dropSlotAt(event.clientX, event.clientY);
    if (!slotList) {
      if (drag.placeholder.parentNode) {
        drag.placeholder.parentNode.removeChild(drag.placeholder);
      }
      clearDropHighlight(drag);
      return;
    }

    placePlaceholder(slotList, insertIndex(slotList, event.clientY));
  }

  function onGlobalUp(event) {
    const drag = App.store.app.drag;

    if (!drag) {
      return;
    }

    if (drag.pending && !drag.active) {
      cleanup();
      return;
    }

    const slotList = dropSlotAt(event.clientX, event.clientY);

    if (slotList) {
      const actorId = slotList.dataset.actorId;
      const slotId = slotList.dataset.slotId;
      const target = App.state.cloneBlocks(App.state.blocks(actorId, slotId));
      let index = insertIndex(slotList, event.clientY);
      let moved;

      if (drag.source === "slot") {
        const origin = App.state.cloneBlocks(App.state.blocks(drag.originActorId, drag.originSlotId));
        moved = origin.splice(drag.originIndex, 1)[0];
        App.state.setBlocks(drag.originActorId, drag.originSlotId, origin);

        if (drag.originActorId === actorId && drag.originSlotId === slotId && drag.originIndex < index) {
          index -= 1;
        }
      } else {
        moved = App.state.createInstance(drag.blockId);
      }

      target.splice(index, 0, moved);
      App.state.setBlocks(actorId, slotId, target);
      App.state.setKeyboardSlotTarget(actorId, slotId);
      App.store.app.ignorePoolClickUntil = Date.now() + 400;
      cleanup();
      afterMutation();
      announceMutation("已放入" + App.config.ACTORS[actorId].name + "的脚本槽。");
      return;
    }

    cleanup();
    if (App.render && typeof App.render.renderAll === "function") {
      App.render.renderAll();
    }
  }

  function handleProgramKeydown(event, blockElement) {
    if (App.store.runtime.isRunning) {
      return;
    }

    const actorId = blockElement.dataset.actorId;
    const slotId = blockElement.dataset.slotId;
    const instanceId = blockElement.dataset.instanceId;

    if ((event.key === "Delete" || event.key === "Backspace") && !event.altKey) {
      event.preventDefault();
      removeProgramBlock(actorId, slotId, instanceId);
      return;
    }

    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      moveProgramBlockByInstance(actorId, slotId, instanceId, -1);
      return;
    }

    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      moveProgramBlockByInstance(actorId, slotId, instanceId, 1);
    }
  }

  function handlePoolClick(event, blockElement) {
    if (App.store.runtime.isRunning) {
      return;
    }

    const keyboardClick = event.detail === 0;
    const coarsePointer = global.matchMedia && global.matchMedia("(pointer: coarse)").matches;

    if (Date.now() < App.store.app.ignorePoolClickUntil) {
      return;
    }

    if (keyboardClick || coarsePointer) {
      appendPoolBlockToCurrentSlot(blockElement.dataset.blockId);
    }
  }

  function handlePoolKeydown(event, blockElement) {
    if (App.store.runtime.isRunning) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    appendPoolBlockToCurrentSlot(blockElement.dataset.blockId);
  }

  App.drag = {
    beginDrag: beginDrag,
    cleanup: cleanup,
    setKeyboardSlotTarget: setKeyboardSlotTarget,
    ensureKeyboardSlotTarget: ensureKeyboardSlotTarget,
    appendPoolBlockToCurrentSlot: appendPoolBlockToCurrentSlot,
    removeProgramBlock: removeProgramBlock,
    cycleProgramBlockParam: cycleProgramBlockParam,
    cycleMessageBinding: cycleMessageBinding,
    handleProgramKeydown: handleProgramKeydown,
    handlePoolClick: handlePoolClick,
    handlePoolKeydown: handlePoolKeydown,
  };
})(window);
