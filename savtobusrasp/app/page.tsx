import { TransitAppV2 } from "@/components/TransitAppV2";
import { loadSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schedule = await loadSchedule();
  return <TransitAppV2 initialData={schedule} />;
}
