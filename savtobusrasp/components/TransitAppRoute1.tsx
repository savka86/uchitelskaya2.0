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
const NAMTSY_CENTER: Coordinates = [62.7145, 129.6720];

const ORDER = [
  "r1-azs",
  "r1-zhkh",
  "r1-selhoz",
  "r1-bazovaya",
  "r1-s-platonova",
  "r1-detsad7",
  "r1-nachalnaya",
  "r1-pochta",
  "r1-lenagaz",
  "r1-pedkolledzh",
  "r1-shkola-sad",
  "r1-dadar1",
  "r1-dadar2",
  "r1-post-gibdd",
] as const;

// Дорожная геометрия официального маршрута №1 из Яндекс Карт, lineId 4042248588.
// Каждый массив — участок дороги между соседними остановками АЗС → Пост ГИБДД.
const ROUTE_SEGMENTS: Coordinates[][] = [
  [[62.741925,129.670083],[62.741906,129.670062],[62.740993,129.669073],[62.740713,129.668767],[62.740543,129.668583],[62.739849,129.667828],[62.738958,129.66691],[62.738041,129.665966],[62.737551,129.66546],[62.737391,129.665302]],
  [[62.737391,129.665302],[62.736296,129.664216],[62.73616,129.664092],[62.736043,129.663999],[62.735926,129.663927],[62.73576,129.663844],[62.735477,129.663812],[62.735321,129.663824],[62.735203,129.663834],[62.734915,129.663882]],
  [[62.734915,129.663882],[62.733574,129.66411],[62.733342,129.66415],[62.731999,129.664378],[62.731729,129.664423],[62.731444,129.66155],[62.731442,129.661538]],
  [[62.731442,129.661538],[62.73128,129.659906],[62.731103,129.658204],[62.730842,129.655319],[62.730828,129.655157],[62.730601,129.655179],[62.730433,129.655222],[62.729833,129.655588]],
  [[62.729833,129.655588],[62.729557,129.655758],[62.728534,129.656338],[62.727238,129.657143],[62.726652,129.657508]],
  [[62.726652,129.657508],[62.726278,129.65774],[62.725269,129.658313],[62.724704,129.658632],[62.72433,129.65873],[62.723965,129.658825],[62.723256,129.658869],[62.722876,129.659027],[62.722605,129.659163],[62.722324,129.659331],[62.722135,129.659457],[62.721438,129.659977]],
  [[62.721438,129.659977],[62.72143,129.659984],[62.72064,129.660575],[62.720609,129.660612],[62.72006,129.660992],[62.719501,129.661368],[62.718911,129.661704],[62.718624,129.661851],[62.718487,129.661923],[62.717989,129.662225],[62.717459,129.662546]],
  [[62.717459,129.662546],[62.716362,129.663212],[62.715898,129.663495],[62.715753,129.663583],[62.714455,129.664359],[62.71386,129.664715],[62.712562,129.665499],[62.712532,129.665517],[62.71245,129.665566],[62.711407,129.666197],[62.710756,129.666598]],
  [[62.710756,129.666598],[62.710569,129.666714],[62.71019,129.666948],[62.710082,129.667014],[62.709787,129.667197],[62.70944,129.667464],[62.708662,129.668063],[62.708267,129.668367],[62.708187,129.668446],[62.70706,129.669545],[62.70685,129.669751],[62.706826,129.669775],[62.706591,129.670038],[62.705937,129.670778],[62.705651,129.671099],[62.705502,129.671267],[62.70547,129.671302],[62.705386,129.671386],[62.704894,129.67188],[62.704373,129.672404],[62.704141,129.672656],[62.70302,129.673875]],
  [[62.70302,129.673875],[62.70236,129.674594],[62.70163,129.675395],[62.701175,129.675893],[62.701254,129.676402],[62.701322,129.676911],[62.701366,129.677322],[62.701392,129.677769],[62.701397,129.678321],[62.701358,129.678903],[62.701306,129.679386],[62.701256,129.679684],[62.701183,129.680062],[62.700901,129.681428]],
  [[62.700901,129.681428],[62.70085,129.681679],[62.70038,129.683992],[62.699995,129.684639],[62.699648,129.6818],[62.699437,129.680087],[62.699425,129.67995],[62.699415,129.679787],[62.699374,129.677865],[62.699311,129.677935],[62.698973,129.678288],[62.698756,129.678513],[62.698156,129.679039],[62.698123,129.679068],[62.697832,129.679297],[62.697779,129.679339],[62.697647,129.679439]],
  [[62.697647,129.679439],[62.697577,129.679495],[62.697399,129.679601],[62.696972,129.679859],[62.696755,129.679949],[62.695432,129.6805],[62.694899,129.680722],[62.693577,129.681273],[62.693492,129.681307],[62.693233,129.681411]],
  [[62.693233,129.681411],[62.692245,129.681808],[62.692182,129.681851],[62.691766,129.682137],[62.691466,129.682398],[62.691226,129.68268],[62.690831,129.683459],[62.690501,129.684185],[62.689536,129.686234],[62.688611,129.688199],[62.687935,129.689468],[62.687607,129.690057],[62.687813,129.690374]],
];

const ROUTE_PATH: Coordinates[] = [
  [62.742087661,129.669933131],
  ...ROUTE_SEGMENTS.flatMap((segment, index) => index === 0 ? segment : segment.slice(1)),
  [62.687753935,129.690555642],
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
          : lastExact + 120;
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
  }).filter((trip) => trip.events.length > 0).sort((a, b) => a.start - b.start);
}

function stopArrivalBalloon(stopId: string, liveTrips: LiveTrip[], now: number) {
  const arrivals = liveTrips
    .flatMap((trip) => trip.events
      .filter((event) => event.stopId === stopId)
      .map((event) => ({
        seconds: event.seconds,
        clock: event.clock,
        estimated: event.estimated,
        direction: trip.direction as Direction,
      })))
    .sort((a, b) => a.seconds - b.seconds);

  const directionName = (direction: Direction) => direction === "forward" ? "к Посту ГИБДД" : "к АЗС";
  const upcoming = arrivals.filter((arrival) => arrival.seconds >= now).slice(0, 3);
  const row = (arrival: typeof arrivals[number], wait: number, tomorrow = false) => {
    const waitText = wait <= 30 ? "сейчас" : formatWait(wait);
    return `<div style="display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-top:1px solid #edf1f7;">
      <div><b style="font-size:16px;color:#182132;">${arrival.estimated ? "≈ " : ""}${arrival.clock}</b><div style="margin-top:2px;color:#657289;font-size:12px;">${directionName(arrival.direction)}${tomorrow ? " · завтра" : ""}</div></div>
      <b style="color:#2864dc;font-size:13px;white-space:nowrap;">${waitText}</b>
    </div>`;
  };

  let arrivalsHtml = "";
  if (upcoming.length) {
    arrivalsHtml = upcoming.map((arrival) => row(arrival, arrival.seconds - now)).join("");
  } else if (arrivals.length) {
    const firstTomorrow = arrivals[0];
    arrivalsHtml = `<div style="padding:7px 0;color:#657289;font-size:12px;">Сегодня рейсов больше нет</div>${row(firstTomorrow, 86400 - now + firstTomorrow.seconds, true)}`;
  } else {
    arrivalsHtml = `<div style="padding:9px 0;color:#657289;font-size:12px;">Для этой остановки время в расписании не указано.</div>`;
  }

  return `<div style="min-width:230px;font-family:Arial,sans-serif;">
    <div style="margin-bottom:7px;color:#657289;font-size:12px;">Сейчас в Намцах: <b style="color:#182132;">${formatClock(now, true)}</b></div>
    <div style="color:#182132;font-size:13px;font-weight:800;">Ближайшее прибытие</div>
    ${arrivalsHtml}
    <div style="margin-top:7px;color:#8a95a8;font-size:10px;line-height:1.35;">Время рассчитано по действующему расписанию. Положение автобуса расчётное, не GPS.</div>
  </div>`;
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

export function TransitAppRoute1({ initialData }: { initialData: ScheduleData }) {
  const [realSeconds, setRealSeconds] = useState(0);
  const [demoSeconds, setDemoSeconds] = useState(timeToSeconds("07:30"));
  const [demoMode, setDemoMode] = useState(false);
  const [scheduleDirection, setScheduleDirection] = useState<Direction>("forward");
  const [mapMessage, setMapMessage] = useState("Загружаю официальный маршрут №1…");
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
      route_id: initialData.route?.id ?? "namtsy-1",
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
          zoom: 13,
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
          const placemark = new ymaps.Placemark(coords, {
            iconContent: String(index + 1),
            balloonContentHeader: `${index + 1}. ${stop?.name ?? routeStop.stop_id}`,
            balloonContentBody: "Нажмите на остановку, чтобы увидеть ближайшее прибытие автобуса.",
          }, { preset: "islands#blueCircleIcon", iconColor: "#2864dc" });
          const updateArrivalBalloon = () => placemark.properties.set(
            "balloonContentBody",
            stopArrivalBalloon(routeStop.stop_id, liveTrips, getYakutskSeconds()),
          );
          placemark.events.add("click", updateArrivalBalloon);
          placemark.events.add("balloonopen", updateArrivalBalloon);
          map.geoObjects.add(placemark);
        }

        const busLayout = ymaps.templateLayoutFactory.createClass(
          `<div style="display:flex;align-items:center;gap:5px;transform:translate(-24px,-24px);white-space:nowrap;">
            <div style="display:grid;width:48px;height:48px;place-items:center;border:4px solid white;border-radius:15px;background:#c9f04a;box-shadow:0 8px 22px rgba(26,49,88,.35);font-size:27px;">🚌</div>
            <b style="padding:6px 8px;border-radius:8px;background:#182132;color:white;font:800 12px Arial,sans-serif;">№ 1</b>
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
        setMapMessage("Маршрут №1 взят из Яндекс Карт · нажмите остановку — покажу ближайшее прибытие");
      } catch (error) {
        setMapMessage(error instanceof Error ? error.message : "Не удалось показать маршрут №1.");
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
  }, [forwardStops, liveTrips, stopById]);

  useEffect(() => {
    if (!mapReady || !live || !busRef.current) return;
    const previousDistance = stopDistanceRef.current.get(live.previous.stopId);
    const nextDistance = stopDistanceRef.current.get(live.next.stopId);
    if (previousDistance == null || nextDistance == null) return;
    const busDistance = previousDistance + (nextDistance - previousDistance) * live.segment;
    const position = pointAtDistance(ROUTE_PATH, cumulativeRef.current, busDistance);
    busRef.current.geometry?.setCoordinates?.(position);
    busRef.current.properties?.set?.("hintContent", live.activeTrip
      ? `Автобус № 1 · следующая: ${live.next.stopName}`
      : "Автобус № 1 · ожидает рейс");
    if (followBus && live.activeTrip && Math.floor(currentSeconds) % 5 === 0) {
      mapRef.current?.panTo?.(position, { flying: false, duration: 350 });
    }
  }, [currentSeconds, followBus, live, mapReady]);

  if (initialData.error || !initialData.route || !live) {
    return <main className="error-screen"><span>🚌</span><h1>Маршрут №1 временно недоступен</h1><p>{initialData.error ?? "Нет данных."}</p></main>;
  }

  const directionLabel = live.selectedTrip.direction === "forward" ? "АЗС → Пост ГИБДД" : "Пост ГИБДД → АЗС";
  const selectedStops = scheduleDirection === "forward" ? forwardStops : returnStops;
  const selectedTrips = initialData.trips
    .filter((trip) => trip.direction === scheduleDirection)
    .sort((a, b) => a.first_timed_stop.localeCompare(b.first_timed_stop));

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-bus">🚌</span><span>SAVTOBUSRASP</span></a>
        <div className={`topbar-status ${live.activeTrip ? "online" : "waiting"}`}><i />{demoMode ? "Демо движения" : live.activeTrip ? "Автобус №1 в пути" : "Ожидание рейса №1"}</div>
      </header>

      <section className="workspace" id="top">
        <aside className="sidebar" aria-label="Важные новости" />

        <section className="map-panel" aria-label="Яндекс Карта маршрута № 1">
          <div className="map-toolbar"><div><strong>Маршрут № 1 · село Намцы</strong><span>{live.activeTrip ? directionLabel : `следующий: ${directionLabel}`}</span></div><span className="map-mode">ЯНДЕКС · МАРШРУТ №1</span></div>
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
        <style>{`.schedule-section::before,.schedule-section::after{display:none!important}`}</style>
        <div className="schedule-heading"><div><span className="source-label">РАСПИСАНИЕ №1 · 2024</span><h2>Все остановки и рейсы</h2></div><div className="direction-tabs"><button className={scheduleDirection === "forward" ? "active" : ""} onClick={() => setScheduleDirection("forward")} type="button">К Посту ГИБДД</button><button className={scheduleDirection === "return" ? "active" : ""} onClick={() => setScheduleDirection("return")} type="button">К АЗС</button></div></div>
        <div className="schedule-table-wrap"><div className="schedule-table" style={{ gridTemplateColumns: `minmax(190px, 1.5fr) repeat(${selectedTrips.length}, minmax(76px, 1fr))` }}>
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
        </div></div>

        <aside className="schedule-live-panel" style={{ gridColumn: 2, alignSelf: "start", minWidth: 0 }}>
          <div className="intro">
            <span className="source-label">НАМЦЫ · МАРШРУТ № 1</span>
            <h1 style={{ fontSize: 36, lineHeight: 0.92, margin: "16px 0 12px" }}>Где мой<br />автобус?</h1>
            <p style={{ marginBottom: 18, fontSize: 13 }}>Автобус №1 движется расчётно по расписанию и по официальной линии маршрута Яндекс Карт.</p>
          </div>
          <div className="route-card">
            <div className="route-card-head"><span className="route-badge">1</span><div><strong>{live.activeTrip ? "Автобус следует" : "Следующий рейс"}</strong><span>{directionLabel}</span></div></div>
            <div className="progress-line"><span style={{ width: `${live.progress}%` }} /></div>
            <div className="next-stop"><span>{live.activeTrip ? "Следующая остановка" : "До начала рейса"}</span><strong>{live.activeTrip ? live.next.stopName : formatWait(live.waitSeconds)}</strong><small>{live.activeTrip ? `${live.next.estimated ? "расчётно " : "по расписанию "}${live.next.clock}` : directionLabel}</small></div>
          </div>
          <div className="clock-card"><div><span>{demoMode ? "Ускоренное время" : "Время в Намцах"}</span><strong>{formatClock(currentSeconds, true)}</strong></div><button type="button" onClick={() => { if (!demoMode) setDemoSeconds(timeToSeconds("07:30")); setDemoMode((m) => !m); }}>{demoMode ? "Онлайн" : "Показать демо"}</button></div>
          <p className="speed-note">{demoMode ? "Демонстрация ускорена в 32 раза" : "Часовой пояс: Якутск, UTC+9"}</p>
        </aside>

        <p className="schedule-note">Маршрут №1 и координаты остановок взяты из переданной страницы Яндекс Карт. Нажмите на остановку на карте, чтобы увидеть ближайшее время прибытия относительно текущего времени. Положение автобуса расчётное, не GPS.</p>
      </section>

      <footer className="data-footer"><span>ЯНДЕКС КАРТА · МАРШРУТ №1 · SUPABASE</span><strong>{initialData.route.name}</strong><p>Маршрут № 1 · расчётное движение по расписанию.</p></footer>
    </main>
  );
}