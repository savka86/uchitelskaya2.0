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
const NAMTSY_BOUNDS: [Coordinates, Coordinates] = [[62.68, 129.60], [62.75, 129.72]];

const SCHEME_ORDER = [
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

const STOP_QUERIES: Record<string, string[]> = {
  "kyuonda-kiries": [
    "Республика Саха (Якутия), Намцы, улица Куонда-Кириэс",
    "Намцы, Куонда-Кириэс",
  ],
  mira: [
    "Республика Саха (Якутия), Намцы, улица Мира",
    "Намцы, улица Мира",
  ],
  manchary: [
    "Республика Саха (Якутия), Намцы, улица Манчаары",
    "Намцы, Манчары",
  ],
  "zamyatina-1": [
    "Республика Саха (Якутия), Намцы, улица Т. Замятина, 11",
    "Намцы, улица Т. Замятина",
  ],
  "zamyatina-2": [
    "Республика Саха (Якутия), Намцы, улица Т. Замятина, 30",
    "Намцы, улица Т. Замятина",
  ],
  "zamyatina-3": [
    "Республика Саха (Якутия), Намцы, улица Т. Замятина, 50",
    "Намцы, улица Т. Замятина",
  ],
  stacionar: [
    "Республика Саха (Якутия), Намцы, Новобольничная улица, 5",
    "Намцы, НЦРБ",
  ],
  "nachalnaya-shkola": [
    "Республика Саха (Якутия), Намцы, улица Степана Платонова, 14/1",
    "Намцы, Начальная школа",
  ],
  pochta: [
    "Республика Саха (Якутия), Намцы, улица Ленина, 4",
    "Намцы, Почта России",
  ],
  "magazin-valeriya": [
    "Республика Саха (Якутия), Намцы, улица Цугель-Аммосовой, 7/1",
    "Намцы, магазин Валерия",
  ],
  tuelbe: [
    "Республика Саха (Якутия), Намцы, улица М. Аммосова, 40",
    "Намцы, Туелбэ",
  ],
  "sportivnaya-ploshchadka": [
    "Республика Саха (Якутия), Намцы, улица Ленина, 16/2",
    "Намцы, спортивная площадка",
  ],
  stroitelnaya: [
    "Республика Саха (Якутия), Намцы, Строительная улица, 47/1",
    "Намцы, Строительная улица",
  ],
  res: [
    "Республика Саха (Якутия), Намцы, Строительная улица, 59",
    "Намцы, РЭС",
  ],
};

function timeToSeconds(clock: string) {
  const [hours, minutes, seconds = 0] = clock.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function displayTime(time: StopTimeRecord | undefined) {
  if (!time) return "—";
  if (time.scheduled_time) return time.scheduled_time.slice(0, 5);
  return time.terminal_status ?? "—";
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
    script.onerror = () => reject(new Error("Не удалось загрузить Яндекс Карту. Проверьте API-ключ."));
    document.head.appendChild(script);
  });
  return globalWindow.__savtobusYandexPromise;
}

function insideNamtsy(coords: Coordinates) {
  return coords[0] >= NAMTSY_BOUNDS[0][0] && coords[0] <= NAMTSY_BOUNDS[1][0]
    && coords[1] >= NAMTSY_BOUNDS[0][1] && coords[1] <= NAMTSY_BOUNDS[1][1];
}

async function resolveStopCoordinate(ymaps: any, stopId: string, dbCoordinate: Coordinates | null): Promise<Coordinates | null> {
  if (dbCoordinate && insideNamtsy(dbCoordinate)) return dbCoordinate;
  for (const query of STOP_QUERIES[stopId] ?? []) {
    try {
      const result = await ymaps.geocode(query, {
        boundedBy: NAMTSY_BOUNDS,
        strictBounds: true,
        results: 1,
      });
      const object = result.geoObjects.get(0);
      const coords = object?.geometry?.getCoordinates?.();
      if (Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1]) && insideNamtsy([coords[0], coords[1]])) {
        return [coords[0], coords[1]];
      }
    } catch {
      // Try next query.
    }
  }
  return null;
}

function interpolateCoordinate(a: Coordinates, b: Coordinates, progress: number): Coordinates {
  const t = Math.max(0, Math.min(1, progress));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function TransitAppYandex({ initialData }: { initialData: ScheduleData }) {
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
  const stopCoordsRef = useRef<Map<string, Coordinates>>(new Map());

  useEffect(() => {
    const tick = () => demoMode
      ? setDemoSeconds((seconds) => (seconds + 8) % 86400)
      : setRealSeconds(getYakutskSeconds());
    tick();
    const timer = window.setInterval(tick, demoMode ? 250 : 1000);
    return () => window.clearInterval(timer);
  }, [demoMode]);

  const forwardStops = useMemo(() => {
    const routeStops = initialData.routeStops.filter((stop) => stop.direction === "forward");
    const byId = new Map(routeStops.map((stop) => [stop.stop_id, stop]));
    return SCHEME_ORDER.map((id, index) => byId.get(id) ?? ({
      route_id: initialData.route?.id ?? "namtsy-2",
      direction: "forward" as const,
      stop_id: id,
      stop_sequence: index + 1,
    }));
  }, [initialData.route?.id, initialData.routeStops]);

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
        if (!ymaps) throw new Error("Яндекс Карты не инициализировались.");
        await new Promise<void>((resolve) => ymaps.ready(resolve));
        if (cancelled || !mapContainerRef.current) return;

        const map = new ymaps.Map(mapContainerRef.current, {
          center: NAMTSY_CENTER,
          zoom: 14,
          controls: ["zoomControl", "geolocationControl", "typeSelector"],
        }, {
          suppressMapOpenBlock: true,
          yandexMapDisablePoiInteractivity: true,
        });
        yandexMapRef.current = map;
        stopCoordsRef.current = new Map();

        const coordinates: Coordinates[] = [];
        let resolved = 0;
        for (let index = 0; index < forwardStops.length; index += 1) {
          if (cancelled) return;
          const routeStop = forwardStops[index];
          const stop = stopById.get(routeStop.stop_id);
          setMapMessage(`Ищу остановки по схеме: ${index + 1}/14 · ${stop?.name ?? routeStop.stop_id}`);

          const dbCoordinate: Coordinates | null = Number.isFinite(stop?.latitude) && Number.isFinite(stop?.longitude)
            ? [Number(stop?.latitude), Number(stop?.longitude)]
            : null;
          const coordinate = await resolveStopCoordinate(ymaps, routeStop.stop_id, dbCoordinate);
          if (coordinate) {
            coordinates.push(coordinate);
            stopCoordsRef.current.set(routeStop.stop_id, coordinate);
            resolved += 1;
          } else {
            coordinates.push(NAMTSY_CENTER);
          }
        }

        // If a point could not be found, place it between its neighbouring scheme stops.
        for (let index = 0; index < forwardStops.length; index += 1) {
          const id = forwardStops[index].stop_id;
          if (stopCoordsRef.current.has(id)) continue;
          let left = index - 1;
          while (left >= 0 && !stopCoordsRef.current.has(forwardStops[left].stop_id)) left -= 1;
          let right = index + 1;
          while (right < forwardStops.length && !stopCoordsRef.current.has(forwardStops[right].stop_id)) right += 1;
          let coordinate = NAMTSY_CENTER;
          if (left >= 0 && right < forwardStops.length) {
            coordinate = interpolateCoordinate(
              stopCoordsRef.current.get(forwardStops[left].stop_id)!,
              stopCoordsRef.current.get(forwardStops[right].stop_id)!,
              (index - left) / (right - left),
            );
          } else if (left >= 0) {
            coordinate = stopCoordsRef.current.get(forwardStops[left].stop_id)!;
          } else if (right < forwardStops.length) {
            coordinate = stopCoordsRef.current.get(forwardStops[right].stop_id)!;
          }
          coordinates[index] = coordinate;
          stopCoordsRef.current.set(id, coordinate);
        }

        forwardStops.forEach((routeStop, index) => {
          const stop = stopById.get(routeStop.stop_id);
          const coords = coordinates[index];
          const placemark = new ymaps.Placemark(coords, {
            iconContent: String(index + 1),
            balloonContentHeader: `${index + 1}. ${stop?.name ?? routeStop.stop_id}`,
            balloonContentBody: "Остановка маршрута № 2 · по схеме с. Намцы",
          }, {
            preset: "islands#blueCircleIcon",
            iconColor: "#2864dc",
          });
          map.geoObjects.add(placemark);
        });

        const multiRoute = new ymaps.multiRouter.MultiRoute({
          referencePoints: coordinates,
          params: {
            routingMode: "auto",
            results: 1,
            avoidTrafficJams: false,
          },
        }, {
          boundsAutoApply: true,
          routeActiveStrokeColor: "#2864dc",
          routeActiveStrokeWidth: 7,
          routeStrokeColor: "#8aaef2",
          routeStrokeWidth: 4,
          wayPointVisible: false,
          viaPointVisible: false,
          pinVisible: false,
        });
        map.geoObjects.add(multiRoute);

        const fallbackLine = new ymaps.Polyline(coordinates, {
          hintContent: "Схема маршрута № 2",
        }, {
          strokeColor: "#2864dc",
          strokeWidth: 4,
          strokeOpacity: 0.28,
        });
        map.geoObjects.add(fallbackLine);

        const busLayout = ymaps.templateLayoutFactory.createClass(
          `<div style="display:flex;align-items:center;gap:5px;transform:translate(-24px,-24px);white-space:nowrap;">
            <div style="display:grid;width:48px;height:48px;place-items:center;border:4px solid white;border-radius:15px;background:#c9f04a;box-shadow:0 8px 22px rgba(26,49,88,.35);font-size:27px;">🚌</div>
            <b style="padding:6px 8px;border-radius:8px;background:#182132;color:white;font:800 12px Arial,sans-serif;">№ ${initialData.route?.route_number ?? "2"}</b>
          </div>`,
        );
        const bus = new ymaps.Placemark(coordinates[0], {
          hintContent: `Автобус № ${initialData.route?.route_number ?? "2"}`,
        }, {
          iconLayout: busLayout,
          iconShape: { type: "Circle", coordinates: [0, 0], radius: 28 },
          zIndex: 10000,
        });
        busPlacemarkRef.current = bus;
        map.geoObjects.add(bus);

        multiRoute.model.events.add("requestsuccess", () => {
          setMapMessage(`Яндекс маршрут построен по схеме · ${resolved}/14 остановок найдены точно`);
          setMapReady(true);
        });
        multiRoute.model.events.add("requestfail", () => {
          setMapMessage(`Яндекс Карта · схема маршрута № 2 · ${resolved}/14 остановок найдены точно`);
          setMapReady(true);
        });

        window.setTimeout(() => {
          if (!cancelled) {
            setMapReady(true);
            setMapMessage((current) => current.startsWith("Яндекс маршрут") ? current : `Яндекс Карта · маршрут № 2 по схеме · ${resolved}/14 остановок найдены точно`);
          }
        }, 5000);
      } catch (error) {
        setMapMessage(error instanceof Error ? error.message : "Не удалось загрузить Яндекс Карту.");
        setMapReady(false);
      }
    };

    init();
    return () => {
      cancelled = true;
      try { yandexMapRef.current?.destroy?.(); } catch { /* noop */ }
      yandexMapRef.current = null;
      busPlacemarkRef.current = null;
      stopCoordsRef.current.clear();
    };
  }, [forwardStops, initialData.route?.route_number, stopById]);

  useEffect(() => {
    if (!mapReady || !live || !busPlacemarkRef.current) return;
    const previous = stopCoordsRef.current.get(live.previous.stopId);
    const next = stopCoordsRef.current.get(live.next.stopId);
    if (!previous || !next) return;
    const position = interpolateCoordinate(previous, next, live.segment);
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
  const selectedTrips = initialData.trips
    .filter((trip) => trip.direction === scheduleDirection)
    .sort((a, b) => a.first_timed_stop.localeCompare(b.first_timed_stop));

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
            <p>Расчётное положение автобуса по расписанию на Яндекс Карте.</p>
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
            <span className="map-mode">ЯНДЕКС КАРТА · СХЕМА № 2</span>
          </div>

          <div className="map-canvas">
            <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", left: 14, bottom: 14, zIndex: 20, maxWidth: "calc(100% - 28px)", display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 12, background: "rgba(255,255,255,.94)", boxShadow: "0 5px 18px rgba(24,33,50,.16)", color: "#526075", fontSize: 10, fontWeight: 800 }}>
              <span style={{ width: 8, height: 8, flex: "0 0 auto", borderRadius: "50%", background: mapReady ? "#31b26b" : "#f59e0b" }} />
              <span>{mapMessage}</span>
            </div>
            <div style={{ position: "absolute", right: 14, top: 14, zIndex: 20, display: "flex", gap: 8 }}>
              <button type="button" onClick={() => {
                const bounds = yandexMapRef.current?.geoObjects?.getBounds?.();
                if (bounds) yandexMapRef.current?.setBounds?.(bounds, { checkZoomRange: true, zoomMargin: 45 });
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
        <p className="schedule-note">Маршрут построен только средствами Яндекс Карт по предоставленной схеме маршрута № 2. Положение автобуса рассчитывается по расписанию; это не GPS.</p>
      </section>

      <footer className="data-footer">
        <span>ЯНДЕКС КАРТА · SUPABASE</span>
        <strong>{initialData.route.name}</strong>
        <p>Маршрут № {initialData.route.route_number} · схема села Намцы · расчётное движение автобуса.</p>
      </footer>
    </main>
  );
}
