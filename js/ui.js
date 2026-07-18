// Игровой UI: онбординг, промпт действия, FAB, панель-меню, прогресс исследования.

export function createUI(stationIds) {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch) document.body.classList.add('touch');

  const onboard = document.getElementById('onboard');
  const prompt = document.getElementById('prompt');
  const promptVerb = document.getElementById('prompt-verb');
  const action = document.getElementById('action');
  const actionVerb = document.getElementById('action-verb');
  const panel = document.getElementById('panel');
  const plateNum = document.getElementById('plate-num');
  const plateZone = document.getElementById('plate-zone');
  const hudCount = document.getElementById('hud-count');
  const footProgress = document.getElementById('foot-progress');
  const footKey = document.getElementById('foot-key');
  const footLabel = document.getElementById('foot-label');
  const panelFoot = document.getElementById('panel-foot');
  const final = document.getElementById('final');

  // слоты прогресса
  const slotsRoot = document.getElementById('hud-slots');
  const slots = {};
  for (const id of stationIds) {
    const el = document.createElement('div');
    el.className = 'hud-slot';
    slotsRoot.appendChild(el);
    slots[id] = el;
  }
  const opened = new Set();

  let onboardHidden = false;
  let panelOpen = false;
  let actionCb = null;
  let closeReqCb = null;
  let finalShown = false;
  let held = false; // FAB зажат — для серийных действий (мешок)

  panelFoot.addEventListener('click', () => closeReqCb && closeReqCb());

  action.addEventListener('click', () => actionCb && actionCb());
  action.addEventListener('pointerdown', () => { held = true; });
  addEventListener('pointerup', () => { held = false; });
  addEventListener('pointercancel', () => { held = false; });
  document.getElementById('final-cta').addEventListener('click', () => {
    final.classList.remove('on');
    actionCb && actionCb('reception');
  });

  return {
    isTouch,
    get onboardHidden() { return onboardHidden; },
    get panelOpen() { return panelOpen; },
    get openedCount() { return opened.size; },
    get actionHeld() { return held; },

    hideOnboard() {
      if (onboardHidden) return;
      onboardHidden = true;
      onboard.classList.add('hidden');
    },

    onAction(cb) { actionCb = cb; },
    onCloseReq(cb) { closeReqCb = cb; },

    // промпт действия: фиксирован внизу по центру, как в играх;
    // на мобилке вместо него — FAB
    showPrompt(verb) {
      if (isTouch) {
        actionVerb.textContent = verb;
        action.classList.add('on');
      } else {
        promptVerb.textContent = verb;
        prompt.classList.add('on');
      }
    },
    hidePrompt() {
      prompt.classList.remove('on');
      action.classList.remove('on');
    },

    openPanel(id) {
      let found = false;
      panel.querySelectorAll('article').forEach((a) => {
        const active = a.dataset.station === id;
        a.classList.toggle('active', active);
        if (active) {
          plateNum.textContent = a.dataset.num;
          plateZone.textContent = a.dataset.zone;
          // статейный режим — конверсионные панели с полноценной вёрсткой
          panel.classList.toggle('wide', a.dataset.mode === 'article');
          found = true;
        }
      });
      if (!found) return;
      this.markOpened(id);
      footProgress.textContent = `исследовано ${opened.size}/${stationIds.length}`;
      // у мешка E занята ударом — закрытие через esc/тап
      footKey.textContent = id === 'bag' ? 'esc' : 'E';
      footLabel.textContent = id === 'bag' ? 'закрыть · E — бить' : 'закрыть';
      panel.classList.add('open');
      panelOpen = true;
      if (id !== 'bag') this.hidePrompt();
    },

    closePanel() {
      panel.classList.remove('open');
      panelOpen = false;
      if (opened.size === stationIds.length && !finalShown) {
        finalShown = true;
        final.classList.add('on');
        setTimeout(() => final.classList.remove('on'), 12000);
      }
    },

    markOpened(id) {
      if (opened.has(id)) return;
      opened.add(id);
      slots[id] && slots[id].classList.add('done');
      hudCount.textContent = opened.size;
    },
  };
}
