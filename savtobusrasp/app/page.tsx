import { TransitAppAttached } from "@/components/TransitAppAttached";
import { loadSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schedule = await loadSchedule();
  return <TransitAppAttached initialData={schedule} />;
}
