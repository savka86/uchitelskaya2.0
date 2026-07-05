// Cloudflare Worker URL. Worker бэлэм буоллаҕына, бу строканы уларыт.
// Холобур: const WORKER_URL = "https://yakut-twin.username.workers.dev";
const WORKER_URL = "https://040eb949.uchitelskaya2-0.pages.dev";

const form = document.getElementById("chatForm");
const input = document.getElementById("userInput");
const messages = document.getElementById("messages");

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function demoReply(text) {
  const lower = text.toLowerCase();

  if (/(салам|привет|здравствуй|hello|hi)/i.test(lower)) {
    return "Сарсыардаҥы күнүнэн! Мин саха тылынан эрэ эппиэттиир көмөлөһөөччүбүн.";
  }

  if (/(цифров|двойник|ии|ai|chatgpt|чат)/i.test(lower)) {
    return "Цифралыы көмөлөһөөччү диэн киһиэхэ, учууталга, оҕоҕо эбэтэр бырайыакка интернет нөҥүө көмөлөһөр ИИ-система. Мин саха тылынан эрэ эппиэттииргэ туруоруллубутум.";
  }

  if (/(учитель|учуутал|проект|бырайыак|урок|задание)/i.test(lower)) {
    return "Учууталга көмө: темаҕын ырытыахха, сыал-сорук суруйуохха, оҕоҕо судургу быһаарыы бэлэмниэххэ, уруокка карточка уонна ыйытыы оҥоруохха сөп.";
  }

  if (/(якут|саха|тыл|язык)/i.test(lower)) {
    return "Саха тыла — төрөөбүт тыл, культура уонна өй-санаа кэрэ кэскилэ. Тылы сайыннарарга күннээҕи кэпсэтии, ааҕыы, суруйуу улахан суолталаах.";
  }

  return "Мин бу версияҕа демо-режимҥа үлэлиибин. Толору ИИ эппиэтин ыларга Cloudflare Worker уонна API-ключ холбоо. Онон эрээри мин саха тылынан эрэ эппиэттииргэ туруоруллубутум.";
}

async function askWorker(text) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.reply || "Эппиэт кэлбэтэ.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  input.disabled = true;
  form.querySelector("button").disabled = true;

  const typing = addMessage("Толкуйдуубун...", "bot");

  try {
    if (!WORKER_URL || WORKER_URL.includes("PASTE_")) {
      typing.textContent = demoReply(text);
    } else {
      typing.textContent = await askWorker(text);
    }
  } catch (error) {
    typing.textContent = "Алҕас таҕыста. Хойутуу хат ырыт.";
  } finally {
    input.disabled = false;
    form.querySelector("button").disabled = false;
    input.focus();
  }
});
