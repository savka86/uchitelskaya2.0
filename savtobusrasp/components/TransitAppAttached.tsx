"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScheduleData, StopTimeRecord, TripRecord } from "@/lib/schedule";

type Direction = "forward" | "return";
type Coordinates = [number, number];
type TimedEvent = {
  stopId: string;
  stopName: string;
  stopSequence: number;
  seconds: number;
  clock: string;
  estimated: boolean;
};
type LiveTrip = TripRecord & { events: TimedEvent[]; start: number; end: number };

const YANDEX_MAPS_API_KEY = "27132710-296f-4362-b23d-6e2b84d5f48a";
const NAMTSY_CENTER: Coordinates = [62.7168, 129.6508];

const ORDER = [
  "kyuonda-kiries",
  "mira",
  "manchary",
  "zamyatina-1",
  "zamyatina-2",
  "zamyatina-3",
  "stacionar",
  "nachalnaya-shkola",
  "pochta",
  "magazin-valeriya",
  "tuelbe",
  "sportivnaya-ploshchadka",
  "stroitelnaya",
  "res",
] as const;

// Точная линия из QR-маршрута Яндекс Карт CTHdiQ9w.
// Яндекс отдаёт её в OG-превью как pl=...; здесь порядок развернут Куонда-Кириэс → РЭС.
// [62.721507, 129.650053] — техническая точка пользователя: она участвует в линии,
// но НЕ является остановкой и отдельной меткой на карте не показывается.
const ROUTE_PATH: Coordinates[] = [
  [62.730216, 129.650616],
  [62.731189, 129.641335],
  [62.725693, 129.641431],
  [62.725136, 129.636351],
  [62.723991, 129.638830],
  [62.722510, 129.637933],
  [62.717581, 129.644213],
  [62.718026, 129.647452],
  [62.718883, 129.649309],
  [62.717079, 129.653853],
  [62.715971, 129.648910],
  [62.717079, 129.653853],
  [62.718440, 129.649822],
  [62.720655, 129.647775],
  [62.720843, 129.649792],
  [62.721507, 129.650053],
  [62.722135, 129.659455],
  [62.711406, 129.666196],
  [62.712609, 129.677703],
  [62.704926, 129.686543],
];

function timeToSeconds(clock: string) {
  const [h, m, s = 0] = clock.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function formatClock(seconds: number, withSeconds = false) {
  const safe = ((Math.floor(seconds) % 86400) + 86400) % 86400;
  const parts = [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60]
    .map((part) => String(part).padStart(2, "0"));
  return withSeconds ? parts.join(":") : parts.slice(0, 2).join(":");
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

function displayTime(time: StopTimeRecord | undefined) {
  if (!time) return "—";
  return time.scheduled_time ? time.scheduled_time.slice(0, 5) : (time.terminal_status ?? "—");
}

function createLiveTrips(data: ScheduleData): LiveTrip[] {
  const stopById = new Map(data.stops.map((stop) => [stop.id, stop]));
  return data.trips.map((trip) => {
    const times = data.stopTimes
      .filter((time) => time.trip_id === trip.id)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);
    const exact = times.filter((time) => time.scheduled_time);
    const firstExact = timeToSeconds(exact[0]?.scheduled_time ?? trip.first_timed_stop);
    const lastExact = timeToSeconds(exact[exact.length - 1]?.scheduled_time ?? trip.first_timed_stop);
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
      };
    });
    return { ...trip, events, start: events[0].seconds, end: events[events.length - 1].seconds };
  }).sort((a, b) => a.start - b.start);
}

function loadYandexMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("Карта доступна только в браузере."));
  const w = window as typeof window & { ymaps?: any; __savtobusYandexPromise?: Promise<void> };
  if (w.ymaps) return Promise.resolve();
  if (w.__savtobusYandexPromise) return w.__savtobusYandexPromise;
  w.__savtobusYandexPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("savtobus-yandex-maps") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Не удалось загрузить Яндекс Карту.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "savtobus-yandex-maps";
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не удалось загрузить Яндекс Карту."));
    document.head.appendChild(script);
  });
  return w.__savtobusYandexPromise;
}

function metersBetween(a: Coordinates, b: Coordinates) {
  const meanLat = ((a[0] + b[0]) / 2) * Math.PI / 180;
  const dy = (b[0] - a[0]) * 111_320;
  const dx = (b[1] - a[1]) * 111_320 * Math.cos(meanLat);
  return Math.hypot(dx, dy);
}

function cumulativeDistances(path: Coordinates[]) {
  const result = [0];
  for (let i = 1; i < path.length; i += 1) {
    result.push(result[i - 1] + metersBetween(path[i - 1], path[i]));
  }
  return result;
}

function pointAtDistance(path: Coordinates[], cumulative: number[], distance: number): Coordinates {
  if (distance <= 0) return path[0];
  const total = cumulative[cumulative.length - 1];
  if (distance >= total) return path[path.length - 1];
  for (let i = 1; i < cumulative.length; i += 1) {
    if (distance <= cumulative[i]) {
      const startD = cumulative[i - 1];
      const span = Math.max(0.0001, cumulative[i] - startD);
      const t = (distance - startD) / span;
      const a = path[i - 1];
      const b = path[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  return path[path.length - 1];
}

function distanceAlongPath(point: Coordinates, path: Coordinates[], cumulative: number[]) {
  let bestDistance = 0;
  let bestError = Number.POSITIVE_INFINITY;

  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const refLat = ((a[0] + b[0] + point[0]) / 3) * Math.PI / 180;
    const scaleX = 111_320 * Math.cos(refLat);
    const scaleY = 111_320;
    const ax = a[1] * scaleX;
    const ay = a[0] * scaleY;
    const bx = b[1] * scaleX;
    const by = b[0] * scaleY;
    const px = point[1] * scaleX;
    const py = point[0] * scaleY;
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
    const cx = ax + vx * t;
    const cy = ay + vy * t;
    const error = (px - cx) ** 2 + (py - cy) ** 2;
    if (error < bestError) {
      bestError = error;
      bestDistance = cumulative[i] + (cumulative[i + 1] - cumulative[i]) * t;
    }
  }
  return bestDistance;
}

export function TransitAppAttached({ initialData }: { initialData: ScheduleData }) {
  const [realSeconds, setRealSeconds] = useState(0);
  const [demoSeconds, setDemoSeconds] = useState(timeToSeconds("07:30"));
  const [demoMode, setDemoMode] = useState(false);
  const [scheduleDirection, setScheduleDirection] = useState<Direction>("forward");
  const [mapMessage, setMapMessage] = useState("Загружаю линию маршрута из QR…");
  const [mapReady, setMapReady] = useState(false);
  const [followBus, setFollowBus] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const busRef = useRef<any>(null);
  const cumulativeRef = useRef<number[]>(cumulativeDistances(ROUTE_PATH));
  const stopDistanceRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const tick = () => demoMode ? setDemoSeconds((s) => (s + 8) % 86400) : setRealSeconds(getYakutskSeconds());
    tick();
    const timer = window.setInterval(tick, demoMode ? 250 : 1000);
    return () => window.clearInterval(timer);
  }, [demoMode]);

  const forwardStops = useMemo(() => {
    const byId = new Map(initialData.routeStops.filter((s) => s.direction === "forward").map((s) => [s.stop_id, s]));
    return ORDER.map((id, index) => byId.get(id) ?? ({
      route_id: initialData.route?.id ?? "namtsy-2",
      direction: "forward" as const,
      stop_id: id,
      stop_sequence: index + 1,
    }));
  }, [initialData.route?.id, initialData.routeStops]);

  const returnStops = useMemo(
    () => initialData.routeStops.filter((s) => s.direction === "return").sort((a, b) => a.stop_sequence - b.stop_sequence),
    [initialData.routeStops],
  );
  const stopById = useMemo(() => new Map(initialData.stops.map((stop) => [stop.id, stop])), [initialData.stops]);
  const liveTrips = useMemo(() => createLiveTrips(initialData), [initialData]);
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
    const progress = activeTrip ? ((positionSeconds - selectedTrip.start) / Math.max(1, selectedTrip.end - selectedTrip.start)) * 100 : 0;
    return { activeTrip, selectedTrip, waitSeconds, previous, next, segment, progress };
  }, [currentSeconds, liveTrips]);

  useEffect(() => {
    if (!mapContainerRef.current || !forwardStops.length) return;
    let cancelled = false;

    const init = async () => {
      try {
        await loadYandexMaps();
        if (cancelled || !mapContainerRef.current) return;
        const ymaps = (window as typeof window & { ymaps?: any }).ymaps;
        await new Promise<void>((resolve) => ymaps.ready(resolve));
        if (cancelled || !mapContainerRef.current) return;

        const map = new ymaps.Map(mapContainerRef.current, {
          center: NAMTSY_CENTER,
          zoom: 14,
          controls: ["zoomControl", "geolocationControl", "typeSelector"],
        }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
        mapRef.current = map;
        stopDistanceRef.current = new Map();
        const cumulative = cumulativeRef.current;

        map.geoObjects.add(new ymaps.Polyline(ROUTE_PATH, {}, {
          strokeColor: "#2864dc",
          strokeWidth: 8,
          strokeOpacity: 0.96,
        }));

        for (let index = 0; index < forwardStops.length; index += 1) {
          const routeStop = forwardStops[index];
          const stop = stopById.get(routeStop.stop_id);
          if (!Number.isFinite(stop?.latitude) || !Number.isFinite(stop?.longitude)) {
            throw new Error(`Нет координат остановки ${stop?.name ?? routeStop.stop_id}`);
          }
          const coords: Coordinates = [Number(stop?.latitude), Number(stop?.longitude)];
          stopDistanceRef.current.set(routeStop.stop_id, distanceAlongPath(coords, ROUTE_PATH, cumulative));
          map.geoObjects.add(new ymaps.Placemark(coords, {
            iconContent: String(index + 1),
            balloonContentHeader: `${index + 1}. ${stop?.name ?? routeStop.stop_id}`,
            balloonContentBody: "Остановка маршрута № 2",
          }, { preset: "islands#blueCircleIcon", iconColor: "#2864dc" }));
        }

        const busLayout = ymaps.templateLayoutFactory.createClass(
          `<div style="display:flex;align-items:center;gap:5px;transform:translate(-24px,-24px);white-space:nowrap;">
            <div style="display:grid;width:48px;height:48px;place-items:center;border:4px solid white;border-radius:15px;background:#c9f04a;box-shadow:0 8px 22px rgba(26,49,88,.35);font-size:27px;">🚌</div>
            <b style="padding:6px 8px;border-radius:8px;background:#182132;color:white;font:800 12px Arial,sans-serif;">№ ${initialData.route?.route_number ?? "2"}</b>
          </div>`
        );
        const bus = new ymaps.Placemark(ROUTE_PATH[0], {}, {
          iconLayout: busLayout,
          iconShape: { type: "Circle", coordinates: [0, 0], radius: 28 },
          zIndex: 10000,
        });
        busRef.current = bus;
        map.geoObjects.add(bus);

        const bounds = map.geoObjects.getBounds?.();
        if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 45 });
        setMapReady(true);
        setMapMessage("Маршрут взят из QR Яндекс · автобус прикреплён к линии дороги");
      } catch (error) {
        setMapMessage(error instanceof Error ? error.message : "Не удалось показать маршрут.");
        setMapReady(false);
      }
    };

    init();
    return () => {
      cancelled = true;
      try { mapRef.current?.destroy?.(); } catch { /* noop */ }
      mapRef.current = null;
      busRef.current = null;
      stopDistanceRef.current.clear();
    };
  }, [forwardStops, initialData.route?.route_number, stopById]);

  useEffect(() => {
    if (!mapReady || !live || !busRef.current) return;
    const previousDistance = stopDistanceRef.current.get(live.previous.stopId);
    const nextDistance = stopDistanceRef.current.get(live.next.stopId);
    if (previousDistance == null || nextDistance == null) return;

    const busDistance = previousDistance + (nextDistance - previousDistance) * live.segment;
    const position = pointAtDistance(ROUTE_PATH, cumulativeRef.current, busDistance);
    busRef.current.geometry?.setCoordinates?.(position);
    busRef.current.properties?.set?.("hintContent", live.activeTrip
      ? `Автобус № ${initialData.route?.route_number ?? "2"} · следующая: ${live.next.stopName}`
      : `Автобус № ${initialData.route?.route_number ?? "2"} · ожидает рейс`);

    if (followBus && live.activeTrip && Math.floor(currentSeconds) % 5 === 0) {
      mapRef.current?.panTo?.(position, { flying: false, duration: 350 });
    }
  }, [currentSeconds, followBus, initialData.route?.route_number, live, mapReady]);

  if (initialData.error || !initialData.route || !live) {
    return <main className="error-screen"><span>🚌</span><h1>Расписание временно недоступно</h1><p>{initialData.error ?? "Нет данных."}</p></main>;
  }

  const directionLabel = live.selectedTrip.direction === "forward" ? "Куонда-Кириэс → РЭС" : "РЭС → Куонда-Кириэс";
  const selectedStops = scheduleDirection === "forward" ? forwardStops : returnStops;
  const selectedTrips = initialData.trips
    .filter((trip) => trip.direction === scheduleDirection)
    .sort((a, b) => a.first_timed_stop.localeCompare(b.first_timed_stop));

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-bus">🚌</span><span>SAVTOBUSRASP</span></a>
        <div className={`topbar-status ${live.activeTrip ? "online" : "waiting"}`}><i />{demoMode ? "Демо движения" : live.activeTrip ? "Автобус в пути" : "Ожидание рейса"}</div>
      </header>

      <section className="workspace" id="top">
        <aside className="sidebar">
          <div className="intro">
            <span className="source-label">НАМЦЫ · МАРШРУТ № {initialData.route.route_number}</span>
            <h1>Где мой<br />автобус?</h1>
            <p>Автобус движется расчётно по расписанию и всегда остаётся на линии маршрута.</p>
          </div>
          <div className="route-card">
            <div className="route-card-head"><span className="route-badge">{initialData.route.route_number}</span><div><strong>{live.activeTrip ? "Автобус следует" : "Следующий рейс"}</strong><span>{directionLabel}</span></div></div>
            <div className="progress-line"><span style={{ width: `${live.progress}%` }} /></div>
            <div className="next-stop"><span>{live.activeTrip ? "Следующая остановка" : "До начала рейса"}</span><strong>{live.activeTrip ? live.next.stopName : formatWait(live.waitSeconds)}</strong><small>{live.activeTrip ? `${live.next.estimated ? "расчётно " : "по расписанию "}${live.next.clock}` : directionLabel}</small></div>
          </div>
          <div className="clock-card"><div><span>{demoMode ? "Ускоренное время" : "Время в Намцах"}</span><strong>{formatClock(currentSeconds, true)}</strong></div><button type="button" onClick={() => { if (!demoMode) setDemoSeconds(timeToSeconds("07:30")); setDemoMode((m) => !m); }}>{demoMode ? "Онлайн" : "Показать демо"}</button></div>
          <p className="speed-note">{demoMode ? "Демонстрация ускорена в 32 раза" : "Часовой пояс: Якутск, UTC+9"}</p>
        </aside>

        <section className="map-panel" aria-label="Яндекс Карта маршрута № 2">
          <div className="map-toolbar"><div><strong>Маршрут № {initialData.route.route_number} · {initialData.route.locality}</strong><span>{live.activeTrip ? directionLabel : `следующий: ${directionLabel}`}</span></div><span className="map-mode">ЯНДЕКС · ЛИНИЯ ИЗ QR</span></div>
          <div className="map-canvas">
            <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", left: 14, bottom: 14, zIndex: 20, maxWidth: "calc(100% - 28px)", display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 12, background: "rgba(255,255,255,.94)", boxShadow: "0 5px 18px rgba(24,33,50,.16)", color: "#526075", fontSize: 10, fontWeight: 800 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: mapReady ? "#31b26b" : "#f59e0b" }} />{mapMessage}</div>
            <div style={{ position: "absolute", right: 14, top: 14, zIndex: 20, display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { const bounds = mapRef.current?.geoObjects?.getBounds?.(); if (bounds) mapRef.current?.setBounds?.(bounds, { checkZoomRange: true, zoomMargin: 45 }); }} style={{ border: "1px solid #d9e0eb", borderRadius: 10, background: "rgba(255,255,255,.96)", padding: "9px 11px", cursor: "pointer", fontSize: 10, fontWeight: 800 }}>Весь маршрут</button>
              <button type="button" onClick={() => setFollowBus((v) => !v)} style={{ border: 0, borderRadius: 10, background: followBus ? "#2864dc" : "#182132", color: "white", padding: "9px 11px", cursor: "pointer", fontSize: 10, fontWeight: 800 }}>{followBus ? "Слежу за 🚌" : "Следить за 🚌"}</button>
            </div>
          </div>
        </section>
      </section>

      <section className="schedule-section">
        <div className="schedule-heading"><div><span className="source-label">РАСПИСАНИЕ · 2024</span><h2>Все остановки и рейсы</h2></div><div className="direction-tabs"><button className={scheduleDirection === "forward" ? "active" : ""} onClick={() => setScheduleDirection("forward")} type="button">К РЭС</button><button className={scheduleDirection === "return" ? "active" : ""} onClick={() => setScheduleDirection("return")} type="button">К Куонда-Кириэс</button></div></div>
        <div className="schedule-table-wrap"><div className="schedule-table" style={{ gridTemplateColumns: `minmax(190px, 1.5fr) repeat(${selectedTrips.length}, minmax(76px, 1fr))` }}>
          <div className="table-head stop-column">Остановка</div>
          {selectedTrips.map((trip) => <div className="table-head" key={trip.id}>{trip.first_timed_stop.slice(0, 5)}</div>)}
          {selectedStops.flatMap((routeStop) => {
            const stop = stopById.get(routeStop.stop_id);
            return [<div className="stop-cell" key={`${routeStop.stop_id}-name`}><span>{routeStop.stop_sequence}</span><strong>{stop?.name ?? routeStop.stop_id}</strong></div>, ...selectedTrips.map((trip) => { const time = initialData.stopTimes.find((item) => item.trip_id === trip.id && item.stop_id === routeStop.stop_id); return <div className="time-cell" key={`${routeStop.stop_id}-${trip.id}`}>{displayTime(time)}</div>; })];
          })}
        </div></div>
        <p className="schedule-note">Линия маршрута взята из переданного QR Яндекс Карт. Автобус прикреплён к этой линии и перемещается по ней между остановками согласно расписанию; это расчёт, не GPS.</p>
      </section>

      <footer className="data-footer"><span>ЯНДЕКС КАРТА · QR-МАРШРУТ · SUPABASE</span><strong>{initialData.route.name}</strong><p>Маршрут № {initialData.route.route_number} · расчётное движение по расписанию.</p></footer>
    </main>
  );
}
