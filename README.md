# VaultUp

Telegram Mini App: апгрейд **Telegram Stars ★** + рулетка. Демо с балансом в звёздах, выводом и админ-панелью.

**Бот:** создайте в [@BotFather](https://t.me/BotFather) бота с именем **VaultUp**  
Рекомендуемый username: `VaultUpBot` / `VaultUp_bot` (текущий бот: **@VaultUp_bot**).

## Быстрый старт (локально)

```bash
cp .env.example .env
# Впишите BOT_TOKEN из BotFather (и при желании ADMIN_PASSWORD)
npm install
npm start
```

Откройте:

- Приложение: http://localhost:3000  
- Админка: http://localhost:3000/admin (пароль по умолчанию: `vaultup-admin`)

Без Telegram WebApp SDK сессия идёт в **демо-режиме** (mock-пользователь). С `BOT_TOKEN` сервер умеет проверять реальный `initData`.

## Переменные окружения

Скопируйте `.env.example` → `.env` (файл `.env` в git **не** коммитится):

| Переменная | Описание |
|---|---|
| `BOT_TOKEN` | Токен бота из BotFather |
| `WEBAPP_URL` | Публичный HTTPS URL мини-приложения (ngrok / VPS / Cloudflare Tunnel) |
| `ADMIN_PASSWORD` | Пароль админки |
| `PORT` | Порт сервера (по умолчанию `3000`) |

## Подключение к Telegram

1. Создайте бота в @BotFather → имя **VaultUp**, username вроде `VaultUpBot`.
2. Скопируйте токен в `.env` как `BOT_TOKEN=...`.
3. Поднимите сервер на **HTTPS** (для Telegram обязателен публичный URL), например через ngrok:
   ```bash
   ngrok http 3000
   ```
4. Пропишите URL в `.env`:
   ```bash
   WEBAPP_URL=https://YOUR-SUBDOMAIN.ngrok-free.app
   ```
   и перезапустите `npm start`. При старте сервер вызовет `setChatMenuButton` (кнопка меню → Web App).
5. Либо вручную в BotFather:
   - `/mybots` → VaultUp → **Bot Settings** → **Menu Button** → Configure menu button → укажите URL  
   - или **Web App** / Direct Link (в зависимости от версии BotFather).
6. Напишите боту `/start` — при заданном `WEBAPP_URL` придёт кнопка **«Открыть VaultUp»**.

## Режимы в приложении

- **Апгрейд** — ставка vs цена предмета, шанс на циферблате, анимация, win/lose.
- **Рулетка** — выбор множителя (×2…×25), ставка с баланса, спин колеса, выплата.
- **Вывод** — заявка списывает баланс; в админке можно approve/reject.
- **Админка** — игроки, выводы, каталог предметов, house edge / min-max шанс.

## Стек

Node.js + Express, JSON-хранилище (`server/data/db.json`), статический фронт в `public/`.

## Сброс демо-данных

```bash
npm run reset-db
```
