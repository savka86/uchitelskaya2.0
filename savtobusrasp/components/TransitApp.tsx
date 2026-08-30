"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RouteStopRecord, ScheduleData, StopTimeRecord, TripRecord } from "@/lib/schedule";

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
const NAMTSY_CENTER: Coordinates = [62.7164, 129.6658];

const STOP_ADDRESSES: Record<string, string> = {
  "kyuonda-kiries": "Республика Саха (Якутия), Намский район, село Намцы, улица Куонда-Кириэс",
  "mira": "Республика Саха (Якутия), Намский район, село Намцы, улица Мира",
  "manchary": "Республика Саха (Якутия), Намский район, село Намцы, улица Манчаары",
  "zamyatina-1": "Республика Саха (Якутия), Намский район, село Намцы, улица Т. Замятина, 11",
  "zamyatina-2": "Республика Саха (Якутия), Намский район, село Намцы, улица Т. Замятина",
  "zamyatina-3": "Республика Саха (Якутия), Намский район, село Намцы, улица Т. Замятина, 50",
  "stacionar": "Республика Саха (Якутия), Намский район, село Намцы, Новобольничная улица, 5",
  "nachalnaya-shkola": "Республика Саха (Якутия), Намский район, село Намцы, улица Степана Платонова, 14/1",
  "pochta": "Республика Саха (Якутия), Намский район, село Намцы, улица Ленина, 4",
  "magazin-valeriya": "Республика Саха (Якутия), Намский район, село Намцы, улица Цугель-Аммосовой, 7/1",
  "tuelbe": "Республика Саха (Якутия), Намский район, село Намцы, улица М. Аммосова, 40",
  "sportivnaya-ploshchadka": "Республика Саха (Якутия), Намский район, село Намцы, улица Ленина, 16/2",
  "stroitelnaya": "Республика Саха (Якутия), Намский район, село Намцы, Строительная улица, 47/1",
  "res": "Республика Саха (Якутия), Намский район, село Намцы, Строительная улица, 59",
};

// Проверенные адресные точки. Для остальных остановок координаты получает Яндекс
// непосредственно по полному адресу выше. Никаких нарисованных fallback-точек нет.
const KNOWN_COORDS: Record<string, Coordinates> = {
  "kyuonda-kiries": [62.7314284, 129.650093],
  "mira": [62.7305783, 129.6436157],
  "stacionar": [62.71602, 129.648278],
  "nachalnaya-shkola": [62.7206, 129.6582],
  "pochta": [62.717681, 129.661436],
  "magazin-valeriya": [62.711857, 129.667855],
  "tuelbe": [62.711736, 129.67213],
  "stroitelnaya": [62.707786, 129.683986],
  "res": [62.704937, 129.686876],
};

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

function createLiveTrips(data: ScheduleData): LiveTrip[] {
  const stopById = new Map(data.stops.map((stop) => [stop.id, stop]));

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

function loadYandexMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("Карта доступна только в браузере."));
  const globalWindow = window as typeof window & { ymaps?: any; __savtobusYandexPromise?: Promise<void> };
  if (globalWindow.ymaps) return Promise.resolve();
  if (globalWindow.__savtobusYandexPromise) return globalWindow.__savtobusYandexPromise;

  globalWindow.__savtobusYandexPromise = new Promise<void>((resolve, reject) => {
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
    script.onerror = () => reject(new Error("Не удалось загрузить Яндекс Карту. Проверьте API-ключ и разрешённый домен."));
    document.head.appendChild(script);
  });
  return globalWindow.__savtobusYandexPromise;
}

function isNamtsyCoordinate(coords: unknown): coords is Coordinates {
  if (!Array.isArray(coords) || coords.length < 2) return false;
  const lat = Number(coords[0]);
  const lon = Number(coords[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 62.65 && lat <= 62.80 && lon >= 129.50 && lon <= 129.85;
}

async function geocodeAddress(ymaps: any, address: string): Promise<Coordinates | null> {
  try {
    const result = await ymaps.geocode(address, { results: 1 });
    const object = result.geoObjects.get(0);
    const coords = object?.geometry?.getCoordinates?.();
    return isNamtsyCoordinate(coords) ? [Number(coords[0]), Number(coords[1])] : null;
  } catch {
    return null;
  }
}

export function TransitApp({ initialData }: { initialData: ScheduleData }) {
  const [realSeconds, setRealSeconds] = useState(0);
  const [demoSeconds, setDemoSeconds] = useState(timeToSeconds("07:30"));
  const [demoMode, setDemoMode] = useState(false);
  const [scheduleDirection, setScheduleDirection] = useState<Direction>("forward");
  const [mapMessage, setMapMessage] = useState("Загружаю Яндекс Карту…");
  const [mapReady, setMapReady] = useState(false);
  const [followBus, setFollowBus] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const yandexMapRef = useRef<any>(null);
  const busPlacemarkRef = useRef<any>(null);
  const routeObjectRef = useRef<any>(null);
  const stopCoordsRef = useRef<Map<string, Coordinates>>(new Map());

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
    const progress = activeTrip ? ((positionSeconds - selectedTrip.start) / (selectedTrip.end - selectedTrip.start)) * 100 : 0;
    return { activeTrip, selectedTrip, waitSeconds, previous, next, segment, progress };
  }, [currentSeconds, liveTrips]);

  useEffect(() => {
    if (!mapContainerRef.current || !forwardStops.length) return;
    let cancelled = false;

    const initializeMap = async () => {
      try {
        await loadYandexMaps();
        if (cancelled || !mapContainerRef.current) return;
        const ymaps = (window as typeof window & { ymaps?: any }).ymaps;
        if (!ymaps) throw new Error("Яндекс Карты не инициализировались.");
        await new Promise<void>((resolve) => ymaps.ready(resolve));
        if (cancelled || !mapContainerRef.current) return;

        const map = new ymaps.Map(mapContainerRef.current, {
          center: NAMTSY_CENTER,
          zoom: 14,
          controls: ["zoomControl", "geolocationControl"],
        }, {
          suppressMapOpenBlock: true,
          yandexMapDisablePoiInteractivity: true,
        });
        yandexMapRef.current = map;
        stopCoordsRef.current = new Map();

        const routeCoordinates: Coordinates[] = [];
        const missingStops: string[] = [];

        for (let index = 0; index < forwardStops.length; index += 1) {
          if (cancelled) return;
          const routeStop = forwardStops[index];
          const stop = stopById.get(routeStop.stop_id);
          const stopName = stop?.name ?? routeStop.stop_id;
          const address = STOP_ADDRESSES[routeStop.stop_id] ?? `Республика Саха (Якутия), село Намцы, ${stopName}`;
          setMapMessage(`Ищу адрес: ${index + 1}/${forwardStops.length} · ${stopName}`);

          let coords: Coordinates | null = null;
          if (Number.isFinite(stop?.latitude) && Number.isFinite(stop?.longitude)) {
            const dbCoords: Coordinates = [Number(stop?.latitude), Number(stop?.longitude)];
            if (isNamtsyCoordinate(dbCoords)) coords = dbCoords;
          }
          if (!coords && KNOWN_COORDS[routeStop.stop_id]) coords = KNOWN_COORDS[routeStop.stop_id];
          if (!coords) coords = await geocodeAddress(ymaps, address);

          if (!coords) {
            missingStops.push(stopName);
            continue;
          }

          stopCoordsRef.current.set(routeStop.stop_id, coords);
          routeCoordinates.push(coords);

          const placemark = new ymaps.Placemark(coords, {
            iconContent: String(index + 1),
            balloonContentHeader: `${index + 1}. ${stopName}`,
            balloonContentBody: `<b>Адрес:</b><br>${address}<br><br>Маршрут № ${initialData.route?.route_number ?? "2"}`,
            hintContent: `${index + 1}. ${stopName}`,
          }, {
            preset: "islands#blueCircleIcon",
            iconColor: "#2864dc",
          });
          map.geoObjects.add(placemark);
        }

        if (routeCoordinates.length >= 2) {
          const fallbackLine = new ymaps.Polyline(routeCoordinates, {}, {
            strokeColor: "#2864dc",
            strokeWidth: 5,
            strokeOpacity: 0.35,
          });
          map.geoObjects.add(fallbackLine);
          routeObjectRef.current = fallbackLine;

          try {
            const multiRoute = new ymaps.multiRouter.MultiRoute({
              referencePoints: routeCoordinates,
              params: { routingMode: "auto", results: 1 },
            }, {
              boundsAutoApply: false,
              routeActiveStrokeColor: "#2864dc",
              routeActiveStrokeWidth: 7,
              routeStrokeColor: "#8aaef2",
              routeStrokeWidth: 4,
              wayPointVisible: false,
              viaPointVisible: false,
            });
            map.geoObjects.add(multiRoute);
            routeObjectRef.current = multiRoute;
          } catch {
            // Если маршрутизация дорог временно недоступна, остаётся линия по реальным меткам.
          }
        }

        const firstCoordinate = routeCoordinates[0];
        if (firstCoordinate) {
          const busLayout = ymaps.templateLayoutFactory.createClass(
            `<div style="display:flex;align-items:center;gap:5px;transform:translate(-24px,-24px);white-space:nowrap;">
              <div style="display:grid;width:48px;height:48px;place-items:center;border:4px solid white;border-radius:15px;background:#c9f04a;box-shadow:0 8px 22px rgba(26,49,88,.35);font-size:27px;">🚌</div>
              <b style="padding:6px 8px;border-radius:8px;background:#182132;color:white;font:800 12px Arial,sans-serif;">№ ${initialData.route?.route_number ?? "2"}</b>
            </div>`,
          );
          const bus = new ymaps.Placemark(firstCoordinate, {
            hintContent: `Автобус № ${initialData.route?.route_number ?? "2"}`,
          }, {
            iconLayout: busLayout,
            iconShape: { type: "Circle", coordinates: [0, 0], radius: 28 },
            zIndex: 10000,
          });
          busPlacemarkRef.current = bus;
          map.geoObjects.add(bus);
        }

        const bounds = map.geoObjects.getBounds?.();
        if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 55 });

        setMapReady(routeCoordinates.length > 0);
        setMapMessage(missingStops.length === 0
          ? `Яндекс Карта · ${routeCoordinates.length}/${forwardStops.length} остановок по адресам`
          : `По адресам найдено ${routeCoordinates.length}/${forwardStops.length}. Не найдены: ${missingStops.join(", ")}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось загрузить Яндекс Карту.";
        setMapMessage(message);
        setMapReady(false);
      }
    };

    initializeMap();
    return () => {
      cancelled = true;
      try { yandexMapRef.current?.destroy?.(); } catch { /* noop */ }
      yandexMapRef.current = null;
      busPlacemarkRef.current = null;
      routeObjectRef.current = null;
      stopCoordsRef.current.clear();
    };
  }, [forwardStops, initialData.route?.route_number, stopById]);

  useEffect(() => {
    if (!mapReady || !live || !busPlacemarkRef.current) return;
    const previous = stopCoordsRef.current.get(live.previous.stopId);
    const next = stopCoordsRef.current.get(live.next.stopId);
    if (!previous || !next) return;
    const position: Coordinates = [
      previous[0] + (next[0] - previous[0]) * live.segment,
      previous[1] + (next[1] - previous[1]) * live.segment,
    ];
    busPlacemarkRef.current.geometry?.setCoordinates?.(position);
    busPlacemarkRef.current.properties?.set?.("hintContent", live.activeTrip
      ? `Автобус № ${initialData.route?.route_number ?? "2"} · следующая: ${live.next.stopName}`
      : `Автобус № ${initialData.route?.route_number ?? "2"} · ожидает рейс`);

    if (followBus && live.activeTrip && Math.floor(currentSeconds) % 5 === 0) {
      yandexMapRef.current?.panTo?.(position, { flying: false, duration: 350 });
    }
  }, [currentSeconds, followBus, initialData.route?.route_number, live, mapReady]);

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

        <section className="map-panel" aria-label={`Яндекс Карта маршрута № ${initialData.route.route_number}`}>
          <div className="map-toolbar">
            <div>
              <strong>Маршрут № {initialData.route.route_number} · {initialData.route.locality}</strong>
              <span>{live.activeTrip ? directionLabel : `следующий: ${directionLabel}`}</span>
            </div>
            <span className="map-mode">ЯНДЕКС КАРТА · ПО АДРЕСАМ</span>
          </div>

          <div className="map-canvas">
            <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />
            <div style={{
              position: "absolute", left: 14, bottom: 14, zIndex: 20, maxWidth: "calc(100% - 28px)",
              display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 12,
              background: "rgba(255,255,255,.94)", boxShadow: "0 5px 18px rgba(24,33,50,.16)",
              color: "#526075", fontSize: 10, fontWeight: 800,
            }}>
              <span style={{ width: 8, height: 8, flex: "0 0 auto", borderRadius: "50%", background: mapReady ? "#31b26b" : "#f59e0b" }} />
              <span>{mapMessage}</span>
            </div>
            <div style={{ position: "absolute", right: 14, top: 14, zIndex: 20, display: "flex", gap: 8 }}>
              <button type="button" onClick={() => {
                const bounds = yandexMapRef.current?.geoObjects?.getBounds?.();
                if (bounds) yandexMapRef.current?.setBounds?.(bounds, { checkZoomRange: true, zoomMargin: 55 });
              }} style={{ border: "1px solid #d9e0eb", borderRadius: 10, background: "rgba(255,255,255,.96)", padding: "9px 11px", cursor: "pointer", fontSize: 10, fontWeight: 800 }}>
                Весь маршрут
              </button>
              <button type="button" onClick={() => setFollowBus((value) => !value)} style={{ border: 0, borderRadius: 10, background: followBus ? "#2864dc" : "#182132", color: "white", padding: "9px 11px", cursor: "pointer", fontSize: 10, fontWeight: 800 }}>
                {followBus ? "Слежу за 🚌" : "Следить за 🚌"}
              </button>
            </div>
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
        <p className="schedule-note">Метки остановок берутся по адресам в селе Намцы. Положение автобуса между ними рассчитывается по времени рейса; это не GPS.</p>
      </section>

      <footer className="data-footer">
        <span>SUPABASE + ЯНДЕКС КАРТЫ</span>
        <strong>{initialData.route.name}</strong>
        <p>Маршрут № {initialData.route.route_number} · остановки привязаны к адресам Намцев.</p>
      </footer>
    </main>
  );
}
