// Пополнение баланса. Без подключённого эквайринга backend работает в
// dev-режиме — POST /api/topup возвращает devMode:true, и кнопка "Демо:
// платёж пришёл" подтверждает вручную (см. backend/src/routes/topup.ts).
// Когда провайдер подключат, dev-confirm сам отключится на сервере, и эту
// кнопку нужно будет спрятать по devMode:false из ответа /api/topup.

function getToken() { return localStorage.getItem('authToken'); }
function fmtMoney(n) { return `${Math.round(n)} ₽`; }

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

let currentIntentId = null;

async function loadBalance() {
  const res = await authedFetch('/api/auth/me');
  const data = await res.json();
  document.getElementById('balanceLine').textContent = fmtMoney(Number(data.balanceRub ?? 0));
}

function showStep(step) {
  document.getElementById('stepPick').style.display = step === 'pick' ? 'block' : 'none';
  document.getElementById('stepWaiting').style.display = step === 'waiting' ? 'block' : 'none';
  document.getElementById('stepDone').style.display = step === 'done' ? 'block' : 'none';
}

async function startPayment() {
  const statusEl = document.getElementById('topupStatus');
  const amount = parseInt(document.getElementById('amountInput').value, 10);
  if (!amount || amount < 50) {
    statusEl.textContent = 'Минимальная сумма пополнения — 50 ₽.';
    statusEl.className = 'status-msg show err';
    return;
  }

  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  btn.textContent = 'Готовим оплату…';

  try {
    const res = await authedFetch('/api/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountRub: amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = data.error || 'Не удалось создать платёж.';
      statusEl.className = 'status-msg show err';
      btn.disabled = false;
      btn.textContent = 'Оплатить через СБП';
      return;
    }

    currentIntentId = data.intentId;
    document.getElementById('waitingAmount').textContent = `${amount} ₽ через СБП`;
    document.getElementById('devConfirmBtn').style.display = data.devMode ? 'block' : 'none';
    showStep('waiting');
  } catch {
    statusEl.textContent = 'Не удалось создать платёж. Попробуйте ещё раз.';
    statusEl.className = 'status-msg show err';
    btn.disabled = false;
    btn.textContent = 'Оплатить через СБП';
  }
}

async function devConfirm() {
  if (!currentIntentId) return;
  const btn = document.getElementById('devConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Подтверждаем…';
  try {
    const res = await authedFetch(`/api/topup/${currentIntentId}/dev-confirm`, { method: 'POST' });
    if (!res.ok) throw new Error('confirm failed');
    await loadBalance();
    showStep('done');
  } catch {
    btn.disabled = false;
    btn.textContent = 'Демо: платёж пришёл';
  }
}

function resetForm() {
  currentIntentId = null;
  document.getElementById('amountInput').value = '300';
  document.getElementById('topupStatus').textContent = '';
  document.getElementById('topupStatus').className = 'status-msg';
  document.getElementById('payBtn').disabled = false;
  document.getElementById('payBtn').textContent = 'Оплатить через СБП';
  document.getElementById('devConfirmBtn').disabled = false;
  document.getElementById('devConfirmBtn').textContent = 'Демо: платёж пришёл';
  showStep('pick');
}

function init() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }

  document.querySelectorAll('.amount-chips button').forEach((b) => {
    b.addEventListener('click', () => {
      const input = document.getElementById('amountInput');
      input.value = String((parseInt(input.value, 10) || 0) + Number(b.dataset.add));
    });
  });
  document.getElementById('payBtn').addEventListener('click', startPayment);
  document.getElementById('devConfirmBtn').addEventListener('click', devConfirm);
  document.getElementById('topupAgainBtn').addEventListener('click', resetForm);

  loadBalance();
}

init();
