// 404 admin dashboard. All requests carry the admin Bearer token from localStorage.
// Redirects to /admin/login.html if the token is missing or a request comes back 401.

const REJECT_REASONS = {
  unreadable_document: 'Нечитаемое фото документа',
  underage: 'Нет 18 лет',
  fio_mismatch: 'ФИО не совпадает с документом',
};

function getToken() {
  return localStorage.getItem('adminToken');
}

async function adminFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    window.location.href = '/admin/login.html';
    throw new Error('no token');
  }
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login.html';
    throw new Error('unauthorized');
  }
  return res;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ---------------------------------------------------------------------
// 1. Верификация анкет
// ---------------------------------------------------------------------

async function loadRegistrations() {
  const status = document.getElementById('vStatusFilter').value;
  const tbody = document.getElementById('vTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">Загрузка…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/registrations?status=${status}`);
    const rows = await res.json();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">Пусто</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.guest?.phone)}</td>
        <td>${escapeHtml(r.guest?.fio)}</td>
        <td>${new Date(r.submittedAt).toLocaleString('ru-RU')}</td>
        <td>
          <a class="thumb-link" href="${r.documentPhotoUrl}" target="_blank" rel="noopener">документ</a> ·
          <a class="thumb-link" href="${r.selfiePhotoUrl}" target="_blank" rel="noopener">селфи</a>
        </td>
        <td>
          ${r.status === 'pending' ? `
            <div class="row-actions">
              <button class="btn btn-primary" data-approve="${r.id}">Одобрить</button>
              <select class="reject-reason" data-reject-select="${r.id}" style="background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); font-size:12px; padding:4px;">
                ${Object.entries(REJECT_REASONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
              </select>
              <button class="btn btn-ghost" data-reject="${r.id}">Отклонить</button>
            </div>
          ` : `<span class="badge">${r.status === 'approved' ? 'одобрено' : 'отклонено · ' + (REJECT_REASONS[r.rejectReason] || r.rejectReason || '')}</span>`}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-approve]').forEach(btn => {
      btn.addEventListener('click', () => reviewRegistration(btn.dataset.approve, 'approved'));
    });
    tbody.querySelectorAll('[data-reject]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.reject;
        const reason = tbody.querySelector(`[data-reject-select="${id}"]`).value;
        reviewRegistration(id, 'rejected', reason);
      });
    });
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--accent);">Не удалось загрузить</td></tr>';
    }
  }
}

async function reviewRegistration(id, status, rejectReason) {
  await adminFetch(`/api/admin/registrations/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, rejectReason }),
  });
  loadRegistrations();
}

// ---------------------------------------------------------------------
// 2. Домофон и коды
// ---------------------------------------------------------------------

const MAX_DOOR_CODES = 10;

function renderDoorCodeRows(codes) {
  const container = document.getElementById('accDoorCodes');
  container.innerHTML = '';
  const list = codes.length ? codes : [''];
  list.forEach((code) => addDoorCodeRow(code));
  updateAccAddCodeVisibility();
}

function addDoorCodeRow(value) {
  const container = document.getElementById('accDoorCodes');
  if (container.children.length >= MAX_DOOR_CODES) return;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:8px;';
  row.innerHTML = `
    <input type="text" class="acc-door-code" placeholder="1234567#" style="flex:1;" value="${(value || '').replace(/"/g, '&quot;')}">
    <button type="button" class="btn btn-ghost acc-door-code-remove" style="padding:6px 10px; font-size:13px;">×</button>
  `;
  row.querySelector('.acc-door-code-remove').addEventListener('click', () => {
    row.remove();
    if (!container.children.length) addDoorCodeRow('');
    updateAccAddCodeVisibility();
  });
  container.appendChild(row);
}

function updateAccAddCodeVisibility() {
  const container = document.getElementById('accDoorCodes');
  document.getElementById('accAddCode').style.display = container.children.length >= MAX_DOOR_CODES ? 'none' : '';
}

function collectDoorCodes() {
  return Array.from(document.querySelectorAll('.acc-door-code'))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

async function loadAccessCredential() {
  try {
    const res = await adminFetch('/api/admin/access-credential');
    const data = await res.json();
    if (data) {
      document.getElementById('accIntercom').value = data.intercomUrl || '';
      renderDoorCodeRows(Array.isArray(data.doorCodeMain) ? data.doorCodeMain : []);
    }
  } catch { /* handled by adminFetch redirect */ }
}

function initAccessForm() {
  document.getElementById('accAddCode').addEventListener('click', () => {
    addDoorCodeRow('');
    updateAccAddCodeVisibility();
  });

  document.getElementById('accessForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('accessStatus');
    try {
      const res = await adminFetch('/api/admin/access-credential', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intercomUrl: document.getElementById('accIntercom').value.trim(),
          doorCodeMain: collectDoorCodes(),
        }),
      });
      if (!res.ok) throw new Error();
      statusEl.textContent = 'Сохранено.';
      statusEl.className = 'status-msg show ok';
    } catch {
      statusEl.textContent = 'Не удалось сохранить.';
      statusEl.className = 'status-msg show err';
    }
  });
}

// ---------------------------------------------------------------------
// 3. Гости
// ---------------------------------------------------------------------

async function loadGuests(search) {
  const tbody = document.getElementById('gTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">Загрузка…</td></tr>';

  try {
    const url = search ? `/api/admin/guests?search=${encodeURIComponent(search)}` : '/api/admin/guests';
    const res = await adminFetch(url);
    const guests = await res.json();

    if (!guests.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">Никого не найдено</td></tr>';
      return;
    }

    tbody.innerHTML = guests.map(g => `
      <tr data-guest-row="${g.id}">
        <td><input type="tel" value="${escapeHtml(g.phone)}" data-field="phone" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px 7px; width:130px; font-size:12px;"></td>
        <td><input type="text" value="${escapeHtml(g.fio || '')}" data-field="fio" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px 7px; width:160px; font-size:12px;"></td>
        <td><input type="number" value="${g.bonusPoints}" data-field="bonusPoints" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px 7px; width:70px; font-size:12px;"></td>
        <td><span class="badge">${g.verification ? g.verification.status : 'нет анкеты'}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-primary" data-save-guest="${g.id}">Сохранить</button>
            <button class="btn btn-ghost" data-history-guest="${g.id}">История</button>
            <button class="btn btn-ghost" data-delete-guest="${g.id}">Удалить</button>
          </div>
        </td>
      </tr>
      <tr class="g-history-row" data-history-row="${g.id}" style="display:none;"><td colspan="5"></td></tr>
    `).join('');

    tbody.querySelectorAll('[data-save-guest]').forEach(btn => {
      btn.addEventListener('click', () => saveGuest(btn.dataset.saveGuest));
    });
    tbody.querySelectorAll('[data-delete-guest]').forEach(btn => {
      btn.addEventListener('click', () => deleteGuest(btn.dataset.deleteGuest));
    });
    tbody.querySelectorAll('[data-history-guest]').forEach(btn => {
      btn.addEventListener('click', () => toggleGuestHistory(btn.dataset.historyGuest));
    });
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--accent);">Не удалось загрузить</td></tr>';
    }
  }
}

const BALANCE_SOURCE_LABELS = {
  MANUAL_ADJUST: 'ручная корректировка', SESSION_CHARGE: 'списание за сессию',
  TOPUP: 'пополнение', REFUND: 'возврат', BONUS_ACCRUAL: 'начисление бонусов',
};

async function toggleGuestHistory(guestId) {
  const row = document.querySelector(`[data-history-row="${guestId}"]`);
  const isOpen = row.style.display !== 'none';
  if (isOpen) { row.style.display = 'none'; return; }
  row.style.display = '';
  row.querySelector('td').innerHTML = '<div style="color:var(--text-muted); padding:8px 0;">Загрузка…</div>';

  const [balanceRes, historyRes] = await Promise.all([
    adminFetch(`/api/guests/${guestId}/balance`),
    adminFetch(`/api/guests/${guestId}/balance/history`),
  ]);
  const balance = await balanceRes.json();
  const history = await historyRes.json();

  const historyRows = history.slice(0, 15).map(h => `
    <tr>
      <td style="font-family:ui-monospace,monospace; font-size:11px;">${new Date(h.createdAt).toLocaleString('ru-RU')}</td>
      <td>${h.kind === 'MONEY' ? '₽' : 'бонусы'}</td>
      <td style="color:${Number(h.amountDelta) >= 0 ? 'var(--ok, #4ADE9C)' : 'var(--accent)'};">${Number(h.amountDelta) >= 0 ? '+' : ''}${h.amountDelta}</td>
      <td>${h.balanceAfter}</td>
      <td>${BALANCE_SOURCE_LABELS[h.source] || h.source}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="color:var(--text-muted);">Пусто</td></tr>';

  row.querySelector('td').innerHTML = `
    <div style="padding:12px 0; background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:14px;">
      <div style="display:flex; gap:24px; margin-bottom:12px; font-size:13px;">
        <div>Баланс: <b>${balance.money} ₽</b></div>
        <div>Бонусы: <b>${balance.bonus}</b></div>
      </div>
      <div class="filter-row" style="margin-bottom:10px;">
        <select id="badj-kind-${guestId}"><option value="MONEY">₽ Деньги</option><option value="BONUS">Бонусы</option></select>
        <input type="number" id="badj-delta-${guestId}" placeholder="+ или -" style="width:100px;">
        <input type="text" id="badj-comment-${guestId}" placeholder="Комментарий" style="width:200px;">
        <button class="btn btn-primary" data-adjust-submit="${guestId}" style="padding:8px 14px; font-size:13px;">Применить</button>
      </div>
      <table class="admin-table">
        <thead><tr><th>Дата</th><th>Тип</th><th>Δ</th><th>Баланс после</th><th>Источник</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>`;

  row.querySelector(`[data-adjust-submit="${guestId}"]`).addEventListener('click', async () => {
    const kind = document.getElementById(`badj-kind-${guestId}`).value;
    const delta = Number(document.getElementById(`badj-delta-${guestId}`).value);
    const comment = document.getElementById(`badj-comment-${guestId}`).value.trim();
    if (!delta) return;
    await adminFetch(`/api/guests/${guestId}/balance/manual-adjust`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, delta, sourceChannel: 'ADMIN_CONSOLE', comment: comment || undefined }),
    });
    toggleGuestHistory(guestId); // закрыть
    toggleGuestHistory(guestId); // и переоткрыть — перезагрузит баланс/историю
  });
}

async function saveGuest(id) {
  const row = document.querySelector(`[data-guest-row="${id}"]`);
  const phone = row.querySelector('[data-field="phone"]').value.trim();
  const fio = row.querySelector('[data-field="fio"]').value.trim();
  const bonusPoints = Number(row.querySelector('[data-field="bonusPoints"]').value);

  await adminFetch(`/api/admin/guests/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, fio, bonusPoints }),
  });
}

async function deleteGuest(id) {
  if (!confirm('Удалить гостя и всю его историю? Действие необратимо.')) return;
  await adminFetch(`/api/admin/guests/${id}`, { method: 'DELETE' });
  loadGuests(document.getElementById('gSearch').value.trim());
}

function initGuestsTab() {
  document.getElementById('gSearchBtn').addEventListener('click', () => {
    loadGuests(document.getElementById('gSearch').value.trim());
  });

  const addForm = document.getElementById('gAddForm');
  document.getElementById('gAddBtn').addEventListener('click', () => {
    addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('gAddSubmit').addEventListener('click', async () => {
    const phone = document.getElementById('gNewPhone').value.trim();
    const fio = document.getElementById('gNewFio').value.trim();
    if (!phone) return;

    await adminFetch('/api/admin/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, fio }),
    });

    document.getElementById('gNewPhone').value = '';
    document.getElementById('gNewFio').value = '';
    addForm.style.display = 'none';
    loadGuests();
  });
}

// ---------------------------------------------------------------------
// Общие справочники (клуб/зоны/тарифы) — нужны нескольким вкладкам сразу
// ---------------------------------------------------------------------

let CLUB_ID = null;
let ZONES_CACHE = [];
let TARIFFS_CACHE = [];
let TARIFF_GROUPS_CACHE = [];
let DAY_TYPES_CACHE = [];
let currentRulesTariffId = null;

const DEVICE_STATUS_LABELS = {
  FREE: 'Свободно', BUSY: 'Занято', CONNECTING: 'Подключение',
  TECH_MODE: 'Тех.режим', LOCKED: 'Заблокировано', DISABLED: 'Отключено',
};
const TARIFF_TYPE_LABELS = { BASE: 'Базовый', PACKAGE: 'Пакет', SUBSCRIPTION: 'Абонемент' };
const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function minutesToHHMM(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

async function loadCommonCaches() {
  const clubsRes = await adminFetch('/api/clubs');
  const clubs = await clubsRes.json();
  CLUB_ID = clubs[0]?.id || null;

  const [zonesRes, tariffsRes, groupsRes, dayTypesRes] = await Promise.all([
    adminFetch(`/api/zones?clubId=${CLUB_ID}`),
    adminFetch('/api/tariffs'),
    adminFetch(`/api/tariff-groups?clubId=${CLUB_ID}`),
    adminFetch(`/api/day-types?clubId=${CLUB_ID}`),
  ]);
  ZONES_CACHE = await zonesRes.json();
  TARIFFS_CACHE = await tariffsRes.json();
  TARIFF_GROUPS_CACHE = await groupsRes.json();
  DAY_TYPES_CACHE = await dayTypesRes.json();
}

// ---------------------------------------------------------------------
// Устройства
// ---------------------------------------------------------------------

function populateZoneSelects() {
  const opts = ZONES_CACHE.map(z => `<option value="${z.id}">${escapeHtml(z.nameRu)}</option>`).join('');
  document.getElementById('dZoneFilter').innerHTML = '<option value="">Все зоны</option>' + opts;
  document.getElementById('dNewZone').innerHTML = opts;
  document.getElementById('trNewZone').innerHTML = opts;
}

async function loadDevices() {
  const tbody = document.getElementById('dTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);">Загрузка…</td></tr>';
  const zoneId = document.getElementById('dZoneFilter').value;
  const status = document.getElementById('dStatusFilter').value;
  const params = new URLSearchParams();
  if (zoneId) params.set('zoneId', zoneId);
  if (status) params.set('status', status);

  try {
    const res = await adminFetch(`/api/devices?${params.toString()}`);
    const devices = await res.json();
    if (!devices.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);">Пусто</td></tr>';
      return;
    }
    tbody.innerHTML = devices.map(d => {
      const zone = ZONES_CACHE.find(z => z.id === d.zoneId);
      const statusOpts = Object.entries(DEVICE_STATUS_LABELS)
        .map(([k, v]) => `<option value="${k}" ${k === d.status ? 'selected' : ''}>${v}</option>`).join('');
      return `
        <tr data-device-row="${d.id}">
          <td>${escapeHtml(zone?.nameRu || '—')}</td>
          <td>${escapeHtml(d.name)}</td>
          <td>${d.cardNumber}</td>
          <td><select class="d-status-select" data-device-id="${d.id}" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px; font-size:12px;">${statusOpts}</select></td>
          <td>
            ${d.hasAgentToken
              ? `<span class="badge" style="color:var(--ok, #4ADE9C);">выдан</span> <button class="btn btn-ghost" data-revoke-token="${d.id}" style="font-size:11px; padding:4px 8px;">Отозвать</button>`
              : `<button class="btn btn-primary" data-issue-token="${d.id}" style="font-size:11px; padding:4px 8px;">Выдать токен</button>`}
          </td>
          <td>
            <div class="row-actions">
              <button class="btn btn-ghost" data-delete-device="${d.id}">Удалить</button>
            </div>
          </td>
        </tr>
        <tr class="d-token-row" data-token-row="${d.id}" style="display:none;"><td colspan="6"></td></tr>
      `;
    }).join('');

    tbody.querySelectorAll('.d-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        await adminFetch(`/api/devices/${sel.dataset.deviceId}/status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: sel.value }),
        });
      });
    });
    tbody.querySelectorAll('[data-issue-token]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.issueToken;
        const res = await adminFetch(`/api/devices/${id}/agent-token`, { method: 'POST' });
        const data = await res.json();
        const tokenRow = tbody.querySelector(`[data-token-row="${id}"]`);
        tokenRow.style.display = '';
        tokenRow.querySelector('td').innerHTML = `
          <div style="background:var(--panel); border:1px solid var(--accent); border-radius:8px; padding:10px 12px; font-size:12px;">
            Токен станции (показывается один раз, вставьте его в настройку pc-widget.html): <br>
            <code style="user-select:all; word-break:break-all;">${escapeHtml(data.agentToken)}</code>
          </div>`;
        loadDevices();
      });
    });
    tbody.querySelectorAll('[data-revoke-token]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Отозвать токен? Станция перестанет авторизовываться, пока не будет выпущен новый.')) return;
        await adminFetch(`/api/devices/${btn.dataset.revokeToken}/agent-token`, { method: 'DELETE' });
        loadDevices();
      });
    });
    tbody.querySelectorAll('[data-delete-device]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить устройство?')) return;
        await adminFetch(`/api/devices/${btn.dataset.deleteDevice}`, { method: 'DELETE' });
        loadDevices();
      });
    });
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--accent);">Не удалось загрузить</td></tr>';
    }
  }
}

function initDevicesTab() {
  document.getElementById('dRefresh').addEventListener('click', loadDevices);
  document.getElementById('dZoneFilter').addEventListener('change', loadDevices);
  document.getElementById('dStatusFilter').addEventListener('change', loadDevices);

  const addForm = document.getElementById('dAddForm');
  document.getElementById('dAddBtn').addEventListener('click', () => {
    addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('dAddSubmit').addEventListener('click', async () => {
    const zoneId = document.getElementById('dNewZone').value;
    const name = document.getElementById('dNewName').value.trim();
    const cardNumber = Number(document.getElementById('dNewCard').value);
    const kind = document.getElementById('dNewKind').value;
    const mac = document.getElementById('dNewMac').value.trim();
    if (!zoneId || !name || !cardNumber) return;

    await adminFetch('/api/devices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: CLUB_ID, zoneId, name, cardNumber, kind, mac: mac || undefined }),
    });
    document.getElementById('dNewName').value = '';
    document.getElementById('dNewCard').value = '';
    document.getElementById('dNewMac').value = '';
    addForm.style.display = 'none';
    loadDevices();
  });
}

// ---------------------------------------------------------------------
// Зоны
// ---------------------------------------------------------------------

async function loadZones() {
  const tbody = document.getElementById('zTableBody');
  tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);">Загрузка…</td></tr>';
  try {
    const res = await adminFetch(`/api/zones?clubId=${CLUB_ID}`);
    ZONES_CACHE = await res.json();
    populateZoneSelects();

    if (!ZONES_CACHE.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);">Пусто</td></tr>';
      return;
    }
    const tariffOpts = '<option value="">— не выбран —</option>' +
      TARIFFS_CACHE.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');

    tbody.innerHTML = ZONES_CACHE.map(z => `
      <tr data-zone-row="${z.id}">
        <td>${escapeHtml(z.nameRu)}</td>
        <td>${z.isRoom ? 'да' : 'нет'}</td>
        <td>
          <select class="z-default-tariff" data-zone-id="${z.id}" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px; font-size:12px;">
            ${tariffOpts}
          </select>
        </td>
        <td><div class="row-actions"><button class="btn btn-ghost" data-delete-zone="${z.id}">Удалить</button></div></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.z-default-tariff').forEach(sel => {
      const z = ZONES_CACHE.find(zz => zz.id === sel.dataset.zoneId);
      if (z?.defaultTariffId) sel.value = z.defaultTariffId;
      sel.addEventListener('change', async () => {
        await adminFetch(`/api/zones/${sel.dataset.zoneId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultTariffId: sel.value || null }),
        });
      });
    });
    tbody.querySelectorAll('[data-delete-zone]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить зону? Устройства в ней нужно удалить/перенести отдельно.')) return;
        await adminFetch(`/api/zones/${btn.dataset.deleteZone}`, { method: 'DELETE' });
        loadZones();
      });
    });
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--accent);">Не удалось загрузить</td></tr>';
    }
  }
}

function initZonesTab() {
  const addForm = document.getElementById('zAddForm');
  document.getElementById('zAddBtn').addEventListener('click', () => {
    addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('zAddSubmit').addEventListener('click', async () => {
    const nameRu = document.getElementById('zNewName').value.trim();
    const isRoom = document.getElementById('zNewIsRoom').checked;
    if (!nameRu) return;
    await adminFetch('/api/zones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: CLUB_ID, nameRu, isRoom }),
    });
    document.getElementById('zNewName').value = '';
    document.getElementById('zNewIsRoom').checked = false;
    addForm.style.display = 'none';
    loadZones();
  });
}

// ---------------------------------------------------------------------
// Тарифы (типы дней / группы / тарифы / правила цен)
// ---------------------------------------------------------------------

async function loadDayTypes() {
  const tbody = document.getElementById('dtTableBody');
  const res = await adminFetch(`/api/day-types?clubId=${CLUB_ID}`);
  DAY_TYPES_CACHE = await res.json();
  document.getElementById('trNewDayType').innerHTML =
    DAY_TYPES_CACHE.map(dt => `<option value="${dt.id}">${escapeHtml(dt.name)}</option>`).join('');

  if (!DAY_TYPES_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }
  tbody.innerHTML = DAY_TYPES_CACHE.map(dt => `
    <tr><td>${escapeHtml(dt.name)}</td><td>${dt.weekdays.map(w => WEEKDAY_LABELS[w]).join(', ')}</td></tr>
  `).join('');
}

function initDayTypesForm() {
  document.getElementById('dtAddSubmit').addEventListener('click', async () => {
    const name = document.getElementById('dtNewName').value.trim();
    const weekdays = Array.from(document.querySelectorAll('.dt-weekday:checked')).map(cb => Number(cb.value));
    if (!name || !weekdays.length) return;
    await adminFetch('/api/day-types', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: CLUB_ID, name, weekdays }),
    });
    document.getElementById('dtNewName').value = '';
    document.querySelectorAll('.dt-weekday').forEach(cb => cb.checked = false);
    loadDayTypes();
  });
}

async function loadTariffGroups() {
  const tbody = document.getElementById('tgTableBody');
  const res = await adminFetch(`/api/tariff-groups?clubId=${CLUB_ID}`);
  TARIFF_GROUPS_CACHE = await res.json();
  document.getElementById('tNewGroup').innerHTML =
    TARIFF_GROUPS_CACHE.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

  if (!TARIFF_GROUPS_CACHE.length) {
    tbody.innerHTML = '<tr><td style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }
  tbody.innerHTML = TARIFF_GROUPS_CACHE.map(g => `<tr><td>${escapeHtml(g.name)}</td></tr>`).join('');
}

function initTariffGroupsForm() {
  document.getElementById('tgAddSubmit').addEventListener('click', async () => {
    const name = document.getElementById('tgNewName').value.trim();
    if (!name) return;
    await adminFetch('/api/tariff-groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: CLUB_ID, name }),
    });
    document.getElementById('tgNewName').value = '';
    loadTariffGroups();
  });
}

async function loadTariffs() {
  const tbody = document.getElementById('tTableBody');
  const res = await adminFetch('/api/tariffs');
  TARIFFS_CACHE = await res.json();

  if (!TARIFFS_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }
  tbody.innerHTML = TARIFFS_CACHE.map(t => {
    const group = TARIFF_GROUPS_CACHE.find(g => g.id === t.groupId);
    return `
      <tr>
        <td>${escapeHtml(group?.name || '—')}</td>
        <td>${TARIFF_TYPE_LABELS[t.type] || t.type}</td>
        <td>${escapeHtml(t.name)}</td>
        <td><button class="btn btn-ghost" data-manage-rules="${t.id}" data-tariff-name="${escapeHtml(t.name)}">Правила цен</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-manage-rules]').forEach(btn => {
    btn.addEventListener('click', () => openRulesPanel(btn.dataset.manageRules, btn.dataset.tariffName));
  });
}

function initTariffsForm() {
  document.getElementById('tNewType').addEventListener('change', (e) => {
    document.getElementById('tNewPackageMinWrap').style.display = e.target.value === 'PACKAGE' ? '' : 'none';
  });
  document.getElementById('tAddSubmit').addEventListener('click', async () => {
    const groupId = document.getElementById('tNewGroup').value;
    const type = document.getElementById('tNewType').value;
    const name = document.getElementById('tNewName').value.trim();
    const packageDurationMin = Number(document.getElementById('tNewPackageMin').value) || undefined;
    if (!groupId || !name) return;
    await adminFetch('/api/tariffs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, type, name, packageDurationMin: type === 'PACKAGE' ? packageDurationMin : undefined }),
    });
    document.getElementById('tNewName').value = '';
    document.getElementById('tNewPackageMin').value = '';
    loadTariffs();
  });
}

function openRulesPanel(tariffId, tariffName) {
  currentRulesTariffId = tariffId;
  document.getElementById('trPanel').style.display = '';
  document.getElementById('trTariffName').textContent = tariffName;
  loadTariffRules();
}

async function loadTariffRules() {
  const tbody = document.getElementById('trTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);">Загрузка…</td></tr>';
  const res = await adminFetch(`/api/tariff-rules?tariffId=${currentRulesTariffId}`);
  const rules = await res.json();

  if (!rules.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);">Пусто — добавьте правило ниже</td></tr>';
    return;
  }
  tbody.innerHTML = rules.map(r => {
    const zone = ZONES_CACHE.find(z => z.id === r.zoneId);
    const dayType = DAY_TYPES_CACHE.find(dt => dt.id === r.dayTypeId);
    return `
      <tr>
        <td>${escapeHtml(zone?.nameRu || '—')}</td>
        <td>${escapeHtml(dayType?.name || '—')}</td>
        <td>${minutesToHHMM(r.startMinute)}</td>
        <td>${minutesToHHMM(r.endMinute)}</td>
        <td>${Number(r.pricePerMinute).toFixed(2)}</td>
        <td>${Math.round(Number(r.pricePerMinute) * 60)}</td>
        <td><button class="btn btn-ghost" data-delete-rule="${r.id}">Удалить</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-delete-rule]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminFetch(`/api/tariff-rules/${btn.dataset.deleteRule}`, { method: 'DELETE' });
      loadTariffRules();
    });
  });
}

function initTariffRulesForm() {
  document.getElementById('trAddSubmit').addEventListener('click', async () => {
    if (!currentRulesTariffId) return;
    const zoneId = document.getElementById('trNewZone').value;
    const dayTypeId = document.getElementById('trNewDayType').value;
    const startMinute = hhmmToMinutes(document.getElementById('trNewStart').value);
    const endMinute = hhmmToMinutes(document.getElementById('trNewEnd').value);
    const pricePerMinute = Number(document.getElementById('trNewPrice').value);
    if (!zoneId || !dayTypeId || !pricePerMinute) return;
    await adminFetch('/api/tariff-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tariffId: currentRulesTariffId, zoneId, dayTypeId, startMinute, endMinute, pricePerMinute }),
    });
    document.getElementById('trNewPrice').value = '';
    loadTariffRules();
  });
}

// ---------------------------------------------------------------------
// Лояльность
// ---------------------------------------------------------------------

async function loadLoyaltyTiers() {
  const tbody = document.getElementById('ltTableBody');
  const res = await adminFetch('/api/loyalty/tiers');
  const tiers = await res.json();
  if (!tiers.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }
  tbody.innerHTML = tiers.map(t => `
    <tr>
      <td>${escapeHtml(t.name)}</td>
      <td>${t.minHours}</td>
      <td>${t.maxHours ?? '∞'}</td>
      <td>${t.discountPercent ?? 0}%</td>
      <td>${t.cashbackPercent ?? 0}%</td>
    </tr>
  `).join('');
}

function initLoyaltyTiersForm() {
  document.getElementById('ltAddSubmit').addEventListener('click', async () => {
    const name = document.getElementById('ltNewName').value.trim();
    const minHours = Number(document.getElementById('ltNewMinHours').value) || 0;
    const maxHoursRaw = document.getElementById('ltNewMaxHours').value;
    const discountPercent = Number(document.getElementById('ltNewDiscount').value) || 0;
    const cashbackPercent = Number(document.getElementById('ltNewCashback').value) || 0;
    if (!name) return;
    await adminFetch('/api/loyalty/tiers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, minHours, discountPercent, cashbackPercent,
        maxHours: maxHoursRaw ? Number(maxHoursRaw) : undefined,
      }),
    });
    document.getElementById('ltNewName').value = '';
    document.getElementById('ltNewMinHours').value = '0';
    document.getElementById('ltNewMaxHours').value = '';
    document.getElementById('ltNewDiscount').value = '0';
    document.getElementById('ltNewCashback').value = '0';
    loadLoyaltyTiers();
  });
}

async function loadManualGroups() {
  const tbody = document.getElementById('mgTableBody');
  const res = await adminFetch('/api/loyalty/manual-groups');
  const groups = await res.json();
  if (!groups.length) {
    tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }
  tbody.innerHTML = groups.map(g => `<tr><td>${escapeHtml(g.name)}</td><td>${g.discountPercent ?? 0}%</td></tr>`).join('');
}

function initManualGroupsForm() {
  document.getElementById('mgAddSubmit').addEventListener('click', async () => {
    const name = document.getElementById('mgNewName').value.trim();
    const discountPercent = Number(document.getElementById('mgNewDiscount').value) || 0;
    if (!name) return;
    await adminFetch('/api/loyalty/manual-groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, discountPercent }),
    });
    document.getElementById('mgNewName').value = '';
    document.getElementById('mgNewDiscount').value = '';
    loadManualGroups();
  });
}

async function loadAutoBonusRules() {
  const tbody = document.getElementById('abTableBody');
  const res = await adminFetch('/api/loyalty/auto-bonus-rules');
  const rules = await res.json();
  if (!rules.length) {
    tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }
  const triggerLabels = { REGISTRATION: 'Регистрация', TOPUP: 'Пополнение' };
  tbody.innerHTML = rules.map(r => `
    <tr>
      <td>${triggerLabels[r.trigger] || r.trigger}</td>
      <td>${r.rewardType === 'PERCENT' ? r.rewardValue + '%' : r.rewardValue + ' ₽'}</td>
    </tr>
  `).join('');
}

function initAutoBonusForm() {
  document.getElementById('abAddSubmit').addEventListener('click', async () => {
    const trigger = document.getElementById('abNewTrigger').value;
    const rewardType = document.getElementById('abNewRewardType').value;
    const rewardValue = Number(document.getElementById('abNewRewardValue').value);
    if (!rewardValue) return;
    await adminFetch('/api/loyalty/auto-bonus-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: CLUB_ID, trigger, rewardType, rewardValue }),
    });
    document.getElementById('abNewRewardValue').value = '';
    loadAutoBonusRules();
  });
}

// ---------------------------------------------------------------------
// 4. Статистика
// ---------------------------------------------------------------------

async function loadAnalytics() {
  const from = document.getElementById('aFrom').value;
  const to = document.getElementById('aTo').value;
  const tbody = document.getElementById('aTableBody');
  tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);">Загрузка…</td></tr>';

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const res = await adminFetch(`/api/admin/analytics?${params.toString()}`);
    const data = await res.json();

    if (!data.events?.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);">Нет данных за период</td></tr>';
      return;
    }

    tbody.innerHTML = data.events.map(e => `
      <tr><td>${escapeHtml(e.source)}</td><td>${escapeHtml(e.step)}</td><td>${e._count}</td></tr>
    `).join('');
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      tbody.innerHTML = '<tr><td colspan="3" style="color:var(--accent);">Не удалось загрузить</td></tr>';
    }
  }
}

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    window.location.href = '/admin/login.html';
    return;
  }

  initTabs();
  initAccessForm();
  initGuestsTab();
  initDevicesTab();
  initZonesTab();
  initDayTypesForm();
  initTariffGroupsForm();
  initTariffsForm();
  initTariffRulesForm();
  initLoyaltyTiersForm();
  initManualGroupsForm();
  initAutoBonusForm();

  document.getElementById('vStatusFilter').addEventListener('change', loadRegistrations);
  document.getElementById('vRefresh').addEventListener('click', loadRegistrations);
  document.getElementById('aRefresh').addEventListener('click', loadAnalytics);

  document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' });
    } catch { /* ignore */ }
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login.html';
  });

  loadRegistrations();
  loadAccessCredential();
  loadGuests();

  try {
    await loadCommonCaches();
    populateZoneSelects();
    loadDevices();
    loadZones();
    loadDayTypes();
    loadTariffGroups();
    loadTariffs();
    loadLoyaltyTiers();
    loadManualGroups();
    loadAutoBonusRules();
  } catch { /* handled by adminFetch redirect */ }
});
