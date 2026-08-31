"use client";

import { useState } from "react";
import type { ScheduleData } from "@/lib/schedule";
import { TransitAppAttached } from "@/components/TransitAppAttached";
import { TransitAppRoute1 } from "@/components/TransitAppRoute1";

export function TransitRouteSwitcher({ route1, route2 }: { route1: ScheduleData; route2: ScheduleData }) {
  const [selectedRoute, setSelectedRoute] = useState<"1" | "2">("1");

  return (
    <>
      <nav className="route-switch-bar" aria-label="Выбор автобусного маршрута">
        <span>Маршрут</span>
        <div className="route-switch-buttons">
          <button type="button" className={selectedRoute === "1" ? "active" : ""} onClick={() => setSelectedRoute("1")} aria-pressed={selectedRoute === "1"}>№ 1</button>
          <button type="button" className={selectedRoute === "2" ? "active" : ""} onClick={() => setSelectedRoute("2")} aria-pressed={selectedRoute === "2"}>№ 2</button>
        </div>
      </nav>
      {selectedRoute === "1" ? <TransitAppRoute1 initialData={route1} /> : <TransitAppAttached initialData={route2} />}
    </>
  );
}
