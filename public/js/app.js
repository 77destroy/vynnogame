import { initTelegram, getInitData, haptic, hapticNotify } from './telegram.js';

const CIRC = 2 * Math.PI * 92;

const state = {
  user: null,
  items: [],
  settings: { currency: '₽', houseEdge: 0.08, minChance: 0.05, maxChance: 0.75 },
  rouletteSlots: [],
  selectedId: null,
  pickId: null,
  spinning: false,
  mode: 'mock',
  wheelAngle: 0
};

const el = {
  balance: document.getElementById('balanceValue'),
  balancePill: document.getElementById('balancePill'),
  chance: document.getElementById('chanceValue'),
  mult: document.getElementById('multValue'),
  dialProgress: document.getElementById('dialProgress'),
  dialNeedle: document.getElementById('dialNeedle'),
  dialWrap: document.querySelector('.dial-wrap'),
  itemSwatch: document.getElementById('itemSwatch'),
  itemRarity: document.getElementById('itemRarity'),
  itemName: document.getElementById('itemName'),
  itemPrice: document.getElementById('itemPrice'),
  targetCard: document.getElementById('targetCard'),
  catalog: document.getElementById('catalog'),
  betInput: document.getElementById('betInput'),
  rouletteBet: document.getElementById('rouletteBet'),
  upgradeBtn: document.getElementById('upgradeBtn'),
  spinBtn: document.getElementById('spinBtn'),
  withdrawSheet: document.getElementById('withdrawSheet'),
  withdrawForm: document.getElementById('withdrawForm'),
  withdrawClose: document.getElementById('withdrawClose'),
  wdAmount: document.getElementById('wdAmount'),
  wdMethod: document.getElementById('wdMethod'),
  wdDetails: document.getElementById('wdDetails'),
  resultSheet: document.getElementById('resultSheet'),
  resultPanel: document.querySelector('#resultSheet .result-panel'),
  resultKicker: document.getElementById('resultKicker'),
  resultTitle: document.getElementById('resultTitle'),
  resultBody: document.getElementById('resultBody'),
  resultOk: document.getElementById('resultOk'),
  resultBurst: document.getElementById('resultBurst'),
  toast: document.getElementById('toast'),
  pickRow: document.getElementById('pickRow'),
  wheelCanvas: document.getElementById('wheelCanvas'),
  wheelHint: document.getElementById('wheelHint'),
  wheelGlow: document.getElementById('wheelGlow')
};

const wheelCtx = el.wheelCanvas.getContext('2d');

function money(n) {
  const cur = state.settings.currency || '★';
  const amount = Math.round(Number(n) || 0).toLocaleString('ru-RU');
  return cur === '★' || cur === 'Stars' ? `${amount} ★` : `${amount} ${cur}`;
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const initData = getInitData();
  if (initData) {
    h['X-Telegram-Init-Data'] = initData;
  } else {
    h['X-Demo-Mock'] = '1';
  }
  return h;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

function calcChanceLocal(bet, price) {
  const { houseEdge, minChance, maxChance } = state.settings;
  if (price <= 0 || bet <= 0) return minChance;
  const raw = (bet / price) * (1 - houseEdge);
  return Math.max(minChance, Math.min(maxChance, raw));
}

function selectedItem() {
  return state.items.find((i) => i.id === state.selectedId) || null;
}

function setDial(chance) {
  const pct = Math.round(chance * 1000) / 10;
  el.chance.textContent = `${pct}%`;
  el.dialProgress.style.strokeDashoffset = String(CIRC * (1 - chance));
  el.dialNeedle.style.transform = `rotate(${chance * 360}deg)`;
}

function updateChanceUI() {
  const item = selectedItem();
  const bet = Number(el.betInput.value) || 0;
  if (!item || bet <= 0) {
    setDial(0);
    el.mult.textContent = '×0.00';
    return;
  }
  const chance = calcChanceLocal(bet, item.price);
  setDial(chance);
  el.mult.textContent = `×${(item.price / Math.max(bet, 1)).toFixed(2)}`;
}

function rarityRu(r) {
  const map = {
    common: 'Обычный',
    uncommon: 'Необычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный',
    mythic: 'Мифический',
    divine: 'Божественный'
  };
  return map[r] || r;
}

function renderTarget() {
  const item = selectedItem();
  if (!item) return;
  el.targetCard.style.setProperty('--item-color', item.color);
  el.itemSwatch.style.setProperty('--item-color', item.color);
  el.itemRarity.textContent = rarityRu(item.rarity);
  el.itemName.textContent = item.name;
  el.itemPrice.textContent = `Цель · ${money(item.price)}`;
  updateChanceUI();
}

function renderCatalog() {
  el.catalog.innerHTML = '';
  state.items
    .slice()
    .sort((a, b) => a.price - b.price)
    .forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cat-item${item.id === state.selectedId ? ' active' : ''}`;
      btn.style.setProperty('--item-color', item.color);
      btn.innerHTML = `<span class="cat-gem"></span><small>${item.name}</small>`;
      btn.addEventListener('click', () => {
        state.selectedId = item.id;
        haptic('light');
        renderCatalog();
        renderTarget();
      });
      el.catalog.appendChild(btn);
    });
}

function bettableSlots() {
  return state.rouletteSlots.filter((s) => s.payout > 0);
}

function renderPicks() {
  el.pickRow.innerHTML = '';
  bettableSlots().forEach((slot) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pick-chip${slot.id === state.pickId ? ' active' : ''}`;
    btn.style.setProperty('--pick-color', slot.color);
    btn.style.color = slot.color;
    btn.textContent = slot.label;
    btn.addEventListener('click', () => {
      state.pickId = slot.id;
      el.wheelHint.textContent = slot.label;
      haptic('light');
      renderPicks();
    });
    el.pickRow.appendChild(btn);
  });
}

function drawWheel(angleRad = 0) {
  const canvas = el.wheelCanvas;
  const ctx = wheelCtx;
  const slots = state.rouletteSlots;
  if (!slots.length) return;

  const dpr = window.devicePixelRatio || 1;
  const size = 320;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const n = slots.length;
  const arc = (Math.PI * 2) / n;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);

  for (let i = 0; i < n; i++) {
    const start = -Math.PI / 2 + i * arc;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, start, start + arc);
    ctx.closePath();
    ctx.fillStyle = slots[i].color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,8,12,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + arc / 2);
    ctx.fillStyle = slots[i].payout === 0 ? '#6b6570' : '#1a1204';
    ctx.font = '700 14px Syne, sans-serif';
    ctx.textAlign = 'center';
    const label = slots[i].payout === 0 ? 'пыль' : slots[i].label;
    ctx.fillText(label, r * 0.58, 4);
    if (slots[i].payout > 0) {
      ctx.font = '16px serif';
      ctx.fillText('★', r * 0.82, 5);
    }
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(238,243,240,0.18)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function setBalance(n) {
  el.balance.textContent = money(n);
  el.balancePill.classList.remove('bump');
  void el.balancePill.offsetWidth;
  el.balancePill.classList.add('bump');
}

function toast(msg) {
  el.toast.hidden = false;
  el.toast.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.toast.hidden = true;
  }, 2800);
}

function showResult({ won, title, body }) {
  el.resultPanel.classList.toggle('win', won);
  el.resultPanel.classList.toggle('lose', !won);
  el.resultKicker.textContent = won ? 'Успех' : 'Мимо';
  el.resultTitle.textContent = title;
  el.resultBody.textContent = body;
  el.resultSheet.showModal();
  hapticNotify(won ? 'success' : 'error');
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateWheelTo(resultIndex) {
  const n = state.rouletteSlots.length;
  const arc = (Math.PI * 2) / n;
  // Pointer at top (-PI/2 in draw space). Segment i center relative to angle 0:
  // We rotate wheel so segment center lands under pointer.
  const segmentCenter = -Math.PI / 2 + resultIndex * arc + arc / 2;
  // After rotation `final`, a point at angle θ on wheel appears at θ+final.
  // We want segmentCenter + final ≡ -PI/2 (mod 2π) → final ≡ -PI/2 - segmentCenter
  let target = -Math.PI / 2 - segmentCenter;
  // normalize relative to current
  const turns = 5 + Math.random() * 2;
  while (target < state.wheelAngle) target += Math.PI * 2;
  target += turns * Math.PI * 2;

  const start = state.wheelAngle;
  const delta = target - start;
  const duration = 4200;
  const t0 = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const a = start + delta * easeOutCubic(t);
      state.wheelAngle = a;
      drawWheel(a);
      if (t < 1) requestAnimationFrame(frame);
      else {
        state.wheelAngle = target % (Math.PI * 2);
        drawWheel(state.wheelAngle);
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function setMode(mode) {
  document.querySelectorAll('.mode-tab').forEach((tab) => {
    const on = tab.dataset.mode === mode;
    tab.classList.toggle('active', on);
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-mode-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.modePanel !== mode;
  });
  if (mode === 'roulette') drawWheel(state.wheelAngle);
}

async function boot() {
  initTelegram();

  const data = await api('/api/session', { method: 'POST', body: '{}' });
  state.user = data.user;
  state.items = data.items;
  state.settings = data.settings;
  state.rouletteSlots = data.settings.rouletteSlots || [];
  state.mode = data.mode;
  state.selectedId =
    state.items.find((i) => i.price > 100)?.id || state.items[0]?.id || null;
  state.pickId = bettableSlots()[0]?.id || null;

  setBalance(state.user.balance);
  renderCatalog();
  renderTarget();
  renderPicks();
  if (state.pickId) {
    el.wheelHint.textContent = bettableSlots().find((s) => s.id === state.pickId)?.label || '×?';
  }
  drawWheel(0);

  if (state.mode === 'mock') toast('VaultUp · демо на Stars ★');
}

document.querySelectorAll('.mode-tab').forEach((tab) => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

el.betInput.addEventListener('input', updateChanceUI);

document.querySelectorAll('[data-bet-delta]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.betTarget);
    const delta = Number(btn.dataset.betDelta);
    const next = Math.max(10, (Number(input.value) || 0) + delta);
    input.value = String(next);
    if (input === el.betInput) updateChanceUI();
  });
});

document.querySelectorAll('[data-bet-max]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.betMax);
    let max = state.user?.balance || 0;
    if (input === el.betInput) {
      const item = selectedItem();
      max = Math.min(max, item ? item.price - 1 : 0);
    }
    input.value = String(Math.max(10, Math.floor(max)));
    if (input === el.betInput) updateChanceUI();
  });
});

el.upgradeBtn.addEventListener('click', async () => {
  if (state.spinning) return;
  const item = selectedItem();
  const bet = Number(el.betInput.value);
  if (!item) return toast('Выберите предмет');
  if (!bet || bet < 10) return toast('Минимальная ставка — 10');

  state.spinning = true;
  el.upgradeBtn.disabled = true;
  el.dialWrap.classList.add('spinning');
  haptic('medium');

  try {
    const result = await api('/api/upgrade', {
      method: 'POST',
      body: JSON.stringify({ itemId: item.id, bet })
    });
    const finalAngle = 360 * 3 + result.chance * 360;
    el.dialWrap.style.setProperty('--final-angle', `${finalAngle}deg`);
    await wait(1900);
    state.user.balance = result.balance;
    setBalance(result.balance);
    setDial(result.chance);
    el.resultBurst.hidden = false;
    el.resultBurst.className = `result-burst ${result.won ? 'win' : 'lose'}`;
    showResult({
      won: result.won,
      title: result.won ? 'Апгрейд ★!' : 'Не повезло',
      body: result.won
        ? `Получено «${result.item.name}» · +${money(result.item.price - bet)}`
        : `Ставка ${money(bet)} сгорела. Попробуй другой шанс.`
    });
  } catch (e) {
    toast(e.message);
  } finally {
    el.dialWrap.classList.remove('spinning');
    state.spinning = false;
    el.upgradeBtn.disabled = false;
  }
});

el.spinBtn.addEventListener('click', async () => {
  if (state.spinning) return;
  const bet = Number(el.rouletteBet.value);
  if (!state.pickId) return toast('Выберите множитель');
  if (!bet || bet < 10) return toast('Минимальная ставка — 10');

  state.spinning = true;
  el.spinBtn.disabled = true;
  el.wheelGlow.hidden = true;
  haptic('medium');

  try {
    const result = await api('/api/roulette', {
      method: 'POST',
      body: JSON.stringify({ bet, pickId: state.pickId })
    });
    // Prefer server slot order if returned
    if (result.slots?.length) {
      state.rouletteSlots = result.slots.map(({ id, label, color, payout }) => ({
        id,
        label,
        color,
        payout
      }));
    }
    await animateWheelTo(result.resultIndex);
    state.user.balance = result.balance;
    setBalance(result.balance);
    el.wheelHint.textContent = result.result.label;
    el.wheelGlow.hidden = false;
    el.wheelGlow.className = `wheel-glow ${result.won ? 'win' : 'lose'}`;
    showResult({
      won: result.won,
      title: result.won ? `★ ${result.result.label}` : `Выпало: ${result.result.label}`,
      body: result.won
        ? `Выигрыш ${money(result.payout)} · баланс обновлён`
        : `Ставка ${money(bet)} ушла в пыль`
    });
  } catch (e) {
    toast(e.message);
  } finally {
    state.spinning = false;
    el.spinBtn.disabled = false;
  }
});

document.querySelectorAll('.withdraw-open').forEach((btn) => {
  btn.addEventListener('click', () => {
    el.wdAmount.value = String(Math.min(state.user?.balance || 0, 500));
    el.withdrawSheet.showModal();
  });
});

el.withdrawClose.addEventListener('click', () => el.withdrawSheet.close());

el.withdrawForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(el.wdAmount.value),
        method: el.wdMethod.value,
        details: el.wdDetails.value
      })
    });
    state.user.balance = data.balance;
    setBalance(data.balance);
    el.withdrawSheet.close();
    toast('Заявка на вывод Stars отправлена');
    hapticNotify('success');
  } catch (err) {
    toast(err.message);
  }
});

el.resultOk.addEventListener('click', () => {
  el.resultSheet.close();
  if (el.resultBurst) el.resultBurst.hidden = true;
});

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

window.addEventListener('resize', () => {
  if (!document.getElementById('modeRoulette').hidden) drawWheel(state.wheelAngle);
});

boot().catch((e) => toast(e.message || 'Не удалось загрузить VaultUp'));
