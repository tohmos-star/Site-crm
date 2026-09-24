// Multi-step registration wizard: consent -> phone -> ФИО -> document photo -> selfie -> pending review.

const regData = { phone: '', password: '', fio: '', docFile: null, selfieFile: null };

function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function initRegister() {
  const consent = document.getElementById('consent');
  const startBtn = document.getElementById('startBtn');

  consent.addEventListener('change', () => { startBtn.disabled = !consent.checked; });
  startBtn.addEventListener('click', () => showStep('step-phone'));

  document.getElementById('phoneNext').addEventListener('click', handlePhoneNext);
  document.getElementById('passwordNext').addEventListener('click', handlePasswordNext);
  document.getElementById('fioNext').addEventListener('click', handleFioNext);

  document.getElementById('docInput').addEventListener('change', (e) => handleUpload(e, 'docBox', 'docNext', 'docFile'));
  document.getElementById('selfieInput').addEventListener('change', (e) => handleUpload(e, 'selfieBox', 'selfieNext', 'selfieFile'));

  document.getElementById('docNext').addEventListener('click', () => showStep('step-selfie'));
  document.getElementById('selfieNext').addEventListener('click', submitRegistration);
}

function handlePhoneNext() {
  const input = document.getElementById('r-phone');
  const hint = document.getElementById('phoneHint');
  const phone = input.value.trim();

  const valid = /^\+7\d{10}$/.test(phone);
  if (!valid) {
    hint.textContent = 'Хм, не похоже на номер 🤔 Формат: +79991234567 (11 цифр, начиная с +7)';
    hint.style.color = 'var(--accent)';
    return;
  }

  regData.phone = phone;
  hint.textContent = '';
  showStep('step-password');
}

function handlePasswordNext() {
  const input = document.getElementById('r-password');
  const password = input.value;
  if (password.length < 6) {
    input.focus();
    return;
  }
  regData.password = password;
  showStep('step-fio');
}

function handleFioNext() {
  const input = document.getElementById('r-fio');
  const fio = input.value.trim();
  if (!fio || fio.split(' ').length < 2) {
    input.focus();
    return;
  }
  regData.fio = fio;
  showStep('step-doc');
}

function handleUpload(e, boxId, nextBtnId, dataKey) {
  const file = e.target.files[0];
  if (!file) return;

  regData[dataKey] = file;

  const box = document.getElementById(boxId);
  box.classList.add('filled');
  const existing = box.querySelector('img');
  if (existing) existing.remove();
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  box.appendChild(img);

  document.getElementById(nextBtnId).disabled = false;
}

async function submitRegistration() {
  const btn = document.getElementById('selfieNext');
  btn.disabled = true;
  btn.textContent = 'Отправка…';

  const formData = new FormData();
  formData.append('phone', regData.phone);
  formData.append('password', regData.password);
  formData.append('fio', regData.fio);
  formData.append('document', regData.docFile, regData.docFile.name);
  formData.append('selfie', regData.selfieFile, regData.selfieFile.name);

  try {
    const res = await fetch('/api/registrations', { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      btn.disabled = false;
      btn.textContent = 'Отправить на проверку';
      alert(data?.error || 'Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.');
      return;
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Отправить на проверку';
    alert('Не удалось отправить заявку — нет связи с сервером. Попробуйте ещё раз.');
    return;
  }

  showStep('step-pending');
}

document.addEventListener('DOMContentLoaded', initRegister);
