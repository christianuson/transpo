import { useMemo, useState } from "react";
import { Bookmark, Map as MapIcon, Star, Trash2 } from "lucide-react";
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
      style={{ width: 27, height: 27, objectFit: "contain", display: "block" }}
    />
  );
}

function initialSavedIds() {
  return GOLDEN_ROUTE_GROUPS.flatMap((group) => group.routes.map((route) => route.id));
}

export function SavedRoutesScreen({ activeRouteIds, onSelectRoute }: Props) {
  const [savedIds, setSavedIds] = useState<string[]>(initialSavedIds);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set(savedIds.slice(0, 3)));

  const savedRoutes = useMemo(
    () => savedIds.map((id) => VEHICLES_BY_ID.get(id)).filter(Boolean) as Vehicle[],
    [savedIds]
  );

  const toggleFav = (id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteRoute = (id: string) => {
    setSavedIds((items) => items.filter((routeId) => routeId !== id));
    setFavoriteIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const renderCard = (route: Vehicle) => {
    const selected = activeRouteIds.includes(route.id);
    const favorite = favoriteIds.has(route.id);

    const stops = route.stops.length ? route.stops : [route.routeName];
    const from = stops[0];
    const to = stops[stops.length - 1];

    return (
      <article
        key={route.id}
        className="rounded-2xl p-4 relative"
        style={{
          background: "#0E1E2A",
          border: selected ? "1px solid #2FA4D7" : "1px solid #1C3344",
        }}
      >
        <div className="absolute top-4 right-3 flex flex-col gap-2 items-end">
          <button
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            className="w-6 h-6 flex items-center justify-center"
            onClick={() => toggleFav(route.id)}
          >
            <Star size={16} color={favorite ? "#2FA4D7" : "#2A4050"} fill={favorite ? "#2FA4D7" : "none"} />
          </button>
          <button
            aria-label="Remove saved route"
            className="w-6 h-6 flex items-center justify-center"
            onClick={() => deleteRoute(route.id)}
          >
            <Trash2 size={14} color="#2A4050" />
          </button>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#233D4D", color: "#2FA4D7", fontSize: 12, fontWeight: 900 }}>
            <VehicleTypeIcon type={route.type} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 style={{ color: "#EAECF0", fontSize: 15, fontWeight: 900, lineHeight: 1.25 }}>{route.routeName}</h2>
            <p style={{ color: "#4A6070", fontSize: 12, marginTop: 5 }}>
              {from}{from !== to ? ` to ${to}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0" style={{ paddingRight: 34 }}>
            <span style={{ color: "#EAECF0", fontSize: 22, fontWeight: 900 }}>{route.eta}</span>
            <span style={{ color: "#4A6070", fontSize: 11 }}> min</span>
          </div>
        </div>

        <button
          onClick={() => onSelectRoute(route.id)}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl"
          style={{ background: "#2FA4D7", color: "#000", fontSize: 14, fontWeight: 800 }}
        >
          <MapIcon size={15} />
          {selected ? "Open Selected Route" : "Open on Map"}
        </button>
      </article>
    );
  };

  const favRoutes = savedRoutes.filter((route) => favoriteIds.has(route.id));
  const otherRoutes = savedRoutes.filter((route) => !favoriteIds.has(route.id));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: "#000" }}>
      <div className="shrink-0 pt-10 px-4 pb-4">
        <h1 style={{ color: "#EAECF0", fontSize: 22, fontWeight: 800 }}>Saved Routes</h1>
        <p style={{ color: "#3A5060", fontSize: 12 }}>{savedRoutes.length} golden route(s) saved</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
        {savedRoutes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 mt-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "#0E1E2A", border: "1px solid #1C3344" }}>
              <Bookmark size={28} color="#2A4050" />
            </div>
            <p style={{ color: "#3A5060", fontSize: 14 }}>No saved routes yet</p>
          </div>
        ) : (
          <>
            {favRoutes.length > 0 && (
              <>
                <p style={{ color: "#3A5060", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4, marginBottom: 2 }}>Favorites</p>
                {favRoutes.map(renderCard)}
              </>
            )}
            {otherRoutes.length > 0 && (
              <>
                <p style={{ color: "#3A5060", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 10, marginBottom: 2 }}>Other Routes</p>
                {otherRoutes.map(renderCard)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
