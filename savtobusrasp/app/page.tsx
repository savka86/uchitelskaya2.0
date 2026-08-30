import { TransitAppRoadSegments } from "@/components/TransitAppRoadSegments";
import { loadSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schedule = await loadSchedule();
  return <TransitAppRoadSegments initialData={schedule} />;
}
