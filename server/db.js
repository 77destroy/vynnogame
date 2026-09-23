'use strict';

const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULT_ITEMS = [
  {
    id: 'star-handful',
    name: 'Горсть ★',
    rarity: 'common',
    price: 50,
    color: '#c4a35a'
  },
  {
    id: 'star-cluster',
    name: 'Скопление ★',
    rarity: 'uncommon',
    price: 90,
    color: '#e8b84a'
  },
  {
    id: 'star-constellation',
    name: 'Созвездие',
    rarity: 'rare',
    price: 160,
    color: '#f5c542'
  },
  {
    id: 'star-nova',
    name: 'Нова',
    rarity: 'epic',
    price: 320,
    color: '#ffd76a'
  },
  {
    id: 'star-supernova',
    name: 'Сверхновая',
    rarity: 'legendary',
    price: 580,
    color: '#ffe08a'
  },
  {
    id: 'star-nebula',
    name: 'Туманность',
    rarity: 'mythic',
    price: 980,
    color: '#7dd3c0'
  },
  {
    id: 'star-galaxy',
    name: 'Галактика',
    rarity: 'divine',
    price: 1650,
    color: '#f0c14a'
  },
  {
    id: 'star-vault',
    name: 'Vault ★',
    rarity: 'legendary',
    price: 720,
    color: '#d4a017'
  }
];

function defaultDb() {
  return {
    settings: {
      adminPassword: process.env.ADMIN_PASSWORD || 'vaultup-admin',
      houseEdge: 0.08,
      minChance: 0.05,
      maxChance: 0.75,
      startingBalance: 500,
      currency: '★',
      currencyName: 'Stars',
      roulette: {
        slots: [
          { id: 'x2', label: '×2★', color: '#c9a227', weight: 36, payout: 2 },
          { id: 'x3', label: '×3★', color: '#e8b84a', weight: 18, payout: 3 },
          { id: 'x5', label: '×5★', color: '#f5c542', weight: 10, payout: 5 },
          { id: 'x10', label: '×10★', color: '#ffd76a', weight: 5, payout: 10 },
          { id: 'x25', label: '×25★', color: '#ffe9a8', weight: 2, payout: 25 },
          { id: 'bust', label: 'пыль', color: '#141820', weight: 29, payout: 0 }
        ]
      }
    },
    items: DEFAULT_ITEMS,
    users: {},
    withdraws: [],
    upgrades: [],
    rouletteSpins: []
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    writeDb(defaultDb());
    return;
  }
  // Soft-migrate missing fields
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const base = defaultDb();
  let dirty = false;
  if (!db.settings) {
    db.settings = base.settings;
    dirty = true;
  }
  if (!db.settings.roulette) {
    db.settings.roulette = base.settings.roulette;
    dirty = true;
  }
  // Stars migration: currency + catalog refresh when still on old skins/₽
  if (db.settings.currency === '₽' || db.settings.currency === 'RUB') {
    db.settings.currency = '★';
    db.settings.currencyName = 'Stars';
    dirty = true;
  }
  if (!db.settings.currencyName) {
    db.settings.currencyName = 'Stars';
    dirty = true;
  }
  const looksLikeSkins =
    Array.isArray(db.items) &&
    db.items.some((i) => /knife|carbine|awp|pistol|glove|mask|blade|smg/i.test(i.id || i.name || ''));
  if (looksLikeSkins) {
    db.items = base.items;
    db.settings.roulette = base.settings.roulette;
    if (db.settings.startingBalance === 1000) db.settings.startingBalance = 500;
    dirty = true;
  }
  // Refresh roulette labels to Stars style if still old
  if (
    db.settings.roulette?.slots?.some((s) => s.label === '×2' || s.label === '0')
  ) {
    db.settings.roulette = base.settings.roulette;
    dirty = true;
  }
  if (db.settings.adminPassword === 'vynn-admin') {
    db.settings.adminPassword = process.env.ADMIN_PASSWORD || 'vaultup-admin';
    dirty = true;
  }
  if (!db.rouletteSpins) {
    db.rouletteSpins = [];
    dirty = true;
  }
  if (!db.items) {
    db.items = base.items;
    dirty = true;
  }
  if (!db.users) {
    db.users = {};
    dirty = true;
  }
  if (!db.withdraws) {
    db.withdraws = [];
    dirty = true;
  }
  if (!db.upgrades) {
    db.upgrades = [];
    dirty = true;
  }
  if (dirty) writeDb(db);
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getOrCreateUser(telegramUser) {
  const db = readDb();
  const id = String(telegramUser.id);
  if (!db.users[id]) {
    db.users[id] = {
      id,
      username: telegramUser.username || null,
      firstName: telegramUser.first_name || telegramUser.firstName || 'Игрок',
      lastName: telegramUser.last_name || telegramUser.lastName || '',
      balance: db.settings.startingBalance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      upgradesWon: 0,
      upgradesLost: 0
    };
    writeDb(db);
  } else {
    const u = db.users[id];
    u.username = telegramUser.username || u.username;
    u.firstName = telegramUser.first_name || telegramUser.firstName || u.firstName;
    u.lastName = telegramUser.last_name || telegramUser.lastName || u.lastName;
    u.updatedAt = new Date().toISOString();
    writeDb(db);
  }
  return readDb().users[id];
}

function calcChance(bet, targetPrice, houseEdge, minChance, maxChance) {
  if (targetPrice <= 0 || bet <= 0) return minChance;
  const raw = (bet / targetPrice) * (1 - houseEdge);
  return Math.max(minChance, Math.min(maxChance, raw));
}

function createWithdraw({ userId, amount, method, details }) {
  const db = readDb();
  const user = db.users[userId];
  if (!user) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
  if (amount <= 0) throw Object.assign(new Error('Некорректная сумма'), { status: 400 });
  if (user.balance < amount) throw Object.assign(new Error('Недостаточно средств'), { status: 400 });

  user.balance = Math.round((user.balance - amount) * 100) / 100;
  user.updatedAt = new Date().toISOString();

  const request = {
    id: nanoid(10),
    userId,
    amount,
    method,
    details: details || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null
  };
  db.withdraws.unshift(request);
  writeDb(db);
  return { request, balance: user.balance };
}

function resolveWithdraw(requestId, action) {
  const db = readDb();
  const request = db.withdraws.find((w) => w.id === requestId);
  if (!request) throw Object.assign(new Error('Заявка не найдена'), { status: 404 });
  if (request.status !== 'pending') {
    throw Object.assign(new Error('Заявка уже обработана'), { status: 400 });
  }

  const user = db.users[request.userId];
  if (action === 'approve') {
    request.status = 'approved';
  } else if (action === 'reject') {
    request.status = 'rejected';
    if (user) {
      user.balance = Math.round((user.balance + request.amount) * 100) / 100;
      user.updatedAt = new Date().toISOString();
    }
  } else {
    throw Object.assign(new Error('Неизвестное действие'), { status: 400 });
  }
  request.resolvedAt = new Date().toISOString();
  writeDb(db);
  return request;
}

function performUpgrade({ userId, itemId, bet }) {
  const db = readDb();
  const user = db.users[userId];
  const item = db.items.find((i) => i.id === itemId);
  if (!user) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });
  if (!item) throw Object.assign(new Error('Предмет не найден'), { status: 404 });

  const amount = Number(bet);
  if (!Number.isFinite(amount) || amount < 10) {
    throw Object.assign(new Error('Минимальная ставка — 10'), { status: 400 });
  }
  if (amount > user.balance) {
    throw Object.assign(new Error('Недостаточно средств'), { status: 400 });
  }
  if (amount >= item.price) {
    throw Object.assign(new Error('Ставка должна быть меньше цены предмета'), { status: 400 });
  }

  const { houseEdge, minChance, maxChance } = db.settings;
  const chance = calcChance(amount, item.price, houseEdge, minChance, maxChance);
  const roll = Math.random();
  const won = roll < chance;

  user.balance = Math.round((user.balance - amount) * 100) / 100;
  if (won) {
    user.balance = Math.round((user.balance + item.price) * 100) / 100;
    user.upgradesWon += 1;
  } else {
    user.upgradesLost += 1;
  }
  user.updatedAt = new Date().toISOString();

  const record = {
    id: nanoid(10),
    userId,
    itemId,
    itemName: item.name,
    bet: amount,
    targetPrice: item.price,
    chance,
    roll,
    won,
    createdAt: new Date().toISOString()
  };
  db.upgrades.unshift(record);
  if (db.upgrades.length > 500) db.upgrades.length = 500;
  writeDb(db);

  return {
    won,
    chance,
    roll,
    item,
    balance: user.balance,
    recordId: record.id
  };
}

function getRouletteSlots(db) {
  return (db.settings.roulette && db.settings.roulette.slots) || defaultDb().settings.roulette.slots;
}

function pickWeighted(slots) {
  const total = slots.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < slots.length; i++) {
    r -= slots[i].weight;
    if (r <= 0) return { slot: slots[i], index: i };
  }
  return { slot: slots[slots.length - 1], index: slots.length - 1 };
}

function performRoulette({ userId, bet, pickId }) {
  const db = readDb();
  const user = db.users[userId];
  if (!user) throw Object.assign(new Error('Пользователь не найден'), { status: 404 });

  const amount = Number(bet);
  if (!Number.isFinite(amount) || amount < 10) {
    throw Object.assign(new Error('Минимальная ставка — 10'), { status: 400 });
  }
  if (amount > user.balance) {
    throw Object.assign(new Error('Недостаточно средств'), { status: 400 });
  }

  const slots = getRouletteSlots(db);
  const pick = slots.find((s) => s.id === pickId && s.payout > 0);
  if (!pick) {
    throw Object.assign(new Error('Выберите цвет / множитель'), { status: 400 });
  }

  const { slot: result, index } = pickWeighted(slots);
  const won = result.id === pick.id;
  const payout = won ? amount * result.payout : 0;

  user.balance = Math.round((user.balance - amount) * 100) / 100;
  if (won) {
    user.balance = Math.round((user.balance + payout) * 100) / 100;
    user.upgradesWon += 1;
  } else {
    user.upgradesLost += 1;
  }
  user.updatedAt = new Date().toISOString();

  if (!db.rouletteSpins) db.rouletteSpins = [];
  const record = {
    id: nanoid(10),
    userId,
    bet: amount,
    pickId: pick.id,
    resultId: result.id,
    resultIndex: index,
    payout,
    won,
    createdAt: new Date().toISOString()
  };
  db.rouletteSpins.unshift(record);
  if (db.rouletteSpins.length > 500) db.rouletteSpins.length = 500;
  writeDb(db);

  return {
    won,
    pick,
    result,
    resultIndex: index,
    payout,
    bet: amount,
    balance: user.balance,
    slots,
    recordId: record.id
  };
}

function publicSettings(db) {
  return {
    houseEdge: db.settings.houseEdge,
    minChance: db.settings.minChance,
    maxChance: db.settings.maxChance,
    currency: db.settings.currency || '★',
    currencyName: db.settings.currencyName || 'Stars',
    startingBalance: db.settings.startingBalance,
    rouletteSlots: getRouletteSlots(db).map(({ id, label, color, payout }) => ({
      id,
      label,
      color,
      payout
    }))
  };
}

module.exports = {
  DB_PATH,
  defaultDb,
  ensureDb,
  readDb,
  writeDb,
  getOrCreateUser,
  calcChance,
  createWithdraw,
  resolveWithdraw,
  performUpgrade,
  performRoulette,
  getRouletteSlots,
  publicSettings
};
