"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ImportantNewsRecord, NewsKind, kindIcon, kindLabel, newsSupabase } from "@/lib/news";

type Credentials = { login: string; password: string };

const PRESETS = [
  { label: "Автобус сломался", title: "Автобус временно не выходит на линию", body: "Автобус временно не выполняет рейсы по технической причине. Следите за обновлениями.", kind: "critical" as NewsKind },
  { label: "Актированный день", title: "Сегодня актированный день", body: "В связи с погодными условиями возможны изменения в работе общественного транспорта. Уточняйте информацию перед поездкой.", kind: "warning" as NewsKind },
  { label: "Поздравление", title: "Поздравляем жителей!", body: "Желаем здоровья, благополучия и хорошего настроения!", kind: "holiday" as NewsKind },
];

export default function AdminPage() {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [login, setLogin] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [news, setNews] = useState<ImportantNewsRecord[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<NewsKind>("info");
  const [routeNumber, setRouteNumber] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const loadAdminNews = useCallback(async (creds: Credentials) => {
    const { data, error } = await newsSupabase.rpc("savtobus_admin_news_list", {
      p_login: creds.login,
      p_password: creds.password,
    });
    if (error) throw error;
    setNews((data ?? []) as ImportantNewsRecord[]);
  }, []);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("savtobus-admin");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Credentials;
      setCredentials(saved);
      setLogin(saved.login);
      loadAdminNews(saved).catch(() => {
        window.sessionStorage.removeItem("savtobus-admin");
        setCredentials(null);
      });
    } catch {
      window.sessionStorage.removeItem("savtobus-admin");
    }
  }, [loadAdminNews]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = await newsSupabase.rpc("savtobus_admin_valid", { p_login: login, p_password: password });
    if (error || !data) {
      setMessage("Неверный логин или пароль.");
      setBusy(false);
      return;
    }
    const creds = { login, password };
    window.sessionStorage.setItem("savtobus-admin", JSON.stringify(creds));
    setCredentials(creds);
    await loadAdminNews(creds);
    setPassword("");
    setBusy(false);
  }

  function logout() {
    window.sessionStorage.removeItem("savtobus-admin");
    setCredentials(null);
    setNews([]);
    setMessage("");
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!credentials) return;
    setBusy(true);
    setMessage("");
    const { error } = await newsSupabase.rpc("savtobus_admin_news_create", {
      p_login: credentials.login,
      p_password: credentials.password,
      p_title: title,
      p_body: body,
      p_kind: kind,
      p_route_number: routeNumber || null,
      p_ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    });
    if (error) setMessage("Не удалось опубликовать сообщение.");
    else {
      setMessage("Опубликовано. На сайте сообщение появится автоматически.");
      setTitle(""); setBody(""); setKind("info"); setRouteNumber(""); setEndsAt("");
      await loadAdminNews(credentials);
    }
    setBusy(false);
  }

  async function setActive(item: ImportantNewsRecord, active: boolean) {
    if (!credentials) return;
    setBusy(true);
    await newsSupabase.rpc("savtobus_admin_news_set_active", {
      p_login: credentials.login,
      p_password: credentials.password,
      p_id: item.id,
      p_active: active,
    });
    await loadAdminNews(credentials);
    setBusy(false);
  }

  async function remove(item: ImportantNewsRecord) {
    if (!credentials || !window.confirm(`Удалить «${item.title}»?`)) return;
    setBusy(true);
    await newsSupabase.rpc("savtobus_admin_news_delete", {
      p_login: credentials.login,
      p_password: credentials.password,
      p_id: item.id,
    });
    await loadAdminNews(credentials);
    setBusy(false);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!credentials || newPassword.length < 10) {
      setMessage("Новый пароль должен быть не короче 10 символов.");
      return;
    }
    setBusy(true);
    const { error } = await newsSupabase.rpc("savtobus_admin_change_password", {
      p_login: credentials.login,
      p_password: credentials.password,
      p_new_password: newPassword,
    });
    if (error) setMessage("Не удалось сменить пароль.");
    else {
      const next = { ...credentials, password: newPassword };
      setCredentials(next);
      window.sessionStorage.setItem("savtobus-admin", JSON.stringify(next));
      setNewPassword("");
      setMessage("Пароль изменён.");
    }
    setBusy(false);
  }

  if (!credentials) {
    return (
      <main className="admin-page">
        <section className="admin-login-card">
          <a href="/" className="admin-back">← Вернуться к расписанию</a>
          <div className="admin-badge">SAVTOBUSRASP · ADMIN</div>
          <h1>Вход администратора</h1>
          <p>Здесь можно публиковать важные сообщения для жителей.</p>
          <form onSubmit={signIn} className="admin-form">
            <label>Логин<input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" /></label>
            <label>Пароль<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
            <button disabled={busy} type="submit">{busy ? "Проверяю…" : "Войти"}</button>
          </form>
          {message ? <p className="admin-message">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page admin-dashboard">
      <header className="admin-topbar">
        <div><span>SAVTOBUSRASP</span><strong>Панель администратора</strong></div>
        <div><a href="/">Открыть сайт</a><button type="button" onClick={logout}>Выйти</button></div>
      </header>

      <div className="admin-grid">
        <section className="admin-card admin-compose">
          <div className="admin-card-head"><div><span>ВАЖНЫЕ НОВОСТИ</span><h2>Новое сообщение</h2></div></div>
          <div className="admin-presets">
            {PRESETS.map((preset) => <button type="button" key={preset.label} onClick={() => { setTitle(preset.title); setBody(preset.body); setKind(preset.kind); }}>{preset.label}</button>)}
          </div>
          <form onSubmit={publish} className="admin-form">
            <label>Заголовок<input maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Автобус №1 сломался" /></label>
            <label>Текст<textarea maxLength={1000} required rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Напишите сообщение для жителей…" /></label>
            <div className="admin-form-row">
              <label>Тип<select value={kind} onChange={(e) => setKind(e.target.value as NewsKind)}><option value="info">🚌 Новость</option><option value="warning">⚠️ Внимание</option><option value="critical">🚨 Срочно</option><option value="holiday">🎉 Поздравление</option></select></label>
              <label>Маршрут<select value={routeNumber} onChange={(e) => setRouteNumber(e.target.value)}><option value="">Для всех</option><option value="1">Только №1</option><option value="2">Только №2</option></select></label>
            </div>
            <label>Показывать до (необязательно)<input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
            <button disabled={busy} type="submit">{busy ? "Сохраняю…" : "Опубликовать"}</button>
          </form>
          {message ? <p className="admin-message">{message}</p> : null}
        </section>

        <section className="admin-card">
          <div className="admin-card-head"><div><span>ОПУБЛИКОВАННОЕ</span><h2>Все сообщения</h2></div><button type="button" onClick={() => loadAdminNews(credentials)}>↻</button></div>
          <div className="admin-news-list">
            {!news.length ? <p>Сообщений пока нет.</p> : news.map((item) => (
              <article className={`admin-news-row ${item.active ? "active" : "inactive"}`} key={item.id}>
                <div className="admin-news-meta">{kindIcon(item.kind)} {kindLabel(item.kind)}{item.route_number ? ` · маршрут №${item.route_number}` : " · для всех"}</div>
                <strong>{item.title}</strong><p>{item.body}</p>
                <div className="admin-news-actions"><button type="button" onClick={() => setActive(item, !item.active)}>{item.active ? "Скрыть" : "Показать"}</button><button className="danger" type="button" onClick={() => remove(item)}>Удалить</button></div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-card admin-password-card">
          <div className="admin-card-head"><div><span>БЕЗОПАСНОСТЬ</span><h2>Сменить пароль</h2></div></div>
          <form onSubmit={changePassword} className="admin-form admin-password-form"><label>Новый пароль<input type="password" minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label><button type="submit" disabled={busy}>Сменить пароль</button></form>
        </section>
      </div>
    </main>
  );
}
