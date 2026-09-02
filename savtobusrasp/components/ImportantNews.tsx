"use client";

import { useCallback, useEffect, useState } from "react";
import { ImportantNewsRecord, kindIcon, kindLabel } from "@/lib/news";

export function ImportantNews({ routeNumber }: { routeNumber?: string }) {
  const [items, setItems] = useState<ImportantNewsRecord[]>([]);

  const load = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const suffix = routeNumber ? `?route=${encodeURIComponent(routeNumber)}` : "";
      const response = await fetch(`/api/important-news${suffix}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return;
      const payload = await response.json();
      setItems(Array.isArray(payload.items) ? payload.items as ImportantNewsRecord[] : []);
    } catch {
      // Оставляем запасное сообщение вместо бесконечной загрузки.
    } finally {
      window.clearTimeout(timeout);
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
        {!items.length ? (
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
