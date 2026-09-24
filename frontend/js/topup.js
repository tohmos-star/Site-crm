// Пополнение баланса. POST /api/topup (см. src/modules/guestSelfService)
// зачисляет сумму синхронно и сразу возвращает новый баланс — реального
// эквайринга/СБП за этим пока нет, это прямое зачисление на баланс гостя.

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

async function loadBalance() {
  const res = await authedFetch('/api/auth/me');
  const data = await res.json();
  document.getElementById('balanceLine').textContent = fmtMoney(Number(data.balanceRub ?? 0));
}

function showStep(step) {
  document.getElementById('stepPick').style.display = step === 'pick' ? 'block' : 'none';
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
  btn.textContent = 'Пополняем…';

  try {
    const res = await authedFetch('/api/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = 'Оплатить через СБП';
    if (!res.ok) {
      statusEl.textContent = data.error || 'Не удалось пополнить баланс.';
      statusEl.className = 'status-msg show err';
      return;
    }

    document.getElementById('balanceLine').textContent = fmtMoney(data.balanceRub);
    showStep('done');
  } catch {
    btn.disabled = false;
    btn.textContent = 'Оплатить через СБП';
    statusEl.textContent = 'Не удалось пополнить баланс. Попробуйте ещё раз.';
    statusEl.className = 'status-msg show err';
  }
}

function resetForm() {
  document.getElementById('amountInput').value = '300';
  document.getElementById('topupStatus').textContent = '';
  document.getElementById('topupStatus').className = 'status-msg';
  document.getElementById('payBtn').disabled = false;
  document.getElementById('payBtn').textContent = 'Оплатить через СБП';
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
  document.getElementById('topupAgainBtn').addEventListener('click', resetForm);

  loadBalance();
}

init();
