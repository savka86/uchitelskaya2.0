import { newsSupabase } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const routeNumber = url.searchParams.get("route");

    let query = newsSupabase
      .from("important_news")
      .select("id,title,body,kind,route_number,active,starts_at,ends_at,created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (routeNumber) query = query.or(`route_number.is.null,route_number.eq.${routeNumber}`);

    const { data, error } = await query;
    if (error) throw error;

    return Response.json(
      { items: data ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } },
    );
  } catch {
    return Response.json(
      { items: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
