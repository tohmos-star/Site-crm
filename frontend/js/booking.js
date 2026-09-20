// Бронь: 1) выбор места 2) дата/время + длительность 3) оплата с баланса
// (POST /api/bookings) 4) код для ввода на ПК-виджете при приходе.
// Между двумя бронями одного места backend держит зазор 60 минут — сервер
// сам отклонит слишком плотную бронь (409), здесь только показываем ошибку.

const ROOM_LABELS = { 'duo-1': 'DUO 1', 'duo-2': 'DUO 2', 'solo-1': 'SOLO', 'solo-plus': 'SOLO+' };

let stations = [];
let selectedStation = null;
let minutes = 60;

function getToken() { return localStorage.getItem('authToken'); }
function fmtMoney(n) { return `${Math.round(n)} ₽`; }
function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function authedFetch(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
    throw new Error('not authenticated');
  }
  return res;
}

function renderStationGrid() {
  const grid = document.getElementById('stationGrid');
  grid.innerHTML = '';
  for (const st of stations) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seat-btn' + (selectedStation?.id === st.id ? ' selected' : '');
    btn.innerHTML = `${st.label}<span class="room">${ROOM_LABELS[st.room] ?? st.room} · ${Math.round(st.tariffPerHour)} ₽/ч</span>`;
    btn.addEventListener('click', () => selectStation(st));
    grid.appendChild(btn);
  }
}

function selectStation(st) {
  selectedStation = st;
  renderStationGrid();
  document.getElementById('selectedLabel').textContent = st.label;
  document.getElementById('stepDetails').style.display = 'block';
  updateTotal();
  document.getElementById('stepDetails').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateTotal() {
  const total = selectedStation ? Number(selectedStation.tariffPerHour) * (minutes / 60) : 0;
  document.getElementById('totalAmount').textContent = fmtMoney(total);
  return total;
}

function setMinutes(next) {
  minutes = Math.max(10, next);
  document.getElementById('minutesVal').textContent = `${minutes} мин`;
  document.querySelectorAll('#durationChips button').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.minutes) === minutes);
  });
  updateTotal();
}

async function loadStations() {
  const res = await fetch('/api/stations');
  const data = await res.json();
  stations = data.stations;
  renderStationGrid();
}

async function loadBalance() {
  const res = await authedFetch('/api/auth/me');
  const data = await res.json();
  document.getElementById('balanceLine').textContent = `Баланс: ${fmtMoney(Number(data.balanceRub ?? 0))}`;
}

async function loadMyBookings() {
  const res = await authedFetch('/api/bookings/mine');
  const data = await res.json();
  const container = document.getElementById('myBookings');

  if (!data.bookings.length) {
    container.textContent = 'Пока нет предстоящих броней.';
    return;
  }

  container.innerHTML = '';
  for (const b of data.bookings) {
    const item = document.createElement('div');
    item.className = 'booking-item';
    item.innerHTML = `
      <div>
        <div>${b.station.label} · <span class="code">${b.code}</span></div>
        <div class="meta">${fmtDateTime(b.startAt)} · ${b.minutesPaid} мин · ${fmtMoney(b.amountRub)}</div>
      </div>
      <button class="btn btn-ghost" data-id="${b.id}">Отменить</button>
    `;
    item.querySelector('button').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const cancelRes = await authedFetch(`/api/bookings/${b.id}/cancel`, { method: 'POST' });
        const result = await cancelRes.json();
        btn.textContent = result.refunded ? 'Отменено, возврат' : 'Отменено';
        await loadBalance();
        await loadMyBookings();
      } catch {
        btn.textContent = 'Ошибка';
        btn.disabled = false;
      }
    });
    container.appendChild(item);
  }
}

async function submitBooking() {
  const statusEl = document.getElementById('formStatus');
  const btn = document.getElementById('submitBtn');
  const startAtInput = document.getElementById('startAt').value;

  if (!selectedStation) return;
  if (!startAtInput) {
    statusEl.textContent = 'Укажите дату и время.';
    statusEl.className = 'status-msg show err';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Бронируем…';

  try {
    const res = await authedFetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId: selectedStation.id,
        startAt: new Date(startAtInput).toISOString(),
        minutes,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 402) {
        statusEl.innerHTML = `Не хватает баланса: нужно ${fmtMoney(data.required)}, на счету ${fmtMoney(data.available)}. <a href="/topup.html" style="color:var(--accent);">Пополнить</a>`;
      } else if (res.status === 409) {
        statusEl.textContent = 'Это место занято рядом с выбранным временем — между бронями нужен зазор 60 минут. Выберите другое время или место.';
      } else if (res.status === 400 && data.error?.includes('minutes from now')) {
        statusEl.textContent = 'Бронь должна начинаться минимум через 5 минут от текущего момента.';
      } else {
        statusEl.textContent = data.error || 'Не удалось забронировать.';
      }
      statusEl.className = 'status-msg show err';
      btn.disabled = false;
      btn.textContent = 'Забронировать и оплатить';
      return;
    }

    showCodeScreen(data.booking.code);
    await Promise.all([loadBalance(), loadMyBookings()]);
  } catch {
    statusEl.textContent = 'Не удалось забронировать. Попробуйте ещё раз.';
    statusEl.className = 'status-msg show err';
    btn.disabled = false;
    btn.textContent = 'Забронировать и оплатить';
  }
}

function showCodeScreen(code) {
  document.getElementById('stepStations').style.display = 'none';
  document.getElementById('stepDetails').style.display = 'none';
  document.getElementById('stepCode').style.display = 'block';
  document.getElementById('codeDigits').textContent = code;
}

function resetToStationPicker() {
  selectedStation = null;
  minutes = 60;
  document.getElementById('startAt').value = '';
  document.getElementById('formStatus').textContent = '';
  document.getElementById('formStatus').className = 'status-msg';
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('submitBtn').textContent = 'Забронировать и оплатить';
  setMinutes(60);
  renderStationGrid();
  document.getElementById('stepCode').style.display = 'none';
  document.getElementById('stepDetails').style.display = 'none';
  document.getElementById('stepStations').style.display = 'block';
}

async function initBooking() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }

  // Минимум 5 минут от текущего момента — сервер тоже это проверяет
  // (см. MIN_LEAD_MINUTES в backend/src/routes/bookings.ts), здесь — только
  // чтобы не давать выбрать заведомо невалидное время в самом пикере.
  const startInput = document.getElementById('startAt');
  startInput.min = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16);

  document.querySelectorAll('#durationChips button').forEach((b) => {
    b.addEventListener('click', () => setMinutes(Number(b.dataset.minutes)));
  });
  document.getElementById('minusMin').addEventListener('click', () => setMinutes(minutes - 10));
  document.getElementById('plusMin').addEventListener('click', () => setMinutes(minutes + 10));
  document.getElementById('submitBtn').addEventListener('click', submitBooking);
  document.getElementById('bookAnotherBtn').addEventListener('click', resetToStationPicker);
  document.getElementById('startAt').addEventListener('change', updateTotal);

  setMinutes(60);
  await Promise.all([loadStations(), loadBalance(), loadMyBookings()]);
}

initBooking();
