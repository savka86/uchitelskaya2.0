# Саха тылынан цифралыы көмөлөһөөччү

Готовая страница для GitHub Pages: цифровой помощник, который должен отвечать только на якутском языке.

Адрес после публикации в репозитории `uchitelskaya2.0`:

```text
https://savka86.github.io/uchitelskaya2.0/yakut-digital-twin/
```

## Что уже работает

- Страница чата на GitHub Pages.
- Красивый современный дизайн.
- Демо-режим без API-ключа: сайт отвечает заготовленными фразами на саха тыла.
- Подготовлен Cloudflare Worker для настоящего ИИ-чата.

## Файлы

- `index.html` — страница чата.
- `style.css` — оформление.
- `script.js` — логика чата и демо-режим.
- `cloudflare-worker.js` — безопасный серверный обработчик для OpenRouter API.

## Почему нужен Cloudflare Worker

GitHub Pages — это статический сайт. Нельзя вставлять API-ключ OpenRouter прямо в `script.js`, потому что его увидят посетители сайта. Поэтому ключ хранится в Cloudflare Worker Secrets.

## Как включить настоящий ИИ

1. Зайди в Cloudflare Dashboard.
2. Workers & Pages → Create Worker.
3. Вставь код из `cloudflare-worker.js`.
4. В Settings → Variables and Secrets добавь:
   - `OPENROUTER_API_KEY` — ключ OpenRouter;
   - `SITE_URL` — `https://savka86.github.io/uchitelskaya2.0/yakut-digital-twin/`;
   - `MODEL` — например `meta-llama/llama-3.1-8b-instruct:free` или другую доступную модель.
5. Deploy.
6. Скопируй URL Worker.
7. В `script.js` замени:

```js
const WORKER_URL = "";
```

на адрес Worker, например:

```js
const WORKER_URL = "https://yakut-twin.username.workers.dev";
```

## Важно

Это не официальный цифровой двойник ChatGPT. Это сайт-помощник, настроенный отвечать только на якутском языке. 100% гарантии языка у ИИ-модели нет, но в Worker добавлены защиты: строгий системный промт, повторная генерация и безопасная якутская заглушка.
