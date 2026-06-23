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

const diagnosticMentors = {
  design: {
    icon: '✏️',
    title: 'Дизайнер образовательных продуктов',
    short: 'Ваш наставник по визуальной упаковке материалов.',
    text: 'Поможет красиво оформить презентацию, стенд, буклет, маршрутный лист, карточки или страницу проекта.',
    links: [
      ['Оформить проект', 'pages/ne-znayu-kak-oformit-proekt.html'],
      ['Бесплатная полка', '#materials']
    ]
  },
  ai: {
    icon: '💻',
    title: 'Интегратор ИИ',
    short: 'Ваш наставник по нейросетям и цифровым помощникам.',
    text: 'Покажет, как безопасно использовать ИИ, составлять промпты, проверять ответы и создавать цифровые продукты.',
    links: [
      ['ИИ без страха', 'pages/hochu-ispolzovat-ii-no-boyus.html'],
      ['ИИ-полка', 'pages/polka-domovoy-grib-ii.html']
    ]
  },
  olymp: {
    icon: '🌟',
    title: 'Наставник одарённых',
    short: 'Ваш наставник для сильных учеников, олимпиад и экзаменов.',
    text: 'Поможет составить план подготовки, подобрать задания, провести диагностику, разобрать ошибки и усилить результат.',
    links: [
      ['Олимпиада', 'pages/nuzhno-podgotovit-uchenika-k-olimpiade.html'],
      ['ВПР, ОГЭ и ЕГЭ', 'pages/podgotovka-k-vpr-oge-ege.html']
    ]
  },
  research: {
    icon: '🧩',
    title: 'Методист проектов',
    short: 'Ваш наставник по исследовательским и проектным работам.',
    text: 'Поможет сформулировать тему, цель, задачи, гипотезу, методы, план исследования и подготовить защиту.',
    links: [
      ['Методист проекта', 'pages/polka-domovoy-grib-metodist.html'],
      ['Пример проекта', 'pages/project-domovoy-grib.html']
    ]
  },
  content: {
    icon: '🏗️',
    title: 'Учитель-архитектор содержания',
    short: 'Ваш наставник по логике урока и учебного материала.',
    text: 'Поможет собрать понятную структуру урока, модуль, задания, объяснение темы и итоговый образовательный продукт.',
    links: [
      ['Идеи для урока', 'pages/ne-hvataet-idey-dlya-uroka.html'],
      ['Выбрать задачу', 'pages/1-vyberi-zadachu.html']
    ]
  },
  producer: {
    icon: '🎬',
    title: 'Учитель-продюсер',
    short: 'Ваш наставник по событиям, конкурсам и публичной защите.',
    text: 'Поможет придумать идею, собрать сценарий, распределить роли, подготовить афишу, медиаплан и яркий финал.',
    links: [
      ['Школьное событие', 'pages/nuzhno-provesti-yarkoe-shkolnoe-sobytie.html'],
      ['Получить помощь', 'pages/3-poluchi-pomosch.html']
    ]
  },
  team: {
    icon: '👥',
    title: 'Фасилитатор',
    short: 'Ваш наставник по командной работе без хаоса.',
    text: 'Поможет провести встречу, договориться о правилах, распределить роли, сделать доску задач и довести работу до результата.',
    links: [
      ['Командная работа', 'pages/hochu-sdelat-komandnuyu-rabotu-bez-haosa.html'],
      ['Найти наставника', 'pages/2-naydi-nastavnika.html']
    ]
  }
};

const mentorQuizQuestions = [
  {
    text: '1. Какая задача сейчас самая важная?',
    options: [
      ['Красиво оформить материал или проект', 'design'],
      ['Использовать ИИ без страха', 'ai'],
      ['Подготовить ученика к олимпиаде или экзамену', 'olymp'],
      ['Собрать исследовательскую работу', 'research'],
      ['Придумать сильный урок', 'content'],
      ['Провести событие', 'producer'],
      ['Организовать команду', 'team']
    ]
  },
  {
    text: '2. Что вы хотите получить в итоге?',
    options: [
      ['Презентацию, буклет, стенд или инфографику', 'design'],
      ['Промпты, чат-бота, цифровой сервис или ИИ-помощника', 'ai'],
      ['План подготовки, задания, пробник и разбор ошибок', 'olymp'],
      ['Тему, цель, задачи, гипотезу и защиту проекта', 'research'],
      ['Конструктор урока, задания и понятную структуру', 'content'],
      ['Сценарий, афишу, программу и медиаплан', 'producer'],
      ['Роли, правила, доску задач и общий план действий', 'team']
    ]
  },
  {
    text: '3. Где сейчас больше всего трудностей?',
    options: [
      ['Материал выглядит скучно или перегруженно', 'design'],
      ['Непонятно, как правильно пользоваться нейросетями', 'ai'],
      ['Ученик решает задания нестабильно', 'olymp'],
      ['Работа есть, но логика исследования слабая', 'research'],
      ['Есть тема, но нет интересной идеи урока', 'content'],
      ['Есть мероприятие, но нет цельного сценария', 'producer'],
      ['Команда спорит, сроки плавают, роли не ясны', 'team']
    ]
  },
  {
    text: '4. Какой формат помощи вам ближе?',
    options: [
      ['Визуальный шаблон и правила оформления', 'design'],
      ['Пошаговая настройка цифрового инструмента', 'ai'],
      ['Тренировочный маршрут и сложные задания', 'olymp'],
      ['Методическая консультация по проекту', 'research'],
      ['Совместная сборка урока по этапам', 'content'],
      ['Продюсерская сессия по событию', 'producer'],
      ['Фасилитационная встреча для команды', 'team']
    ]
  },
  {
    text: '5. Для кого готовится результат?',
    options: [
      ['Для жюри, стенда, выставки или защиты', 'design'],
      ['Для учителей, учеников или сайта с ИИ', 'ai'],
      ['Для сильного ученика или экзаменационной группы', 'olymp'],
      ['Для НПК, конкурса проектов или исследования', 'research'],
      ['Для класса на уроке', 'content'],
      ['Для всей школы, родителей или гостей', 'producer'],
      ['Для рабочей группы, класса или педагогической команды', 'team']
    ]
  },
  {
    text: '6. Что нужно сделать первым шагом?',
    options: [
      ['Выбрать стиль, цвета и структуру слайдов', 'design'],
      ['Составить первый безопасный промпт', 'ai'],
      ['Провести диагностику уровня ученика', 'olymp'],
      ['Уточнить проблему и цель исследования', 'research'],
      ['Сформулировать результат урока', 'content'],
      ['Определить идею и главный момент события', 'producer'],
      ['Раздать роли и договориться о правилах', 'team']
    ]
  },
  {
    text: '7. Что для вас будет признаком успеха?',
    options: [
      ['Материал выглядит понятно, красиво и профессионально', 'design'],
      ['ИИ реально экономит время и не пугает', 'ai'],
      ['Ученик увереннее решает сложные задания', 'olymp'],
      ['Проект логичный, доказательный и готов к защите', 'research'],
      ['Урок получился живым, понятным и полезным', 'content'],
      ['Событие запомнилось и прошло организованно', 'producer'],
      ['Команда работает спокойно, роли понятны, хаоса нет', 'team']
    ]
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
  makeCardActive(card, 'pages/kak-polzovatsya-doskoy.html', 'Откройте подробную красочную инструкцию: как двигаться по 7 столбцам, выбирать карточки, находить наставника и получать результат.', 'Открыть инструкцию по работе с доской');
}

function linkChooseTaskCard() {
  const card = findBoardCard('welcome', 'Выбери задачу');
  makeCardActive(card, 'pages/1-vyberi-zadachu.html', 'Откройте подробную визуальную страницу: как выбрать задачу, определить маршрут и перейти к наставнику.', 'Открыть страницу «1. Выбери задачу»');
}

function linkFindMentorCard() {
  const card = findBoardCard('welcome', 'Найди наставника');
  makeCardActive(card, 'pages/2-naydi-nastavnika.html', 'Откройте подробную визуальную страницу: как выбрать наставника по задаче, суперсиле и нужному результату.', 'Открыть страницу «2. Найди наставника»');
}

function linkGetHelpCard() {
  const card = findBoardCard('welcome', 'Получи помощь');
  makeCardActive(card, 'pages/3-poluchi-pomosch.html', 'Откройте подробную визуальную страницу: как получить помощь, подготовить заявку, выбрать формат поддержки и довести задачу до результата.', 'Открыть страницу «3. Получи помощь»');
}

function linkFillRequestCard() {
  const card = findBoardCard('welcome', 'Заполни заявку');
  makeCardActive(card, 'pages/4-zapolni-zayavku.html', 'Откройте подробную визуальную страницу: как правильно заполнить заявку, описать задачу, срок, материалы и ожидаемый результат.', 'Открыть страницу «4. Заполни заявку»');
}

function linkGetResultCard() {
  const card = findBoardCard('welcome', 'Получи результат');
  makeCardActive(card, 'pages/5-poluchi-rezultat.html', 'Откройте подробную визуальную страницу: как проверить итог, доработать материал, применить его и показать готовый результат.', 'Открыть страницу «5. Получи результат»');
}

function linkProjectFormatCard() {
  const card = findBoardCard('problems', 'Не знаю, как оформить проект');
  makeCardActive(card, 'pages/ne-znayu-kak-oformit-proekt.html', 'Откройте подробную визуальную страницу: как оформить школьный проект, написать проблему, актуальность, цель, задачи, продукт, результат и подготовить защиту.', 'Открыть страницу «Не знаю, как оформить проект»');
}

function linkAiFearCard() {
  const card = findBoardCard('problems', 'Хочу использовать ИИ, но боюсь');
  makeCardActive(card, 'pages/hochu-ispolzovat-ii-no-boyus.html', 'Откройте красочную страницу: как начать использовать ИИ без страха, с правилами безопасности, примерами и поддержкой наставника.', 'Открыть страницу «Хочу использовать ИИ, но боюсь»');
}

function linkOlympiadCard() {
  const card = findBoardCard('problems', 'Нужно подготовить ученика к олимпиаде');
  makeCardActive(card, 'pages/nuzhno-podgotovit-uchenika-k-olimpiade.html', 'Откройте красочную страницу: как составить маршрут подготовки олимпиадника, разобрать задания, вести прогресс и подключить наставника.', 'Открыть страницу «Нужно подготовить ученика к олимпиаде»');
}

function linkSchoolEventCard() {
  const card = findBoardCard('problems', 'Нужно провести яркое школьное событие');
  makeCardActive(card, 'pages/nuzhno-provesti-yarkoe-shkolnoe-sobytie.html', 'Откройте красочную страницу: как придумать идею, собрать команду, подготовить сценарий, оформление, медиаплан и провести событие без хаоса.', 'Открыть страницу «Нужно провести яркое школьное событие»');
}

function linkTeamworkCard() {
  const card = findBoardCard('problems', 'Хочу сделать командную работу без хаоса');
  makeCardActive(card, 'pages/hochu-sdelat-komandnuyu-rabotu-bez-haosa.html', 'Откройте красочную страницу: как распределить роли, поставить задачи, сделать канбан-доску, провести короткую встречу и довести команду до результата.', 'Открыть страницу «Хочу сделать командную работу без хаоса»');
}

function linkLessonIdeaCard() {
  const card = findBoardCard('problems', 'Не хватает идей для урока');
  makeCardActive(card, 'pages/ne-hvataet-idey-dlya-uroka.html', 'Откройте красочную страницу: как быстро собрать идею урока, выбрать формат, придумать активность и получить понятный результат.', 'Открыть страницу «Не хватает идей для урока»');
}

function linkExamPrepCard() {
  const card = findBoardCard('problems', 'Подготовка к ВПР, ОГЭ и ЕГЭ');
  makeCardActive(card, 'pages/podgotovka-k-vpr-oge-ege.html', 'Откройте красочную страницу: диагностика, карта тем, план подготовки, пробники, работа над ошибками и помощь наставника.', 'Открыть страницу «Подготовка к ВПР, ОГЭ и ЕГЭ»');
}

function loadMushroomProjectShelf() {
  const shelf = document.querySelector('[data-column="materials"]');
  if (!shelf) return;

  shelf.querySelectorAll('.card').forEach(card => card.remove());

  const projectCards = [
    { icon: '🌟', title: 'От наставника одарённых', info: 'Проект «Serpula lacrymans»: подготовка к НПК, ОВСУ и защите перед жюри. Акцент — новизна, практическая значимость, ответы на вопросы.', href: 'pages/polka-domovoy-grib-nastavnik-odarennyh.html' },
    { icon: '🧩', title: 'От методиста проекта', info: 'Паспорт исследования: тема, цель, задачи, гипотеза, объект, предмет, методы, этапы и выводы по проекту о домовом грибе.', href: 'pages/polka-domovoy-grib-metodist.html' },
    { icon: '🏗️', title: 'От архитектора содержания', info: 'Логика работы: проблема деревянных домов → опрос 66 домов → карта заражённости → эксперимент → рекомендации.', href: 'pages/project-domovoy-grib.html#content' },
    { icon: '✏️', title: 'От дизайнера продукта', info: 'Визуальная упаковка проекта: зелёная палитра, карта Намцев, диаграммы 66/45/31/14, фотографии образцов и чистая презентация.', href: 'pages/project-domovoy-grib.html#design' },
    { icon: '💻', title: 'От интегратора ИИ', info: 'ИИ-поддержка проекта: речь для защиты, вопросы жюри, проверка цифр, исправление текста и подготовка карточек «вопрос — ответ».', href: 'pages/polka-domovoy-grib-ii.html' },
    { icon: '🎬', title: 'От учителя-продюсера', info: 'Сценарий защиты: сильное начало, главный визуальный аргумент, карта заражённости, эксперимент и финальные рекомендации жителям.', href: 'pages/project-domovoy-grib.html#producer' },
    { icon: '👥', title: 'От фасилитатора', info: 'Роли команды проекта: исследователь, дизайнер, спикер, проверяющий данных и ответственный за материалы.', href: 'pages/project-domovoy-grib.html#team' }
  ];

  projectCards.forEach(item => {
    const card = document.createElement('a');
    card.className = 'card card--link';
    card.href = item.href;
    card.dataset.info = item.info;
    card.innerHTML = `<span class="card__icon">${item.icon}</span><b>${item.title}</b>`;
    shelf.appendChild(card);
  });
}

function injectDiagnosticStyles() {
  if (document.querySelector('#diagnosticQuizStyles')) return;
  const style = document.createElement('style');
  style.id = 'diagnosticQuizStyles';
  style.textContent = `
    .quiz-modal__content{width:min(940px,94vw);max-height:90vh;overflow:auto;}
    .quiz-intro{margin:0 0 18px;color:#55627a;line-height:1.55;}
    .mentor-quiz{display:grid;gap:16px;margin:18px 0;}
    .mentor-question{padding:16px;border-radius:22px;background:linear-gradient(135deg,#fff,#f6f8ff);border:1px solid rgba(98,116,168,.18);box-shadow:0 10px 24px rgba(25,38,76,.08);}
    .mentor-question h3{margin:0 0 12px;font-size:1rem;color:#20315c;}
    .mentor-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
    .mentor-option{display:flex;align-items:flex-start;gap:9px;min-height:46px;padding:11px 12px;border-radius:16px;background:#fff;border:1px solid rgba(77,98,150,.18);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;font-weight:700;color:#27324d;line-height:1.25;}
    .mentor-option:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(35,49,93,.12);border-color:#8aa4ff;}
    .mentor-option input{margin-top:2px;accent-color:#5b6cff;}
    .mentor-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px;}
    .quiz-result{margin-top:16px;}
    .mentor-result{padding:20px;border-radius:24px;color:#14203d;background:radial-gradient(circle at top left,rgba(255,230,132,.7),transparent 34%),linear-gradient(135deg,#e7fff4,#eef4ff 55%,#fff1fb);border:1px solid rgba(91,108,255,.22);box-shadow:0 16px 36px rgba(25,38,76,.14);}
    .mentor-result__top{display:flex;gap:14px;align-items:center;margin-bottom:10px;}
    .mentor-result__icon{width:58px;height:58px;border-radius:20px;display:grid;place-items:center;font-size:2rem;background:#fff;box-shadow:0 10px 22px rgba(25,38,76,.14);}
    .mentor-result h3{margin:0;font-size:1.35rem;color:#172554;}
    .mentor-result p{margin:8px 0 0;line-height:1.55;}
    .mentor-result__links{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}
    .mentor-result__links a,.mentor-reset-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:10px 14px;border-radius:999px;text-decoration:none;font-weight:900;border:0;cursor:pointer;}
    .mentor-result__links a{background:#172554;color:#fff;}
    .mentor-reset-btn{background:#fff;color:#172554;border:1px solid rgba(23,37,84,.16);}
    .mentor-warning{padding:13px 15px;border-radius:16px;background:#fff7e6;color:#7a4b00;font-weight:800;}
    @media(max-width:720px){.mentor-options{grid-template-columns:1fr}.quiz-modal__content{width:96vw;}}
  `;
  document.head.appendChild(style);
}

function renderDiagnosticQuiz() {
  if (!quizForm) return;
  injectDiagnosticStyles();
  quizForm.innerHTML = `
    <button class="quiz-modal__close" type="button" data-quiz-close aria-label="Закрыть">×</button>
    <p class="eyebrow">Мини-диагностика</p>
    <h2 id="quizTitle">Какой наставник вам нужен?</h2>
    <p class="quiz-intro">Ответьте на 7 вопросов. По вашим ответам система подберёт наставника: интегратора ИИ, наставника одарённых, методиста проекта, дизайнера продукта, продюсера, фасилитатора или архитектора содержания.</p>
    <div class="mentor-quiz" id="mentorQuiz">
      ${mentorQuizQuestions.map((question, index) => `
        <section class="mentor-question">
          <h3>${question.text}</h3>
          <div class="mentor-options">
            ${question.options.map(([label, role]) => `
              <label class="mentor-option">
                <input type="radio" name="quiz-q${index}" value="${role}" required>
                <span>${label}</span>
              </label>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </div>
    <div class="mentor-actions">
      <button class="btn btn--primary" id="quizSubmit" type="submit">Получить наставника</button>
      <button class="mentor-reset-btn" type="button" data-quiz-reset>Сбросить ответы</button>
    </div>
    <div class="quiz-result" id="quizResult" aria-live="polite"></div>
  `;
  quizForm.querySelector('[data-quiz-close]')?.addEventListener('click', () => {
    if (quizModal && typeof quizModal.close === 'function') quizModal.close();
    else quizModal?.removeAttribute('open');
  });
  quizForm.querySelector('[data-quiz-reset]')?.addEventListener('click', () => {
    quizForm.reset();
    const result = quizForm.querySelector('#quizResult');
    if (result) result.innerHTML = '';
  });
}

function getDiagnosticWinner() {
  if (!quizForm) return null;
  const checked = Array.from(quizForm.querySelectorAll('.mentor-question input[type="radio"]:checked'));
  if (checked.length < mentorQuizQuestions.length) return { incomplete: true, answered: checked.length };
  const scores = {};
  checked.forEach(input => { scores[input.value] = (scores[input.value] || 0) + 1; });
  const priority = ['ai', 'olymp', 'research', 'content', 'design', 'producer', 'team'];
  const winner = priority.reduce((best, role) => !best || (scores[role] || 0) > (scores[best] || 0) ? role : best, null);
  return { role: winner, score: scores[winner] || 0, scores };
}

function renderDiagnosticResult(result) {
  const resultBox = quizForm?.querySelector('#quizResult');
  if (!resultBox) return;
  if (result?.incomplete) {
    resultBox.innerHTML = `<div class="mentor-warning">Вы ответили на ${result.answered} из ${mentorQuizQuestions.length} вопросов. Заполните все пункты, чтобы получить точную рекомендацию.</div>`;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const mentor = diagnosticMentors[result.role];
  if (!mentor) return;
  const scoreText = result.score >= 5 ? 'Совпадение очень сильное.' : result.score >= 3 ? 'Совпадение хорошее.' : 'Есть несколько подходящих направлений, начните с этого наставника.';
  resultBox.innerHTML = `
    <article class="mentor-result">
      <div class="mentor-result__top">
        <div class="mentor-result__icon">${mentor.icon}</div>
        <div><p class="eyebrow">Ваш наставник</p><h3>${mentor.title}</h3></div>
      </div>
      <p><strong>${mentor.short}</strong></p>
      <p>${mentor.text}</p>
      <p><strong>${scoreText}</strong> Ответов в пользу этого направления: ${result.score} из ${mentorQuizQuestions.length}.</p>
      <div class="mentor-result__links">${mentor.links.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}</div>
    </article>
  `;
  highlightByRole(result.role);
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
linkLessonIdeaCard();
linkExamPrepCard();
renderDiagnosticQuiz();

const cards = Array.from(document.querySelectorAll('.card'));

function showInfo(title, text, icon = '💡') {
  if (!infoBox) return;
  infoBox.innerHTML = `<span class="info-box__icon">${icon}</span><div><h2>${title}</h2><p>${text}</p></div>`;
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
    if (tags.includes(role) || card.dataset.role === role) card.classList.add('is-active');
  });
}

cards.forEach(card => {
  card.addEventListener('click', event => {
    const isAnchor = card.tagName === 'A';
    const href = card.getAttribute('href') || '';
    const isPlaceholderLink = isAnchor && (!href || href === '#');
    if (isPlaceholderLink) event.preventDefault();
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
  if (typeof quizModal.showModal === 'function') quizModal.showModal();
  else quizModal.setAttribute('open', '');
});

quizForm?.addEventListener('submit', event => {
  event.preventDefault();
  renderDiagnosticResult(getDiagnosticWinner());
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.body.classList.remove('nav-open');
});
