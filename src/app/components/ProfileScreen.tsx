import { useEffect, useState } from "react";
import { Briefcase, ChevronRight, Clock, GraduationCap, Heart, LogOut, MapPin, Pencil, Settings, Wrench } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase, type ProfileRecord } from "../lib/supabase";
import { mergeTripHistory, readLocalTripHistory, type TripHistoryRecord } from "../lib/tripHistory";
import { GOLDEN_ROUTE_VEHICLES } from "../data/routes";
import { UserLocationSharing } from "./UserLocationSharing";

interface Props {
  user: User | null;
  isGuest: boolean;
  profile: ProfileRecord | null;
  isSharingLocation: boolean;
  userLocation: { lat: number; lon: number; name: string } | null;
  locationStatus: string;
  onToggleLocationSharing: () => void;
  onSettings: () => void;
  onSaveProfile: (profile: ProfileRecord) => Promise<string | undefined>;
  onSignOut: () => void;
}

const ROLES = [
  { id: "commuter", label: "Commuter", Icon: Heart },
  { id: "student", label: "Student", Icon: GraduationCap },
  { id: "worker", label: "Worker", Icon: Briefcase },
  { id: "driver", label: "Driver", Icon: Wrench },
];

const TRANSPORT_PREFS = [
  { id: "jeepney", label: "Jeepney" },
  { id: "bus", label: "Bus" },
  { id: "train", label: "Train" },
  { id: "uvexpress", label: "UV Express" },
];

const ROUTE_NAME_BY_ID = new Map(GOLDEN_ROUTE_VEHICLES.map((route) => [route.id, route.routeName]));

function formatTripDate(value: string | null) {
  if (!value) return "In progress";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function tripDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "Active";
  const minutes = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function ProfileScreen({ user, isGuest, profile, isSharingLocation, userLocation, locationStatus, onToggleLocationSharing, onSettings, onSaveProfile, onSignOut }: Props) {
  const [selectedRole, setSelectedRole] = useState("commuter");
  const [selectedTransport, setSelectedTransport] = useState(["jeepney", "train"]);
  const [showHistory, setShowHistory] = useState(false);
  const [draftName, setDraftName] = useState(profile?.full_name || "Guest User");
  const [saveStatus, setSaveStatus] = useState("");
  const [tripHistory, setTripHistory] = useState<TripHistoryRecord[]>([]);
  const [tripHistoryStatus, setTripHistoryStatus] = useState("");

  const displayName = profile?.full_name || draftName || "Guest User";
  const email = profile?.email || user?.email || (isGuest ? "Guest session" : "Connect with Google");
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const profileUserId = profile?.id || user?.id || null;
  const savedName = profile?.full_name || "Guest User";
  const nameChanged = draftName.trim() !== savedName;

  useEffect(() => {
    setDraftName(profile?.full_name || "Guest User");
  }, [profile?.full_name]);

  useEffect(() => {
    let cancelled = false;

    async function loadTripHistory() {
      const localTrips = readLocalTripHistory();

      if (!supabase) {
        const mergedTrips = mergeTripHistory(localTrips).slice(0, 3);
        setTripHistory(mergedTrips);
        setTripHistoryStatus(mergedTrips.length ? "" : "No completed trips yet.");
        return;
      }

      let userId = profileUserId;
      if (!userId) {
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user?.id ?? null;
      }

      if (!userId) {
        const mergedTrips = mergeTripHistory(localTrips).slice(0, 3);
        setTripHistory(mergedTrips);
        setTripHistoryStatus(mergedTrips.length ? "" : "No completed trips on this device yet.");
        return;
      }

      const { data, error } = await supabase
        .from("trip_history")
        .select("id,route_ids,started_at,ended_at,status")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(3);

      if (cancelled) return;

      if (error) {
        const mergedTrips = mergeTripHistory(localTrips).slice(0, 3);
        setTripHistory(mergedTrips);
        setTripHistoryStatus(mergedTrips.length ? "" : error.message);
        return;
      }

      const mergedTrips = mergeTripHistory((data || []) as TripHistoryRecord[], localTrips).slice(0, 3);
      setTripHistory(mergedTrips);
      setTripHistoryStatus(mergedTrips.length ? "" : "No completed trips yet.");
    }

    void loadTripHistory();

    return () => {
      cancelled = true;
    };
  }, [profileUserId]);

  const toggleTransport = (id: string) => {
    setSelectedTransport((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const saveChanges = async () => {
    const message = await onSaveProfile({
      id: profile?.id || user?.id,
      email: profile?.email || user?.email || null,
      full_name: draftName.trim() || "Guest User",
      avatar_url: avatarUrl || null,
    });
    setSaveStatus(message || "Profile saved.");
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto" style={{ background: "#000" }}>
      <div className="shrink-0 pt-10 px-4 pb-6 flex items-center justify-between">
        <h1 style={{ color: "#EAECF0", fontSize: 22, fontWeight: 800 }}>Profile</h1>
        <button
          onClick={onSettings}
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#233D4D", border: "1px solid #1C3344" }}
        >
          <Settings size={18} color="#8899A8" />
        </button>
      </div>

      <div className="shrink-0 px-4 flex flex-col items-center gap-3 pb-6">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(145deg, #2FA4D7, #248FBE)" }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span style={{ color: "#000", fontSize: 24, fontWeight: 900 }}>
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <div className="text-center">
          <p style={{ color: "#EAECF0", fontSize: 18, fontWeight: 800 }}>{displayName}</p>
          <div className="flex items-center gap-1.5 justify-center mt-1">
            <MapPin size={12} color="#4A6070" />
            <p style={{ color: "#4A6070", fontSize: 12 }}>{email}</p>
          </div>
        </div>

        <div className="w-full rounded-2xl p-3.5" style={{ background: "#0E1E2A", border: "1px solid #1C3344" }}>
          <label className="flex flex-col gap-2">
            <span style={{ color: "#4A6070", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Display Name
            </span>
            <div className="relative">
              <input
                value={draftName}
                onChange={(event) => {
                  setDraftName(event.target.value);
                  setSaveStatus("");
                }}
                placeholder="Guest User"
                style={{
                  width: "100%",
                  background: "#233D4D",
                  border: "1px solid #1C3344",
                  borderRadius: 12,
                  color: "#EAECF0",
                  padding: "12px 42px 12px 14px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <Pencil
                size={16}
                color={nameChanged ? "#2FA4D7" : "#8899A8"}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
            </div>
          </label>
          {nameChanged && (
            <button
              onClick={saveChanges}
              className="w-full mt-3 py-3 rounded-xl"
              style={{ background: "#2FA4D7", color: "#000", fontSize: 14, fontWeight: 800 }}
            >
              Save Changes
            </button>
          )}
          {saveStatus && (
            <p style={{ color: "#8899A8", fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>{saveStatus}</p>
          )}
        </div>

        <div className="w-full flex rounded-2xl overflow-hidden mt-2" style={{ background: "#0E1E2A", border: "1px solid #1C3344" }}>
          {[
            { label: "Trips", value: String(tripHistory.length) },
            { label: "Routes", value: "0" },
            { label: "Km Saved", value: "0" },
          ].map(({ label, value }, i, arr) => (
            <div
              key={label}
              className="flex-1 flex flex-col items-center py-3"
              style={{ borderRight: i < arr.length - 1 ? "1px solid #1C3344" : "none" }}
            >
              <span style={{ color: "#2FA4D7", fontSize: 20, fontWeight: 800 }}>{value}</span>
              <span style={{ color: "#4A6070", fontSize: 10 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 mb-4">
        <p style={{ color: "#4A6070", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
          My Role
        </p>
        <div className="grid grid-cols-4 gap-2">
          {ROLES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedRole(id)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl"
              style={{
                background: selectedRole === id ? "#2FA4D722" : "#0E1E2A",
                border: `1px solid ${selectedRole === id ? "#2FA4D766" : "#1C3344"}`,
              }}
            >
              <Icon size={18} color={selectedRole === id ? "#2FA4D7" : "#3A5060"} />
              <span style={{ color: selectedRole === id ? "#2FA4D7" : "#4A6070", fontSize: 10, fontWeight: 600 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mb-4">
        <p style={{ color: "#4A6070", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
          Preferred Transport
        </p>
        <div className="flex gap-2 flex-wrap">
          {TRANSPORT_PREFS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => toggleTransport(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: selectedTransport.includes(id) ? "#2FA4D7" : "#0E1E2A",
                color: selectedTransport.includes(id) ? "#000" : "#4A6070",
                border: `1px solid ${selectedTransport.includes(id) ? "#2FA4D7" : "#1C3344"}`,
                fontSize: 12,
                fontWeight: selectedTransport.includes(id) ? 700 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <UserLocationSharing
        isSharing={isSharingLocation}
        currentLocation={userLocation}
        status={locationStatus}
        onToggle={onToggleLocationSharing}
      />

      <div className="px-4 mb-4">
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="w-full flex items-center justify-between py-3.5 px-4 rounded-2xl"
          style={{ background: "#0E1E2A", border: "1px solid #1C3344" }}
        >
          <div className="flex items-center gap-3">
            <Clock size={18} color="#4A6070" />
            <span style={{ color: "#EAECF0", fontSize: 14, fontWeight: 600 }}>Trip History</span>
          </div>
          <ChevronRight size={16} color="#3A5060" style={{ transform: showHistory ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
        </button>

        {showHistory && (
          <div className="mt-2 flex flex-col gap-2">
            {tripHistory.length > 0 ? tripHistory.map((trip) => {
              const routeNames = trip.route_ids
                .map((routeId) => ROUTE_NAME_BY_ID.get(routeId) || routeId)
                .join(" + ");

              return (
                <div key={trip.id} className="p-3 rounded-xl" style={{ background: "#0A1520", border: "1px solid #1C3344" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p style={{ color: "#EAECF0", fontSize: 13, fontWeight: 800, lineHeight: 1.35 }}>
                        {routeNames || "Unnamed route"}
                      </p>
                      <p style={{ color: "#4A6070", fontSize: 11, marginTop: 5 }}>
                        Ended {formatTripDate(trip.ended_at)}
                      </p>
                    </div>
                    <span className="shrink-0" style={{ color: "#2FA4D7", fontSize: 12, fontWeight: 900 }}>
                      {tripDuration(trip.started_at, trip.ended_at)}
                    </span>
                  </div>
                </div>
              );
            }) : (
              <div className="p-3 rounded-xl" style={{ background: "#0A1520", border: "1px solid #1C3344" }}>
                <span style={{ color: "#8899A8", fontSize: 12 }}>
                  {tripHistoryStatus || "No completed trips yet."}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 mb-6">
        <button
          onClick={onSettings}
          className="w-full flex items-center justify-between py-3.5 px-4 rounded-2xl"
          style={{ background: "#0E1E2A", border: "1px solid #1C3344" }}
        >
          <div className="flex items-center gap-3">
            <Settings size={18} color="#4A6070" />
            <span style={{ color: "#EAECF0", fontSize: 14, fontWeight: 600 }}>App Settings</span>
          </div>
          <ChevronRight size={16} color="#3A5060" />
        </button>
      </div>

      <div className="px-4 pb-6">
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl"
          style={{ background: "#0E1E2A", border: "1px solid #1C3344", color: "#C0392B" }}
        >
          <LogOut size={16} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{isGuest ? "Exit Guest Mode" : "Log Out"}</span>
        </button>
      </div>
    </div>
  );
}
