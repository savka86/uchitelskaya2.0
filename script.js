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
  design: 'Лучший маршрут: дизайнер образовательных продуктов → презентация, стенд, брошюра, дашборд → красивая упаковка опыта.',
  ai: 'Лучший маршрут: интегратор ИИ → нейросети, автоматизация рутины, приложения и ИИ-помощники.',
  olymp: 'Лучший маршрут: наставник одарённых → олимпиадники, 100-балльное ЕГЭ, задания повышенной сложности.',
  research: 'Лучший маршрут: методист проектов → НИР, цель, задачи, оформление и защита на НПК.',
  content: 'Лучший маршрут: учитель-архитектор содержания → сборники, пособия, электронные курсы для всей школы.',
  producer: 'Лучший маршрут: учитель-продюсер → ресурсы, партнёры, конкурсы, гранты и внешний уровень проекта.',
  team: 'Лучший маршрут: фасилитатор → групповая работа, мозговой штурм, педсовет, родительская встреча, дебаты и решение команды.',
  exam: 'Лучший маршрут: наставник одарённых → план подготовки → разбор сложных заданий.'
};

const teacherRoles = [
  {
    icon: '🌟',
    title: 'Наставник одарённых',
    tags: 'olymp exam',
    teacher: 'Учитель химии',
    note: 'ВсОШ, «Большие вызовы»',
    action: 'Ведёт олимпиадников, готовит к 100-балльному ЕГЭ, разбирает задания повышенной сложности.'
  },
  {
    icon: '🧩',
    title: 'Методист проектов',
    tags: 'research',
    teacher: 'Учитель биологии',
    note: 'результативные проекты учащихся',
    action: 'Помогает оформить НИР, поставить цель и задачи, довести исследование до защиты на НПК.'
  },
  {
    icon: '✏️',
    title: 'Дизайнер образовательных продуктов',
    tags: 'design',
    teacher: 'Учитель английского',
    note: 'презентации, стенды, брошюры, дашборды',
    action: 'Создаёт презентации, стенды, брошюры, дашборды и упаковывает педагогический опыт в визуальный продукт.'
  },
  {
    icon: '💻',
    title: 'Интегратор ИИ',
    tags: 'ai',
    teacher: 'Учитель физики',
    note: 'нейросети, приложения, ИИ-помощники',
    action: 'Внедряет нейросети, автоматизирует рутину, создаёт приложения и ИИ-помощников.'
  },
  {
    icon: '🎬',
    title: 'Учитель-продюсер',
    tags: 'producer',
    teacher: 'Учитель истории',
    note: 'клуб дебатеров, музей',
    action: 'Находит ресурсы и партнёров, выводит проекты на внешний уровень: конкурсы, гранты, события.'
  },
  {
    icon: '👥',
    title: 'Фасилитатор',
    tags: 'team',
    teacher: 'Учитель истории / педагог-психолог',
    note: 'групповая работа, педсоветы, родительские собрания, дебаты',
    action: 'Ведёт групповую работу, мозговые штурмы, педсоветы, родительские собрания, дебаты родители-дети и помогает команде находить решения.'
  },
  {
    icon: '🏗️',
    title: 'Учитель-архитектор содержания',
    tags: 'content',
    teacher: 'Учитель математики',
    note: 'OneNote-сборник по всем классам, пособие',
    action: 'Создаёт системные сборники, пособия и электронные курсы для всей школы.'
  }
];

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

function findBoardCard(column, text) {
  return Array.from(document.querySelectorAll(`[data-column="${column}"] .card`)).find(item =>
    item.innerText.includes(text)
  );
}

function renderTeacherRoles() {
  const column = document.querySelector('[data-column="teachers"]');
  if (!column) return;

  column.querySelectorAll('.card').forEach(card => card.remove());

  teacherRoles.forEach(role => {
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.dataset.tags = role.tags;
    card.dataset.info = `${role.title}. Что делает: ${role.action} Кто из ваших учителей: ${role.teacher} (${role.note}).`;
    card.innerHTML = `
      <span class="card__icon">${role.icon}</span>
      <span style="display:grid;gap:4px;min-width:0;">
        <b>${role.title}</b>
        <small style="display:block;color:#52705d;font-weight:800;line-height:1.25;">${role.teacher}</small>
        <small style="display:block;color:#6d7490;line-height:1.25;">${role.note}</small>
      </span>
    `;
    column.appendChild(card);
  });
}

function adaptExamProblemCard() {
  const examProblemCard = Array.from(document.querySelectorAll('[data-column="problems"] .card')).find(card =>
    card.innerText.includes('ВПР') || card.innerText.includes('ОГЭ') || card.innerText.includes('ЕГЭ')
  );

  if (examProblemCard) {
    examProblemCard.dataset.role = 'olymp';
    examProblemCard.dataset.info = 'Рекомендация: выберите наставника одарённых, чтобы выстроить подготовку к сложным заданиям, олимпиадам и высоким результатам.';
  }
}

function linkBoardGuideCard() {
  const card = findBoardCard('welcome', 'Как пользоваться доской');
  makeCardActive(
    card,
    'pages/kak-polzovatsya-doskoy.html',
    'Откройте подробную красочную инструкцию: как двигаться по 7 столбцам, выбирать карточки, находить наставника и получать результат.',
    'Открыть инструкцию по работе с доской'
  );
}

function linkChooseTaskCard() {
  const card = findBoardCard('welcome', 'Выбери задачу');
  makeCardActive(
    card,
    'pages/1-vyberi-zadachu.html',
    'Откройте подробную визуальную страницу: как выбрать задачу, определить маршрут и перейти к наставнику.',
    'Открыть страницу «1. Выбери задачу»'
  );
}

function linkFindMentorCard() {
  const card = findBoardCard('welcome', 'Найди наставника');
  makeCardActive(
    card,
    'pages/2-naydi-nastavnika.html',
    'Откройте подробную визуальную страницу: как выбрать наставника по задаче, суперсиле и нужному результату.',
    'Открыть страницу «2. Найди наставника»'
  );
}

function linkGetHelpCard() {
  const card = findBoardCard('welcome', 'Получи помощь');
  makeCardActive(
    card,
    'pages/3-poluchi-pomosch.html',
    'Откройте подробную визуальную страницу: как получить помощь, подготовить заявку, выбрать формат поддержки и довести задачу до результата.',
    'Открыть страницу «3. Получи помощь»'
  );
}

function linkFillRequestCard() {
  const card = findBoardCard('welcome', 'Заполни заявку');
  makeCardActive(
    card,
    'pages/4-zapolni-zayavku.html',
    'Откройте подробную визуальную страницу: как правильно заполнить заявку, описать задачу, срок, материалы и ожидаемый результат.',
    'Открыть страницу «4. Заполни заявку»'
  );
}

function linkGetResultCard() {
  const card = findBoardCard('welcome', 'Получи результат');
  makeCardActive(
    card,
    'pages/5-poluchi-rezultat.html',
    'Откройте подробную визуальную страницу: как проверить итог, доработать материал, применить его и показать готовый результат.',
    'Открыть страницу «5. Получи результат»'
  );
}

function linkProjectFormatCard() {
  const card = findBoardCard('problems', 'Не знаю, как оформить проект');
  makeCardActive(
    card,
    'pages/ne-znayu-kak-oformit-proekt.html',
    'Откройте подробную визуальную страницу: как оформить школьный проект, написать проблему, актуальность, цель, задачи, продукт, результат и подготовить защиту.',
    'Открыть страницу «Не знаю, как оформить проект»'
  );
}

function linkAiFearCard() {
  const card = findBoardCard('problems', 'Хочу использовать ИИ, но боюсь');
  makeCardActive(
    card,
    'pages/hochu-ispolzovat-ii-no-boyus.html',
    'Откройте красочную страницу: как начать использовать ИИ без страха, с правилами безопасности, примерами и поддержкой наставника.',
    'Открыть страницу «Хочу использовать ИИ, но боюсь»'
  );
}

function linkOlympiadCard() {
  const card = findBoardCard('problems', 'Нужно подготовить ученика к олимпиаде');
  makeCardActive(
    card,
    'pages/nuzhno-podgotovit-uchenika-k-olimpiade.html',
    'Откройте красочную страницу: как составить маршрут подготовки олимпиадника, разобрать задания, вести прогресс и подключить наставника.',
    'Открыть страницу «Нужно подготовить ученика к олимпиаде»'
  );
}

function linkSchoolEventCard() {
  const card = findBoardCard('problems', 'Нужно провести яркое школьное событие');
  makeCardActive(
    card,
    'pages/nuzhno-provesti-yarkoe-shkolnoe-sobytie.html',
    'Откройте красочную страницу: как придумать идею, собрать команду, подготовить сценарий, оформление, медиаплан и провести событие без хаоса.',
    'Открыть страницу «Нужно провести яркое школьное событие»'
  );
}

function linkTeamworkCard() {
  const card = findBoardCard('problems', 'Хочу сделать командную работу без хаоса');
  makeCardActive(
    card,
    'pages/hochu-sdelat-komandnuyu-rabotu-bez-haosa.html',
    'Откройте красочную страницу: как распределить роли, поставить задачи, сделать канбан-доску, провести короткую встречу и довести команду до результата.',
    'Открыть страницу «Хочу сделать командную работу без хаоса»'
  );
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
      href: 'pages/polka-domovoy-grib-nastavnik-odarennyh.html'
    },
    {
      icon: '🧩',
      title: 'От методиста проекта',
      info: 'Паспорт исследования: тема, цель, задачи, гипотеза, объект, предмет, методы, этапы и выводы по проекту о домовом грибе.',
      href: 'pages/polka-domovoy-grib-metodist.html'
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
      href: 'pages/polka-domovoy-grib-ii.html'
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
renderTeacherRoles();
adaptExamProblemCard();
loadMushroomProjectShelf();
linkBoardGuideCard();
linkChooseTaskCard();
linkFindMentorCard();
linkGetHelpCard();
linkFillRequestCard();
linkGetResultCard();
linkProjectFormatCard();
linkAiFearCard();
linkOlympiadCard();
linkSchoolEventCard();
linkTeamworkCard();

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
    const tags = (card.dataset.tags || '').split(/\s+/);
    if (tags.includes(role) || card.dataset.role === role) {
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
