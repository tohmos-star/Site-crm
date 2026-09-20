// Builds header/footer dynamically depending on auth state (localStorage token),
// and wires up nav + live status bar. Replaces the old static-partials approach
// because the menu structure itself now depends on whether the guest is logged in.

const GUEST_LINKS = [
  ['/club.html', 'О клубе'],
  ['/prices.html', 'Цены'],
  ['/promotions.html', 'Акции'],
  ['/club.html#hardware', 'Железо'],
  ['/social.html', 'Соцсети'],
];

const MEMBER_PRIMARY = [
  ['/entry.html', 'Войти в клуб'],
  ['/booking.html', 'Забронировать'],
];

const TOPUP_LINK = ['/topup.html', 'Пополнить баланс'];

const MEMBER_MORE_GROUPS = [
  ['Клуб', [
    ['/club.html', 'О клубе'],
    ['/club.html#hardware', 'Железо'],
    ['/club.html#room-control', 'Управление комнатой'],
    ['/club-map.html', 'Карта клуба'],
    ['/prices.html', 'Цены'],
  ]],
  ['Сейчас', [
    ['/promotions.html', 'Акции'],
    ['/offers.html', 'Предложения'],
    TOPUP_LINK,
  ]],
  ['Помощь', [
    ['/support.html', 'Тех.поддержка'],
    ['/location.html', 'Как нас найти'],
  ]],
  ['Другое', [
    ['/social.html', 'Соцсети'],
  ]],
];

function isLoggedIn() {
  return Boolean(localStorage.getItem('authToken'));
}

async function loadLayout() {
  renderHeader();
  renderFooter();
  wireNav();
  startStatusBar();
}

function renderHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;

  const loggedIn = isLoggedIn();

  const navHtml = loggedIn
    ? `
      ${MEMBER_PRIMARY.map(([path, label]) => `<a href="${path}" data-nav="${path}">${label}</a>`).join('')}
      <a href="javascript:void(0)" id="moreToggle">Ещё</a>
    `
    : `
      ${GUEST_LINKS.map(([path, label]) => `<a href="${path}" data-nav="${path}">${label}</a>`).join('')}
    `;

  const headerActions = loggedIn ? '' : `
    <a href="/login.html" class="btn btn-ghost" style="padding:7px 12px; font-size:13px;">Войти</a>
    <a href="/register.html" class="btn btn-primary" style="padding:7px 12px; font-size:13px;">Регистрация</a>
  `;

  host.innerHTML = `
    <div class="statusbar" id="statusbar">
      <div class="wrap">
        <span><span class="dot"></span><span id="statusbar-text">подключение…</span></span>
        <span id="statusbar-time"></span>
      </div>
    </div>
    <header class="site">
      <div class="wrap">
        <a href="/index.html" class="logo">4<span class="err">0</span>4</a>
        <div class="header-actions">
          ${headerActions}
          <button class="nav-toggle" id="navToggle" aria-label="Меню">меню</button>
        </div>
        <nav class="main" id="mainNav">${navHtml}</nav>
      </div>
    </header>
    ${loggedIn ? renderMorePanel() : ''}
  `;
}

function renderMorePanel() {
  return `
    <div id="morePanel" class="more-panel">
      <div class="wrap">
        ${MEMBER_MORE_GROUPS.map(([title, items]) => `
          <div class="more-group">
            <p class="more-group-title">${title}</p>
            ${items.map(([path, label]) => `<a href="${path}">${label}</a>`).join('')}
          </div>
        `).join('')}
        <button class="btn btn-ghost" id="logoutBtn" style="width:100%; justify-content:center; margin-top:8px;">Выйти</button>
      </div>
    </div>
  `;
}

function renderFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;
  host.innerHTML = `
    <footer class="site">
      <div class="wrap">
        <span>404 — автоматизированный компьютерный клуб · Самара</span>
        <span>
          <a href="/offers.html">Предложения</a> ·
          <a href="https://vk.ru/errorsmr" target="_blank" rel="noopener">VK</a> ·
          <a href="/privacy.html">Политика обработки ПДн</a>
        </span>
      </div>
    </footer>
  `;
}

function wireNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  const moreToggle = document.getElementById('moreToggle');
  const morePanel = document.getElementById('morePanel');
  if (moreToggle && morePanel) {
    moreToggle.addEventListener('click', () => morePanel.classList.toggle('open'));
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('authToken');
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      } catch { /* ignore network errors on logout */ }
      localStorage.removeItem('authToken');
      window.location.href = '/index.html';
    });
  }

  const current = window.location.pathname + window.location.hash;
  document.querySelectorAll('nav.main a[data-nav]').forEach(a => {
    if (a.getAttribute('data-nav') === current || a.getAttribute('href') === window.location.pathname) {
      a.classList.add('active');
    }
  });
}

function startStatusBar() {
  const textEl = document.getElementById('statusbar-text');
  const timeEl = document.getElementById('statusbar-time');
  const bar = document.getElementById('statusbar');
  if (!textEl || !timeEl || !bar) return;

  function tick() {
    timeEl.textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 30000);

  fetchStatus(textEl, bar);
  setInterval(() => fetchStatus(textEl, bar), 60000);
}

async function fetchStatus(textEl, bar) {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('bad response');
    renderStatus(await res.json(), textEl, bar);
  } catch {
    renderStatus({ open: true, free: 6, total: 20 }, textEl, bar);
  }
}

function renderStatus(data, textEl, bar) {
  if (!data.open) {
    bar.classList.add('offline');
    textEl.textContent = 'клуб закрыт · откроется по расписанию';
    return;
  }
  bar.classList.remove('offline');
  textEl.textContent = `открыт · свободно ${data.free} из ${data.total} мест`;
}

document.addEventListener('DOMContentLoaded', loadLayout);
