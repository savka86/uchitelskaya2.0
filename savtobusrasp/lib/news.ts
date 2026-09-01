import { createClient } from "@supabase/supabase-js";

export type NewsKind = "info" | "warning" | "critical" | "holiday";

export type ImportantNewsRecord = {
  id: string;
  title: string;
  body: string;
  kind: NewsKind;
  route_number: string | null;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

const defaultSupabaseUrl = "https://clehcdkviariimjwfyun.supabase.co";
const defaultPublishableKey = "sb_publishable_1PBxH_MMhKheXKkgC5Xfrg_FYQ9SGX7";

export const newsSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? defaultSupabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? defaultPublishableKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export function kindLabel(kind: NewsKind) {
  if (kind === "critical") return "СРОЧНО";
  if (kind === "warning") return "ВНИМАНИЕ";
  if (kind === "holiday") return "ПОЗДРАВЛЕНИЕ";
  return "НОВОСТЬ";
}

export function kindIcon(kind: NewsKind) {
  if (kind === "critical") return "🚨";
  if (kind === "warning") return "⚠️";
  if (kind === "holiday") return "🎉";
  return "🚌";
}
