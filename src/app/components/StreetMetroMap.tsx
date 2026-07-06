import { Fragment, useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L, { type LatLngExpression, type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { VehicleType } from "../App";
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
let preservedMapView: { center: [number, number]; zoom: number } | null = null;

const HEAT_SPOTS: Array<{ center: LatLngExpression; radius: number; color: string }> = [
  { center: [14.619, 121.052], radius: 900, color: "#737373" },
  { center: [14.586, 121.057], radius: 750, color: "#9CA3AF" },
  { center: [14.554, 121.024], radius: 850, color: "#6B7280" },
  { center: [14.604, 120.982], radius: 700, color: "#A3A3A3" },
  { center: [14.655, 121.032], radius: 650, color: "#D4D4D4" },
];

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

type CrowdLevel = "low" | "moderate" | "high" | "critical";

type LocalVehicle = {
  id: string;
  routeId: string;
  routeName: string;
  type: VehicleType;
  path: [number, number][];
  currentIndex: number;
  direction: 1 | -1;
  stopIndexes: number[];
  pauseUntil: number;
  lastPausedStopIndex: number | null;
  availableSeats: number;
  maxSeats: number;
};

type LocalHotspot = {
  id: string;
  label: string;
  waitingCommuters: number;
  crowdLevel: CrowdLevel;
};

const VEHICLE_ICON_IMAGE: Record<VehicleType, string> = {
  bus: busIcon,
  train: trainIcon,
  jeepney: jeepneyIcon,
  uvexpress: uvIcon,
};

const VEHICLE_MARKER_ICONS: Record<VehicleType, L.DivIcon> = {
  bus: createVehicleMarkerIcon("bus"),
  jeepney: createVehicleMarkerIcon("jeepney"),
  train: createVehicleMarkerIcon("train"),
  uvexpress: createVehicleMarkerIcon("uvexpress"),
};

function createVehicleMarkerIcon(type: VehicleType) {
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
    "><img src="${VEHICLE_ICON_IMAGE[type]}" style="width:28px;height:28px;object-fit:contain;display:block;" /></span>`,
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

function PreserveMapView() {
  useMapEvents({
    moveend: (event) => {
      const map = event.target;
      const center = map.getCenter();
      preservedMapView = {
        center: [center.lat, center.lng],
        zoom: map.getZoom(),
      };
    },
    zoomend: (event) => {
      const map = event.target;
      const center = map.getCenter();
      preservedMapView = {
        center: [center.lat, center.lng],
        zoom: map.getZoom(),
      };
    },
  });

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

function hotspotStyle(level?: CrowdLevel) {
  if (level === "critical") return { radius: 24, color: "#7f1d1d" };
  if (level === "high") return { radius: 16, color: "#ef4444" };
  if (level === "moderate") return { radius: 10, color: "#f59e0b" };
  return { radius: 6, color: "#16a34a" };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function maxSeatsFor(type: VehicleType) {
  if (type === "train") return 1000;
  if (type === "bus") return 55;
  if (type === "uvexpress") return 14;
  return 18;
}

function ghostVehicleCountFor(type: VehicleType) {
  if (type === "uvexpress") return 5;
  return 10;
}

function nearestPathIndex(path: [number, number][], coordinate: [number, number]) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  path.forEach(([lng, lat], index) => {
    const lngDelta = lng - coordinate[0];
    const latDelta = lat - coordinate[1];
    const distance = lngDelta * lngDelta + latDelta * latDelta;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function stopIndexesForRoute(route: TransitRoute) {
  if (!route.coordinates.length) return [];
  const indexes = STOPS
    .filter((stop) => stop.routeId === route.id)
    .map((stop) => nearestPathIndex(route.coordinates, stop.coordinates));

  return Array.from(new Set(indexes)).sort((a, b) => a - b);
}

function crossedStopIndex(vehicle: LocalVehicle, nextIndex: number) {
  if (!vehicle.stopIndexes.length || vehicle.currentIndex === nextIndex) return null;

  const pathLength = vehicle.path.length;
  const crossed = (stopIndex: number) => {
    if (stopIndex === vehicle.currentIndex || stopIndex === vehicle.lastPausedStopIndex) return false;

    if (vehicle.direction === 1) {
      return vehicle.currentIndex < nextIndex
        ? stopIndex > vehicle.currentIndex && stopIndex <= nextIndex
        : stopIndex > vehicle.currentIndex || stopIndex <= nextIndex;
    }

    return vehicle.currentIndex > nextIndex
      ? stopIndex < vehicle.currentIndex && stopIndex >= nextIndex
      : stopIndex < vehicle.currentIndex || stopIndex >= nextIndex;
  };

  const candidates = vehicle.stopIndexes.filter(crossed);
  if (!candidates.length) return null;

  return candidates.reduce((nearest, stopIndex) => {
    const nearestDistance = (vehicle.direction === 1)
      ? (nearest - vehicle.currentIndex + pathLength) % pathLength
      : (vehicle.currentIndex - nearest + pathLength) % pathLength;
    const stopDistance = (vehicle.direction === 1)
      ? (stopIndex - vehicle.currentIndex + pathLength) % pathLength
      : (vehicle.currentIndex - stopIndex + pathLength) % pathLength;

    return stopDistance < nearestDistance ? stopIndex : nearest;
  });
}

function crowdLevelFor(waitingCommuters: number): CrowdLevel {
  if (waitingCommuters > 300) return "critical";
  if (waitingCommuters > 150) return "high";
  if (waitingCommuters > 50) return "moderate";
  return "low";
}

function popupForVehicle(vehicle: LocalVehicle) {
  return `
    <div style="min-width:160px">
      <strong>${vehicle.routeName}</strong><br />
      Seats: ${vehicle.availableSeats}/${vehicle.maxSeats}<br />
      Updated: ${new Date().toLocaleTimeString()}
    </div>
  `;
}

function VehicleMarkersLayer({
  routes,
  onVehicleClick,
}: {
  routes: TransitRoute[];
  onVehicleClick: (vehicleId: string) => void;
}) {
  const map = useMap();
  const routeKey = routes.map((route) => route.id).join("|");

  useEffect(() => {
    const layer = L.layerGroup().addTo(map);
    const vehicles: LocalVehicle[] = routes.flatMap((route, routeIndex) => {
      const vehiclesPerDirection = ghostVehicleCountFor(route.vehicleType);
      const maxSeats = maxSeatsFor(route.vehicleType);
      const totalVehicles = vehiclesPerDirection * 2;
      const stopIndexes = stopIndexesForRoute(route);

      return Array.from({ length: totalVehicles }, (_, vehicleIndex) => {
        const reverse = vehicleIndex >= vehiclesPerDirection;
        const direction = reverse ? -1 : 1;
        const sequenceIndex = reverse ? vehicleIndex - vehiclesPerDirection : vehicleIndex;
        const baseIndex = Math.floor((route.coordinates.length / vehiclesPerDirection) * sequenceIndex) % route.coordinates.length;
        const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(route.coordinates.length / Math.max(vehiclesPerDirection, 1))));
        const currentIndex = reverse
          ? (route.coordinates.length - 1 - baseIndex + jitter) % route.coordinates.length
          : (baseIndex + jitter) % route.coordinates.length;

        return {
          id: `local-${route.id}-${routeIndex}-${vehicleIndex}`,
          routeId: route.id,
          routeName: `${route.name} ${reverse ? "Inbound" : "Outbound"} ${sequenceIndex + 1}`,
          type: route.vehicleType,
          path: route.coordinates,
          currentIndex,
          direction,
          stopIndexes,
          pauseUntil: 0,
          lastPausedStopIndex: null,
          availableSeats: clamp(Math.floor(maxSeats * (0.35 + Math.random() * 0.45)), 0, maxSeats),
          maxSeats,
        };
      });
    });

    const markers = new Map<string, L.Marker>();
    vehicles.forEach((vehicle) => {
      const [lng, lat] = vehicle.path[vehicle.currentIndex];
      const marker = L.marker([lat, lng], { icon: VEHICLE_MARKER_ICONS[vehicle.type] })
        .bindPopup(popupForVehicle(vehicle))
        .on("click", () => onVehicleClick(vehicle.routeId))
        .addTo(layer);
      markers.set(vehicle.id, marker);
    });

    const intervalId = window.setInterval(() => {
      const now = Date.now();

      vehicles.forEach((vehicle) => {
        if (vehicle.pauseUntil > now) {
          vehicle.availableSeats = clamp(vehicle.availableSeats + Math.floor(Math.random() * 5) - 2, 0, vehicle.maxSeats);
          markers.get(vehicle.id)?.setPopupContent(popupForVehicle(vehicle));
          return;
        }

        if (vehicle.lastPausedStopIndex === vehicle.currentIndex) {
          vehicle.lastPausedStopIndex = null;
        }

        const step = 1 + Math.floor(Math.random() * 3);
        const nextIndex = (vehicle.currentIndex + vehicle.direction * step + vehicle.path.length) % vehicle.path.length;
        const stopIndex = crossedStopIndex(vehicle, nextIndex);
        vehicle.currentIndex = stopIndex ?? nextIndex;
        if (stopIndex !== null) {
          vehicle.pauseUntil = now + 5000;
          vehicle.lastPausedStopIndex = stopIndex;
        }
        vehicle.availableSeats = clamp(vehicle.availableSeats + Math.floor(Math.random() * 7) - 3, 0, vehicle.maxSeats);
        const [lng, lat] = vehicle.path[vehicle.currentIndex];
        const marker = markers.get(vehicle.id);
        marker?.setLatLng([lat, lng]);
        marker?.setPopupContent(popupForVehicle(vehicle));
      });
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
      layer.removeFrom(map);
    };
  }, [map, routeKey, onVehicleClick]);

  return null;
}

function HotspotLayer({ routes }: { routes: TransitRoute[] }) {
  const map = useMap();
  const routeKey = routes.map((route) => route.id).join("|");

  useEffect(() => {
    const layer = L.layerGroup().addTo(map);
    const activeRouteIds = new Set(routes.map((route) => route.id));
    const hotspots = STOPS.filter((stop) => stop.routeId && activeRouteIds.has(stop.routeId)).map((stop) => {
      const waitingCommuters = Math.floor(Math.random() * 140);
      return {
        id: stop.id,
        label: stop.name,
        waitingCommuters,
        crowdLevel: crowdLevelFor(waitingCommuters),
      } satisfies LocalHotspot;
    });

    const markers = new Map<string, L.CircleMarker>();
    hotspots.forEach((hotspot) => {
      const station = STOPS.find((stop) => stop.id === hotspot.id);
      if (!station) return;
      const style = hotspotStyle(hotspot.crowdLevel);
      const marker = L.circleMarker([station.coordinates[1], station.coordinates[0]], {
        radius: style.radius,
        color: "#FFFFFF",
        fillColor: style.color,
        fillOpacity: 0.72,
        opacity: 1,
        weight: 3,
      })
        .bindPopup(`<strong>${hotspot.label}</strong><br />Crowd: ${hotspot.crowdLevel}<br />Waiting: ${hotspot.waitingCommuters}`)
        .addTo(layer);
      markers.set(hotspot.id, marker);
    });

    const intervalId = window.setInterval(() => {
      hotspots.forEach((hotspot) => {
        hotspot.waitingCommuters = clamp(hotspot.waitingCommuters + Math.floor(Math.random() * 31) - 12, 0, 500);
        hotspot.crowdLevel = crowdLevelFor(hotspot.waitingCommuters);
        const marker = markers.get(hotspot.id);
        const style = hotspotStyle(hotspot.crowdLevel);
        marker?.setRadius(style.radius);
        marker?.setStyle({ fillColor: style.color });
        marker?.setPopupContent(`<strong>${hotspot.label}</strong><br />Crowd: ${hotspot.crowdLevel}<br />Waiting: ${hotspot.waitingCommuters}`);
      });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
      layer.removeFrom(map);
    };
  }, [map, routeKey]);

  return null;
}

export function StreetMetroMap({ showHeatmap, activeFilters, activeRouteId, activeRouteIds, searchedLocation, mapStyle, offlineMode, lowDataMode, onVehicleClick }: Props) {
  const selectedRouteIds = activeRouteIds?.length ? activeRouteIds : activeRouteId ? [activeRouteId] : [];
  const selectedRouteKey = selectedRouteIds.join("|");
  const activeFilterKey = activeFilters.join("|");
  const activeRoutes = useMemo(() => selectedRouteIds
    .map((routeId) => ROUTES_BY_ID.get(routeId))
    .filter((route): route is TransitRoute => Boolean(route) && activeFilters.includes(route.vehicleType)), [activeFilterKey, selectedRouteKey]);
  const tileUrl = lowDataMode
    ? "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
    : mapStyle === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileClassName = lowDataMode ? "grayscale contrast-75 brightness-105" : mapStyle === "dark" ? "brightness-110 contrast-90" : "grayscale contrast-75 brightness-110";

  return (
    <MapContainer
      center={preservedMapView?.center || DEFAULT_CENTER}
      zoom={preservedMapView?.zoom || 12}
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

      {!offlineMode && (
        <VehicleMarkersLayer
          routes={activeRoutes}
          onVehicleClick={onVehicleClick}
        />
      )}

      {activeRoutes.flatMap((route) => {
        if (!route) return [];

        return STOPS.filter((stop) => stop.routeId === route.id).map((station) => {
          const fallbackColor = routeColor(route.id, route.vehicleType);

          return (
            <CircleMarker
              key={station.id}
              center={[station.coordinates[1], station.coordinates[0]]}
              radius={5}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: fallbackColor,
                fillOpacity: 0.95,
                opacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong>{station.name}</strong>
                  <br />
                  Station marker
                </div>
              </Popup>
            </CircleMarker>
          );
        });
      })}

      {!offlineMode && !lowDataMode && <HotspotLayer routes={activeRoutes} />}

      {searchedLocation && (
        <Marker position={[searchedLocation.lat, searchedLocation.lon]} icon={searchedIcon}>
          <Popup>{searchedLocation.name}</Popup>
        </Marker>
      )}

      <PreserveMapView />
    </MapContainer>
  );
}
