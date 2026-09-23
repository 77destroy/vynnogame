'use strict';

const crypto = require('crypto');

/**
 * Verify Telegram WebApp initData (HMAC-SHA256).
 * See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculated !== hash) return null;

  const authDate = Number(params.get('auth_date') || 0);
  const maxAgeSec = 86400;
  if (authDate && Date.now() / 1000 - authDate > maxAgeSec) return null;

  let user = null;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
  return user;
}

/** Local demo user when Telegram is not available */
function mockUser(seed = 'demo') {
  return {
    id: 100001,
    first_name: 'Демо',
    last_name: 'Игрок',
    username: `vaultup_${seed}`,
    language_code: 'ru',
    is_premium: false
  };
}

function resolveUser({ initData, mock, botToken }) {
  if (botToken && initData) {
    const verified = verifyInitData(initData, botToken);
    if (verified) return { user: verified, mode: 'telegram' };
    // Fall through only if mock explicitly requested for local debugging
  }
  if (mock || !botToken) {
    return { user: mockUser(), mode: 'mock' };
  }
  return { user: null, mode: 'invalid' };
}

module.exports = {
  verifyInitData,
  mockUser,
  resolveUser
};
