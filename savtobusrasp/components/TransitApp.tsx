"use client";

import { useEffect, useMemo, useState } from "react";
import type { RouteStopRecord, ScheduleData, StopTimeRecord, TripRecord } from "@/lib/schedule";

type Direction = "forward" | "return";
type MapPoint = { x: number; y: number };
type TimedEvent = {
  stopId: string;
  stopName: string;
  stopSequence: number;
  seconds: number;
  clock: string;
  estimated: boolean;
  point: MapPoint;
};
type LiveTrip = TripRecord & { events: TimedEvent[]; start: number; end: number };

const mapPoints: MapPoint[] = [
  { x: 8, y: 78 }, { x: 15, y: 70 }, { x: 22, y: 63 }, { x: 30, y: 58 },
  { x: 38, y: 52 }, { x: 46, y: 47 }, { x: 54, y: 53 }, { x: 61, y: 47 },
  { x: 67, y: 39 }, { x: 74, y: 33 }, { x: 80, y: 39 }, { x: 86, y: 31 },
  { x: 91, y: 23 }, { x: 95, y: 16 },
];

const routePolyline = mapPoints.map((point) => `${point.x * 10},${point.y * 6}`).join(" ");

function timeToSeconds(clock: string) {
  const [hours, minutes, seconds = 0] = clock.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatClock(seconds: number, withSeconds = false) {
  const safe = ((Math.floor(seconds) % 86400) + 86400) % 86400;
  const result = [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60]
    .map((part) => String(part).padStart(2, "0"));
  return withSeconds ? result.join(":") : result.slice(0, 2).join(":");
}

function getYakutskSeconds() {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yakutsk",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
}

function formatWait(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${Math.max(1, minutes)} мин`;
}

function sourceDate(date: string | null) {
  if (!date) return "источник не указан";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function createLiveTrips(data: ScheduleData, forwardStops: RouteStopRecord[]): LiveTrip[] {
  const stopById = new Map(data.stops.map((stop) => [stop.id, stop]));
  const forwardPoint = new Map(forwardStops.map((routeStop, index) => [routeStop.stop_id, mapPoints[index] ?? mapPoints[0]]));

  return data.trips.map((trip) => {
    const times = data.stopTimes
      .filter((time) => time.trip_id === trip.id)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);
    const timed = times.filter((time) => time.scheduled_time);
    const firstExact = timeToSeconds(timed[0]?.scheduled_time ?? trip.first_timed_stop);
    const lastExact = timeToSeconds(timed[timed.length - 1]?.scheduled_time ?? trip.first_timed_stop);

    const events = times.map((time, index) => {
      const estimated = !time.scheduled_time;
      const seconds = time.scheduled_time
        ? timeToSeconds(time.scheduled_time)
        : index === 0
          ? firstExact - 120
          : lastExact + (trip.direction === "forward" ? 240 : 120);
      return {
        stopId: time.stop_id,
        stopName: stopById.get(time.stop_id)?.name ?? time.stop_id,
        stopSequence: time.stop_sequence,
        seconds,
        clock: formatClock(seconds),
        estimated,
        point: forwardPoint.get(time.stop_id) ?? mapPoints[0],
      };
    });

    return { ...trip, events, start: events[0].seconds, end: events[events.length - 1].seconds };
  }).sort((a, b) => a.start - b.start);
}

function displayTime(time: StopTimeRecord | undefined) {
  if (!time) return "—";
  if (time.scheduled_time) return time.scheduled_time.slice(0, 5);
  return time.terminal_status ?? "—";
}

export function TransitApp({ initialData }: { initialData: ScheduleData }) {
  const [realSeconds, setRealSeconds] = useState(0);
  const [demoSeconds, setDemoSeconds] = useState(timeToSeconds("07:30"));
  const [demoMode, setDemoMode] = useState(false);
  const [scheduleDirection, setScheduleDirection] = useState<Direction>("forward");

  useEffect(() => {
    const tick = () => demoMode
      ? setDemoSeconds((seconds) => (seconds + 8) % 86400)
      : setRealSeconds(getYakutskSeconds());
    tick();
    const timer = window.setInterval(tick, demoMode ? 250 : 1000);
    return () => window.clearInterval(timer);
  }, [demoMode]);

  const forwardStops = useMemo(
    () => initialData.routeStops.filter((stop) => stop.direction === "forward").sort((a, b) => a.stop_sequence - b.stop_sequence),
    [initialData.routeStops],
  );
  const returnStops = useMemo(
    () => initialData.routeStops.filter((stop) => stop.direction === "return").sort((a, b) => a.stop_sequence - b.stop_sequence),
    [initialData.routeStops],
  );
  const stopById = useMemo(() => new Map(initialData.stops.map((stop) => [stop.id, stop])), [initialData.stops]);
  const liveTrips = useMemo(() => createLiveTrips(initialData, forwardStops), [initialData, forwardStops]);
  const currentSeconds = demoMode ? demoSeconds : realSeconds;

  const live = useMemo(() => {
    if (!liveTrips.length) return null;
    const activeTrip = liveTrips.find((trip) => currentSeconds >= trip.start && currentSeconds <= trip.end);
    const upcomingTrip = liveTrips.find((trip) => trip.start > currentSeconds);
    const selectedTrip = activeTrip ?? upcomingTrip ?? liveTrips[0];
    const waitSeconds = activeTrip ? 0 : upcomingTrip ? upcomingTrip.start - currentSeconds : 86400 - currentSeconds + liveTrips[0].start;
    const positionSeconds = activeTrip ? currentSeconds : selectedTrip.start;
    let nextIndex = selectedTrip.events.findIndex((event) => event.seconds > positionSeconds);
    if (nextIndex === -1) nextIndex = selectedTrip.events.length - 1;
    const previousIndex = Math.max(0, nextIndex - 1);
    const previous = selectedTrip.events[previousIndex];
    const next = selectedTrip.events[nextIndex];
    const span = Math.max(1, next.seconds - previous.seconds);
    const segment = activeTrip ? Math.min(1, Math.max(0, (positionSeconds - previous.seconds) / span)) : 0;
    const x = previous.point.x + (next.point.x - previous.point.x) * segment;
    const y = previous.point.y + (next.point.y - previous.point.y) * segment;
    const progress = activeTrip ? ((positionSeconds - selectedTrip.start) / (selectedTrip.end - selectedTrip.start)) * 100 : 0;
    const passed = new Set(activeTrip ? selectedTrip.events.filter((event) => event.seconds <= positionSeconds).map((event) => event.stopId) : []);
    return { activeTrip, selectedTrip, waitSeconds, next, x, y, progress, passed };
  }, [currentSeconds, liveTrips]);

  if (initialData.error || !initialData.route || !live) {
    return (
      <main className="error-screen">
        <span aria-hidden="true">🚌</span>
        <h1>Расписание временно недоступно</h1>
        <p>{initialData.error ?? "В базе пока нет данных маршрута."}</p>
      </main>
    );
  }

  const directionLabel = live.selectedTrip.direction === "forward" ? "Куонда-Кириэс → РЭС" : "РЭС → Куонда-Кириэс";
  const selectedStops = scheduleDirection === "forward" ? forwardStops : returnStops;
  const selectedTrips = initialData.trips.filter((trip) => trip.direction === scheduleDirection).sort((a, b) => a.first_timed_stop.localeCompare(b.first_timed_stop));

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="SAVTOBUSRASP — на главную">
          <span className="brand-bus" aria-hidden="true">🚌</span>
          <span>SAVTOBUSRASP</span>
        </a>
        <div className={`topbar-status ${live.activeTrip ? "online" : "waiting"}`}>
          <i /> {demoMode ? "Демо движения" : live.activeTrip ? "Автобус в пути" : "Ожидание рейса"}
        </div>
      </header>

      <section className="workspace" id="top">
        <aside className="sidebar">
          <div className="intro">
            <span className="source-label">НАМЦЫ · МАРШРУТ № {initialData.route.route_number}</span>
            <h1>Где мой<br />автобус?</h1>
            <p>Расчётное положение автобуса по расписанию между остановками.</p>
          </div>

          <div className="route-card">
            <div className="route-card-head">
              <span className="route-badge">{initialData.route.route_number}</span>
              <div>
                <strong>{live.activeTrip ? "Автобус следует" : "Следующий рейс"}</strong>
                <span>{directionLabel}</span>
              </div>
            </div>
            <div className="progress-line" aria-label={`Пройдено ${Math.round(live.progress)}% маршрута`}>
              <span style={{ width: `${live.progress}%` }} />
            </div>
            <div className="next-stop">
              <span>{live.activeTrip ? "Следующая остановка" : "До начала рейса"}</span>
              <strong>{live.activeTrip ? live.next.stopName : formatWait(live.waitSeconds)}</strong>
              <small>{live.activeTrip ? `${live.next.estimated ? "расчётно " : "по расписанию "}${live.next.clock}` : directionLabel}</small>
            </div>
          </div>

          <div className="clock-card">
            <div>
              <span>{demoMode ? "Ускоренное время" : "Время в Намцах"}</span>
              <strong>{formatClock(currentSeconds, true)}</strong>
            </div>
            <button type="button" onClick={() => { if (!demoMode) setDemoSeconds(timeToSeconds("07:30")); setDemoMode((mode) => !mode); }}>
              {demoMode ? "Онлайн" : "Показать демо"}
            </button>
          </div>
          <p className="speed-note">{demoMode ? "Демонстрация ускорена в 32 раза" : "Часовой пояс: Якутск, UTC+9"}</p>
        </aside>

        <section className="map-panel" aria-label={`Схема движения маршрута № ${initialData.route.route_number}`}>
          <div className="map-toolbar">
            <div>
              <strong>Маршрут № {initialData.route.route_number} · {initialData.route.locality}</strong>
              <span>{live.activeTrip ? directionLabel : `следующий: ${directionLabel}`}</span>
            </div>
            <span className="map-mode">РАСЧЁТНОЕ ПОЛОЖЕНИЕ</span>
          </div>

          <div className="map-canvas">
            <div className="street-grid" aria-hidden="true" />
            <svg className="route-svg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
              <polyline className="route-shadow" points={routePolyline} />
              <polyline className="route-path" points={routePolyline} />
            </svg>
            {forwardStops.map((routeStop, index) => {
              const stop = stopById.get(routeStop.stop_id);
              const point = mapPoints[index] ?? mapPoints[0];
              const isNext = live.activeTrip && live.next.stopId === routeStop.stop_id;
              const showLabel = index === 0 || index === forwardStops.length - 1 || isNext;
              return (
                <div className={`map-stop ${live.passed.has(routeStop.stop_id) ? "passed" : ""} ${isNext ? "next" : ""}`} key={routeStop.stop_id} style={{ left: `${point.x}%`, top: `${point.y}%` }}>
                  <span className="stop-dot" />
                  <div className={`stop-label ${showLabel ? "visible" : ""}`}>
                    <strong>{stop?.name ?? routeStop.stop_id}</strong>
                    {isNext && <span>следующая · {live.next.clock}</span>}
                  </div>
                </div>
              );
            })}
            <div className={`bus-marker ${live.activeTrip ? "moving" : "parked"}`} style={{ left: `${live.x}%`, top: `${live.y}%` }}>
              {live.activeTrip && <span className="bus-pulse" />}
              <div className="bus-icon" aria-label={`Автобус № ${initialData.route.route_number}`}>🚌</div>
              <strong>№ {initialData.route.route_number}</strong>
            </div>
            <div className="map-legend"><span><i className="legend-bus" /> Автобус</span><span><i className="legend-stop" /> Остановка</span></div>
          </div>
        </section>
      </section>

      <section className="schedule-section">
        <div className="schedule-heading">
          <div>
            <span className="source-label">РАСПИСАНИЕ ОТ {sourceDate(initialData.route.source_date)}</span>
            <h2>Все остановки и рейсы</h2>
          </div>
          <div className="direction-tabs" aria-label="Направление расписания">
            <button className={scheduleDirection === "forward" ? "active" : ""} onClick={() => setScheduleDirection("forward")} type="button">К РЭС</button>
            <button className={scheduleDirection === "return" ? "active" : ""} onClick={() => setScheduleDirection("return")} type="button">К Куонда-Кириэс</button>
          </div>
        </div>

        <div className="schedule-table-wrap">
          <div className="schedule-table" style={{ gridTemplateColumns: `minmax(190px, 1.5fr) repeat(${selectedTrips.length}, minmax(76px, 1fr))` }}>
            <div className="table-head stop-column">Остановка</div>
            {selectedTrips.map((trip) => <div className="table-head" key={trip.id}>{trip.first_timed_stop.slice(0, 5)}</div>)}
            {selectedStops.flatMap((routeStop) => {
              const stop = stopById.get(routeStop.stop_id);
              return [
                <div className="stop-cell" key={`${routeStop.stop_id}-name`}><span>{routeStop.stop_sequence}</span><strong>{stop?.name ?? routeStop.stop_id}</strong></div>,
                ...selectedTrips.map((trip) => {
                  const time = initialData.stopTimes.find((item) => item.trip_id === trip.id && item.stop_id === routeStop.stop_id);
                  return <div className="time-cell" key={`${routeStop.stop_id}-${trip.id}`}>{displayTime(time)}</div>;
                }),
              ];
            })}
          </div>
        </div>
        <p className="schedule-note">Данные загружаются из Supabase. В исходном расписании минуты на конечных обозначены словами «стоянка» и «конечная», поэтому крайние участки на схеме показаны приблизительно.</p>
      </section>

      <footer className="data-footer">
        <span>SUPABASE · ДАННЫЕ ПОДКЛЮЧЕНЫ</span>
        <strong>{initialData.route.name}</strong>
        <p>Координаты остановок можно добавить в базу без изменения сайта.</p>
      </footer>
    </main>
  );
}
