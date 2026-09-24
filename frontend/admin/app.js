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

// Токен станции хранится без разделителя (8 симв.), дефис только для
// удобства чтения/диктовки — виджет на ПК сам убирает нецифро-буквенные
// символы при вводе, так что формат при копировании не важен.
function formatStationToken(token) {
  return token.length === 8 ? `${token.slice(0, 4)}-${token.slice(4)}` : token;
}

// ---------------------------------------------------------------------
// Разделы (боковое меню вместо ряда вкладок)
// ---------------------------------------------------------------------

function initTabs() {
  const menu = document.getElementById('sideMenu');
  const backdrop = document.getElementById('sideMenuBackdrop');
  const toggle = document.getElementById('menuToggle');

  const closeMenu = () => { menu.classList.remove('open'); backdrop.classList.remove('open'); };
  const openMenu = () => { menu.classList.add('open'); backdrop.classList.add('open'); };

  toggle.addEventListener('click', () => {
    menu.classList.contains('open') ? closeMenu() : openMenu();
  });
  backdrop.addEventListener('click', closeMenu);

  document.querySelectorAll('.side-menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.side-menu-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      closeMenu();
    });
  });

  // Подвкладки внутри "Тарифы" (Типы дней / Группы тарифов / Базовый тариф / Пакеты).
  // trPanel ("Правила цен") общий для "Группы тарифов" и "Пакеты" и физически
  // вынесен за пределы subtab-panel — при уходе на другую подвкладку прячем
  // его и сбрасываем выбор пакета, чтобы не оставалось "прилипшего" состояния.
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.subtab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('subtab-' + btn.dataset.subtab).classList.add('active');
      document.getElementById('trPanel').style.display = 'none';
      const pkgSelect = document.getElementById('pkgTariffSelect');
      if (pkgSelect) pkgSelect.value = '';
    });
  });
}

// ---------------------------------------------------------------------
// 1. Верификация анкет
// ---------------------------------------------------------------------

async function loadRegistrations() {
  const status = document.getElementById('vStatusFilter').value;
  const tbody = document.getElementById('vTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);">Загрузка…</td></tr>';

  try {
    const res = await adminFetch(`/api/admin/registrations?status=${status}`);
    const rows = await res.json();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);">Пусто</td></tr>';
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
        <td>${r.doorCode ? escapeHtml(r.doorCode) : '<span style="color:var(--text-muted);">—</span>'}</td>
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
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--accent);">Не удалось загрузить</td></tr>';
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

// Бэкенду (PUT /api/admin/access-credential) нужны оба поля разом, так что
// обе кнопки шлют один и тот же полный запрос с текущими значениями формы —
// разница только в том, какую кнопку нажал админ и куда пишется статус.
async function saveAccessCredential(statusElId) {
  const statusEl = document.getElementById(statusElId);
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
}

function initAccessForm() {
  document.getElementById('accAddCode').addEventListener('click', () => {
    addDoorCodeRow('');
    updateAccAddCodeVisibility();
  });

  document.getElementById('accIntercomSave').addEventListener('click', () => {
    saveAccessCredential('accIntercomStatus');
  });

  document.getElementById('accessForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveAccessCredential('accessStatus');
  });
}

// ---------------------------------------------------------------------
// 3. Гости
// ---------------------------------------------------------------------

const SELECT_STYLE = 'background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px 7px; font-size:12px;';

function loyaltySelectOptions(items, selectedId) {
  return '<option value="">— нет —</option>' +
    items.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('');
}

async function loadGuests(search) {
  const tbody = document.getElementById('gTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="color:var(--text-muted);">Загрузка…</td></tr>';

  try {
    const url = search ? `/api/admin/guests?search=${encodeURIComponent(search)}` : '/api/admin/guests';
    const [res] = await Promise.all([
      adminFetch(url),
      TIERS_CACHE.length ? Promise.resolve() : loadLoyaltyTiers(),
      MANUAL_GROUPS_CACHE.length ? Promise.resolve() : loadManualGroups(),
    ]);
    const guests = await res.json();

    if (!guests.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--text-muted);">Никого не найдено</td></tr>';
      return;
    }

    tbody.innerHTML = guests.map(g => `
      <tr data-guest-row="${g.id}">
        <td><input type="tel" value="${escapeHtml(g.phone)}" data-field="phone" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px 7px; width:130px; font-size:12px;"></td>
        <td><input type="text" value="${escapeHtml(g.fio || '')}" data-field="fio" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px 7px; width:160px; font-size:12px;"></td>
        <td><input type="number" value="${g.bonusPoints}" data-field="bonusPoints" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px 7px; width:70px; font-size:12px;"></td>
        <td>${g.doorCode
          ? escapeHtml(g.doorCode)
          : `<button class="btn btn-ghost" data-assign-door-code="${g.id}" style="padding:4px 8px; font-size:12px;">Назначить код</button>`
        }</td>
        <td><select class="g-manual-group" data-field="manualGroupId" style="${SELECT_STYLE} width:130px;">${loyaltySelectOptions(MANUAL_GROUPS_CACHE, g.manualGroupId)}</select></td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            <select class="g-tier" data-field="tierId" style="${SELECT_STYLE} width:130px;">${loyaltySelectOptions(TIERS_CACHE, g.tierId)}</select>
            <button class="btn btn-ghost" data-recalc-tier="${g.id}" title="Пересчитать автоматически по отыгранным часам" style="padding:4px 6px; font-size:11px;">↻</button>
          </div>
        </td>
        <td><span class="badge">${g.verification ? g.verification.status : 'нет анкеты'}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-primary" data-save-guest="${g.id}">Сохранить</button>
            <button class="btn btn-ghost" data-history-guest="${g.id}">История</button>
            <button class="btn btn-ghost" data-delete-guest="${g.id}">Удалить</button>
          </div>
        </td>
      </tr>
      <tr class="g-history-row" data-history-row="${g.id}" style="display:none;"><td colspan="8"></td></tr>
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
    tbody.querySelectorAll('[data-assign-door-code]').forEach(btn => {
      btn.addEventListener('click', () => assignDoorCode(btn.dataset.assignDoorCode));
    });
    tbody.querySelectorAll('[data-recalc-tier]').forEach(btn => {
      btn.addEventListener('click', () => recalcGuestTier(btn.dataset.recalcTier));
    });
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--accent);">Не удалось загрузить</td></tr>';
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
  const manualGroupId = row.querySelector('[data-field="manualGroupId"]').value || null;
  const tierId = row.querySelector('[data-field="tierId"]').value || null;

  const [profileRes, groupRes, tierRes] = await Promise.all([
    adminFetch(`/api/admin/guests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, fio, bonusPoints }),
    }),
    adminFetch(`/api/guests/${id}/manual-group`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualGroupId }),
    }),
    adminFetch(`/api/guests/${id}/tier`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tierId }),
    }),
  ]);

  const failed = [profileRes, groupRes, tierRes].find((res) => !res.ok);
  if (failed) {
    const data = await failed.json().catch(() => null);
    alert(data?.error || 'Не удалось сохранить гостя — проверьте данные (например, телефон может быть занят другим гостем).');
  }
  loadGuests(document.getElementById('gSearch').value.trim());
}

async function recalcGuestTier(id) {
  await adminFetch(`/api/guests/${id}/loyalty/recalculate`, { method: 'POST' });
  loadGuests(document.getElementById('gSearch').value.trim());
}

async function assignDoorCode(id) {
  try {
    const res = await adminFetch(`/api/admin/guests/${id}/assign-door-code`, { method: 'POST' });
    if (!res.ok) {
      alert('Не удалось назначить код — возможно, в клубе ещё не задано ни одного кода двери (вкладка «Домофон и коды»).');
      return;
    }
    loadGuests(document.getElementById('gSearch').value.trim());
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      alert('Не удалось назначить код.');
    }
  }
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
let TIERS_CACHE = [];
let MANUAL_GROUPS_CACHE = [];
let currentRulesTariffId = null;

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
  document.getElementById('trEditZone').innerHTML = opts;
}

async function loadDevices() {
  const tbody = document.getElementById('dTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">Загрузка…</td></tr>';
  const zoneId = document.getElementById('dZoneFilter').value;
  const params = new URLSearchParams();
  if (zoneId) params.set('zoneId', zoneId);

  try {
    const res = await adminFetch(`/api/devices?${params.toString()}`);
    const devices = await res.json();
    if (!devices.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">Пусто</td></tr>';
      return;
    }
    tbody.innerHTML = devices.map(d => {
      const zoneOpts = ZONES_CACHE
        .map(z => `<option value="${z.id}" ${z.id === d.zoneId ? 'selected' : ''}>${escapeHtml(z.nameRu)}</option>`).join('');
      return `
        <tr data-device-row="${d.id}">
          <td><select class="d-zone-select" data-device-id="${d.id}" style="background:var(--bg); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:5px; font-size:12px;">${zoneOpts}</select></td>
          <td>${escapeHtml(d.name)}</td>
          <td>${d.cardNumber}</td>
          <td>
            ${d.agentToken
              ? `<code style="font-size:13px; letter-spacing:0.05em; user-select:all;">${escapeHtml(formatStationToken(d.agentToken))}</code>
                 <div class="row-actions" style="margin-top:4px;">
                   <button class="btn btn-ghost" data-copy-token="${escapeHtml(d.agentToken)}" style="font-size:11px; padding:4px 8px;">Копировать</button>
                   <button class="btn btn-ghost" data-revoke-token="${d.id}" style="font-size:11px; padding:4px 8px;">Отозвать</button>
                 </div>`
              : `<button class="btn btn-primary" data-issue-token="${d.id}" style="font-size:11px; padding:4px 8px;">Выдать токен</button>`}
          </td>
          <td>
            <div class="row-actions">
              <button class="btn btn-ghost" data-delete-device="${d.id}">Удалить</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.d-zone-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const res = await adminFetch(`/api/devices/${sel.dataset.deviceId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoneId: sel.value }),
        });
        if (!res.ok) {
          alert('Не удалось перенести устройство в другую зону.');
          loadDevices();
          return;
        }
        loadDevices();
      });
    });
    tbody.querySelectorAll('[data-issue-token]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await adminFetch(`/api/devices/${btn.dataset.issueToken}/agent-token`, { method: 'POST' });
        loadDevices();
      });
    });
    tbody.querySelectorAll('[data-copy-token]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copyToken);
          const original = btn.textContent;
          btn.textContent = 'Скопировано!';
          setTimeout(() => { btn.textContent = original; }, 1500);
        } catch {
          alert('Не удалось скопировать — выделите токен вручную.');
        }
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
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--accent);">Не удалось загрузить</td></tr>';
    }
  }
}

function initDevicesTab() {
  document.getElementById('dRefresh').addEventListener('click', loadDevices);
  document.getElementById('dZoneFilter').addEventListener('change', loadDevices);

  const addForm = document.getElementById('dAddForm');
  document.getElementById('dAddBtn').addEventListener('click', () => {
    addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('dAddSubmit').addEventListener('click', async () => {
    const zoneId = document.getElementById('dNewZone').value;
    const name = document.getElementById('dNewName').value.trim();
    const mac = document.getElementById('dNewMac').value.trim();
    if (!zoneId || !name) return;

    await adminFetch('/api/devices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: CLUB_ID, zoneId, name, mac: mac || undefined }),
    });
    document.getElementById('dNewName').value = '';
    document.getElementById('dNewMac').value = '';
    addForm.style.display = 'none';
    loadDevices();
  });
}

// ---------------------------------------------------------------------
// Зоны
// ---------------------------------------------------------------------

let zoneEditingId = null;

async function loadZones() {
  const tbody = document.getElementById('zTableBody');
  tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);">Загрузка…</td></tr>';
  try {
    const res = await adminFetch(`/api/zones?clubId=${CLUB_ID}`);
    ZONES_CACHE = await res.json();
    populateZoneSelects();
    renderZonesTable();
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--accent);">Не удалось загрузить</td></tr>';
    }
  }
}

const ZONE_ARROW_STYLE = 'background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:9px; padding:0; line-height:1;';

function renderZonesTable() {
  const tbody = document.getElementById('zTableBody');
  if (!ZONES_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }

  tbody.innerHTML = ZONES_CACHE.map((z, i) => {
    const nameCell = z.id === zoneEditingId
      ? `<input type="text" class="z-edit-name" value="${escapeHtml(z.nameRu)}" style="${SELECT_STYLE} width:110px;">`
      : escapeHtml(z.nameRu);
    const arrows = `
      <div style="display:flex; flex-direction:column;">
        <button type="button" data-move-up="${z.id}" title="Выше" style="${ZONE_ARROW_STYLE}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" data-move-down="${z.id}" title="Ниже" style="${ZONE_ARROW_STYLE}" ${i === ZONES_CACHE.length - 1 ? 'disabled' : ''}>▼</button>
      </div>`;
    const nameEnCell = z.id === zoneEditingId
      ? `<input type="text" class="z-edit-nameEn" value="${escapeHtml(z.nameEn || '')}" style="${SELECT_STYLE} width:110px;">`
      : escapeHtml(z.nameEn || '—');
    const colorCell = `<input type="color" class="z-color-picker" data-zone-id="${z.id}" value="${escapeHtml(z.color)}" style="width:40px; height:30px; padding:2px; border:1px solid var(--border); border-radius:5px; background:var(--bg); cursor:pointer;">`;
    const actionsCell = z.id === zoneEditingId
      ? `<div class="row-actions">
          <button class="btn btn-ghost" data-save-zone="${z.id}" title="Сохранить" style="padding:4px 8px; color:#4ADE9C;">✓</button>
          <button class="btn btn-ghost" data-cancel-zone="${z.id}" title="Отмена" style="padding:4px 8px; color:var(--accent);">✗</button>
        </div>`
      : `<div class="row-actions">
          <button class="btn btn-ghost" data-edit-zone="${z.id}" title="Редактировать" style="padding:4px 8px;">✎</button>
          <button class="btn btn-ghost" data-delete-zone="${z.id}" title="Удалить" style="padding:4px 8px;">🗑</button>
        </div>`;

    return `
      <tr data-zone-row="${z.id}">
        <td><div style="display:flex; align-items:center; gap:8px;">${arrows}<span>${nameCell}</span></div></td>
        <td>${nameEnCell}</td>
        <td>${colorCell}</td>
        <td>${actionsCell}</td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-move-up]').forEach(btn => {
    btn.addEventListener('click', () => moveZone(btn.dataset.moveUp, 'up'));
  });
  tbody.querySelectorAll('[data-move-down]').forEach(btn => {
    btn.addEventListener('click', () => moveZone(btn.dataset.moveDown, 'down'));
  });
  tbody.querySelectorAll('.z-color-picker').forEach(input => {
    input.addEventListener('change', async () => {
      await adminFetch(`/api/zones/${input.dataset.zoneId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: input.value }),
      });
      const zone = ZONES_CACHE.find(zz => zz.id === input.dataset.zoneId);
      if (zone) zone.color = input.value;
    });
  });
  tbody.querySelectorAll('[data-edit-zone]').forEach(btn => {
    btn.addEventListener('click', () => {
      zoneEditingId = btn.dataset.editZone;
      renderZonesTable();
    });
  });
  tbody.querySelectorAll('[data-cancel-zone]').forEach(btn => {
    btn.addEventListener('click', () => {
      zoneEditingId = null;
      renderZonesTable();
    });
  });
  tbody.querySelectorAll('[data-save-zone]').forEach(btn => {
    btn.addEventListener('click', () => saveZoneEdit(btn.dataset.saveZone));
  });
  tbody.querySelectorAll('[data-delete-zone]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить зону? Устройства в ней нужно удалить/перенести отдельно.')) return;
      const res = await adminFetch(`/api/zones/${btn.dataset.deleteZone}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Не удалось удалить зону.');
        return;
      }
      loadZones();
    });
  });
}

async function moveZone(id, direction) {
  const idx = ZONES_CACHE.findIndex(z => z.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= ZONES_CACHE.length) return;
  const reordered = ZONES_CACHE.slice();
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
  // Переприсваиваем sortOrder = позиция в новом порядке всем зонам разом —
  // это самолечит "хвосты" из старых зон, у которых sortOrder мог совпадать
  // (например, все нули по умолчанию), а не просто меняет местами значения.
  await Promise.all(reordered.map((z, i) => adminFetch(`/api/zones/${z.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sortOrder: i }),
  })));
  loadZones();
}

async function saveZoneEdit(id) {
  const row = document.querySelector(`[data-zone-row="${id}"]`);
  const nameRu = row.querySelector('.z-edit-name').value.trim();
  const nameEn = row.querySelector('.z-edit-nameEn').value.trim();
  if (!nameRu) return;
  await adminFetch(`/api/zones/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nameRu, nameEn }),
  });
  zoneEditingId = null;
  loadZones();
}

function initZonesTab() {
  const backdrop = document.getElementById('zModalBackdrop');
  const closeModal = () => { backdrop.style.display = 'none'; };

  document.getElementById('zAddBtn').addEventListener('click', () => {
    document.getElementById('zModalName').value = '';
    document.getElementById('zModalNameEn').value = '';
    document.getElementById('zModalColor').value = '#f97316';
    backdrop.style.display = 'flex';
  });
  document.getElementById('zModalClose').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  document.getElementById('zModalSave').addEventListener('click', async () => {
    const nameRu = document.getElementById('zModalName').value.trim();
    const nameEn = document.getElementById('zModalNameEn').value.trim();
    const color = document.getElementById('zModalColor').value;
    if (!nameRu) return;
    await adminFetch('/api/zones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: CLUB_ID, nameRu, nameEn: nameEn || undefined, color }),
    });
    closeModal();
    loadZones();
  });
}

// ---------------------------------------------------------------------
// Тарифы (типы дней / группы / тарифы / правила цен)
// ---------------------------------------------------------------------

let dayTypeEditingId = null;

async function loadDayTypes() {
  const tbody = document.getElementById('dtTableBody');
  const res = await adminFetch(`/api/day-types?clubId=${CLUB_ID}`);
  DAY_TYPES_CACHE = await res.json();
  const dayTypeOpts = DAY_TYPES_CACHE.map(dt => `<option value="${dt.id}">${escapeHtml(dt.name)}</option>`).join('');
  document.getElementById('trNewDayType').innerHTML = dayTypeOpts;
  document.getElementById('trEditDayType').innerHTML = dayTypeOpts;

  if (!DAY_TYPES_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }
  tbody.innerHTML = DAY_TYPES_CACHE.map(dt => `
    <tr>
      <td>${escapeHtml(dt.name)}</td>
      <td>${dt.weekdays.map(w => WEEKDAY_LABELS[w]).join(', ')}</td>
      <td><span style="display:inline-block; width:16px; height:16px; border-radius:4px; vertical-align:middle; border:1px solid var(--border); background:${escapeHtml(dt.color || '#64748b')};"></span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost" data-edit-daytype="${dt.id}" title="Редактировать" style="padding:4px 8px;">✎</button>
          <button class="btn btn-ghost" data-delete-daytype="${dt.id}" title="Удалить" style="padding:4px 8px;">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit-daytype]').forEach(btn => {
    btn.addEventListener('click', () => openDayTypeModal(btn.dataset.editDaytype));
  });
  tbody.querySelectorAll('[data-delete-daytype]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить тип дня?')) return;
      const res = await adminFetch(`/api/day-types/${btn.dataset.deleteDaytype}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Не удалось удалить тип дня — возможно, на него ссылаются правила цен или календарь.');
        return;
      }
      loadDayTypes();
    });
  });
}

function openDayTypeModal(id) {
  dayTypeEditingId = id || null;
  const dt = id ? DAY_TYPES_CACHE.find(d => d.id === id) : null;
  document.getElementById('dtModalTitle').textContent = dt ? 'Изменить группу' : 'Добавить группу';
  document.getElementById('dtModalName').value = dt ? dt.name : '';
  document.getElementById('dtModalColor').value = dt?.color || '#f8f00d';
  document.querySelectorAll('.dt-modal-weekday').forEach(cb => {
    cb.checked = !!dt && dt.weekdays.includes(Number(cb.value));
  });
  document.getElementById('dtModalBackdrop').style.display = 'flex';
}

function initDayTypesForm() {
  const backdrop = document.getElementById('dtModalBackdrop');
  const closeModal = () => { backdrop.style.display = 'none'; };

  document.getElementById('dtAddBtn').addEventListener('click', () => openDayTypeModal(null));
  document.getElementById('dtModalClose').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  document.getElementById('dtModalSave').addEventListener('click', async () => {
    const name = document.getElementById('dtModalName').value.trim();
    const color = document.getElementById('dtModalColor').value;
    const weekdays = Array.from(document.querySelectorAll('.dt-modal-weekday:checked')).map(cb => Number(cb.value));
    if (!name || !weekdays.length) return;

    const body = { name, color, weekdays };
    const res = dayTypeEditingId
      ? await adminFetch(`/api/day-types/${dayTypeEditingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      : await adminFetch('/api/day-types', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clubId: CLUB_ID, ...body }),
        });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Не удалось сохранить тип дня.');
      return;
    }
    closeModal();
    loadDayTypes();
  });
}

// Категории тарифов ("Группы тарифов") больше не показываются админу —
// это оказался лишний уровень по сравнению с референсом LANGAME. Кэш всё
// ещё нужен (renderTariffsTable показывает имя группы, а createTariff
// требует groupId), поэтому просто подгружаем список и при необходимости
// заводим ровно одну группу по умолчанию, без какого-либо UI управления ею.
async function loadTariffGroups() {
  const res = await adminFetch(`/api/tariff-groups?clubId=${CLUB_ID}`);
  TARIFF_GROUPS_CACHE = await res.json();
}

async function ensureDefaultTariffGroupId() {
  if (TARIFF_GROUPS_CACHE.length) return TARIFF_GROUPS_CACHE[0].id;
  const res = await adminFetch('/api/tariff-groups', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clubId: CLUB_ID, name: 'Основные' }),
  });
  const group = await res.json();
  TARIFF_GROUPS_CACHE = [group];
  return group.id;
}

// "Пакет" на сервере — один type с двумя режимами (packageMode); админу
// удобнее видеть их как два разных типа сразу в списке/форме.
function tariffTypeLabel(t) {
  if (t.type === 'PACKAGE') {
    return t.packageMode === 'FIXED_END' ? 'Фикс. окончание' : 'Фикс. длительность';
  }
  return TARIFF_TYPE_LABELS[t.type] || t.type;
}

async function loadTariffs() {
  const res = await adminFetch('/api/tariffs');
  TARIFFS_CACHE = await res.json();
  renderTariffsTable();
  renderBaseTariffPanel();
  renderPackagePicker();
}

// "Пакеты" — выпадающий список PACKAGE-тарифов (заведённых во "Группы
// тарифов"); выбор открывает общую панель "Правила цен" для него.
function renderPackagePicker() {
  const select = document.getElementById('pkgTariffSelect');
  const selected = select.value;
  const packages = TARIFFS_CACHE.filter(t => t.type === 'PACKAGE');
  select.innerHTML = '<option value="">— выберите пакет —</option>' +
    packages.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  if (packages.some(t => t.id === selected)) select.value = selected;
}

// "Базовый тариф" — отдельная подвкладка с фокусом на его ключевой настройке
// (минимальное списание), реюзает общую модалку редактирования тарифа.
function renderBaseTariffPanel() {
  const container = document.getElementById('subtab-base');
  const baseTariffs = TARIFFS_CACHE.filter(t => t.type === 'BASE');
  if (!baseTariffs.length) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Пока нет ни одного базового тарифа — создайте его во вкладке «Группы тарифов» (тип «Базовый»).</p>';
    return;
  }
  container.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Название</th><th>Минимальное списание, мин</th><th></th></tr></thead>
      <tbody>
        ${baseTariffs.map(t => `
          <tr>
            <td>${escapeHtml(t.name)}</td>
            <td>${t.minChargedMinutes || 0}</td>
            <td><button class="btn btn-ghost" data-edit-base-tariff="${t.id}">✎ Редактировать</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  container.querySelectorAll('[data-edit-base-tariff]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!TIERS_CACHE.length) await loadLoyaltyTiers();
      openTariffEditModal(btn.dataset.editBaseTariff);
    });
  });
}

function renderTariffsTable() {
  const tbody = document.getElementById('tTableBody');
  if (!TARIFFS_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);">Пусто</td></tr>';
    return;
  }
  tbody.innerHTML = TARIFFS_CACHE.map(t => {
    const group = TARIFF_GROUPS_CACHE.find(g => g.id === t.groupId);
    return `
      <tr>
        <td>${escapeHtml(group?.name || '—')}</td>
        <td>${tariffTypeLabel(t)}</td>
        <td>${escapeHtml(t.name)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost" data-edit-tariff="${t.id}" title="Редактировать">✎</button>
            <button class="btn btn-ghost" data-manage-rules="${t.id}" data-tariff-name="${escapeHtml(t.name)}">Правила цен</button>
            <button class="btn btn-ghost" data-delete-tariff="${t.id}" title="Удалить" style="color:var(--accent);">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-manage-rules]').forEach(btn => {
    btn.addEventListener('click', () => openRulesPanel(btn.dataset.manageRules, btn.dataset.tariffName));
  });
  tbody.querySelectorAll('[data-edit-tariff]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!TIERS_CACHE.length) await loadLoyaltyTiers();
      openTariffEditModal(btn.dataset.editTariff);
    });
  });
  tbody.querySelectorAll('[data-delete-tariff]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить этот тариф?')) return;
      const res = await adminFetch(`/api/tariffs/${btn.dataset.deleteTariff}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Не удалось удалить тариф.');
        return;
      }
      loadTariffs();
    });
  });
}

let tariffEditingId = null;

function openTariffEditModal(id) {
  const t = TARIFFS_CACHE.find(x => x.id === id);
  if (!t) return;
  tariffEditingId = id;

  document.getElementById('tEditName').value = t.name;

  const isDuration = t.type === 'PACKAGE' && t.packageMode === 'FIXED_DURATION';
  const isFixedEnd = t.type === 'PACKAGE' && t.packageMode === 'FIXED_END';
  const isBase = t.type === 'BASE';
  const isSubscription = t.type === 'SUBSCRIPTION';
  document.getElementById('tEditDurationWrap').style.display = isDuration ? '' : 'none';
  document.getElementById('tEditFixedEndWrap').style.display = isFixedEnd ? '' : 'none';
  document.getElementById('tEditMinChargedWrap').style.display = isBase ? '' : 'none';
  document.getElementById('tEditSubDurationWrap').style.display = isSubscription ? '' : 'none';
  document.getElementById('tEditSubLifetimeWrap').style.display = isSubscription ? '' : 'none';
  document.getElementById('tEditSubPriceWrap').style.display = isSubscription ? '' : 'none';
  if (isDuration) document.getElementById('tEditDuration').value = t.packageDurationMin || '';
  if (isFixedEnd) document.getElementById('tEditFixedEnd').value = minutesToHHMM(t.packageFixedEndMin || 0);
  if (isBase) document.getElementById('tEditMinCharged').value = t.minChargedMinutes || 0;
  if (isSubscription) {
    document.getElementById('tEditSubDuration').value = t.subscriptionDurationMin || '';
    document.getElementById('tEditSubLifetime').value = t.subscriptionLifetimeHrs || '';
    document.getElementById('tEditSubPrice').value = t.subscriptionPrice || '';
  }

  const bonusEnabled = (t.bonusSpendMaxPercent || 0) > 0;
  document.getElementById('tEditBonusEnabled').checked = bonusEnabled;
  document.getElementById('tEditBonusPercentWrap').style.display = bonusEnabled ? '' : 'none';
  document.getElementById('tEditBonusPercent').value = t.bonusSpendMaxPercent || 0;

  document.getElementById('tEditAppAvailable').checked = t.allowOnlineBooking !== false;

  const selectedTierIds = new Set((t.allowedLoyaltyTiers || []).map(x => x.id));
  document.getElementById('tEditTiers').innerHTML = TIERS_CACHE.map(tier =>
    `<option value="${tier.id}" ${selectedTierIds.has(tier.id) ? 'selected' : ''}>${escapeHtml(tier.name)}</option>`
  ).join('');

  document.getElementById('tEditModalBackdrop').style.display = 'flex';
}

function initTariffsForm() {
  const typeSelect = document.getElementById('tNewType');
  function updateNewTariffFieldVisibility() {
    const v = typeSelect.value;
    document.getElementById('tNewPackageMinWrap').style.display = v === 'FIXED_DURATION' ? '' : 'none';
    document.getElementById('tNewFixedEndWrap').style.display = v === 'FIXED_END' ? '' : 'none';
    const subDisplay = v === 'SUBSCRIPTION' ? '' : 'none';
    document.getElementById('tNewSubDurationWrap').style.display = subDisplay;
    document.getElementById('tNewSubLifetimeWrap').style.display = subDisplay;
    document.getElementById('tNewSubPriceWrap').style.display = subDisplay;
  }
  typeSelect.addEventListener('change', updateNewTariffFieldVisibility);
  updateNewTariffFieldVisibility();

  document.getElementById('pkgTariffSelect').addEventListener('change', (e) => {
    if (!e.target.value) {
      document.getElementById('trPanel').style.display = 'none';
      return;
    }
    const t = TARIFFS_CACHE.find(x => x.id === e.target.value);
    openRulesPanel(t.id, t.name);
  });

  document.getElementById('tAddSubmit').addEventListener('click', async () => {
    const uiType = typeSelect.value; // BASE | FIXED_DURATION | FIXED_END | SUBSCRIPTION
    const name = document.getElementById('tNewName').value.trim();
    if (!name) return;
    const groupId = await ensureDefaultTariffGroupId();

    const body = { groupId, name };
    if (uiType === 'BASE') {
      body.type = 'BASE';
    } else if (uiType === 'FIXED_DURATION') {
      body.type = 'PACKAGE';
      body.packageMode = 'FIXED_DURATION';
      body.packageDurationMin = Number(document.getElementById('tNewPackageMin').value) || undefined;
    } else if (uiType === 'FIXED_END') {
      body.type = 'PACKAGE';
      body.packageMode = 'FIXED_END';
      body.packageFixedEndMin = hhmmToMinutes(document.getElementById('tNewFixedEnd').value);
    } else if (uiType === 'SUBSCRIPTION') {
      body.type = 'SUBSCRIPTION';
      body.subscriptionDurationMin = Number(document.getElementById('tNewSubDuration').value) || undefined;
      body.subscriptionLifetimeHrs = Number(document.getElementById('tNewSubLifetime').value) || undefined;
      body.subscriptionPrice = Number(document.getElementById('tNewSubPrice').value) || undefined;
    }

    const res = await adminFetch('/api/tariffs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Не удалось добавить тариф — проверьте поля.');
      return;
    }
    document.getElementById('tNewName').value = '';
    document.getElementById('tNewPackageMin').value = '';
    document.getElementById('tNewFixedEnd').value = '10:00';
    document.getElementById('tNewSubDuration').value = '';
    document.getElementById('tNewSubLifetime').value = '';
    document.getElementById('tNewSubPrice').value = '';
    loadTariffs();
  });

  const editBackdrop = document.getElementById('tEditModalBackdrop');
  document.getElementById('tEditModalClose').addEventListener('click', () => { editBackdrop.style.display = 'none'; });
  editBackdrop.addEventListener('click', (e) => { if (e.target === editBackdrop) editBackdrop.style.display = 'none'; });
  document.getElementById('tEditBonusEnabled').addEventListener('change', (e) => {
    document.getElementById('tEditBonusPercentWrap').style.display = e.target.checked ? '' : 'none';
  });

  document.getElementById('tEditModalSave').addEventListener('click', async () => {
    const t = TARIFFS_CACHE.find(x => x.id === tariffEditingId);
    if (!t) return;
    const name = document.getElementById('tEditName').value.trim();
    if (!name) return;

    const body = {
      name,
      allowedLoyaltyTierIds: Array.from(document.getElementById('tEditTiers').selectedOptions).map(o => o.value),
      bonusSpendMaxPercent: document.getElementById('tEditBonusEnabled').checked
        ? Number(document.getElementById('tEditBonusPercent').value) || 0
        : 0,
      allowOnlineBooking: document.getElementById('tEditAppAvailable').checked,
    };
    if (t.type === 'PACKAGE' && t.packageMode === 'FIXED_DURATION') {
      body.packageDurationMin = Number(document.getElementById('tEditDuration').value) || undefined;
    }
    if (t.type === 'PACKAGE' && t.packageMode === 'FIXED_END') {
      body.packageFixedEndMin = hhmmToMinutes(document.getElementById('tEditFixedEnd').value);
    }
    if (t.type === 'BASE') {
      body.minChargedMinutes = Number(document.getElementById('tEditMinCharged').value) || 0;
    }
    if (t.type === 'SUBSCRIPTION') {
      body.subscriptionDurationMin = Number(document.getElementById('tEditSubDuration').value) || undefined;
      body.subscriptionLifetimeHrs = Number(document.getElementById('tEditSubLifetime').value) || undefined;
      body.subscriptionPrice = Number(document.getElementById('tEditSubPrice').value) || undefined;
    }

    const res = await adminFetch(`/api/tariffs/${tariffEditingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Не удалось сохранить тариф.');
      return;
    }
    editBackdrop.style.display = 'none';
    loadTariffs();
  });

  document.getElementById('tEditModalDelete').addEventListener('click', async () => {
    if (!confirm('Удалить этот тариф?')) return;
    const res = await adminFetch(`/api/tariffs/${tariffEditingId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Не удалось удалить тариф.');
      return;
    }
    editBackdrop.style.display = 'none';
    loadTariffs();
  });
}

let RULES_CACHE = [];
let ruleEditingId = null;

function openRulesPanel(tariffId, tariffName) {
  currentRulesTariffId = tariffId;
  document.getElementById('trPanel').style.display = '';
  document.getElementById('trTariffName').textContent = tariffName;
  loadTariffRules();
}

// Необязательное время — пусто, если поле не заполнено (не "00:00").
function hhmmToMinutesOrNull(hhmm) {
  return hhmm ? hhmmToMinutes(hhmm) : null;
}
function minutesToHHMMOrEmpty(min) {
  return min === null || min === undefined ? '' : minutesToHHMM(min);
}

async function loadTariffRules() {
  const tbody = document.getElementById('trTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="color:var(--text-muted);">Загрузка…</td></tr>';
  const res = await adminFetch(`/api/tariff-rules?tariffId=${currentRulesTariffId}`);
  RULES_CACHE = await res.json();

  if (!RULES_CACHE.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:var(--text-muted);">Пусто — добавьте правило ниже</td></tr>';
    return;
  }
  tbody.innerHTML = RULES_CACHE.map(r => {
    const zone = ZONES_CACHE.find(z => z.id === r.zoneId);
    const dayType = DAY_TYPES_CACHE.find(dt => dt.id === r.dayTypeId);
    const display = r.displayStartMinute != null && r.displayEndMinute != null
      ? `${minutesToHHMM(r.displayStartMinute)}–${minutesToHHMM(r.displayEndMinute)}`
      : '—';
    return `
      <tr>
        <td>${escapeHtml(zone?.nameRu || '—')}</td>
        <td>${escapeHtml(dayType?.name || '—')}</td>
        <td>${minutesToHHMM(r.startMinute)}</td>
        <td>${minutesToHHMM(r.endMinute)}</td>
        <td>${Number(r.pricePerMinute).toFixed(2)}</td>
        <td>${Math.round(Number(r.pricePerMinute) * 60)}</td>
        <td>${display}</td>
        <td><button class="btn btn-ghost" data-edit-rule="${r.id}">✎</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit-rule]').forEach(btn => {
    btn.addEventListener('click', () => openRuleEditModal(btn.dataset.editRule));
  });
}

function openRuleEditModal(id) {
  const r = RULES_CACHE.find(x => x.id === id);
  if (!r) return;
  ruleEditingId = id;
  document.getElementById('trEditZone').value = r.zoneId;
  document.getElementById('trEditDayType').value = r.dayTypeId;
  document.getElementById('trEditStart').value = minutesToHHMM(r.startMinute);
  document.getElementById('trEditEnd').value = minutesToHHMM(r.endMinute);
  document.getElementById('trEditPrice').value = Number(r.pricePerMinute);
  document.getElementById('trEditDisplayStart').value = minutesToHHMMOrEmpty(r.displayStartMinute);
  document.getElementById('trEditDisplayEnd').value = minutesToHHMMOrEmpty(r.displayEndMinute);
  document.getElementById('trEditModalBackdrop').style.display = 'flex';
}

function initTariffRulesForm() {
  document.getElementById('trAddSubmit').addEventListener('click', async () => {
    if (!currentRulesTariffId) return;
    const zoneId = document.getElementById('trNewZone').value;
    const dayTypeId = document.getElementById('trNewDayType').value;
    const startMinute = hhmmToMinutes(document.getElementById('trNewStart').value);
    const endMinute = hhmmToMinutes(document.getElementById('trNewEnd').value);
    const pricePerMinute = Number(document.getElementById('trNewPrice').value);
    const displayStartMinute = hhmmToMinutesOrNull(document.getElementById('trNewDisplayStart').value);
    const displayEndMinute = hhmmToMinutesOrNull(document.getElementById('trNewDisplayEnd').value);
    if (!zoneId || !dayTypeId || !pricePerMinute) return;
    const res = await adminFetch('/api/tariff-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tariffId: currentRulesTariffId, zoneId, dayTypeId, startMinute, endMinute, pricePerMinute,
        displayStartMinute: displayStartMinute ?? undefined,
        displayEndMinute: displayEndMinute ?? undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Не удалось добавить правило.');
      return;
    }
    document.getElementById('trNewPrice').value = '';
    document.getElementById('trNewDisplayStart').value = '';
    document.getElementById('trNewDisplayEnd').value = '';
    loadTariffRules();
  });

  const ruleEditBackdrop = document.getElementById('trEditModalBackdrop');
  document.getElementById('trEditModalClose').addEventListener('click', () => { ruleEditBackdrop.style.display = 'none'; });
  ruleEditBackdrop.addEventListener('click', (e) => { if (e.target === ruleEditBackdrop) ruleEditBackdrop.style.display = 'none'; });

  document.getElementById('trEditModalSave').addEventListener('click', async () => {
    const body = {
      zoneId: document.getElementById('trEditZone').value,
      dayTypeId: document.getElementById('trEditDayType').value,
      startMinute: hhmmToMinutes(document.getElementById('trEditStart').value),
      endMinute: hhmmToMinutes(document.getElementById('trEditEnd').value),
      pricePerMinute: Number(document.getElementById('trEditPrice').value),
      displayStartMinute: hhmmToMinutesOrNull(document.getElementById('trEditDisplayStart').value),
      displayEndMinute: hhmmToMinutesOrNull(document.getElementById('trEditDisplayEnd').value),
    };
    const res = await adminFetch(`/api/tariff-rules/${ruleEditingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Не удалось сохранить правило.');
      return;
    }
    ruleEditBackdrop.style.display = 'none';
    loadTariffRules();
  });

  document.getElementById('trEditModalDelete').addEventListener('click', async () => {
    if (!confirm('Удалить это правило цены?')) return;
    const res = await adminFetch(`/api/tariff-rules/${ruleEditingId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Не удалось удалить правило.');
      return;
    }
    ruleEditBackdrop.style.display = 'none';
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
  TIERS_CACHE = tiers;
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
  MANUAL_GROUPS_CACHE = groups;
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

async function deleteAutoBonusRule(id) {
  if (!confirm('Удалить правило автобонуса?')) return;
  await adminFetch(`/api/loyalty/auto-bonus-rules/${id}`, { method: 'DELETE' });
  loadAutoBonusRules();
}

async function loadAutoBonusRules() {
  const regBody = document.getElementById('abRegTableBody');
  const topupBody = document.getElementById('abTopupTableBody');
  const res = await adminFetch('/api/loyalty/auto-bonus-rules');
  const rules = await res.json();

  const regRules = rules.filter(r => r.trigger === 'REGISTRATION');
  const topupRules = rules.filter(r => r.trigger === 'TOPUP');

  regBody.innerHTML = regRules.length ? regRules.map(r => `
    <tr>
      <td>${r.rewardType === 'PERCENT' ? r.rewardValue + '%' : r.rewardValue + ' ₽'}</td>
      <td><div class="row-actions"><button class="btn btn-ghost" data-delete-bonus="${r.id}">Удалить</button></div></td>
    </tr>
  `).join('') : '<tr><td colspan="2" style="color:var(--text-muted);">Пусто</td></tr>';

  topupBody.innerHTML = topupRules.length ? topupRules.map(r => `
    <tr>
      <td>${r.minAmount ?? '—'}</td>
      <td>${r.maxAmount ?? '—'}</td>
      <td>${r.rewardType === 'PERCENT' ? r.rewardValue + '%' : r.rewardValue + ' ₽'}</td>
      <td><div class="row-actions"><button class="btn btn-ghost" data-delete-bonus="${r.id}">Удалить</button></div></td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--text-muted);">Пусто</td></tr>';

  [regBody, topupBody].forEach(tbody => {
    tbody.querySelectorAll('[data-delete-bonus]').forEach(btn => {
      btn.addEventListener('click', () => deleteAutoBonusRule(btn.dataset.deleteBonus));
    });
  });
}

function initAutoBonusForm() {
  document.getElementById('abRegAddSubmit').addEventListener('click', async () => {
    const rewardType = document.getElementById('abRegRewardType').value;
    const rewardValue = Number(document.getElementById('abRegRewardValue').value);
    if (!rewardValue) return;
    await adminFetch('/api/loyalty/auto-bonus-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: CLUB_ID, trigger: 'REGISTRATION', rewardType, rewardValue }),
    });
    document.getElementById('abRegRewardValue').value = '';
    loadAutoBonusRules();
  });

  document.getElementById('abTopupAddSubmit').addEventListener('click', async () => {
    const minAmount = Number(document.getElementById('abTopupFrom').value);
    const maxAmount = Number(document.getElementById('abTopupTo').value);
    const rewardValue = Number(document.getElementById('abTopupPercent').value);
    if (!minAmount || !maxAmount || !rewardValue) return;
    await adminFetch('/api/loyalty/auto-bonus-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId: CLUB_ID, trigger: 'TOPUP', rewardType: 'PERCENT', rewardValue,
        minAmount, maxAmount,
      }),
    });
    document.getElementById('abTopupFrom').value = '';
    document.getElementById('abTopupTo').value = '';
    document.getElementById('abTopupPercent').value = '';
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
