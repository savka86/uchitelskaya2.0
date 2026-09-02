const SOURCE = "https://clehcdkviariimjwfyun.supabase.co/storage/v1/object/public/site-assets/jubilee-bus-transparent.png";

export const revalidate = 86400;

export async function GET() {
  try {
    const upstream = await fetch(SOURCE, { next: { revalidate: 86400 } });
    if (!upstream.ok) return new Response("Bus image unavailable", { status: 502 });
    const bytes = await upstream.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("Bus image unavailable", { status: 502 });
  }
}
