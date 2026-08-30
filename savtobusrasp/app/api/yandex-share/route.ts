export const dynamic = "force-dynamic";

const SHARE_URL = "https://yandex.ru/maps/-/CTHdiQ9w";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(SHARE_URL, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeout);
    const html = await response.text();
    return Response.json({
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      html: html.slice(0, 120000),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
