// Offers page: entry choice (survey vs free text), free-text submit,
// and a 9-question survey wizard (single-select, multi-select, 1-5 rating).

const questions = [
  {
    q: 'Как часто вы посещаете клуб?',
    type: 'single',
    options: ['Несколько раз в неделю', 'Раз в неделю', '2–3 раза в месяц', 'Раз в месяц', 'Реже раза в месяц'],
  },
  {
    q: 'Из какого района Самары вы обычно добираетесь до клуба?',
    type: 'single',
    options: ['Самарский/Ленинский', 'Октябрьский', 'Железнодорожный', 'Советский', 'Промышленный', 'Кировский/Красноглинский', 'Куйбышевский', 'Другой район'],
    otherTrigger: 'Другой район',
    otherPrompt: 'Напишите, из какого района или населённого пункта вы добираетесь:',
  },
  {
    q: 'Как вы обычно добираетесь до клуба?',
    type: 'single',
    options: ['Пешком', 'На личном авто', 'На общественном транспорте', 'На такси', 'На самокате/велосипеде'],
  },
  {
    q: 'Насколько удобно вам добираться до клуба?',
    type: 'single',
    options: ['Очень удобно, клуб рядом или по пути', 'Нормально, дорога не напрягает', 'Не очень удобно, но формат того стоит', 'Неудобно, это серьёзный минус'],
  },
  {
    q: 'Что нравится в клубе больше всего? Можно выбрать несколько вариантов.',
    type: 'multi',
    options: ['Автономность — никто не мешает', 'Приватность и тишина', 'Качество оборудования и периферии', 'Расположение в центре города', 'Атмосфера и комфорт', 'Соотношение цены и качества', 'Другое'],
    otherTrigger: 'Другое',
    otherPrompt: 'Что именно? Напишите в двух словах:',
  },
  {
    q: 'Чего не хватает или что хотелось бы улучшить? Можно выбрать несколько вариантов.',
    type: 'multi',
    options: ['Обновить оборудование или периферию', 'Больше комнат / меньше ожидания', 'Расширить часы работы', 'Удобнее парковка', 'Лучше транспортная доступность', 'Зона отдыха, напитки, перекус', 'Упростить систему входа / верификации', 'Другое'],
    otherTrigger: 'Другое',
    otherPrompt: 'Что именно? Напишите в двух словах:',
  },
  { q: 'Оцените работу технической поддержки', type: 'rating' },
  { q: 'Оцените работу автоматики и оборудования (ПК, умный дом, доступ)', type: 'rating' },
  {
    q: 'Порекомендовали бы вы клуб знакомым?',
    type: 'single',
    options: ['Да, уже рекомендовал(а)', 'Скорее да', 'Скорее нет', 'Нет'],
  },
];

let currentQ = 0;
const answers = [];

function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function initOffers() {
  document.getElementById('btnSurvey').addEventListener('click', () => {
    currentQ = 0;
    answers.length = 0;
    showStep('step-survey');
    renderQuestion();
  });

  document.getElementById('btnFree').addEventListener('click', () => showStep('step-free'));
  document.getElementById('freeSubmit').addEventListener('click', submitFreeText);
}

function renderQuestion() {
  const q = questions[currentQ];
  document.getElementById('qProgress').textContent = `Вопрос ${currentQ + 1} из ${questions.length}`;
  const container = document.getElementById('qContainer');
  container.innerHTML = '';

  const title = document.createElement('p');
  title.style.cssText = 'font-size:16px; margin:0 0 16px;';
  title.textContent = q.q;
  container.appendChild(title);

  const selected = new Set();

  if (q.type === 'rating') {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; margin-bottom:16px;';
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.style.cssText = 'flex:1; text-align:center;';
      btn.textContent = i;
      btn.addEventListener('click', () => {
        row.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        answers[currentQ] = i;
        nextQuestion();
      });
      row.appendChild(btn);
    }
    container.appendChild(row);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = q.type === 'multi' ? 'multi-select' : '';

  let otherInput = null;

  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (q.type === 'single') {
        wrap.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        answers[currentQ] = opt;
        if (opt === q.otherTrigger) {
          showOtherPrompt(q, container, (text) => { answers[currentQ] = { option: opt, detail: text }; nextQuestion(); });
        } else {
          nextQuestion();
        }
      } else {
        btn.classList.toggle('selected');
        if (selected.has(opt)) selected.delete(opt); else selected.add(opt);
      }
    });
    wrap.appendChild(btn);
  });

  container.appendChild(wrap);

  if (q.type === 'multi') {
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn btn-primary';
    doneBtn.style.cssText = 'width:100%; justify-content:center; margin-top:12px;';
    doneBtn.textContent = 'Готово';
    doneBtn.addEventListener('click', () => {
      const arr = Array.from(selected);
      if (arr.includes(q.otherTrigger)) {
        showOtherPrompt(q, container, (text) => { answers[currentQ] = { options: arr, detail: text }; nextQuestion(); });
      } else {
        answers[currentQ] = { options: arr };
        nextQuestion();
      }
    });
    container.appendChild(doneBtn);
  }
}

function showOtherPrompt(q, container, onSubmit) {
  const existing = container.querySelector('.other-prompt');
  if (existing) existing.remove();

  const box = document.createElement('div');
  box.className = 'field other-prompt';
  box.style.marginTop = '12px';
  box.innerHTML = `<label>${q.otherPrompt}</label><input type="text" class="other-input">`;
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.style.cssText = 'width:100%; justify-content:center; margin-top:8px;';
  btn.textContent = 'Далее';
  btn.addEventListener('click', () => {
    onSubmit(box.querySelector('.other-input').value.trim());
  });
  box.appendChild(btn);
  container.appendChild(box);
}

function nextQuestion() {
  if (currentQ < questions.length - 1) {
    currentQ++;
    renderQuestion();
  } else {
    submitSurvey();
  }
}

async function submitSurvey() {
  try {
    await fetch('/api/offers/survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
  } catch (err) {
    console.warn('survey submit failed, showing demo final screen', err);
  }
  showStep('step-survey-final');
}

async function submitFreeText() {
  const text = document.getElementById('freeText').value.trim();
  const statusEl = document.getElementById('freeStatus');
  const btn = document.getElementById('freeSubmit');
  if (!text) return;

  btn.disabled = true;
  btn.textContent = 'Отправка…';

  try {
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) throw new Error();
    statusEl.textContent = 'Спасибо за предложение! Передали его команде 404 — читаем каждое.';
    statusEl.className = 'status-msg show ok';
    btn.textContent = 'Отправлено';
  } catch {
    statusEl.textContent = 'Не удалось отправить. Попробуйте ещё раз.';
    statusEl.className = 'status-msg show err';
    btn.disabled = false;
    btn.textContent = 'Отправить';
  }
}

document.addEventListener('DOMContentLoaded', initOffers);
