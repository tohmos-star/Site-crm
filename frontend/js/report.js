// Session cleanliness report: checklist + 2-3 photos -> POST /api/session-reports

const photos = {}; // slot index -> File

function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('session') || null;
}

function initReport() {
  const sessionId = getSessionId();
  document.getElementById('session-id').textContent = sessionId || 'демо-режим';

  document.querySelectorAll('.check-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.check-item').classList.toggle('checked', cb.checked);
      updateSubmitState();
    });
  });

  document.querySelectorAll('.photo-slot input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => handlePhoto(e, input.dataset.slot));
  });

  document.getElementById('reportForm').addEventListener('submit', handleSubmit);

  updateSubmitState();
}

function handlePhoto(e, slot) {
  const file = e.target.files[0];
  if (!file) return;

  photos[slot] = file;

  const slotEl = document.getElementById(`slot-${slot}`);
  slotEl.classList.add('filled');

  const existing = slotEl.querySelector('img');
  if (existing) existing.remove();

  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  slotEl.prepend(img);

  updateSubmitState();
}

function requiredPhotoCount() {
  return 2; // slots 0 and 1 are mandatory, slot 2 optional
}

function checklistComplete() {
  return Array.from(document.querySelectorAll('.check-item input[type="checkbox"]'))
    .every(cb => cb.checked);
}

function photosComplete() {
  return photos['0'] && photos['1'];
}

function updateSubmitState() {
  const btn = document.getElementById('submitBtn');
  btn.disabled = !(checklistComplete() && photosComplete());
}

async function handleSubmit(e) {
  e.preventDefault();
  const statusEl = document.getElementById('formStatus');
  const btn = document.getElementById('submitBtn');

  btn.disabled = true;
  btn.textContent = 'Отправка…';

  const formData = new FormData();
  formData.append('sessionId', getSessionId() || 'demo');
  formData.append('checkDesk', 'true');
  formData.append('checkPc', 'true');
  formData.append('checkHeadset', 'true');
  Object.entries(photos).forEach(([slot, file]) => {
    formData.append(`photo_${slot}`, file, file.name);
  });

  try {
    const res = await fetch('/api/session-reports', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('upload failed');

    statusEl.textContent = 'Отчёт принят и отправлен на проверку. Бонусы начислим после проверки.';
    statusEl.className = 'status-msg show ok';
    btn.textContent = 'Отправлено';
  } catch (err) {
    statusEl.textContent = 'Не удалось отправить отчёт. Проверьте связь и попробуйте снова.';
    statusEl.className = 'status-msg show err';
    btn.disabled = false;
    btn.textContent = 'Отправить отчёт';
  }
}

document.addEventListener('DOMContentLoaded', initReport);
