function getSavedUser() {
  const keys = ['uchitelskayaUser', 'uchitelskaya_user', 'currentUser'];

  for (const key of keys) {
    try {
      const value = localStorage.getItem(key);
      if (!value) continue;
      const user = JSON.parse(value);
      if (user && (user.name || user.email || user.role)) return user;
    } catch (error) {
      continue;
    }
  }

  return null;
}

function isBoardPage() {
  const path = window.location.pathname;
  return path.endsWith('/') || path.endsWith('/index.html') || path.includes('/uchitelskaya2.0/index.html');
}

function requireLoginBeforeBoard() {
  const user = getSavedUser();

  if (!user && isBoardPage()) {
    window.location.replace('pages/login.html?return=../index.html%23board');
    return false;
  }

  return true;
}

if (!requireLoginBeforeBoard()) {
  throw new Error('Требуется вход в Учительскую 2.0');
}

const menuBtn = document.querySelector('#menuBtn');
const searchInput = document.querySelector('#boardSearch');
const clearSearch = document.querySelector('#clearSearch');
const cards = Array.from(document.querySelectorAll('.card'));
const infoBox = document.querySelector('#help');
const diagnosticBtn = document.querySelector('#diagnosticBtn');
const quizModal = document.querySelector('#quizModal');
const quizForm = document.querySelector('#quizForm');
const quizSelect = document.querySelector('#quizSelect');
const quizResult = document.querySelector('#quizResult');
const profile = document.querySelector('.profile');

function hideTopbarExtras() {
  document.querySelectorAll('.topbar .avatars, .topbar .invite-btn, .topbar .icon-btn').forEach(element => {
    element.remove();
  });
}

const recommendations = {
  design: 'Лучший маршрут: дизайнер образовательных продуктов → шаблон презентации → стенд как у профи.',
  ai: 'Лучший маршрут: интегратор ИИ → 10 промптов для учителя → ИИ-помощник класса.',
  olymp: 'Лучший маршрут: наставник одарённых → чек-лист для НПК → олимпиадный разбор.',
  research: 'Лучший маршрут: методист проектов → как написать цель и задачи → проект под ключ.',
  exam: 'Лучший маршрут: наставник ВПР, ОГЭ и ЕГЭ → план подготовки → разбор заданий и диагностика.',
  producer: 'Лучший маршрут: учитель-продюсер → сценарий события → ученик — продюсер фестиваля.',
  team: 'Лучший маршрут: фасилитатор → распределение ролей → командная работа без хаоса.'
};

function renderLoggedUser() {
  if (!profile) return;

  const user = getSavedUser();
  const avatar = profile.querySelector(':scope > span');
  const name = profile.querySelector('b');
  const role = profile.querySelector('small');

  if (!user || !user.name) {
    if (avatar) avatar.textContent = '🔐';
    if (name) name.textContent = 'Войти';
    if (role) role.textContent = 'Не выполнен вход';
    profile.title = 'Нажмите, чтобы войти в Учительскую 2.0';
    profile.style.cursor = 'pointer';
    profile.addEventListener('click', () => {
      window.location.href = 'pages/login.html?return=../index.html%23board';
    });
    return;
  }

  if (avatar) avatar.textContent = user.role === 'Ученик' ? '🧑‍🎓' : '👩‍🏫';
  if (name) name.textContent = user.name;
  if (role) role.textContent = user.role || 'Участник';

  profile.title = `${user.role || 'Участник'}: ${user.name}${user.email ? ` (${user.email})` : ''}. Нажмите, чтобы выйти.`;
  profile.style.cursor = 'pointer';
  profile.addEventListener('click', () => {
    if (confirm('Выйти из Учительской 2.0?')) {
      localStorage.removeItem('uchitelskayaUser');
      localStorage.removeItem('uchitelskaya_user');
      localStorage.removeItem('currentUser');
      window.location.href = 'pages/login.html?return=../index.html%23board';
    }
  });
}

function adaptWelcomeCard() {
  const welcomeCard = document.querySelector('[data-column="welcome"] .card');
  if (!welcomeCard) return;

  const user = getSavedUser();

  if (user && user.name) {
    welcomeCard.remove();
    return;
  }

  welcomeCard.dataset.info = 'Сначала войдите в Учительскую 2.0 как учитель или ученик.';
  welcomeCard.dataset.loginLink = 'pages/login.html?return=../index.html%23board';
  welcomeCard.classList.add('card--link');

  const icon = welcomeCard.querySelector('.card__icon');
  const title = welcomeCard.querySelector('b');

  if (icon) icon.textContent = '🔐';
  if (title) title.textContent = 'Войти в Учительскую';

  welcomeCard.addEventListener('click', event => {
    event.preventDefault();
    window.location.href = welcomeCard.dataset.loginLink;
  });
}

function linkBoardGuideCard() {
  const guideCard = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(card =>
    card.innerText.includes('Как пользоваться доской')
  );

  if (!guideCard) return;

  guideCard.dataset.info = 'Откройте подробную красочную инструкцию: как двигаться по 7 столбцам, выбирать карточки, находить наставника и получать результат.';
  guideCard.dataset.guideLink = 'pages/kak-polzovatsya-doskoy.html';
  guideCard.classList.add('card--link');
  guideCard.style.cursor = 'pointer';
  guideCard.title = 'Открыть инструкцию по работе с доской';

  guideCard.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = guideCard.dataset.guideLink;
  });
}

function linkChooseTaskCard() {
  const chooseTaskCard = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(card =>
    card.innerText.includes('Выбери задачу')
  );

  if (!chooseTaskCard) return;

  chooseTaskCard.dataset.info = 'Откройте подробную визуальную страницу: как выбрать задачу, определить маршрут и перейти к наставнику.';
  chooseTaskCard.dataset.taskLink = 'pages/1-vyberi-zadachu.html';
  chooseTaskCard.classList.add('card--link');
  chooseTaskCard.style.cursor = 'pointer';
  chooseTaskCard.title = 'Открыть страницу «1. Выбери задачу»';

  chooseTaskCard.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = chooseTaskCard.dataset.taskLink;
  });
}

function linkFindMentorCard() {
  const mentorCard = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(card =>
    card.innerText.includes('Найди наставника')
  );

  if (!mentorCard) return;

  mentorCard.dataset.info = 'Откройте подробную визуальную страницу: как выбрать наставника по задаче, суперсиле и нужному результату.';
  mentorCard.dataset.mentorLink = 'pages/2-naydi-nastavnika.html';
  mentorCard.classList.add('card--link');
  mentorCard.style.cursor = 'pointer';
  mentorCard.title = 'Открыть страницу «2. Найди наставника»';

  mentorCard.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = mentorCard.dataset.mentorLink;
  });
}

function linkGetHelpCard() {
  const helpCard = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(card =>
    card.innerText.includes('Получи помощь')
  );

  if (!helpCard) return;

  helpCard.dataset.info = 'Откройте подробную визуальную страницу: как получить помощь, подготовить заявку, выбрать формат поддержки и довести задачу до результата.';
  helpCard.dataset.helpLink = 'pages/3-poluchi-pomosch.html';
  helpCard.classList.add('card--link');
  helpCard.style.cursor = 'pointer';
  helpCard.title = 'Открыть страницу «3. Получи помощь»';

  helpCard.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = helpCard.dataset.helpLink;
  });
}

function linkFillRequestCard() {
  const requestCard = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(card =>
    card.innerText.includes('Заполни заявку')
  );

  if (!requestCard) return;

  requestCard.dataset.info = 'Откройте подробную визуальную страницу: как правильно заполнить заявку, описать задачу, срок, материалы и ожидаемый результат.';
  requestCard.dataset.requestLink = 'pages/4-zapolni-zayavku.html';
  requestCard.classList.add('card--link');
  requestCard.style.cursor = 'pointer';
  requestCard.title = 'Открыть страницу «4. Заполни заявку»';

  requestCard.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = requestCard.dataset.requestLink;
  });
}

function linkGetResultCard() {
  const resultCard = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(card =>
    card.innerText.includes('Получи результат')
  );

  if (!resultCard) return;

  resultCard.dataset.info = 'Откройте подробную визуальную страницу: как проверить итог, доработать материал, применить его и показать готовый результат.';
  resultCard.dataset.resultLink = 'pages/5-poluchi-rezultat.html';
  resultCard.classList.add('card--link');
  resultCard.style.cursor = 'pointer';
  resultCard.title = 'Открыть страницу «5. Получи результат»';

  resultCard.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = resultCard.dataset.resultLink;
  });
}

function adaptExamCards() {
  const examProblemCard = Array.from(document.querySelectorAll('[data-column="problems"] .card')).find(card =>
    card.innerText.includes('ВПР') || card.innerText.includes('ОГЭ') || card.innerText.includes('ЕГЭ')
  );

  if (examProblemCard) {
    examProblemCard.dataset.role = 'exam';
    examProblemCard.dataset.info = 'Рекомендация: выберите наставника ВПР, ОГЭ и ЕГЭ, чтобы составить план подготовки, разобрать задания и провести диагностику.';
  }

  const methodistCard = Array.from(document.querySelectorAll('[data-column="teachers"] .card')).find(card =>
    card.innerText.includes('Методист проектов')
  );

  if (methodistCard) {
    methodistCard.dataset.tags = 'exam';
    methodistCard.dataset.info = 'Наставник ВПР, ОГЭ и ЕГЭ помогает составить план подготовки, разобрать типовые задания, отработать сложные темы и провести диагностику.';

    const icon = methodistCard.querySelector('.card__icon');
    const title = methodistCard.querySelector('b');

    if (icon) icon.textContent = '📚';
    if (title) title.textContent = 'Наставник ВПР, ОГЭ и ЕГЭ';
  }
}

hideTopbarExtras();
renderLoggedUser();
adaptWelcomeCard();
linkBoardGuideCard();
linkChooseTaskCard();
linkFindMentorCard();
linkGetHelpCard();
linkFillRequestCard();
linkGetResultCard();
adaptExamCards();

function showInfo(title, text, icon = '💡') {
  if (!infoBox) return;

  infoBox.innerHTML = `
    <span class="info-box__icon">${icon}</span>
    <div>
      <h2>${title}</h2>
      <p>${text}</p>
    </div>
  `;
}

function setActiveCard(card) {
  cards.forEach(item => item.classList.remove('is-active'));
  card.classList.add('is-active');
}

cards.forEach(card => {
  card.addEventListener('click', event => {
    const isAnchor = card.tagName === 'A';
    const href = card.getAttribute('href') || '';
    const isPlaceholderLink = isAnchor && (!href || href === '#');

    if (isPlaceholderLink) {
      event.preventDefault();
    }

    const title = card.innerText.trim();
    const icon = card.querySelector('.card__icon')?.textContent || '💡';
    const text = card.dataset.info || 'Описание карточки можно добавить в HTML через атрибут data-info.';

    setActiveCard(card);
    showInfo(title, text, icon);

    const role = card.dataset.role;
    if (role && recommendations[role]) {
      showInfo(title, recommendations[role], icon);
      highlightByRole(role);
    }

    if (isAnchor && href.startsWith('#') && href.length > 1) {
      const target = document.querySelector(href);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'center' });
        history.pushState(null, '', href);
        flashTarget(target);
      }
    }
  });
});

function flashTarget(target) {
  target.classList.add('is-targeted');
  setTimeout(() => target.classList.remove('is-targeted'), 1400);
}

function highlightByRole(role) {
  cards.forEach(card => {
    if (card.dataset.tags === role || card.dataset.role === role) {
      card.classList.add('is-active');
    }
  });
}

searchInput?.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();

  cards.forEach(card => {
    const text = card.innerText.toLowerCase();
    card.classList.toggle('is-hidden', query && !text.includes(query));
  });
});

clearSearch?.addEventListener('click', () => {
  searchInput.value = '';
  cards.forEach(card => card.classList.remove('is-hidden'));
  searchInput.focus();
});

menuBtn?.addEventListener('click', () => {
  document.body.classList.toggle('nav-open');
});

diagnosticBtn?.addEventListener('click', () => {
  if (typeof quizModal.showModal === 'function') {
    quizModal.showModal();
  } else {
    quizModal.setAttribute('open', '');
  }
});

quizForm?.addEventListener('submit', event => {
  event.preventDefault();
  const value = quizSelect.value;
  quizResult.textContent = value ? recommendations[value] : 'Сначала выберите задачу.';
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document.body.classList.remove('nav-open');
  }
});
