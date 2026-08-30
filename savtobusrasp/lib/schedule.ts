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

export async function loadSchedule(): Promise<ScheduleData> {
  const url = process.env.SUPABASE_URL ?? defaultSupabaseUrl;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? defaultPublishableKey;

  if (!url || !publishableKey) {
    return emptySchedule("Не настроено подключение к базе расписаний.");
  }

  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [routeResult, stopsResult, routeStopsResult, tripsResult, stopTimesResult] = await Promise.all([
    supabase.from("routes").select("id,route_number,name,locality,source_date,source_note,active").eq("id", "namtsy-2").eq("active", true).single(),
    supabase.from("stops").select("id,name,latitude,longitude,active").eq("active", true).order("name"),
    supabase.from("route_stops").select("route_id,direction,stop_id,stop_sequence").eq("route_id", "namtsy-2").order("stop_sequence"),
    supabase.from("trips").select("id,route_id,direction,label,first_timed_stop,active").eq("route_id", "namtsy-2").eq("active", true).order("first_timed_stop"),
    supabase.from("stop_times").select("trip_id,stop_id,stop_sequence,scheduled_time,terminal_status").order("stop_sequence"),
  ]);

  const error = [routeResult.error, stopsResult.error, routeStopsResult.error, tripsResult.error, stopTimesResult.error].find(Boolean);
  if (error) return emptySchedule("Не удалось загрузить расписание. Попробуйте обновить страницу.");

  return {
    route: routeResult.data as RouteRecord,
    stops: (stopsResult.data ?? []) as StopRecord[],
    routeStops: (routeStopsResult.data ?? []) as RouteStopRecord[],
    trips: (tripsResult.data ?? []) as TripRecord[],
    stopTimes: (stopTimesResult.data ?? []) as StopTimeRecord[],
    error: null,
  };
}
