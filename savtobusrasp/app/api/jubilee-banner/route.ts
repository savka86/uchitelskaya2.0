const SOURCE = "https://clehcdkviariimjwfyun.supabase.co/storage/v1/object/public/site-assets/jubilee-banner-latest.png?v=4";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(SOURCE, { cache: "no-store" });
    if (!upstream.ok) {
      return new Response("Banner unavailable", { status: 502 });
    }

    const bytes = await upstream.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return new Response("Banner unavailable", { status: 502 });
  }
}
