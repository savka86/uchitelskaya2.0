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

// Промежуточные повороты вручную сняты с дорожной сетки Яндекс Карты.
// Концы каждого участка всегда заменяются точными координатами остановок из Supabase.
const MANUAL_BENDS: Record<string, Coordinates[]> = {
  "kyuonda-kiries|mira": [
    [62.729863762, 129.648019871],
    [62.729785628, 129.645447122],
  ],
  "mira|manchary": [
    [62.729668486, 129.641330716],
    [62.728684339, 129.641160011],
  ],
  "manchary|zamyatina-1": [
    [62.726125455, 129.641162131],
    [62.724944731, 129.639876702],
    [62.723960945, 129.638162308],
  ],
  "zamyatina-1|zamyatina-2": [
    [62.721795635, 129.638592904],
    [62.720929270, 129.639794269],
  ],
  "zamyatina-2|zamyatina-3": [
    [62.719235989, 129.641853923],
    [62.718369645, 129.642969527],
  ],
  "zamyatina-3|stacionar": [
    [62.718171987, 129.646485870],
    [62.718014057, 129.648458492],
    [62.717265475, 129.651031926],
    [62.716832133, 129.652318692],
    [62.716596328, 129.650603678],
  ],
  "stacionar|nachalnaya-shkola": [
    [62.716596328, 129.650603678],
    [62.716832133, 129.652318692],
    [62.717461512, 129.654462183],
    [62.718248360, 129.656605543],
    [62.719232447, 129.657033529],
    [62.720216633, 129.657032714],
    [62.720806845, 129.658318632],
  ],
  "nachalnaya-shkola|pochta": [
    [62.720215933, 129.660034331],
    [62.719034749, 129.660721394],
    [62.718168485, 129.661493956],
  ],
  "pochta|magazin-valeriya": [
    [62.716081589, 129.663296655],
    [62.714703548, 129.664069641],
    [62.713325427, 129.665185669],
    [62.711868450, 129.666816325],
  ],
  "magazin-valeriya|tuelbe": [
    [62.711828462, 129.669474933],
  ],
  "tuelbe|sportivnaya-ploshchadka": [
    [62.712181869, 129.673333861],
  ],
  "sportivnaya-ploshchadka|stroitelnaya": [
    [62.711551049, 129.677365126],
    [62.710842155, 129.678566360],
  ],
  "stroitelnaya|res": [
    [62.709188081, 129.681312065],
    [62.708006717, 129.682770972],
    [62.706825393, 129.684058358],
    [62.705644069, 129.685345744],
  ],
};

function key(from: string, to: string) {
  return `${from}|${to}`;
}

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

function sourceDate(date: string | null) {
  if (!date) return "источник не указан";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
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
        : index === 0 ? firstExact - 120 : lastExact + (trip.direction === "forward" ? 240 : 120);
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

function distanceMeters(a: Coordinates, b: Coordinates) {
  const meanLat = ((a[0] + b[0]) / 2) * Math.PI / 180;
  const dy = (b[0] - a[0]) * 111_320;
  const dx = (b[1] - a[1]) * 111_320 * Math.cos(meanLat);
  return Math.hypot(dx, dy);
}

function positionAlong(line: Coordinates[], progress: number): Coordinates | null {
  if (!line.length) return null;
  if (line.length === 1) return line[0];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    const length = distanceMeters(line[i], line[i + 1]);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return line[0];
  const target = Math.max(0, Math.min(1, progress)) * total;
  let travelled = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    if (travelled + lengths[i] >= target) {
      const t = lengths[i] ? (target - travelled) / lengths[i] : 0;
      const a = line[i], b = line[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    travelled += lengths[i];
  }
  return line[line.length - 1];
}

export function TransitAppManual({ initialData }: { initialData: ScheduleData }) {
  const [realSeconds, setRealSeconds] = useState(0);
  const [demoSeconds, setDemoSeconds] = useState(timeToSeconds("07:30"));
  const [demoMode, setDemoMode] = useState(false);
  const [scheduleDirection, setScheduleDirection] = useState<Direction>("forward");
  const [mapMessage, setMapMessage] = useState("Рисую маршрут вручную по дорогам…");
  const [mapReady, setMapReady] = useState(false);
  const [followBus, setFollowBus] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const busRef = useRef<any>(null);
  const segmentsRef = useRef<Map<string, Coordinates[]>>(new Map());

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

        const exact = new Map<string, Coordinates>();
        for (const routeStop of forwardStops) {
          const stop = stopById.get(routeStop.stop_id);
          if (!Number.isFinite(stop?.latitude) || !Number.isFinite(stop?.longitude)) {
            throw new Error(`Нет координат остановки ${stop?.name ?? routeStop.stop_id}`);
          }
          exact.set(routeStop.stop_id, [Number(stop?.latitude), Number(stop?.longitude)]);
        }

        const map = new ymaps.Map(mapContainerRef.current, {
          center: NAMTSY_CENTER,
          zoom: 14,
          controls: ["zoomControl", "geolocationControl", "typeSelector"],
        }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
        mapRef.current = map;
        segmentsRef.current = new Map();

        forwardStops.forEach((routeStop, index) => {
          const stop = stopById.get(routeStop.stop_id);
          map.geoObjects.add(new ymaps.Placemark(exact.get(routeStop.stop_id), {
            iconContent: String(index + 1),
            balloonContentHeader: `${index + 1}. ${stop?.name ?? routeStop.stop_id}`,
            balloonContentBody: "Точная остановка маршрута № 2",
          }, { preset: "islands#blueCircleIcon", iconColor: "#2864dc" }));
        });

        for (let i = 0; i < forwardStops.length - 1; i += 1) {
          const from = forwardStops[i].stop_id;
          const to = forwardStops[i + 1].stop_id;
          const start = exact.get(from)!;
          const end = exact.get(to)!;
          const line = [start, ...(MANUAL_BENDS[key(from, to)] ?? []), end];
          segmentsRef.current.set(key(from, to), line);
          segmentsRef.current.set(key(to, from), [...line].reverse());
          map.geoObjects.add(new ymaps.Polyline(line, {}, {
            strokeColor: "#2864dc",
            strokeWidth: 7,
            strokeOpacity: 0.95,
          }));
        }

        const busLayout = ymaps.templateLayoutFactory.createClass(
          `<div style="display:flex;align-items:center;gap:5px;transform:translate(-24px,-24px);white-space:nowrap;">
            <div style="display:grid;width:48px;height:48px;place-items:center;border:4px solid white;border-radius:15px;background:#c9f04a;box-shadow:0 8px 22px rgba(26,49,88,.35);font-size:27px;">🚌</div>
            <b style="padding:6px 8px;border-radius:8px;background:#182132;color:white;font:800 12px Arial,sans-serif;">№ ${initialData.route?.route_number ?? "2"}</b>
          </div>`
        );
        const bus = new ymaps.Placemark(exact.get(forwardStops[0].stop_id), {}, {
          iconLayout: busLayout,
          iconShape: { type: "Circle", coordinates: [0, 0], radius: 28 },
          zIndex: 10000,
        });
        busRef.current = bus;
        map.geoObjects.add(bus);

        const bounds = map.geoObjects.getBounds?.();
        if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 45 });
        setMapReady(true);
        setMapMessage("Маршрут вручную проложен по улицам · Яндекс используется только как карта");
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
      segmentsRef.current.clear();
    };
  }, [forwardStops, initialData.route?.route_number, stopById]);

  useEffect(() => {
    if (!mapReady || !live || !busRef.current) return;
    const line = segmentsRef.current.get(key(live.previous.stopId, live.next.stopId));
    if (!line) return;
    const position = positionAlong(line, live.segment);
    if (!position) return;
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
            <p>Маршрут нарисован вручную по улицам. Автобус движется по нему расчётно по расписанию.</p>
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
          <div className="map-toolbar"><div><strong>Маршрут № {initialData.route.route_number} · {initialData.route.locality}</strong><span>{live.activeTrip ? directionLabel : `следующий: ${directionLabel}`}</span></div><span className="map-mode">РУЧНОЙ МАРШРУТ · ЯНДЕКС КАРТА</span></div>
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
        <div className="schedule-heading"><div><span className="source-label">РАСПИСАНИЕ ОТ {sourceDate(initialData.route.source_date)}</span><h2>Все остановки и рейсы</h2></div><div className="direction-tabs"><button className={scheduleDirection === "forward" ? "active" : ""} onClick={() => setScheduleDirection("forward")} type="button">К РЭС</button><button className={scheduleDirection === "return" ? "active" : ""} onClick={() => setScheduleDirection("return")} type="button">К Куонда-Кириэс</button></div></div>
        <div className="schedule-table-wrap"><div className="schedule-table" style={{ gridTemplateColumns: `minmax(190px, 1.5fr) repeat(${selectedTrips.length}, minmax(76px, 1fr))` }}>
          <div className="table-head stop-column">Остановка</div>
          {selectedTrips.map((trip) => <div className="table-head" key={trip.id}>{trip.first_timed_stop.slice(0, 5)}</div>)}
          {selectedStops.flatMap((routeStop) => {
            const stop = stopById.get(routeStop.stop_id);
            return [<div className="stop-cell" key={`${routeStop.stop_id}-name`}><span>{routeStop.stop_sequence}</span><strong>{stop?.name ?? routeStop.stop_id}</strong></div>, ...selectedTrips.map((trip) => { const time = initialData.stopTimes.find((item) => item.trip_id === trip.id && item.stop_id === routeStop.stop_id); return <div className="time-cell" key={`${routeStop.stop_id}-${trip.id}`}>{displayTime(time)}</div>; })];
          })}
        </div></div>
        <p className="schedule-note">Яндекс используется только как подложка карты. Линия маршрута и движение автобуса заданы нами вручную по дорожной сети Намцев; это не GPS.</p>
      </section>

      <footer className="data-footer"><span>РУЧНОЙ МАРШРУТ · ЯНДЕКС КАРТА · SUPABASE</span><strong>{initialData.route.name}</strong><p>Маршрут № {initialData.route.route_number} · расчётное движение по расписанию.</p></footer>
    </main>
  );
}
