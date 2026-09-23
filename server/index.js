'use strict';

const path = require('path');
const fs = require('fs');

// Load .env without printing secrets
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const express = require('express');
const cors = require('cors');
const {
  ensureDb,
  readDb,
  writeDb,
  getOrCreateUser,
  calcChance,
  createWithdraw,
  resolveWithdraw,
  performUpgrade,
  performRoulette,
  publicSettings
} = require('./db');
const { resolveUser } = require('./auth');
const { getMe, configureBotProfile, setWebAppMenu, startPolling } = require('./bot');

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_SESSIONS = new Set();

function webAppUrl() {
  return (process.env.WEBAPP_URL || '').trim();
}

ensureDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function authUser(req) {
  const initData = req.headers['x-telegram-init-data'] || req.body?.initData || '';
  const mockHeader = req.headers['x-demo-mock'] === '1' || req.query.mock === '1';
  // Prefer real Telegram auth when initData present; allow mock for local browser demo
  const mock = !initData && (mockHeader || !BOT_TOKEN);
  const { user, mode } = resolveUser({
    initData,
    mock: mock || (!initData && mockHeader),
    botToken: BOT_TOKEN
  });
  if (!user) {
    const err = new Error('Не удалось авторизовать пользователя');
    err.status = 401;
    throw err;
  }
  return { telegramUser: user, mode };
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !ADMIN_SESSIONS.has(token)) {
    return res.status(401).json({ error: 'Нужна авторизация админа' });
  }
  next();
}

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    brand: 'VaultUp',
    auth: BOT_TOKEN ? 'telegram+mock' : 'mock-only',
    webAppUrlConfigured: Boolean(webAppUrl())
  });
});

app.post('/api/session', (req, res) => {
  try {
    const { telegramUser, mode } = authUser(req);
    const user = getOrCreateUser(telegramUser);
    const db = readDb();
    res.json({
      mode,
      user,
      items: db.items,
      settings: publicSettings(db)
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/api/items', (_req, res) => {
  const db = readDb();
  res.json({ items: db.items, settings: publicSettings(db) });
});

app.post('/api/chance', (req, res) => {
  try {
    const { telegramUser } = authUser(req);
    getOrCreateUser(telegramUser);
    const db = readDb();
    const item = db.items.find((i) => i.id === req.body.itemId);
    if (!item) return res.status(404).json({ error: 'Предмет не найден' });
    const bet = Number(req.body.bet);
    const chance = calcChance(
      bet,
      item.price,
      db.settings.houseEdge,
      db.settings.minChance,
      db.settings.maxChance
    );
    res.json({ chance, multiplier: item.price / bet, item });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/upgrade', (req, res) => {
  try {
    const { telegramUser } = authUser(req);
    const user = getOrCreateUser(telegramUser);
    const result = performUpgrade({
      userId: user.id,
      itemId: req.body.itemId,
      bet: req.body.bet
    });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/roulette', (req, res) => {
  try {
    const { telegramUser } = authUser(req);
    const user = getOrCreateUser(telegramUser);
    const result = performRoulette({
      userId: user.id,
      bet: req.body.bet,
      pickId: req.body.pickId
    });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/withdraw', (req, res) => {
  try {
    const { telegramUser } = authUser(req);
    const user = getOrCreateUser(telegramUser);
    const amount = Number(req.body.amount);
    const method = String(req.body.method || 'card').slice(0, 40);
    const details = String(req.body.details || '').slice(0, 200);
    const { request, balance } = createWithdraw({
      userId: user.id,
      amount,
      method,
      details
    });
    res.json({ request, balance });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/api/me/withdraws', (req, res) => {
  try {
    const { telegramUser } = authUser(req);
    const user = getOrCreateUser(telegramUser);
    const db = readDb();
    const list = db.withdraws.filter((w) => w.userId === user.id).slice(0, 20);
    res.json({ withdraws: list });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  const db = readDb();
  const password = String(req.body.password || '');
  if (password !== db.settings.adminPassword) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  const token = require('crypto').randomBytes(24).toString('hex');
  ADMIN_SESSIONS.add(token);
  res.json({ token });
});

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const db = readDb();
  const users = Object.values(db.users).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  res.json({
    users,
    withdraws: db.withdraws,
    items: db.items,
    settings: publicSettings(db),
    upgrades: db.upgrades.slice(0, 50)
  });
});

app.post('/api/admin/withdraws/:id/:action', requireAdmin, (req, res) => {
  try {
    const action = req.params.action === 'approve' ? 'approve' : 'reject';
    const request = resolveWithdraw(req.params.id, action);
    res.json({ request });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const db = readDb();
  const s = db.settings;
  if (req.body.houseEdge != null) s.houseEdge = clamp(Number(req.body.houseEdge), 0, 0.4);
  if (req.body.minChance != null) s.minChance = clamp(Number(req.body.minChance), 0.01, 0.5);
  if (req.body.maxChance != null) s.maxChance = clamp(Number(req.body.maxChance), 0.1, 0.95);
  if (req.body.startingBalance != null) {
    s.startingBalance = Math.max(0, Number(req.body.startingBalance) || s.startingBalance);
  }
  writeDb(db);
  res.json({ settings: publicSettings(db) });
});

app.put('/api/admin/items/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const item = db.items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Предмет не найден' });
  if (req.body.name) item.name = String(req.body.name).slice(0, 60);
  if (req.body.price != null) item.price = Math.max(1, Number(req.body.price) || item.price);
  if (req.body.rarity) item.rarity = String(req.body.rarity).slice(0, 30);
  if (req.body.color) item.color = String(req.body.color).slice(0, 20);
  writeDb(db);
  res.json({ item });
});

app.post('/api/admin/items', requireAdmin, (req, res) => {
  const db = readDb();
  const id = String(req.body.id || `item-${Date.now()}`)
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase();
  if (db.items.some((i) => i.id === id)) {
    return res.status(400).json({ error: 'ID уже существует' });
  }
  const item = {
    id,
    name: String(req.body.name || 'Новый предмет').slice(0, 60),
    rarity: String(req.body.rarity || 'rare').slice(0, 30),
    price: Math.max(1, Number(req.body.price) || 100),
    color: String(req.body.color || '#2ee6a8').slice(0, 20)
  };
  db.items.push(item);
  writeDb(db);
  res.json({ item });
});

app.post('/api/admin/users/:id/balance', requireAdmin, (req, res) => {
  const db = readDb();
  const user = db.users[req.params.id];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const balance = Number(req.body.balance);
  if (!Number.isFinite(balance) || balance < 0) {
    return res.status(400).json({ error: 'Некорректный баланс' });
  }
  user.balance = Math.round(balance * 100) / 100;
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ user });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`VaultUp → http://localhost:${PORT}`);
  console.log(`Админка → http://localhost:${PORT}/admin`);
  console.log(
    `Режим auth: ${BOT_TOKEN ? 'Telegram initData + mock fallback' : 'только mock (локально)'}`
  );

  if (!BOT_TOKEN) {
    console.log('BOT_TOKEN не задан — бот-команды отключены. См. .env.example');
    return;
  }

  try {
    const me = await getMe(BOT_TOKEN);
    console.log(`Бот: @${me.username} (id ${me.id}) · ${me.first_name}`);
    const profile = await configureBotProfile(BOT_TOKEN);
    console.log('Профиль бота:', profile);
    const menu = await setWebAppMenu(BOT_TOKEN, webAppUrl());
    if (menu.skipped) {
      console.log(
        'Menu Button / Web App: пропущено (задайте WEBAPP_URL=https://… в .env или через @BotFather)'
      );
    } else {
      console.log('Menu Button → Web App:', menu.url);
    }
    startPolling(BOT_TOKEN, webAppUrl);
  } catch (e) {
    console.warn('Не удалось инициализировать бота:', e.message);
  }
});
