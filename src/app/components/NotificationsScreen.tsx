import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, CheckCircle, Clock, Info, Trash2 } from "lucide-react";
import { GOLDEN_ROUTE_VEHICLES } from "../data/routes";
import type { AppSettings, VehicleType } from "../App";

interface Props {
  activeRouteIds: string[];
  settings: AppSettings;
}

interface AppNotification {
  id: string;
  type: "arriving" | "seat" | "route" | "system";
  title: string;
  body: string;
  time: string;
}

interface NotificationVehicleTelemetry {
  id: string;
  route_id: string;
  label: string;
  last_seen_at: string;
  metadata: {
    available_seats: number;
    max_seats: number;
    vehicle_type: VehicleType;
  };
}

const ROUTE_BY_ID = new Map(GOLDEN_ROUTE_VEHICLES.map((vehicle) => [vehicle.id, vehicle]));

const TYPE_COLOR: Record<AppNotification["type"], string> = {
  arriving: "#2FA4D7",
  seat: "#27AE60",
  route: "#2E86C1",
  system: "#8899A8",
};

function relativeTime(value: string | null) {
  if (!value) return "Pending";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  return `${Math.floor(diffMinutes / 60)} hr ago`;
}

function routeTypeLabel(routeId: string) {
  const type = ROUTE_BY_ID.get(routeId)?.type;
  if (type === "bus") return "Bus";
  if (type === "train") return "Train";
  if (type === "uvexpress") return "UV";
  return "Jeep";
}

function maxSeatsFor(type: VehicleType) {
  if (type === "train") return 1000;
  if (type === "bus") return 55;
  if (type === "uvexpress") return 14;
  return 18;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function initializeNotificationFleet(): NotificationVehicleTelemetry[] {
  return GOLDEN_ROUTE_VEHICLES.flatMap((route) => {
    const maxSeats = maxSeatsFor(route.type);
    const count = route.type === "uvexpress" ? 10 : 20;

    return Array.from({ length: count }, (_, index) => ({
      id: `notification-${route.id}-${index}`,
      route_id: route.id,
      label: `${route.routeName} ${index + 1}`,
      last_seen_at: new Date().toISOString(),
      metadata: {
        available_seats: clamp(Math.floor(maxSeats * (0.35 + Math.random() * 0.45)), 0, maxSeats),
        max_seats: maxSeats,
        vehicle_type: route.type,
      },
    }));
  });
}

function buildNotifications(activeRouteIds: string[], telemetry: NotificationVehicleTelemetry[], settings: AppSettings): AppNotification[] {
  if (!activeRouteIds.length) {
    return [{
      id: "select-route",
      type: "system",
      title: "Select routes to receive alerts",
      body: "Route and vehicle alerts will appear here once you choose routes on the map.",
      time: "Now",
    }];
  }

  const notifications: AppNotification[] = settings.savedRoute ? activeRouteIds.map((routeId) => {
    const route = ROUTE_BY_ID.get(routeId);
    const count = telemetry.filter((vehicle) => vehicle.route_id === routeId).length;
    return {
      id: `route-${routeId}`,
      type: "route",
      title: route ? `${route.routeName} selected` : "Selected route",
      body: count ? `${count} live ${routeTypeLabel(routeId).toLowerCase()} vehicle(s) are broadcasting on this route.` : "Waiting for simulated vehicles to broadcast on this route.",
      time: "Live",
    };
  }) : [];

  telemetry.slice(0, 12).forEach((vehicle) => {
    const route = ROUTE_BY_ID.get(vehicle.route_id);
    const availableSeats = vehicle.metadata?.available_seats;
    const maxSeats = vehicle.metadata?.max_seats;
    const lowSeats = availableSeats !== undefined && maxSeats !== undefined && maxSeats > 0 && availableSeats / maxSeats <= 0.2;

    if (lowSeats && settings.seatUpdate) {
      notifications.push({
        id: `seat-${vehicle.id}`,
        type: "seat",
        title: "Limited seats available",
        body: `${vehicle.label || route?.routeName || "Vehicle"} has ${availableSeats}/${maxSeats ?? "?"} seats available.`,
        time: relativeTime(vehicle.last_seen_at),
      });
    } else if (!lowSeats && settings.arriving) {
      notifications.push({
        id: `vehicle-${vehicle.id}`,
        type: "arriving",
        title: "Vehicle telemetry updated",
        body: `${vehicle.label || route?.routeName || "Vehicle"}${availableSeats !== undefined ? ` has ${availableSeats}/${maxSeats ?? "?"} seats available.` : " is active on the selected route."}`,
        time: relativeTime(vehicle.last_seen_at),
      });
    }
  });

  return notifications.length ? notifications : [{
    id: "alerts-disabled",
    type: "system",
    title: "Alerts are muted",
    body: "Turn on vehicle, seat, or route alerts in Settings to receive updates here.",
    time: "Now",
  }];
}

export function NotificationsScreen({ activeRouteIds, settings }: Props) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [simulatedVehicles, setSimulatedVehicles] = useState<NotificationVehicleTelemetry[]>(initializeNotificationFleet);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const timestamp = new Date().toISOString();

      setSimulatedVehicles((vehicles) => vehicles.map((vehicle) => {
        const seatDelta = Math.floor(Math.random() * 7) - 3;
        return {
          ...vehicle,
          last_seen_at: timestamp,
          metadata: {
            ...vehicle.metadata,
            available_seats: clamp(vehicle.metadata.available_seats + seatDelta, 0, vehicle.metadata.max_seats),
          },
        };
      }));
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, []);

  const telemetry = useMemo(
    () => simulatedVehicles
      .filter((vehicle) => activeRouteIds.includes(vehicle.route_id))
      .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
      .slice(0, 40),
    [activeRouteIds, simulatedVehicles]
  );

  const notifications = useMemo(
    () => buildNotifications(activeRouteIds, telemetry, settings).filter((notification) => !dismissedIds.has(notification.id)),
    [activeRouteIds, telemetry, dismissedIds, settings]
  );

  const unread = notifications.filter((notification) => !readIds.has(notification.id)).length;
  const markAllRead = () => setReadIds(new Set(notifications.map((notification) => notification.id)));
  const dismiss = (id: string) => setDismissedIds((current) => new Set(current).add(id));

  const renderNotif = (notification: AppNotification) => {
    const read = readIds.has(notification.id);
    const Icon = notification.type === "seat" ? CheckCircle : notification.type === "route" ? Info : notification.type === "system" ? Bell : AlertCircle;

    return (
      <div
        key={notification.id}
        className="flex items-start gap-3 p-3.5 rounded-2xl relative"
        style={{
          background: "#0E1E2A",
          border: `1px solid ${read ? "#1C3344" : TYPE_COLOR[notification.type] + "66"}`,
        }}
      >
        {!read && <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: TYPE_COLOR[notification.type] }} />}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: TYPE_COLOR[notification.type] + "22" }}>
          <Icon size={19} color={TYPE_COLOR[notification.type]} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p style={{ color: "#EAECF0", fontSize: 13, fontWeight: 800 }}>{notification.title}</p>
            <button onClick={() => dismiss(notification.id)}>
              <Trash2 size={13} color="#4A6070" />
            </button>
          </div>
          <p style={{ color: "#8899A8", fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>{notification.body}</p>
          <div className="flex items-center gap-1 mt-1.5">
            <Clock size={10} color="#4A6070" />
            <span style={{ color: "#4A6070", fontSize: 10 }}>{notification.time}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: "#000" }}>
      <div className="shrink-0 pt-10 px-4 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 style={{ color: "#EAECF0", fontSize: 22, fontWeight: 800 }}>Notifications</h1>
          {unread > 0 && (
            <span className="px-2.5 py-0.5 rounded-full" style={{ background: "#2FA4D7", color: "#000", fontSize: 12, fontWeight: 800 }}>
              {unread}
            </span>
          )}
        </div>
        <button onClick={markAllRead} style={{ color: "#2FA4D7", fontSize: 12, fontWeight: 700 }}>
          Mark all as read
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-3 pb-4">
        <p style={{ color: "#3A5060", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Selected Route Alerts
        </p>
        {notifications.map(renderNotif)}
      </div>
    </div>
  );
}
