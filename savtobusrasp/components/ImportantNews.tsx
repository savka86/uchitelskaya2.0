"use client";

import { useCallback, useEffect, useState } from "react";
import { ImportantNewsRecord, kindIcon, kindLabel, newsSupabase } from "@/lib/news";

export function ImportantNews({ routeNumber }: { routeNumber?: string }) {
  const [items, setItems] = useState<ImportantNewsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = newsSupabase
        .from("important_news")
        .select("id,title,body,kind,route_number,active,starts_at,ends_at,created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      if (routeNumber) query = query.or(`route_number.is.null,route_number.eq.${routeNumber}`);

      const result = await Promise.race([
        query,
        new Promise<{ data: ImportantNewsRecord[] | null }>((resolve) => {
          window.setTimeout(() => resolve({ data: [] }), 4000);
        }),
      ]);

      setItems((result.data ?? []) as ImportantNewsRecord[]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [routeNumber]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <div className="important-news">
      <div className="important-news-head">
        <div><span>ОПЕРАТИВНАЯ ИНФОРМАЦИЯ</span><h2>Важные новости</h2></div>
        <button type="button" onClick={load} title="Обновить новости">↻</button>
      </div>

      <div className="important-news-list">
        {loading ? <p className="important-news-empty">Загружаю новости…</p> : null}
        {!loading && !items.length ? (
          <article className="news-item info">
            <div className="news-kind">🚌 НОВОСТЬ</div>
            <strong>Маршруты работают по расписанию</strong>
            <p>Если появится важное сообщение, оно будет опубликовано здесь.</p>
          </article>
        ) : null}
        {items.map((item) => (
          <article className={`news-item ${item.kind}`} key={item.id}>
            <div className="news-kind">{kindIcon(item.kind)} {kindLabel(item.kind)}{item.route_number ? ` · №${item.route_number}` : ""}</div>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>

      <a className="admin-login-link" href="/admin">⚙ Вход администратора</a>
    </div>
  );
}
