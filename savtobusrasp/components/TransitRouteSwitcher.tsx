"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { ScheduleData } from "@/lib/schedule";
import { TransitAppAttached } from "@/components/TransitAppAttached";
import { TransitAppRoute1 } from "@/components/TransitAppRoute1";

const barStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  minHeight: 52,
  padding: "7px 12px",
  borderBottom: "1px solid #dde3ed",
  background: "rgba(255,255,255,.97)",
  boxShadow: "0 5px 18px rgba(24,33,50,.06)",
  backdropFilter: "blur(10px)",
};

const buttonGroupStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  padding: 4,
  border: "1px solid #dde3ed",
  borderRadius: 14,
  background: "#f5f7fb",
};

function buttonStyle(active: boolean): CSSProperties {
  return {
    minWidth: 72,
    minHeight: 34,
    padding: "0 16px",
    border: 0,
    borderRadius: 10,
    background: active ? "#2864dc" : "transparent",
    color: active ? "white" : "#526075",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
    boxShadow: active ? "0 5px 12px rgba(40,100,220,.22)" : "none",
  };
}

export function TransitRouteSwitcher({ route1, route2 }: { route1: ScheduleData; route2: ScheduleData }) {
  const [selectedRoute, setSelectedRoute] = useState<"1" | "2">("1");

  return (
    <>
      <nav style={barStyle} aria-label="Выбор автобусного маршрута">
        <span style={{ color: "#667085", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>Маршрут</span>
        <div style={buttonGroupStyle}>
          <button type="button" style={buttonStyle(selectedRoute === "1")} onClick={() => setSelectedRoute("1")} aria-pressed={selectedRoute === "1"}>№ 1</button>
          <button type="button" style={buttonStyle(selectedRoute === "2")} onClick={() => setSelectedRoute("2")} aria-pressed={selectedRoute === "2"}>№ 2</button>
        </div>
      </nav>
      {selectedRoute === "1" ? <TransitAppRoute1 initialData={route1} /> : <TransitAppAttached initialData={route2} />}
    </>
  );
}
