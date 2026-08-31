import { TransitRouteSwitcher } from "@/components/TransitRouteSwitcher";
import { loadSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [route1, route2] = await Promise.all([
    loadSchedule("namtsy-1"),
    loadSchedule("namtsy-2"),
  ]);

  return <TransitRouteSwitcher route1={route1} route2={route2} />;
}
