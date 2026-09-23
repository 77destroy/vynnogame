'use strict';

/**
 * Lightweight Telegram bot helpers for VaultUp Mini App.
 * Token is read from process.env — never log it.
 */

const API = (token) => `https://api.telegram.org/bot${token}`;

async function tg(token, method, body) {
  const res = await fetch(`${API(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(data.description || `Telegram API ${method} failed`);
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}

async function getMe(token) {
  return tg(token, 'getMe');
}

async function configureBotProfile(token) {
  const results = {};
  try {
    await tg(token, 'setMyName', { name: 'VaultUp' });
    results.name = 'ok';
  } catch (e) {
    results.name = e.message;
  }
  try {
    await tg(token, 'setMyDescription', {
      description:
        'VaultUp — мини-приложение для апгрейда предметов. Крути шанс, выигрывай ценные скины, выводи баланс.'
    });
    results.description = 'ok';
  } catch (e) {
    results.description = e.message;
  }
  try {
    await tg(token, 'setMyShortDescription', {
      short_description: 'Апгрейд предметов · Telegram Mini App'
    });
    results.shortDescription = 'ok';
  } catch (e) {
    results.shortDescription = e.message;
  }
  try {
    await tg(token, 'setMyCommands', {
      commands: [
        { command: 'start', description: 'Открыть VaultUp' },
        { command: 'app', description: 'Запустить мини-приложение' }
      ]
    });
    results.commands = 'ok';
  } catch (e) {
    results.commands = e.message;
  }
  return results;
}

async function setWebAppMenu(token, webAppUrl) {
  if (!webAppUrl) return { skipped: true, reason: 'WEBAPP_URL не задан' };
  await tg(token, 'setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'VaultUp',
      web_app: { url: webAppUrl }
    }
  });
  return { ok: true, url: webAppUrl };
}

function startReplyMarkup(webAppUrl) {
  if (!webAppUrl) {
    return {
      inline_keyboard: [
        [{ text: 'Как подключить Mini App', url: 'https://core.telegram.org/bots/webapps' }]
      ]
    };
  }
  return {
    inline_keyboard: [[{ text: 'Открыть VaultUp', web_app: { url: webAppUrl } }]]
  };
}

function startText(webAppUrl) {
  if (webAppUrl) {
    return (
      '<b>VaultUp</b> — апгрейд предметов прямо в Telegram.\n\n' +
      'Нажми кнопку ниже, чтобы открыть мини-приложение.'
    );
  }
  return (
    '<b>VaultUp</b> готов.\n\n' +
    'Mini App URL ещё не задан (WEBAPP_URL). ' +
    'После деплоя укажи HTTPS-адрес в .env или через @BotFather → Bot Settings → Menu Button / Web App.'
  );
}

/**
 * Long-polling loop for /start and /app.
 */
function startPolling(token, getWebAppUrl) {
  let offset = 0;
  let stopped = false;

  async function loop() {
    while (!stopped) {
      try {
        const updates = await tg(token, 'getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message']
        });
        for (const update of updates) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg?.text) continue;
          const text = msg.text.trim();
          if (!text.startsWith('/start') && !text.startsWith('/app')) continue;
          const webAppUrl = typeof getWebAppUrl === 'function' ? getWebAppUrl() : getWebAppUrl;
          await tg(token, 'sendMessage', {
            chat_id: msg.chat.id,
            text: startText(webAppUrl),
            parse_mode: 'HTML',
            reply_markup: startReplyMarkup(webAppUrl)
          });
        }
      } catch (e) {
        if (e.code === 409) {
          console.warn('[bot] getUpdates conflict — другой polling уже запущен, пропускаем.');
          stopped = true;
          break;
        }
        console.warn('[bot] polling error:', e.message);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  loop();
  return () => {
    stopped = true;
  };
}

module.exports = {
  getMe,
  configureBotProfile,
  setWebAppMenu,
  startPolling
};
