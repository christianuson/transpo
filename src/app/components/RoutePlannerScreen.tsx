import { useMemo, useState } from "react";
import { Map as MapIcon, Search } from "lucide-react";
import type { Vehicle, VehicleType } from "../App";
import { GOLDEN_ROUTE_GROUPS, GOLDEN_ROUTE_VEHICLES } from "../data/routes";
import busIcon from "../assets/bus-inverted.png";
import jeepneyIcon from "../assets/jeepney-inverted.png";
import trainIcon from "../assets/train-inverted.png";
import uvIcon from "../assets/uv-inverted.png";

interface Props {
  activeRouteIds: string[];
  onSelectRoute: (routeId: string) => void;
}

const MODE_FILTERS: Array<{ id: VehicleType | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "jeepney", label: "Jeep" },
  { id: "bus", label: "Bus" },
  { id: "uvexpress", label: "UV" },
  { id: "train", label: "Train" },
];

const VEHICLES_BY_ID = new Map(GOLDEN_ROUTE_VEHICLES.map((vehicle) => [vehicle.id, vehicle]));

const VEHICLE_ICON_BY_TYPE: Record<VehicleType, string> = {
  bus: busIcon,
  jeepney: jeepneyIcon,
  train: trainIcon,
  uvexpress: uvIcon,
};

function VehicleTypeIcon({ type }: { type: VehicleType }) {
  return (
    <img
      src={VEHICLE_ICON_BY_TYPE[type]}
      alt=""
      style={{ width: 30, height: 30, objectFit: "contain", display: "block" }}
    />
  );
}

function goldenVehicles() {
  return GOLDEN_ROUTE_GROUPS.flatMap((group) =>
    group.routes.map((route) => VEHICLES_BY_ID.get(route.id)).filter(Boolean) as Vehicle[]
  );
}

export function RoutePlannerScreen({ activeRouteIds, onSelectRoute }: Props) {
  const [modeFilter, setModeFilter] = useState<VehicleType | "all">("all");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return goldenVehicles().filter((vehicle) => {
      const modeMatches = modeFilter === "all" || vehicle.type === modeFilter;
      const textMatches = !normalizedQuery || `${vehicle.routeName} ${vehicle.stops.join(" ")}`.toLowerCase().includes(normalizedQuery);
      return modeMatches && textMatches;
    });
  }, [modeFilter, query]);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#000" }}>
      <div className="shrink-0 pt-10 px-4 pb-3">
        <h1 style={{ color: "#EAECF0", fontSize: 24, fontWeight: 900 }}>Routes</h1>

        <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "#0E1E2A", border: "1px solid #1C3344" }}>
          <Search size={17} color="#4A6070" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search golden routes"
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ color: "#EAECF0", fontSize: 14 }}
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto">
          {MODE_FILTERS.map(({ id, label }) => {
            const active = modeFilter === id;
            return (
              <button
                key={id}
                onClick={() => setModeFilter(id)}
                className="shrink-0 px-3 py-1.5 rounded-full"
                style={{
                  background: active ? "#2FA4D7" : "#0E1E2A",
                  color: active ? "#000" : "#4A6070",
                  border: `1px solid ${active ? "#2FA4D7" : "#1C3344"}`,
                  fontSize: 12,
                  fontWeight: active ? 800 : 500,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
        {results.map((vehicle) => {
          const selected = activeRouteIds.includes(vehicle.id);
          const stops = vehicle.stops.length ? vehicle.stops : [vehicle.routeName];
          const from = stops[0];
          const to = stops[stops.length - 1];

          return (
            <article
              key={vehicle.id}
              className="rounded-2xl p-4"
              style={{ background: "#0E1E2A", border: selected ? "1px solid #2FA4D7" : "1px solid #1C3344" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#233D4D", color: "#2FA4D7", fontSize: 12, fontWeight: 900 }}>
                  <VehicleTypeIcon type={vehicle.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 style={{ color: "#EAECF0", fontSize: 15, fontWeight: 900, lineHeight: 1.25 }}>{vehicle.routeName}</h2>
                  <p style={{ color: "#4A6070", fontSize: 12, marginTop: 5 }}>
                    {from}{from !== to ? ` to ${to}` : ""}
                  </p>
                  <p style={{ color: "#8899A8", fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
                    {stops.slice(0, 5).join(" - ")}{stops.length > 5 ? " ..." : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span style={{ color: "#EAECF0", fontSize: 22, fontWeight: 900 }}>{vehicle.eta}</span>
                  <span style={{ color: "#4A6070", fontSize: 11 }}> min</span>
                </div>
              </div>

              <button
                onClick={() => onSelectRoute(vehicle.id)}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl"
                style={{ background: "#2FA4D7", color: "#000", fontSize: 14, fontWeight: 800 }}
              >
                <MapIcon size={15} />
                {selected ? "Open Selected Route" : "Open on Map"}
              </button>
            </article>
          );
        })}

        {results.length === 0 && (
          <div className="rounded-2xl p-5" style={{ background: "#0E1E2A", border: "1px solid #1C3344" }}>
            <p style={{ color: "#8899A8", fontSize: 13 }}>No golden routes match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
