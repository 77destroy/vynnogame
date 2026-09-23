let token = sessionStorage.getItem('vaultup_admin_token') || '';

const loginView = document.getElementById('loginView');
const dashView = document.getElementById('dashView');
const loginError = document.getElementById('loginError');

async function adminApi(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

function money(n, cur = '★') {
  const amount = Math.round(n).toLocaleString('ru-RU');
  return cur === '★' || cur === 'Stars' ? `${amount} ★` : `${amount} ${cur}`;
}

async function login() {
  loginError.textContent = '';
  try {
    const password = document.getElementById('adminPassword').value;
    const data = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Ошибка входа');
      return j;
    });
    token = data.token;
    sessionStorage.setItem('vaultup_admin_token', token);
    await showDash();
  } catch (e) {
    loginError.textContent = e.message;
  }
}

async function showDash() {
  loginView.hidden = true;
  dashView.hidden = false;
  await refresh();
}

async function refresh() {
  const data = await adminApi('/api/admin/overview');
  renderUsers(data.users, data.settings.currency);
  renderWithdraws(data.withdraws, data.settings.currency);
  renderItems(data.items);
  fillOdds(data.settings);
}

function renderUsers(users, currency) {
  const body = document.getElementById('usersBody');
  body.innerHTML = users
    .map(
      (u) => `
    <tr>
      <td>${u.id}</td>
      <td>${escapeHtml(u.firstName || '')} ${escapeHtml(u.username ? '@' + u.username : '')}</td>
      <td>${money(u.balance, currency)}</td>
      <td>${u.upgradesWon}/${u.upgradesLost}</td>
      <td>
        <button class="btn compact ghost" data-set-balance="${u.id}" data-balance="${u.balance}">Изменить</button>
      </td>
    </tr>`
    )
    .join('');

  body.querySelectorAll('[data-set-balance]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const next = prompt('Новый баланс', btn.dataset.balance);
      if (next == null) return;
      await adminApi(`/api/admin/users/${btn.dataset.setBalance}/balance`, {
        method: 'POST',
        body: JSON.stringify({ balance: Number(next) })
      });
      await refresh();
    });
  });
}

function renderWithdraws(list, currency) {
  const body = document.getElementById('wdBody');
  body.innerHTML = list
    .map((w) => {
      const actions =
        w.status === 'pending'
          ? `<div class="row-actions">
              <button class="btn compact" data-wd="${w.id}" data-action="approve">Ок</button>
              <button class="btn compact danger" data-wd="${w.id}" data-action="reject">Отклон.</button>
            </div>`
          : '—';
      return `<tr>
        <td>${new Date(w.createdAt).toLocaleString('ru-RU')}</td>
        <td>${w.userId}</td>
        <td>${money(w.amount, currency)}</td>
        <td>${escapeHtml(w.method)} · ${escapeHtml(w.details)}</td>
        <td><span class="status ${w.status}">${w.status}</span></td>
        <td>${actions}</td>
      </tr>`;
    })
    .join('');

  body.querySelectorAll('[data-wd]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await adminApi(`/api/admin/withdraws/${btn.dataset.wd}/${btn.dataset.action}`, {
        method: 'POST',
        body: '{}'
      });
      await refresh();
    });
  });
}

function renderItems(items) {
  const body = document.getElementById('itemsBody');
  body.innerHTML = items
    .map(
      (i) => `<tr>
      <td>${escapeHtml(i.id)}</td>
      <td>${escapeHtml(i.name)}</td>
      <td><input data-price-id="${i.id}" type="number" value="${i.price}" style="width:90px" /></td>
      <td>${escapeHtml(i.rarity)}</td>
      <td><button class="btn compact ghost" data-save-item="${i.id}">Сохранить</button></td>
    </tr>`
    )
    .join('');

  body.querySelectorAll('[data-save-item]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.saveItem;
      const price = Number(body.querySelector(`[data-price-id="${id}"]`).value);
      await adminApi(`/api/admin/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ price })
      });
      await refresh();
    });
  });
}

function fillOdds(settings) {
  const form = document.getElementById('oddsForm');
  form.houseEdge.value = settings.houseEdge;
  form.minChance.value = settings.minChance;
  form.maxChance.value = settings.maxChance;
  form.startingBalance.value = settings.startingBalance;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('adminPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login();
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.panel').forEach((p) => {
      p.hidden = p.dataset.panel !== tab.dataset.tab;
    });
  });
});

document.getElementById('addItemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await adminApi('/api/admin/items', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(fd.entries()))
  });
  e.target.reset();
  await refresh();
});

document.getElementById('oddsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(
    [...fd.entries()].map(([k, v]) => [k, Number(v)])
  );
  await adminApi('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) });
  document.getElementById('oddsMsg').textContent = 'Сохранено';
  await refresh();
});

if (token) {
  showDash().catch(() => {
    token = '';
    sessionStorage.removeItem('vaultup_admin_token');
    loginView.hidden = false;
    dashView.hidden = true;
  });
}
