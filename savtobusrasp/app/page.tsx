import { TransitAppRoad } from "@/components/TransitAppRoad";
import { loadSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schedule = await loadSchedule();
  return <TransitAppRoad initialData={schedule} />;
}
