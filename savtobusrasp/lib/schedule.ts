import { createClient } from "@supabase/supabase-js";

export type RouteRecord = {
  id: string;
  route_number: string;
  name: string;
  locality: string;
  source_date: string | null;
  source_note: string | null;
  active: boolean;
};

export type StopRecord = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
};

export type RouteStopRecord = {
  route_id: string;
  direction: "forward" | "return";
  stop_id: string;
  stop_sequence: number;
};

export type TripRecord = {
  id: string;
  route_id: string;
  direction: "forward" | "return";
  label: string;
  first_timed_stop: string;
  active: boolean;
};

export type StopTimeRecord = {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  scheduled_time: string | null;
  terminal_status: "стоянка" | "конечная" | null;
};

export type ScheduleData = {
  route: RouteRecord | null;
  stops: StopRecord[];
  routeStops: RouteStopRecord[];
  trips: TripRecord[];
  stopTimes: StopTimeRecord[];
  error: string | null;
};

export type RouteId = "namtsy-1" | "namtsy-2";

// Publishable keys are safe in public clients when Row Level Security is enabled.
const defaultSupabaseUrl = "https://clehcdkviariimjwfyun.supabase.co";
const defaultPublishableKey = "sb_publishable_1PBxH_MMhKheXKkgC5Xfrg_FYQ9SGX7";

const emptySchedule = (error: string): ScheduleData => ({
  route: null,
  stops: [],
  routeStops: [],
  trips: [],
  stopTimes: [],
  error,
});

export async function loadSchedule(routeId: RouteId = "namtsy-2"): Promise<ScheduleData> {
  const url = process.env.SUPABASE_URL ?? defaultSupabaseUrl;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? defaultPublishableKey;

  if (!url || !publishableKey) {
    return emptySchedule("Не настроено подключение к базе расписаний.");
  }

  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [routeResult, stopsResult, routeStopsResult, tripsResult] = await Promise.all([
    supabase.from("routes").select("id,route_number,name,locality,source_date,source_note,active").eq("id", routeId).eq("active", true).single(),
    supabase.from("stops").select("id,name,latitude,longitude,active").eq("active", true).order("name"),
    supabase.from("route_stops").select("route_id,direction,stop_id,stop_sequence").eq("route_id", routeId).order("stop_sequence"),
    supabase.from("trips").select("id,route_id,direction,label,first_timed_stop,active").eq("route_id", routeId).eq("active", true).order("first_timed_stop"),
  ]);

  const firstError = [routeResult.error, stopsResult.error, routeStopsResult.error, tripsResult.error].find(Boolean);
  if (firstError) return emptySchedule("Не удалось загрузить расписание. Попробуйте обновить страницу.");

  const trips = (tripsResult.data ?? []) as TripRecord[];
  const tripIds = trips.map((trip) => trip.id);
  const stopTimesResult = tripIds.length
    ? await supabase.from("stop_times").select("trip_id,stop_id,stop_sequence,scheduled_time,terminal_status").in("trip_id", tripIds).order("stop_sequence")
    : { data: [], error: null };

  if (stopTimesResult.error) return emptySchedule("Не удалось загрузить расписание. Попробуйте обновить страницу.");

  return {
    route: routeResult.data as RouteRecord,
    stops: (stopsResult.data ?? []) as StopRecord[],
    routeStops: (routeStopsResult.data ?? []) as RouteStopRecord[],
    trips,
    stopTimes: (stopTimesResult.data ?? []) as StopTimeRecord[],
    error: null,
  };
}
