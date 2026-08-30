import { TransitAppYandex } from "@/components/TransitAppYandex";
import { loadSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schedule = await loadSchedule();
  return <TransitAppYandex initialData={schedule} />;
}
