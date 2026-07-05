// Cloudflare Worker для безопасного хранения API-ключа.
// Secrets:
// OPENROUTER_API_KEY = ваш ключ OpenRouter
// SITE_URL = адрес сайта, например https://savka86.github.io/uchitelskaya2.0/yakut-digital-twin/
// MODEL = модель, например meta-llama/llama-3.1-8b-instruct:free или другая доступная модель

const SYSTEM_PROMPT = `
Система: Эн саха тылынан эрэ эппиэттиир ИИ көмөлөһөөччүҥ.
Бастакы быраабыла: саха тылыттан атын тылынан эппиэттээмэ.
Киһи нууччалыы, ангылычаанныы эбэтэр атын тылынан ыйыттахха да, саха тылынан эрэ эппиэттээ.
Эппиэтиҥ судургу, сытыы, учууталга уонна оҕолорго көмөлөһөр буоллун.
Билбэт буоллаххына саха тылынан: "Мин бу туһунан толору билбэппин" диэн эт.
Өйдөбүл: Эн ChatGPT официальнай копията буолбатаххын, сайт иһинэн көмөлөһөр виртуальнай ИИ көмөлөһөөччү буоларгын.
`;

const FALLBACK_YAKUT = "Кырдьык, мин саха тылынан эрэ эппиэттиэхтээхпин. Ыйытыыҥын сахалыы уонна судургу гына биэр.";

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.SITE_URL || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  };
}

// Простая защитная проверка: если ответ явно содержит много латиницы/русских сигналов
// и почти не содержит якутских букв, просим модель перегенерировать ответ.
function looksNotYakut(text) {
  const yakutLetters = /[ҕҥөһү]/i;
  const latinWords = (text.match(/[A-Za-z]{3,}/g) || []).length;
  const russianOnlySignals = /(здравствуйте|ответ|вопрос|помощник|учитель|я могу|конечно)/i.test(text);
  return !yakutLetters.test(text) && (latinWords > 2 || russianOnlySignals);
}

async function askModel(env, messages) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.SITE_URL || "https://github.io",
      "X-Title": "Yakut Digital Twin"
    },
    body: JSON.stringify({
      model: env.MODEL || "meta-llama/llama-3.1-8b-instruct:free",
      temperature: 0.4,
      messages
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${details}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || FALLBACK_YAKUT;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders(env) });
    }

    try {
      const { message } = await request.json();
      const cleanMessage = String(message || "").slice(0, 2000).trim();
      if (!cleanMessage) {
        return new Response(JSON.stringify({ reply: FALLBACK_YAKUT }), { headers: corsHeaders(env) });
      }

      let reply = await askModel(env, [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: cleanMessage }
      ]);

      if (looksNotYakut(reply)) {
        reply = await askModel(env, [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Бу эппиэти саха тылынан эрэ саҥаттан суруй. Атын тыл туттума: ${reply}` }
        ]);
      }

      if (looksNotYakut(reply)) reply = FALLBACK_YAKUT;

      return new Response(JSON.stringify({ reply }), { headers: corsHeaders(env) });
    } catch (error) {
      return new Response(JSON.stringify({ reply: FALLBACK_YAKUT, error: String(error.message || error) }), {
        status: 500,
        headers: corsHeaders(env)
      });
    }
  }
};
