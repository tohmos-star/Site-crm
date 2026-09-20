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

async function loadAccessCredential() {
  try {
    const res = await adminFetch('/api/admin/access-credential');
    const data = await res.json();
    if (data) {
      document.getElementById('accIntercom').value = data.intercomUrl || '';
      document.getElementById('accDoorMain').value = data.doorCodeMain || '';
      document.getElementById('accDoorSecond').value = data.doorCodeSecond || '';
    }
  } catch { /* handled by adminFetch redirect */ }
}

function initAccessForm() {
  document.getElementById('accessForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('accessStatus');
    try {
      const res = await adminFetch('/api/admin/access-credential', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intercomUrl: document.getElementById('accIntercom').value.trim(),
          doorCodeMain: document.getElementById('accDoorMain').value.trim(),
          doorCodeSecond: document.getElementById('accDoorSecond').value.trim() || undefined,
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
            <button class="btn btn-ghost" data-delete-guest="${g.id}">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-save-guest]').forEach(btn => {
      btn.addEventListener('click', () => saveGuest(btn.dataset.saveGuest));
    });
    tbody.querySelectorAll('[data-delete-guest]').forEach(btn => {
      btn.addEventListener('click', () => deleteGuest(btn.dataset.deleteGuest));
    });
  } catch (err) {
    if (err.message !== 'unauthorized' && err.message !== 'no token') {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--accent);">Не удалось загрузить</td></tr>';
    }
  }
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

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = '/admin/login.html';
    return;
  }

  initTabs();
  initAccessForm();
  initGuestsTab();

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
});
