import { TransitAppManual } from "@/components/TransitAppManual";
import { loadSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schedule = await loadSchedule();
  return <TransitAppManual initialData={schedule} />;
}
