function getSavedUser() {
  for (const key of ['uchitelskayaUser', 'uchitelskaya_user', 'currentUser']) {
    try {
      const value = localStorage.getItem(key);
      if (!value) continue;
      const user = JSON.parse(value);
      if (user && (user.name || user.email || user.role)) return user;
    } catch (error) {}
  }
  return null;
}

function isBoardPage() {
  const path = window.location.pathname;
  return path.endsWith('/') || path.endsWith('/index.html') || path.includes('/uchitelskaya2.0/index.html');
}

if (!getSavedUser() && isBoardPage()) {
  window.location.replace('pages/login.html?return=../index.html%23board');
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
  design: 'Лучший маршрут: дизайнер образовательных продуктов → презентация, стенд, буклет, дашборд → красивая упаковка опыта.',
  ai: 'Лучший маршрут: интегратор ИИ → нейросети, автоматизация рутины, приложения и ИИ-помощники.',
  olymp: 'Лучший маршрут: наставник одарённых → олимпиадники, ВПР, ОГЭ, ЕГЭ и задания повышенной сложности.',
  research: 'Лучший маршрут: методист проектов → НИР, цель, задачи, оформление и защита на НПК.',
  content: 'Лучший маршрут: учитель-архитектор содержания → логика урока, задания, модуль и образовательный продукт.',
  producer: 'Лучший маршрут: учитель-продюсер → сценарий, событие, партнёры, конкурс, грант и публичный результат.',
  team: 'Лучший маршрут: фасилитатор → групповая работа, роли, правила, встреча и решение команды.'
};

const diagnosticMentors = {
  design: { icon: '✏️', title: 'Дизайнер образовательных продуктов', short: 'Ваш наставник по визуальной упаковке материалов.', text: 'Поможет красиво оформить презентацию, стенд, буклет, маршрутный лист, карточки или страницу проекта.', links: [['Оформить проект', 'pages/ne-znayu-kak-oformit-proekt.html'], ['Бесплатная полка', '#materials']] },
  ai: { icon: '💻', title: 'Интегратор ИИ', short: 'Ваш наставник по нейросетям и цифровым помощникам.', text: 'Покажет, как безопасно использовать ИИ, составлять промпты, проверять ответы и создавать цифровые продукты.', links: [['ИИ без страха', 'pages/hochu-ispolzovat-ii-no-boyus.html'], ['ИИ-полка', 'pages/polka-domovoy-grib-ii.html']] },
  olymp: { icon: '🌟', title: 'Наставник одарённых', short: 'Ваш наставник для сильных учеников, олимпиад и экзаменов.', text: 'Поможет составить план подготовки, подобрать задания, провести диагностику, разобрать ошибки и усилить результат.', links: [['Олимпиада', 'pages/nuzhno-podgotovit-uchenika-k-olimpiade.html'], ['ВПР, ОГЭ и ЕГЭ', 'pages/podgotovka-k-vpr-oge-ege.html']] },
  research: { icon: '🧩', title: 'Методист проектов', short: 'Ваш наставник по исследовательским и проектным работам.', text: 'Поможет сформулировать тему, цель, задачи, гипотезу, методы, план исследования и подготовить защиту.', links: [['Методист проекта', 'pages/polka-domovoy-grib-metodist.html'], ['Пример проекта', 'pages/project-domovoy-grib.html']] },
  content: { icon: '🏗️', title: 'Учитель-архитектор содержания', short: 'Ваш наставник по логике урока и учебного материала.', text: 'Поможет собрать понятную структуру урока, модуль, задания, объяснение темы и итоговый образовательный продукт.', links: [['Идеи для урока', 'pages/ne-hvataet-idey-dlya-uroka.html'], ['Выбрать задачу', 'pages/1-vyberi-zadachu.html']] },
  producer: { icon: '🎬', title: 'Учитель-продюсер', short: 'Ваш наставник по событиям, конкурсам и публичной защите.', text: 'Поможет придумать идею, собрать сценарий, распределить роли, подготовить афишу, медиаплан и яркий финал.', links: [['Школьное событие', 'pages/nuzhno-provesti-yarkoe-shkolnoe-sobytie.html'], ['Получить помощь', 'pages/3-poluchi-pomosch.html']] },
  team: { icon: '👥', title: 'Фасилитатор', short: 'Ваш наставник по командной работе без хаоса.', text: 'Поможет провести встречу, договориться о правилах, распределить роли, сделать доску задач и довести работу до результата.', links: [['Командная работа', 'pages/hochu-sdelat-komandnuyu-rabotu-bez-haosa.html'], ['Найти наставника', 'pages/2-naydi-nastavnika.html']] }
};

const mentorQuizQuestions = [
  { text: 'Какая задача сейчас самая важная?', hint: 'Выберите то, что болит сильнее всего именно сейчас.', options: [['Красиво оформить материал или проект','design'],['Использовать ИИ без страха','ai'],['Подготовить ученика к олимпиаде или экзамену','olymp'],['Собрать исследовательскую работу','research'],['Придумать сильный урок','content'],['Провести событие','producer'],['Организовать команду','team']] },
  { text: 'Что вы хотите получить в итоге?', hint: 'Результат помогает точнее подобрать наставника.', options: [['Презентацию, буклет, стенд или инфографику','design'],['Промпты, чат-бота, цифровой сервис или ИИ-помощника','ai'],['План подготовки, задания, пробник и разбор ошибок','olymp'],['Тему, цель, задачи, гипотезу и защиту проекта','research'],['Конструктор урока, задания и понятную структуру','content'],['Сценарий, афишу, программу и медиаплан','producer'],['Роли, правила, доску задач и общий план действий','team']] },
  { text: 'Где сейчас больше всего трудностей?', hint: 'Отметьте слабое место, которое тормозит работу.', options: [['Материал выглядит скучно или перегруженно','design'],['Непонятно, как правильно пользоваться нейросетями','ai'],['Ученик решает задания нестабильно','olymp'],['Работа есть, но логика исследования слабая','research'],['Есть тема, но нет интересной идеи урока','content'],['Есть мероприятие, но нет цельного сценария','producer'],['Команда спорит, сроки плавают, роли не ясны','team']] },
  { text: 'Какой формат помощи вам ближе?', hint: 'Это покажет, какой стиль сопровождения нужен.', options: [['Визуальный шаблон и правила оформления','design'],['Пошаговая настройка цифрового инструмента','ai'],['Тренировочный маршрут и сложные задания','olymp'],['Методическая консультация по проекту','research'],['Совместная сборка урока по этапам','content'],['Продюсерская сессия по событию','producer'],['Фасилитационная встреча для команды','team']] },
  { text: 'Для кого готовится результат?', hint: 'Аудитория влияет на формат помощи.', options: [['Для жюри, стенда, выставки или защиты','design'],['Для учителей, учеников или сайта с ИИ','ai'],['Для сильного ученика или экзаменационной группы','olymp'],['Для НПК, конкурса проектов или исследования','research'],['Для класса на уроке','content'],['Для всей школы, родителей или гостей','producer'],['Для рабочей группы, класса или педагогической команды','team']] },
  { text: 'Что нужно сделать первым шагом?', hint: 'Первый шаг часто раскрывает настоящий запрос.', options: [['Выбрать стиль, цвета и структуру слайдов','design'],['Составить первый безопасный промпт','ai'],['Провести диагностику уровня ученика','olymp'],['Уточнить проблему и цель исследования','research'],['Сформулировать результат урока','content'],['Определить идею и главный момент события','producer'],['Раздать роли и договориться о правилах','team']] },
  { text: 'Что для вас будет признаком успеха?', hint: 'Финальный ориентир помогает выбрать правильный маршрут.', options: [['Материал выглядит понятно, красиво и профессионально','design'],['ИИ реально экономит время и не пугает','ai'],['Ученик увереннее решает сложные задания','olymp'],['Проект логичный, доказательный и готов к защите','research'],['Урок получился живым, понятным и полезным','content'],['Событие запомнилось и прошло организованно','producer'],['Команда работает спокойно, роли понятны, хаоса нет','team']] }
];

let quizStep = 0;
let quizAnswers = [];
let boardCards = [];

function hideTopbarExtras() {
  document.querySelectorAll('.topbar .avatars, .topbar .invite-btn, .topbar .icon-btn').forEach(element => element.remove());
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
    profile.addEventListener('click', () => window.location.href = 'pages/login.html?return=../index.html%23board');
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
  welcomeCard.style.cursor = 'pointer';
  const icon = welcomeCard.querySelector('.card__icon');
  const title = welcomeCard.querySelector('b');
  if (icon) icon.textContent = '🔐';
  if (title) title.textContent = 'Войти в Учительскую';
  welcomeCard.addEventListener('click', event => {
    event.preventDefault();
    window.location.href = welcomeCard.dataset.loginLink;
  });
}

function findBoardCard(column, text) {
  return Array.from(document.querySelectorAll(`[data-column="${column}"] .card`)).find(item => item.innerText.includes(text));
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

function activateBoardLinks() {
  const links = [
    ['welcome','Как пользоваться доской','pages/kak-polzovatsya-doskoy.html','Открыть инструкцию по работе с доской'],
    ['welcome','Выбери задачу','pages/1-vyberi-zadachu.html','Открыть страницу «1. Выбери задачу»'],
    ['welcome','Найди наставника','pages/2-naydi-nastavnika.html','Открыть страницу «2. Найди наставника»'],
    ['welcome','Получи помощь','pages/3-poluchi-pomosch.html','Открыть страницу «3. Получи помощь»'],
    ['welcome','Заполни заявку','pages/4-zapolni-zayavku.html','Открыть страницу «4. Заполни заявку»'],
    ['welcome','Получи результат','pages/5-poluchi-rezultat.html','Открыть страницу «5. Получи результат»'],
    ['problems','Не знаю, как оформить проект','pages/ne-znayu-kak-oformit-proekt.html','Открыть страницу «Не знаю, как оформить проект»'],
    ['problems','Хочу использовать ИИ, но боюсь','pages/hochu-ispolzovat-ii-no-boyus.html','Открыть страницу «Хочу использовать ИИ, но боюсь»'],
    ['problems','Нужно подготовить ученика к олимпиаде','pages/nuzhno-podgotovit-uchenika-k-olimpiade.html','Открыть страницу «Нужно подготовить ученика к олимпиаде»'],
    ['problems','Нужно провести яркое школьное событие','pages/nuzhno-provesti-yarkoe-shkolnoe-sobytie.html','Открыть страницу «Нужно провести яркое школьное событие»'],
    ['problems','Хочу сделать командную работу без хаоса','pages/hochu-sdelat-komandnuyu-rabotu-bez-haosa.html','Открыть страницу «Хочу сделать командную работу без хаоса»'],
    ['problems','Не хватает идей для урока','pages/ne-hvataet-idey-dlya-uroka.html','Открыть страницу «Не хватает идей для урока»'],
    ['problems','Подготовка к ВПР, ОГЭ и ЕГЭ','pages/podgotovka-k-vpr-oge-ege.html','Открыть страницу «Подготовка к ВПР, ОГЭ и ЕГЭ»']
  ];
  links.forEach(([column, text, href, title]) => makeCardActive(findBoardCard(column, text), href, title, title));
}

function loadMushroomProjectShelf() {
  const shelf = document.querySelector('[data-column="materials"]');
  if (!shelf) return;
  shelf.querySelectorAll('.card').forEach(card => card.remove());
  const projectCards = [
    { icon: '🌟', title: 'От наставника одарённых', info: 'Проект «Serpula lacrymans»: подготовка к НПК, ОВСУ и защите перед жюри.', href: 'pages/polka-domovoy-grib-nastavnik-odarennyh.html' },
    { icon: '🧩', title: 'От методиста проекта', info: 'Паспорт исследования: тема, цель, задачи, гипотеза, объект, предмет, методы, этапы и выводы.', href: 'pages/polka-domovoy-grib-metodist.html' },
    { icon: '🏗️', title: 'От архитектора содержания', info: 'Логика работы: проблема → опрос → карта заражённости → эксперимент → рекомендации.', href: 'pages/project-domovoy-grib.html#content' },
    { icon: '✏️', title: 'От дизайнера продукта', info: 'Визуальная упаковка проекта: палитра, карта, диаграммы, фото и презентация.', href: 'pages/project-domovoy-grib.html#design' },
    { icon: '💻', title: 'От интегратора ИИ', info: 'ИИ-поддержка: речь, вопросы жюри, проверка цифр, карточки «вопрос — ответ».', href: 'pages/polka-domovoy-grib-ii.html' },
    { icon: '🎬', title: 'От учителя-продюсера', info: 'Сценарий защиты: сильное начало, главный аргумент, эксперимент и рекомендации.', href: 'pages/project-domovoy-grib.html#producer' },
    { icon: '👥', title: 'От фасилитатора', info: 'Роли команды: исследователь, дизайнер, спикер, проверяющий данных и ответственный за материалы.', href: 'pages/project-domovoy-grib.html#team' }
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
    .quiz-modal::backdrop{background:rgba(10,20,45,.58);backdrop-filter:blur(8px)}
    .quiz-modal__content{width:min(760px,94vw);max-height:90vh;overflow:auto;border:0;border-radius:34px;padding:24px;background:linear-gradient(145deg,#fff,#f7fbff);box-shadow:0 30px 80px rgba(12,20,48,.35)}
    .quiz-window{position:relative;overflow:hidden;border-radius:30px;padding:24px;background:radial-gradient(circle at 8% 0%,rgba(255,218,121,.55),transparent 28%),radial-gradient(circle at 92% 20%,rgba(119,226,255,.45),transparent 30%),linear-gradient(135deg,#fff,#eef4ff 58%,#fff3fb);border:1px solid rgba(88,108,170,.18);box-shadow:0 16px 40px rgba(28,41,89,.12);animation:quizPop .28s ease}
    .quiz-window::before{content:'✨';position:absolute;right:22px;top:18px;font-size:2rem;opacity:.75}.quiz-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.quiz-progress{height:10px;overflow:hidden;border-radius:999px;background:rgba(23,37,84,.1);margin:0 0 18px}.quiz-progress span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#5b6cff,#24c6dc,#41d67a);transition:width .28s ease}.quiz-step-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#172554;color:#fff;font-weight:900}.quiz-step-badge small{opacity:.85}.quiz-question-icon{width:58px;height:58px;border-radius:20px;display:grid;place-items:center;background:#fff;font-size:2rem;box-shadow:0 12px 28px rgba(23,37,84,.14)}
    .quiz-window h3{margin:0 0 8px;font-size:1.45rem;color:#172554;line-height:1.15}.quiz-hint{margin:0 0 18px;color:#52627e;line-height:1.5;font-weight:700}.mentor-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mentor-option{display:flex;align-items:center;gap:12px;min-height:64px;padding:14px 15px;border-radius:20px;background:#fff;border:2px solid rgba(85,104,170,.15);cursor:pointer;transition:.18s ease;font-weight:900;color:#27324d;line-height:1.28;text-align:left}.mentor-option:hover{transform:translateY(-2px);box-shadow:0 12px 24px rgba(35,49,93,.12);border-color:#91a6ff}.mentor-option.is-selected{background:linear-gradient(135deg,#eef4ff,#eafff5);border-color:#5b6cff;box-shadow:0 12px 26px rgba(91,108,255,.2)}.mentor-option__mark{width:28px;height:28px;flex:0 0 28px;border-radius:999px;display:grid;place-items:center;background:#f0f4ff;color:#5b6cff;font-weight:1000}.mentor-option.is-selected .mentor-option__mark{background:#172554;color:#fff}
    .mentor-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:20px}.mentor-actions__left,.mentor-actions__right{display:flex;flex-wrap:wrap;gap:10px}.mentor-reset-btn,.mentor-back-btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 15px;border-radius:999px;text-decoration:none;font-weight:900;border:1px solid rgba(23,37,84,.16);cursor:pointer;background:#fff;color:#172554}.mentor-back-btn:disabled,[data-quiz-next]:disabled{opacity:.45;cursor:not-allowed}.mentor-result{padding:24px;border-radius:30px;color:#14203d;background:radial-gradient(circle at top left,rgba(255,230,132,.7),transparent 34%),linear-gradient(135deg,#e7fff4,#eef4ff 55%,#fff1fb);border:1px solid rgba(91,108,255,.22);box-shadow:0 16px 36px rgba(25,38,76,.14);animation:quizPop .28s ease}.mentor-result__top{display:flex;gap:14px;align-items:center;margin-bottom:10px}.mentor-result__icon{width:64px;height:64px;border-radius:22px;display:grid;place-items:center;font-size:2.2rem;background:#fff;box-shadow:0 10px 22px rgba(25,38,76,.14)}.mentor-result h3{margin:0;font-size:1.5rem;color:#172554}.mentor-result p{margin:9px 0 0;line-height:1.55}.mentor-result__links{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.mentor-result__links a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 15px;border-radius:999px;text-decoration:none;font-weight:900;background:#172554;color:#fff}.quiz-modal__close{position:absolute;right:18px;top:14px;z-index:4}@keyframes quizPop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:720px){.mentor-options{grid-template-columns:1fr}.quiz-modal__content{width:96vw;padding:16px}.quiz-window{padding:18px}.quiz-window h3{font-size:1.2rem}.mentor-actions{justify-content:flex-start}.mentor-actions__left,.mentor-actions__right{width:100%}.mentor-actions button{flex:1}}
  `;
  document.head.appendChild(style);
}

function closeQuizModal() {
  if (quizModal && typeof quizModal.close === 'function') quizModal.close();
  else quizModal?.removeAttribute('open');
}

function getDiagnosticWinner() {
  const scores = {};
  quizAnswers.forEach(role => { if (role) scores[role] = (scores[role] || 0) + 1; });
  const priority = ['ai', 'olymp', 'research', 'content', 'design', 'producer', 'team'];
  const winner = priority.reduce((best, role) => !best || (scores[role] || 0) > (scores[best] || 0) ? role : best, null);
  return { role: winner, score: scores[winner] || 0 };
}

function highlightByRole(role) {
  boardCards.forEach(card => {
    const tags = (card.dataset.tags || '').split(/\s+/);
    if (tags.includes(role) || card.dataset.role === role) card.classList.add('is-active');
  });
}

function renderDiagnosticResult() {
  const result = getDiagnosticWinner();
  const mentor = diagnosticMentors[result.role];
  if (!quizForm || !mentor) return;
  const scoreText = result.score >= 5 ? 'Совпадение очень сильное.' : result.score >= 3 ? 'Совпадение хорошее.' : 'Есть несколько подходящих направлений, начните с этого наставника.';
  quizForm.innerHTML = `<button class="quiz-modal__close" type="button" data-quiz-close aria-label="Закрыть">×</button><article class="mentor-result"><div class="mentor-result__top"><div class="mentor-result__icon">${mentor.icon}</div><div><p class="eyebrow">Ваш наставник</p><h3>${mentor.title}</h3></div></div><p><strong>${mentor.short}</strong></p><p>${mentor.text}</p><p><strong>${scoreText}</strong> Ответов в пользу этого направления: ${result.score} из ${mentorQuizQuestions.length}.</p><div class="mentor-result__links">${mentor.links.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}</div><div class="mentor-actions" style="justify-content:flex-start"><button class="mentor-reset-btn" type="button" data-quiz-restart>Пройти ещё раз</button></div></article>`;
  quizForm.querySelector('[data-quiz-close]')?.addEventListener('click', closeQuizModal);
  quizForm.querySelector('[data-quiz-restart]')?.addEventListener('click', () => { quizStep = 0; quizAnswers = []; renderDiagnosticQuiz(); });
  highlightByRole(result.role);
}

function renderDiagnosticQuiz() {
  if (!quizForm) return;
  injectDiagnosticStyles();
  const question = mentorQuizQuestions[quizStep];
  const progress = Math.round(((quizStep + 1) / mentorQuizQuestions.length) * 100);
  const selectedRole = quizAnswers[quizStep] || '';
  quizForm.innerHTML = `<button class="quiz-modal__close" type="button" data-quiz-close aria-label="Закрыть">×</button><p class="eyebrow">Мини-диагностика</p><h2 id="quizTitle">Какой наставник вам нужен?</h2><div class="quiz-window"><div class="quiz-top"><span class="quiz-step-badge">Вопрос ${quizStep + 1}<small>/ ${mentorQuizQuestions.length}</small></span><div class="quiz-question-icon">${['💡','🎯','🧭','🛠️','👥','🚀','🏆'][quizStep] || '✨'}</div></div><div class="quiz-progress" aria-label="Прогресс"><span style="width:${progress}%"></span></div><h3>${question.text}</h3><p class="quiz-hint">${question.hint}</p><div class="mentor-options">${question.options.map(([label, role]) => `<button class="mentor-option ${selectedRole === role ? 'is-selected' : ''}" type="button" data-role="${role}"><span class="mentor-option__mark">${selectedRole === role ? '✓' : '○'}</span><span>${label}</span></button>`).join('')}</div><div class="mentor-actions"><div class="mentor-actions__left"><button class="mentor-back-btn" type="button" data-quiz-back ${quizStep === 0 ? 'disabled' : ''}>← Назад</button><button class="mentor-reset-btn" type="button" data-quiz-reset>Сначала</button></div><div class="mentor-actions__right"><button class="btn btn--primary" type="button" data-quiz-next ${selectedRole ? '' : 'disabled'}>${quizStep === mentorQuizQuestions.length - 1 ? 'Показать наставника' : 'Далее →'}</button></div></div></div>`;
  quizForm.querySelector('[data-quiz-close]')?.addEventListener('click', closeQuizModal);
  quizForm.querySelectorAll('.mentor-option').forEach(button => button.addEventListener('click', () => { quizAnswers[quizStep] = button.dataset.role; renderDiagnosticQuiz(); }));
  quizForm.querySelector('[data-quiz-back]')?.addEventListener('click', () => { if (quizStep > 0) { quizStep -= 1; renderDiagnosticQuiz(); } });
  quizForm.querySelector('[data-quiz-reset]')?.addEventListener('click', () => { quizStep = 0; quizAnswers = []; renderDiagnosticQuiz(); });
  quizForm.querySelector('[data-quiz-next]')?.addEventListener('click', () => {
    if (!quizAnswers[quizStep]) return;
    if (quizStep < mentorQuizQuestions.length - 1) { quizStep += 1; renderDiagnosticQuiz(); return; }
    renderDiagnosticResult();
  });
}

function showInfo(title, text, icon = '💡') {
  if (!infoBox) return;
  infoBox.innerHTML = `<span class="info-box__icon">${icon}</span><div><h2>${title}</h2><p>${text}</p></div>`;
}

function setActiveCard(card) {
  boardCards.forEach(item => item.classList.remove('is-active'));
  card.classList.add('is-active');
}

function flashTarget(target) {
  target.classList.add('is-targeted');
  setTimeout(() => target.classList.remove('is-targeted'), 1400);
}

hideTopbarExtras();
renderLoggedUser();
adaptWelcomeCard();
loadMushroomProjectShelf();
activateBoardLinks();
renderDiagnosticQuiz();
boardCards = Array.from(document.querySelectorAll('.card'));

boardCards.forEach(card => {
  card.addEventListener('click', event => {
    const isAnchor = card.tagName === 'A';
    const href = card.getAttribute('href') || '';
    if (isAnchor && (!href || href === '#')) event.preventDefault();
    const title = card.innerText.trim();
    const icon = card.querySelector('.card__icon')?.textContent || '💡';
    const text = card.dataset.info || 'Описание карточки можно добавить в HTML через атрибут data-info.';
    setActiveCard(card);
    showInfo(title, text, icon);
    const role = card.dataset.role;
    if (role && recommendations[role]) { showInfo(title, recommendations[role], icon); highlightByRole(role); }
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
  boardCards.forEach(card => card.classList.toggle('is-hidden', query && !card.innerText.toLowerCase().includes(query)));
});

clearSearch?.addEventListener('click', () => {
  if (!searchInput) return;
  searchInput.value = '';
  boardCards.forEach(card => card.classList.remove('is-hidden'));
  searchInput.focus();
});

menuBtn?.addEventListener('click', () => document.body.classList.toggle('nav-open'));

diagnosticBtn?.addEventListener('click', () => {
  if (!quizModal) return;
  quizStep = 0;
  quizAnswers = [];
  renderDiagnosticQuiz();
  if (typeof quizModal.showModal === 'function') quizModal.showModal();
  else quizModal.setAttribute('open', '');
});

quizForm?.addEventListener('submit', event => event.preventDefault());

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.body.classList.remove('nav-open');
});