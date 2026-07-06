import { Fragment, useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L, { type LatLngExpression, type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { VehicleType } from "../App";
import { supabase } from "../lib/supabase";
import { ROUTES_BY_ID, STOPS, type TransitRoute } from "../data/routes";
import busIcon from "../assets/bus.png";
import jeepneyIcon from "../assets/jeepney.png";
import trainIcon from "../assets/train.png";
import uvIcon from "../assets/uv.png";
import peopleIcon from "../assets/people.png";

const METRO_MANILA_BOUNDS: LatLngBoundsExpression = [
  [14.00, 120.55],
  [15.05, 121.45],
];

const DEFAULT_CENTER: LatLngExpression = [14.6091, 121.0223];

const HEAT_SPOTS: Array<{ center: LatLngExpression; radius: number; color: string }> = [
  { center: [14.619, 121.052], radius: 900, color: "#737373" },
  { center: [14.586, 121.057], radius: 750, color: "#9CA3AF" },
  { center: [14.554, 121.024], radius: 850, color: "#6B7280" },
  { center: [14.604, 120.982], radius: 700, color: "#A3A3A3" },
  { center: [14.655, 121.032], radius: 650, color: "#D4D4D4" },
];

interface VehicleTelemetry {
  id: string;
  route_id: string;
  label: string | null;
  latitude: number;
  longitude: number;
  last_seen_at: string | null;
  metadata?: {
    available_seats?: number;
    max_seats?: number;
    vehicle_type?: VehicleType;
  } | null;
}

interface StopHotspot {
  id: string;
  route_id?: string | null;
  label: string | null;
  crowd_level: "low" | "moderate" | "high" | "critical";
  waiting_commuters: number;
  last_updated: string | null;
}

export interface SearchedLocation {
  lat: number;
  lon: number;
  name: string;
}

interface Props {
  showHeatmap: boolean;
  activeFilters: string[];
  activeRouteId?: string | null;
  activeRouteIds?: string[];
  searchedLocation: SearchedLocation | null;
  mapStyle: "dark" | "light";
  offlineMode: boolean;
  lowDataMode: boolean;
  onVehicleClick: (vehicleId: string) => void;
}

function markerIcon(type: VehicleType) {
  const image: Record<VehicleType, string> = {
    bus: busIcon,
    train: trainIcon,
    jeepney: jeepneyIcon,
    uvexpress: uvIcon,
  };

  return L.divIcon({
    className: "",
    html: `<span style="
      display:flex;
      align-items:center;
      justify-content:center;
      width:34px;
      height:34px;
      border-radius:999px;
      background:rgba(255,255,255,0.92);
      border:2px solid #FFFFFF;
      box-shadow:0 5px 16px rgba(0,0,0,0.22), 0 0 0 4px rgba(255,255,255,0.55);
      overflow:hidden;
    "><img src="${image[type]}" style="width:28px;height:28px;object-fit:contain;display:block;" /></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

const searchedIcon = L.divIcon({
  className: "",
  html: `<span style="
    display:flex;
    align-items:center;
    justify-content:center;
    width:34px;
    height:34px;
    border-radius:999px;
    background:rgba(255,255,255,0.96);
    border:3px solid #FFFFFF;
    box-shadow:0 8px 22px rgba(0,0,0,0.22);
    overflow:hidden;
  "><img src="${peopleIcon}" style="width:28px;height:28px;object-fit:contain;display:block;" /></span>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function ChangeView({ location }: { location: SearchedLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;
    map.flyTo([location.lat, location.lon], 14, { duration: 1.5 });
  }, [location, map]);

  return null;
}

function routeColor(routeId: string | null, type?: VehicleType) {
  if (routeId === "ROUTE_880747") return "#D4A017";
  if (routeId === "ROUTE_880801") return "#7B3FB2";
  if (routeId === "ROUTE_880854") return "#1B8F4D";
  if (type === "bus") return "#3F3F3F";
  if (type === "uvexpress") return "#6F6F6F";
  return "#525252";
}

function hotspotStyle(level?: StopHotspot["crowd_level"]) {
  if (level === "critical") return { radius: 24, color: "#7f1d1d" };
  if (level === "high") return { radius: 16, color: "#ef4444" };
  if (level === "moderate") return { radius: 10, color: "#f59e0b" };
  return { radius: 6, color: "#16a34a" };
}

export function StreetMetroMap({ showHeatmap, activeFilters, activeRouteId, activeRouteIds, searchedLocation, mapStyle, offlineMode, lowDataMode, onVehicleClick }: Props) {
  const selectedRouteIds = activeRouteIds?.length ? activeRouteIds : activeRouteId ? [activeRouteId] : [];
  const selectedRouteKey = selectedRouteIds.join("|");
  const activeFilterKey = activeFilters.join("|");
  const activeRoutes = useMemo(() => selectedRouteIds
    .map((routeId) => ROUTES_BY_ID.get(routeId))
    .filter((route): route is TransitRoute => Boolean(route) && activeFilters.includes(route.vehicleType)), [activeFilterKey, selectedRouteKey]);
  const [vehicleTelemetry, setVehicleTelemetry] = useState<VehicleTelemetry[]>([]);
  const [hotspots, setHotspots] = useState<Record<string, StopHotspot>>({});
  const tileUrl = lowDataMode
    ? "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
    : mapStyle === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileClassName = lowDataMode ? "grayscale contrast-75 brightness-105" : mapStyle === "dark" ? "brightness-110 contrast-90" : "grayscale contrast-75 brightness-110";

  useEffect(() => {
    if (!supabase || !selectedRouteIds.length || offlineMode) {
      setVehicleTelemetry([]);
      return;
    }

    let cancelled = false;

    async function loadVehicleTelemetry() {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id,route_id,label,latitude,longitude,last_seen_at,metadata")
        .in("route_id", selectedRouteIds);

      if (cancelled) return;
      if (error) {
        console.warn("Vehicle telemetry fetch failed:", error.message);
        return;
      }

      setVehicleTelemetry((data || []).filter((vehicle) => (
        Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude)
      )) as VehicleTelemetry[]);
    }

    void loadVehicleTelemetry();
    const intervalId = window.setInterval(() => {
      void loadVehicleTelemetry();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedRouteKey, offlineMode]);

  useEffect(() => {
    if (!supabase || offlineMode || lowDataMode) {
      setHotspots({});
      return;
    }

    let cancelled = false;

    async function loadHotspots() {
      const { data, error } = await supabase
        .from("live_stops")
        .select("id,route_id,label,crowd_level,waiting_commuters,last_updated");

      if (cancelled) return;
      if (error) {
        console.warn("Live stop hotspot fetch failed:", error.message);
        return;
      }

      const nextHotspots = (data || []).reduce<Record<string, StopHotspot>>((acc, hotspot) => {
        acc[String(hotspot.id)] = hotspot as StopHotspot;
        return acc;
      }, {});
      setHotspots(nextHotspots);
    }

    void loadHotspots();

    const channel = supabase
      .channel("live-stops-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_stops" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = String((payload.old as { id?: string }).id || "");
          setHotspots((current) => {
            const next = { ...current };
            delete next[oldId];
            return next;
          });
          return;
        }

        const next = payload.new as StopHotspot;
        if (!next?.id) return;
        setHotspots((current) => ({ ...current, [String(next.id)]: next }));
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [offlineMode, lowDataMode]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={12}
      minZoom={10}
      maxBounds={METRO_MANILA_BOUNDS}
      maxBoundsViscosity={1}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
      style={{ background: mapStyle === "dark" ? "#0B1C28" : "#F8F8F8", zIndex: 0 }}
    >
      {!offlineMode && (
        <TileLayer
          key={`${mapStyle}-${lowDataMode ? "low" : "full"}`}
          attribution={mapStyle === "dark" || lowDataMode ? "OpenStreetMap contributors, CARTO" : "OpenStreetMap contributors"}
          url={tileUrl}
          className={tileClassName}
        />
      )}

      {selectedRouteIds.length > 0 && showHeatmap && !offlineMode && !lowDataMode && HEAT_SPOTS.map((spot, index) => (
        <Circle
          key={`${spot.color}-${index}`}
          center={spot.center}
          radius={spot.radius}
          pathOptions={{ color: spot.color, fillColor: spot.color, fillOpacity: 0.2, opacity: 0.32, weight: 1 }}
        />
      ))}

      {activeRoutes.map((route) => {
        if (!route) return null;
        const routePath = route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
        const color = routeColor(route.id, route.vehicleType);

        return (
          <Fragment key={`${route.id}-line`}>
            <Polyline
              positions={routePath}
              pathOptions={{ color: "#FFFFFF", opacity: 0.95, weight: 9, lineCap: "round", lineJoin: "round" }}
            />
            <Polyline
              positions={routePath}
              pathOptions={{ color, opacity: 0.92, weight: 4, lineCap: "round", lineJoin: "round" }}
            />
          </Fragment>
        );
      })}

      {!offlineMode && activeRoutes.flatMap((route) => {
        const routeVehicles = vehicleTelemetry.filter((vehicle) => vehicle.route_id === route.id);

        if (!routeVehicles.length) {
          const fallbackPosition = route.coordinates[Math.floor(route.coordinates.length / 2)];
          if (!fallbackPosition) return [];

          return (
            <Marker
              key={`${route.id}-vehicle-fallback`}
              position={[fallbackPosition[1], fallbackPosition[0]]}
              icon={markerIcon(route.vehicleType)}
              eventHandlers={{ click: () => onVehicleClick(route.id) }}
            >
              <Popup>{route.name}</Popup>
            </Marker>
          );
        }

        return routeVehicles.map((vehicle) => (
          <Marker
            key={vehicle.id}
            position={[vehicle.latitude, vehicle.longitude]}
            icon={markerIcon(route.vehicleType)}
            eventHandlers={{ click: () => onVehicleClick(route.id) }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <strong>{vehicle.label || route.name}</strong>
                {vehicle.metadata?.available_seats !== undefined && (
                  <>
                    <br />
                    Seats: {vehicle.metadata.available_seats}/{vehicle.metadata.max_seats ?? "?"}
                  </>
                )}
                {vehicle.last_seen_at && (
                  <>
                    <br />
                    Updated: {new Date(vehicle.last_seen_at).toLocaleTimeString()}
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ));
      })}

      {activeRoutes.flatMap((route) => {
        if (!route) return [];

        return STOPS.filter((stop) => stop.routeId === route.id).map((station) => {
          const hotspot = hotspots[station.id];
          const liveStyle = hotspotStyle(hotspot?.crowd_level);
          const fallbackColor = routeColor(route.id, route.vehicleType);

          return (
            <CircleMarker
              key={station.id}
              center={[station.coordinates[1], station.coordinates[0]]}
              radius={hotspot ? liveStyle.radius : 5}
              className={hotspot?.crowd_level === "high" || hotspot?.crowd_level === "critical" ? "transpo-hotspot-pulse" : ""}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: hotspot ? liveStyle.color : fallbackColor,
                fillOpacity: hotspot ? 0.72 : 0.95,
                opacity: 1,
                weight: hotspot ? 3 : 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong>{hotspot?.label || station.name}</strong>
                  {hotspot ? (
                    <>
                      <br />
                      Crowd: {hotspot.crowd_level}
                      <br />
                      Waiting: {hotspot.waiting_commuters}
                    </>
                  ) : (
                    <>
                      <br />
                      Live crowd pending
                    </>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        });
      })}

      {searchedLocation && (
        <Marker position={[searchedLocation.lat, searchedLocation.lon]} icon={searchedIcon}>
          <Popup>{searchedLocation.name}</Popup>
        </Marker>
      )}

      <ChangeView location={searchedLocation} />
    </MapContainer>
  );
}
