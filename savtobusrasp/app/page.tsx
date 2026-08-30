import { TransitApp } from "@/components/TransitApp";
import { loadSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schedule = await loadSchedule();
  return <TransitApp initialData={schedule} />;
}
