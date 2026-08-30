"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScheduleData, StopTimeRecord, TripRecord } from "@/lib/schedule";

type Direction = "forward" | "return";
type Coordinates = [number, number];
type TimedEvent = {
  stopId: string;
  stopName: string;
  seconds: number;
  clock: string;
  estimated: boolean;
};
type LiveTrip = TripRecord & { events: TimedEvent[]; start: number; end: number };
type RoutePoint = { name: string; coords: Coordinates };
type RouteData = { line: Coordinates[]; points: RoutePoint[]; source: string };

const YANDEX_MAPS_API_KEY = "27132710-296f-4362-b23d-6e2b84d5f48a";
const GOOGLE_MAP_ID = "1yvps6zGyD8iFRkF-XjvVAl__6sixAIk";
const GOOGLE_KML_URL = `https://www.google.com/maps/d/kml?forcekml=1&mid=${GOOGLE_MAP_ID}`;
const NAMTSY_CENTER: Coordinates = [62.7167815, 129.6507946];

const STOP_ALIASES: Record<string, string[]> = {
  "kyuonda-kiries": ["куонда кириэс", "куонда-кириэс", "куонда кириис"],
  mira: ["мира"],
  manchary: ["манчары", "манчаары"],
  "zamyatina-1": ["замятина 1", "замятина1"],
  "zamyatina-2": ["замятина 2", "замятина2"],
  "zamyatina-3": ["замятина 3", "замятина3"],
  stacionar: ["стационар", "больница"],
  "nachalnaya-shkola": ["начальная школа", "нач школа"],
  pochta: ["почта"],
  "magazin-valeriya": ["магазин валерия", "валерия"],
  tuelbe: ["туелбэ", "туелбе"],
  "sportivnaya-ploshchadka": ["спортивная площадка", "спортплощадка"],
  stroitelnaya: ["строительная"],
  res: ["рэс", "рэс намцы", "электросети"],
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
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
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
        seconds,
        clock: formatClock(seconds),
        estimated,
      };
    });
    return { ...trip, events, start: events[0].seconds, end: events[events.length - 1].seconds };
  }).sort((a, b) => a.start - b.start);
}

function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[№#]/g, " ")
    .replace(/[^а-яa-z0-9]+/gi, " ")
    .replace(/^\s*\d+\s+/, "")
    .trim();
}

function pointForStop(stopId: string, stopName: string, points: RoutePoint[]) {
  const aliases = [stopName, ...(STOP_ALIASES[stopId] ?? [])].map(normalizeLabel).filter(Boolean);
  return points.find((point) => {
    const pointName = normalizeLabel(point.name);
    if (!pointName) return false;
    return aliases.some((alias) => pointName === alias || pointName.includes(alias) || (alias.length > 4 && alias.includes(pointName)));
  });
}

function distanceMeters(a: Coordinates, b: Coordinates) {
  const meanLat = ((a[0] + b[0]) / 2) * Math.PI / 180;
  const dy = (b[0] - a[0]) * 111_320;
  const dx = (b[1] - a[1]) * 111_320 * Math.cos(meanLat);
  return Math.hypot(dx, dy);
}

function nearestRouteIndex(line: Coordinates[], coordinate: Coordinates, startIndex = 0) {
  let bestIndex = Math.max(0, Math.min(startIndex, line.length - 1));
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = bestIndex; index < line.length; index += 1) {
    const distance = distanceMeters(line[index], coordinate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function orientRoute(line: Coordinates[], startCoordinate: Coordinates | null) {
  if (!startCoordinate || line.length < 2) return line;
  return distanceMeters(startCoordinate, line[line.length - 1]) < distanceMeters(startCoordinate, line[0])
    ? [...line].reverse()
    : line;
}

function fillRouteIndices(values: Array<number | null>, maxIndex: number) {
  const result = [...values];
  for (let index = 0; index < result.length; index += 1) {
    if (result[index] !== null) continue;
    let left = index - 1;
    while (left >= 0 && result[left] === null) left -= 1;
    let right = index + 1;
    while (right < result.length && result[right] === null) right += 1;
    if (left >= 0 && right < result.length) {
      const a = result[left] as number;
      const b = result[right] as number;
      result[index] = Math.round(a + (b - a) * ((index - left) / (right - left)));
    } else if (left >= 0) {
      const a = result[left] as number;
      result[index] = Math.round(a + (maxIndex - a) * ((index - left) / Math.max(1, result.length - 1 - left)));
    } else if (right < result.length) {
      const b = result[right] as number;
      result[index] = Math.round(b * (index / Math.max(1, right)));
    } else {
      result[index] = Math.round(maxIndex * (index / Math.max(1, result.length - 1)));
    }
  }
  let previous = 0;
  return result.map((value) => {
    const safe = Math.max(previous, Math.min(maxIndex, value ?? previous));
    previous = safe;
    return safe;
  });
}

function positionAlongRoute(line: Coordinates[], fromIndex: number, toIndex: number, progress: number): Coordinates | null {
  if (!line.length) return null;
  const from = Math.max(0, Math.min(line.length - 1, fromIndex));
  const to = Math.max(0, Math.min(line.length - 1, toIndex));
  if (from === to) return line[from];
  const step = to > from ? 1 : -1;
  const indexes: number[] = [];
  for (let index = from; index !== to; index += step) indexes.push(index);
  indexes.push(to);
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < indexes.length - 1; i += 1) {
    const length = distanceMeters(line[indexes[i]], line[indexes[i + 1]]);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return line[from];
  const target = Math.min(1, Math.max(0, progress)) * total;
  let travelled = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const length = lengths[i];
    if (travelled + length >= target) {
      const local = length > 0 ? (target - travelled) / length : 0;
      const a = line[indexes[i]];
      const b = line[indexes[i + 1]];
      return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
    }
    travelled += length;
  }
  return line[to];
}

function parseCoordinateText(value: string): Coordinates[] {
  return value.trim().split(/\s+/).map((token) => token.split(",").map(Number))
    .filter((parts) => parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
    .map((parts) => [parts[1], parts[0]] as Coordinates);
}

function parseKml(kml: string): RouteData {
  const xml = new DOMParser().parseFromString(kml, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("Google My Maps вернул повреждённый KML.");
  const lines = Array.from(xml.getElementsByTagName("LineString"))
    .map((node) => parseCoordinateText(node.getElementsByTagName("coordinates")[0]?.textContent ?? ""))
    .filter((line) => line.length > 1)
    .sort((a, b) => b.length - a.length);
  const line = lines[0] ?? [];
  if (line.length < 2) throw new Error("В Google My Maps не найдена линия маршрута.");
  const points: RoutePoint[] = [];
  for (const placemark of Array.from(xml.getElementsByTagName("Placemark"))) {
    const point = placemark.getElementsByTagName("Point")[0];
    if (!point) continue;
    const coords = parseCoordinateText(point.getElementsByTagName("coordinates")[0]?.textContent ?? "")[0];
    if (!coords) continue;
    const name = placemark.getElementsByTagName("name")[0]?.textContent?.trim() ?? "";
    points.push({ name, coords });
  }
  return { line, points, source: "Google My Maps (KML)" };
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-store", mode: "cors", signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadRouteData(): Promise<RouteData> {
  try {
    const response = await fetchWithTimeout(GOOGLE_KML_URL, 9000);
    if (!response.ok) throw new Error(`Google My Maps: HTTP ${response.status}`);
    const text = await response.text();
    if (!text.includes("<kml") && !text.includes("<Placemark")) throw new Error("Google My Maps не вернул KML.");
    return parseKml(text);
  } catch (directError) {
    try {
      const response = await fetchWithTimeout("/api/google-route", 7000);
      const data = await response.json() as { line?: Coordinates[]; points?: RoutePoint[]; error?: string };
      if (!response.ok || data.error || !data.line?.length) throw new Error(data.error ?? "Прокси маршрута не ответил.");
      return { line: data.line, points: data.points ?? [], source: "Google My Maps (через Vercel)" };
    } catch {
      throw directError;
    }
  }
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
    script.onerror = () => reject(new Error("Не удалось загрузить Яндекс Карту. Проверьте ограничения ключа."));
    document.head.appendChild(script);
  });
  return globalWindow.__savtobusYandexPromise;
}

function fallbackStopCoordinates(data: ScheduleData, orderedIds: string[]) {
  const byId = new Map(data.stops.map((stop) => [stop.id, stop]));
  const coords: Array<Coordinates | null> = orderedIds.map((id) => {
    const stop = byId.get(id);
    return Number.isFinite(stop?.latitude) && Number.isFinite(stop?.longitude)
      ? [Number(stop?.latitude), Number(stop?.longitude)]
      : null;
  });
  for (let i = 0; i < coords.length; i += 1) {
    if (coords[i]) continue;
    let left = i - 1;
    while (left >= 0 && !coords[left]) left -= 1;
    let right = i + 1;
    while (right < coords.length && !coords[right]) right += 1;
    if (left >= 0 && right < coords.length) {
      const a = coords[left] as Coordinates;
      const b = coords[right] as Coordinates;
      const t = (i - left) / (right - left);
      coords[i] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    } else if (left >= 0) coords[i] = coords[left];
    else if (right < coords.length) coords[i] = coords[right];
    else coords[i] = NAMTSY_CENTER;
  }
  return coords as Coordinates[];
}

export function TransitAppV2({ initialData }: { initialData: ScheduleData }) {
  const [realSeconds, setRealSeconds] = useState(0);
  const [demoSeconds, setDemoSeconds] = useState(timeToSeconds("07:30"));
  const [demoMode, setDemoMode] = useState(false);
  const [scheduleDirection, setScheduleDirection] = useState<Direction>("forward");
  const [mapMessage, setMapMessage] = useState("Загружаю Яндекс Карту…");
  const [mapReady, setMapReady] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [followBus, setFollowBus] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const yandexMapRef = useRef<any>(null);
  const busPlacemarkRef = useRef<any>(null);
  const routeLineRef = useRef<Coordinates[]>([]);
  const stopRouteIndexRef = useRef<Map<string, number>>(new Map());

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
    const progress = activeTrip ? ((positionSeconds - selectedTrip.start) / Math.max(1, selectedTrip.end - selectedTrip.start)) * 100 : 0;
    return { activeTrip, selectedTrip, waitSeconds, previous, next, segment, progress };
  }, [currentSeconds, liveTrips]);

  useEffect(() => {
    if (!mapContainerRef.current || !forwardStops.length) return;
    let cancelled = false;
    const initialize = async () => {
      try {
        setMapMessage("Загружаю Яндекс Карту…");
        await loadYandexMaps();
        if (cancelled || !mapContainerRef.current) return;
        const ymaps = (window as typeof window & { ymaps?: any }).ymaps;
        if (!ymaps) throw new Error("Яндекс Карты не инициализировались.");
        await new Promise<void>((resolve) => ymaps.ready(resolve));
        if (cancelled || !mapContainerRef.current) return;

        const map = new ymaps.Map(mapContainerRef.current, {
          center: NAMTSY_CENTER,
          zoom: 13,
          controls: ["zoomControl", "geolocationControl"],
        }, {
          suppressMapOpenBlock: true,
          yandexMapDisablePoiInteractivity: true,
        });
        yandexMapRef.current = map;
        setMapReady(true);
        setMapMessage("Яндекс Карта готова · загружаю маршрут Google My Maps…");

        let routeData: RouteData | null = null;
        try {
          routeData = await loadRouteData();
        } catch (error) {
          setMapMessage(`${error instanceof Error ? error.message : "Маршрут Google не загрузился."} Показываю резервные точки.`);
        }
        if (cancelled) return;

        const orderedIds = forwardStops.map((stop) => stop.stop_id);
        const fallbackCoords = fallbackStopCoordinates(initialData, orderedIds);
        let line = routeData?.line?.length ? routeData.line : fallbackCoords;
        const firstStop = stopById.get(orderedIds[0]);
        const googleStart = routeData ? pointForStop(orderedIds[0], firstStop?.name ?? "", routeData.points) : undefined;
        const dbStart: Coordinates | null = Number.isFinite(firstStop?.latitude) && Number.isFinite(firstStop?.longitude)
          ? [Number(firstStop?.latitude), Number(firstStop?.longitude)] : null;
        line = orientRoute(line, googleStart?.coords ?? dbStart);
        routeLineRef.current = line;

        const routePolyline = new ymaps.Polyline(line, {
          hintContent: routeData ? "Маршрут № 2 · Google My Maps" : "Маршрут № 2 · резервная линия",
        }, {
          strokeColor: routeData ? "#2864dc" : "#8aa4c8",
          strokeWidth: routeData ? 7 : 5,
          strokeOpacity: routeData ? 0.92 : 0.65,
        });
        map.geoObjects.add(routePolyline);

        const rawIndexes: Array<number | null> = [];
        let searchFrom = 0;
        let googleMatches = 0;
        let dbMatches = 0;
        forwardStops.forEach((routeStop, index) => {
          const stop = stopById.get(routeStop.stop_id);
          const googlePoint = routeData ? pointForStop(routeStop.stop_id, stop?.name ?? routeStop.stop_id, routeData.points) : undefined;
          let source: Coordinates | null = null;
          if (googlePoint) {
            source = googlePoint.coords;
            googleMatches += 1;
          } else if (Number.isFinite(stop?.latitude) && Number.isFinite(stop?.longitude)) {
            source = [Number(stop?.latitude), Number(stop?.longitude)];
            dbMatches += 1;
          } else if (!routeData) {
            source = fallbackCoords[index];
          }
          if (source) {
            const routeIndex = nearestRouteIndex(line, source, searchFrom);
            rawIndexes.push(routeIndex);
            searchFrom = routeIndex;
          } else rawIndexes.push(null);
        });
        const routeIndexes = fillRouteIndices(rawIndexes, line.length - 1);
        stopRouteIndexRef.current = new Map();

        forwardStops.forEach((routeStop, index) => {
          const stop = stopById.get(routeStop.stop_id);
          const routeIndex = routeIndexes[index];
          const coords = line[routeIndex];
          stopRouteIndexRef.current.set(routeStop.stop_id, routeIndex);
          const placemark = new ymaps.Placemark(coords, {
            iconContent: String(index + 1),
            balloonContentHeader: `${index + 1}. ${stop?.name ?? routeStop.stop_id}`,
            balloonContentBody: routeData ? "Остановка на маршруте Google My Maps" : "Резервное положение остановки",
          }, {
            preset: "islands#blueCircleIcon",
            iconColor: "#2864dc",
          });
          map.geoObjects.add(placemark);
        });

        const busLayout = ymaps.templateLayoutFactory.createClass(
          `<div style="display:flex;align-items:center;gap:5px;transform:translate(-24px,-24px);white-space:nowrap;">
            <div style="display:grid;width:48px;height:48px;place-items:center;border:4px solid white;border-radius:15px;background:#c9f04a;box-shadow:0 8px 22px rgba(26,49,88,.35);font-size:27px;">🚌</div>
            <b style="padding:6px 8px;border-radius:8px;background:#182132;color:white;font:800 12px Arial,sans-serif;">№ ${initialData.route?.route_number ?? "2"}</b>
          </div>`,
        );
        const bus = new ymaps.Placemark(line[routeIndexes[0]] ?? line[0] ?? NAMTSY_CENTER, {
          hintContent: `Автобус № ${initialData.route?.route_number ?? "2"}`,
        }, {
          iconLayout: busLayout,
          iconShape: { type: "Circle", coordinates: [0, 0], radius: 28 },
          zIndex: 10000,
        });
        busPlacemarkRef.current = bus;
        map.geoObjects.add(bus);

        const bounds = routePolyline.geometry?.getBounds?.();
        if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 45 });
        setRouteReady(true);
        if (routeData) {
          const inferred = rawIndexes.filter((value) => value === null).length;
          setMapMessage(`${routeData.source} · ${line.length} точек линии · остановки: ${googleMatches} из Google, ${dbMatches} из базы${inferred ? `, ${inferred} по порядку` : ""}`);
        } else {
          setMapMessage("Яндекс Карта работает · Google My Maps временно недоступен, показана резервная линия.");
        }
      } catch (error) {
        setMapMessage(error instanceof Error ? error.message : "Не удалось загрузить карту.");
        setMapReady(false);
      }
    };
    initialize();
    return () => {
      cancelled = true;
      try { yandexMapRef.current?.destroy?.(); } catch { /* noop */ }
      yandexMapRef.current = null;
      busPlacemarkRef.current = null;
      routeLineRef.current = [];
      stopRouteIndexRef.current.clear();
    };
  }, [forwardStops, initialData, stopById]);

  useEffect(() => {
    if (!routeReady || !live || !busPlacemarkRef.current || !routeLineRef.current.length) return;
    const fromIndex = stopRouteIndexRef.current.get(live.previous.stopId);
    const toIndex = stopRouteIndexRef.current.get(live.next.stopId);
    if (fromIndex === undefined || toIndex === undefined) return;
    const position = positionAlongRoute(routeLineRef.current, fromIndex, toIndex, live.segment);
    if (!position) return;
    busPlacemarkRef.current.geometry?.setCoordinates?.(position);
    busPlacemarkRef.current.properties?.set?.("hintContent", live.activeTrip
      ? `Автобус № ${initialData.route?.route_number ?? "2"} · следующая: ${live.next.stopName}`
      : `Автобус № ${initialData.route?.route_number ?? "2"} · ожидает рейс`);
    if (followBus && live.activeTrip && Math.floor(currentSeconds) % 5 === 0) {
      yandexMapRef.current?.panTo?.(position, { flying: false, duration: 350 });
    }
  }, [currentSeconds, followBus, initialData.route?.route_number, live, routeReady]);

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
            <p>Расчётное положение автобуса по расписанию на реальной линии маршрута.</p>
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
            <span className="map-mode">ЯНДЕКС КАРТА · GOOGLE MY MAPS</span>
          </div>
          <div className="map-canvas">
            <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />
            <div style={{
              position: "absolute", left: 14, bottom: 14, zIndex: 20, maxWidth: "calc(100% - 28px)",
              display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 12,
              background: "rgba(255,255,255,.94)", boxShadow: "0 5px 18px rgba(24,33,50,.16)",
              color: "#526075", fontSize: 10, fontWeight: 800,
            }}>
              <span style={{ width: 8, height: 8, flex: "0 0 auto", borderRadius: "50%", background: routeReady ? "#31b26b" : mapReady ? "#f59e0b" : "#ef4444" }} />
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
        <p className="schedule-note">Яндекс Карта загружается независимо от Google My Maps. Линия маршрута берётся из предоставленной Google-карты; положение автобуса рассчитывается по расписанию, это не GPS.</p>
      </section>

      <footer className="data-footer">
        <span>GOOGLE MY MAPS → ЯНДЕКС КАРТА · SUPABASE</span>
        <strong>{initialData.route.name}</strong>
        <p>Маршрут № {initialData.route.route_number} · расчётное движение автобуса по линии маршрута.</p>
      </footer>
    </main>
  );
}
