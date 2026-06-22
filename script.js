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
const infoBox = document.querySelector('#infoBox');
const diagnosticBtn = document.querySelector('#diagnosticBtn');
const quizModal = document.querySelector('#quizModal');
const quizForm = document.querySelector('#quizForm');
const quizSelect = document.querySelector('#quizSelect');
const quizResult = document.querySelector('#quizResult');
const profile = document.querySelector('.profile');

const recommendations = {
  design: 'Лучший маршрут: дизайнер образовательных продуктов → шаблон презентации → стенд как у профи.',
  ai: 'Лучший маршрут: интегратор ИИ → 10 промптов для учителя → ИИ-помощник класса.',
  olymp: 'Лучший маршрут: наставник одарённых → чек-лист для НПК → олимпиадный разбор.',
  research: 'Лучший маршрут: методист проектов → как написать цель и задачи → проект под ключ.',
  exam: 'Лучший маршрут: наставник ВПР, ОГЭ и ЕГЭ → план подготовки → разбор заданий и диагностика.',
  producer: 'Лучший маршрут: учитель-продюсер → сценарий события → ученик — продюсер фестиваля.',
  team: 'Лучший маршрут: фасилитатор → распределение ролей → командная работа без хаоса.'
};

function hideTopbarExtras() {
  document.querySelectorAll('.topbar .avatars, .topbar .invite-btn, .topbar .icon-btn').forEach(element => {
    element.remove();
  });
}

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

function makeCardActive(card, link, info, title) {
  if (!card) return;

  card.dataset.info = info;
  card.dataset.activeLink = link;
  card.classList.add('card--link');
  card.style.cursor = 'pointer';
  card.title = title;

  card.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = card.dataset.activeLink;
  });
}

function linkBoardGuideCard() {
  const card = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(item =>
    item.innerText.includes('Как пользоваться доской')
  );

  makeCardActive(
    card,
    'pages/kak-polzovatsya-doskoy.html',
    'Откройте подробную красочную инструкцию: как двигаться по 7 столбцам, выбирать карточки, находить наставника и получать результат.',
    'Открыть инструкцию по работе с доской'
  );
}

function linkChooseTaskCard() {
  const card = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(item =>
    item.innerText.includes('Выбери задачу')
  );

  makeCardActive(
    card,
    'pages/1-vyberi-zadachu.html',
    'Откройте подробную визуальную страницу: как выбрать задачу, определить маршрут и перейти к наставнику.',
    'Открыть страницу «1. Выбери задачу»'
  );
}

function linkFindMentorCard() {
  const card = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(item =>
    item.innerText.includes('Найди наставника')
  );

  makeCardActive(
    card,
    'pages/2-naydi-nastavnika.html',
    'Откройте подробную визуальную страницу: как выбрать наставника по задаче, суперсиле и нужному результату.',
    'Открыть страницу «2. Найди наставника»'
  );
}

function linkGetHelpCard() {
  const card = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(item =>
    item.innerText.includes('Получи помощь')
  );

  makeCardActive(
    card,
    'pages/3-poluchi-pomosch.html',
    'Откройте подробную визуальную страницу: как получить помощь, подготовить заявку, выбрать формат поддержки и довести задачу до результата.',
    'Открыть страницу «3. Получи помощь»'
  );
}

function linkFillRequestCard() {
  const card = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(item =>
    item.innerText.includes('Заполни заявку')
  );

  makeCardActive(
    card,
    'pages/4-zapolni-zayavku.html',
    'Откройте подробную визуальную страницу: как правильно заполнить заявку, описать задачу, срок, материалы и ожидаемый результат.',
    'Открыть страницу «4. Заполни заявку»'
  );
}

function linkGetResultCard() {
  const card = Array.from(document.querySelectorAll('[data-column="welcome"] .card')).find(item =>
    item.innerText.includes('Получи результат')
  );

  makeCardActive(
    card,
    'pages/5-poluchi-rezultat.html',
    'Откройте подробную визуальную страницу: как проверить итог, доработать материал, применить его и показать готовый результат.',
    'Открыть страницу «5. Получи результат»'
  );
}

function linkProjectFormatCard() {
  const card = Array.from(document.querySelectorAll('[data-column="problems"] .card')).find(item =>
    item.innerText.includes('Не знаю, как оформить проект')
  );

  makeCardActive(
    card,
    'pages/ne-znayu-kak-oformit-proekt.html',
    'Откройте подробную визуальную страницу: как оформить школьный проект, написать проблему, актуальность, цель, задачи, продукт, результат и подготовить защиту.',
    'Открыть страницу «Не знаю, как оформить проект»'
  );
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

function loadMushroomProjectShelf() {
  const shelf = document.querySelector('[data-column="materials"]');
  if (!shelf) return;

  shelf.querySelectorAll('.card').forEach(card => card.remove());

  const projectCards = [
    {
      icon: '🌟',
      title: 'От наставника одарённых',
      info: 'Проект «Serpula lacrymans»: подготовка к НПК, ОВСУ и защите перед жюри. Акцент — новизна, практическая значимость, ответы на вопросы.',
      href: 'pages/project-domovoy-grib.html#talent'
    },
    {
      icon: '🧩',
      title: 'От методиста проекта',
      info: 'Паспорт исследования: тема, цель, задачи, гипотеза, объект, предмет, методы, этапы и выводы по проекту о домовом грибе.',
      href: 'pages/project-domovoy-grib.html#method'
    },
    {
      icon: '🏗️',
      title: 'От архитектора содержания',
      info: 'Логика работы: проблема деревянных домов → опрос 66 домов → карта заражённости → эксперимент → рекомендации.',
      href: 'pages/project-domovoy-grib.html#content'
    },
    {
      icon: '✏️',
      title: 'От дизайнера продукта',
      info: 'Визуальная упаковка проекта: зелёная палитра, карта Намцев, диаграммы 66/45/31/14, фотографии образцов и чистая презентация.',
      href: 'pages/project-domovoy-grib.html#design'
    },
    {
      icon: '💻',
      title: 'От интегратора ИИ',
      info: 'ИИ-поддержка проекта: речь для защиты, вопросы жюри, проверка цифр, исправление текста и подготовка карточек «вопрос — ответ».',
      href: 'pages/project-domovoy-grib.html#ai'
    },
    {
      icon: '🎬',
      title: 'От учителя-продюсера',
      info: 'Сценарий защиты: сильное начало, главный визуальный аргумент, карта заражённости, эксперимент и финальные рекомендации жителям.',
      href: 'pages/project-domovoy-grib.html#producer'
    },
    {
      icon: '👥',
      title: 'От фасилитатора',
      info: 'Роли команды проекта: исследователь, дизайнер, спикер, проверяющий данных и ответственный за материалы.',
      href: 'pages/project-domovoy-grib.html#team'
    }
  ];

  projectCards.forEach(item => {
    const card = document.createElement('a');
    card.className = 'card card--link';
    card.href = item.href;
    card.dataset.info = item.info;
    card.innerHTML = `
      <span class="card__icon">${item.icon}</span>
      <b>${item.title}</b>
    `;
    shelf.appendChild(card);
  });
}

hideTopbarExtras();
renderLoggedUser();
adaptWelcomeCard();
adaptExamCards();
loadMushroomProjectShelf();
linkBoardGuideCard();
linkChooseTaskCard();
linkFindMentorCard();
linkGetHelpCard();
linkFillRequestCard();
linkGetResultCard();
linkProjectFormatCard();

const cards = Array.from(document.querySelectorAll('.card'));

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

searchInput?.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();

  cards.forEach(card => {
    const text = card.innerText.toLowerCase();
    card.classList.toggle('is-hidden', query && !text.includes(query));
  });
});

clearSearch?.addEventListener('click', () => {
  if (!searchInput) return;
  searchInput.value = '';
  cards.forEach(card => card.classList.remove('is-hidden'));
  searchInput.focus();
});

menuBtn?.addEventListener('click', () => {
  document.body.classList.toggle('nav-open');
});

diagnosticBtn?.addEventListener('click', () => {
  if (!quizModal) return;
  if (typeof quizModal.showModal === 'function') {
    quizModal.showModal();
  } else {
    quizModal.setAttribute('open', '');
  }
});

quizForm?.addEventListener('submit', event => {
  event.preventDefault();
  const value = quizSelect?.value;
  if (quizResult) quizResult.textContent = value ? recommendations[value] : 'Сначала выберите задачу.';
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document.body.classList.remove('nav-open');
  }
});
