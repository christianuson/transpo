import { useState, useEffect, useRef } from "react";
import { SplashScreen } from "./components/SplashScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { AuthScreen } from "./components/AuthScreen";
import { HomeScreen } from "./components/HomeScreen";
import { RoutePlannerScreen } from "./components/RoutePlannerScreen";
import { LiveTrackingScreen } from "./components/LiveTrackingScreen";
import { NotificationsScreen } from "./components/NotificationsScreen";
import { SavedRoutesScreen } from "./components/SavedRoutesScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { BottomNav } from "./components/BottomNav";
import {
  clearLocalGuestProfile,
  ensureGuestUser,
  getLocalGuestProfile,
  hasLocalGuestProfile,
  loadProfile,
  profileFromUser,
  saveLocalGuestProfile,
  signInWithOAuth,
  supabase,
  upsertProfile,
  type OAuthProvider,
  type ProfileRecord,
} from "./lib/supabase";
import type { User } from "@supabase/supabase-js";

export type VehicleType = "jeepney" | "bus" | "train" | "uvexpress";
export type CapacityLevel = "available" | "limited" | "full";

export interface Vehicle {
  id: string;
  type: VehicleType;
  routeName: string;
  plateNo: string;
  capacity: CapacityLevel;
  eta: number;
  distance: string;
  occupancy: number;
  maxOccupancy: number;
  stops: string[];
  currentStop: number;
  emoji: string;
}

type AppPhase = "splash" | "onboarding" | "auth" | "app";
type AppTab = "home" | "routes" | "notifications" | "saved" | "profile";
type SubScreen = null | "tracking" | "settings";
type HomeFlow = "prompt" | "map" | "routes";
const GPS_SHARING_KEY = "transpo_gps_sharing_enabled";
const MAP_STYLE_KEY = "transpo_map_style";
const APP_SETTINGS_KEY = "transpo_app_settings";
type MapStyle = "dark" | "light";

export interface AppSettings {
  arriving: boolean;
  seatUpdate: boolean;
  savedRoute: boolean;
  offlineMode: boolean;
  lowData: boolean;
  locationBg: boolean;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  arriving: true,
  seatUpdate: true,
  savedRoute: false,
  offlineMode: false,
  lowData: false,
  locationBg: true,
};

function loadAppSettings() {
  const stored = localStorage.getItem(APP_SETTINGS_KEY);
  if (!stored) return DEFAULT_APP_SETTINGS;

  try {
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(stored) } as AppSettings;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

interface SharedLocation {
  lat: number;
  lon: number;
  name: string;
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [homeFlow, setHomeFlow] = useState<HomeFlow>("prompt");
  const [homeActiveRouteIds, setHomeActiveRouteIds] = useState<string[]>([]);
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [authError, setAuthError] = useState("");
  const [isSharingLocation, setIsSharingLocation] = useState(() => localStorage.getItem(GPS_SHARING_KEY) === "true");
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => localStorage.getItem(MAP_STYLE_KEY) === "light" ? "light" : "dark");
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [sharedLocation, setSharedLocation] = useState<SharedLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState("GPS sharing is off");
  const watchIdRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    userIdRef.current = currentUser?.id ?? profile?.id ?? userIdRef.current;
  }, [currentUser?.id, profile?.id]);

  useEffect(() => {
    if (phase === "splash") {
      const t = setTimeout(() => {
        if (hasLocalGuestProfile()) {
          const localGuest = getLocalGuestProfile();
          setProfile(localGuest);
          setIsGuest(true);
          setPhase("app");
          return;
        }
        setPhase("onboarding");
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setCurrentUser(data.session.user);
        const anonymous = Boolean(data.session.user.is_anonymous);
        setIsGuest(anonymous);
        loadProfile(data.session.user).then((nextProfile) => {
          const profileToUse = anonymous ? { ...getLocalGuestProfile(), id: data.session.user.id, email: data.session.user.email ?? null } : nextProfile;
          setProfile(profileToUse);
          void upsertProfile(profileToUse);
        });
        setPhase("app");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) {
        const anonymous = Boolean(session.user.is_anonymous);
        setIsGuest(anonymous);
        const nextProfile = anonymous
          ? { ...getLocalGuestProfile(), id: session.user.id, email: session.user.email ?? null }
          : profileFromUser(session.user);
        setProfile(nextProfile);
        void upsertProfile(nextProfile);
        setPhase("app");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleOAuth = async (provider: OAuthProvider) => {
    setAuthError("");
    const { error } = await signInWithOAuth(provider);
    if (error) setAuthError(error.message);
  };

  const handleGuest = () => {
    setCurrentUser(null);
    const guestProfile = getLocalGuestProfile();
    saveLocalGuestProfile(guestProfile);
    setProfile(guestProfile);
    setIsGuest(true);
    setAuthError("");
    setPhase("app");
  };

  const handleSaveProfile = async (nextProfile: ProfileRecord) => {
    if (isGuest) {
      saveLocalGuestProfile(nextProfile);
      setProfile(nextProfile);

      const { user, error } = await ensureGuestUser();
      if (error || !user) return error?.message || "Saved locally. Supabase guest sign-in is not configured yet.";

      const guestProfile = {
        ...nextProfile,
        id: user.id,
        email: user.email ?? null,
      };
      saveLocalGuestProfile(guestProfile);
      setCurrentUser(user);
      setProfile(guestProfile);
      const { error: profileError } = await upsertProfile(guestProfile);
      return profileError ? profileError.message : "Saved locally and synced to Supabase.";
    }

    if (!currentUser) return "Sign in before saving profile changes.";

    const signedInProfile = {
      ...nextProfile,
      id: currentUser.id,
      email: currentUser.email ?? nextProfile.email,
    };
    setProfile(signedInProfile);
    const { error } = await upsertProfile(signedInProfile);
    return error ? error.message : "Profile saved.";
  };

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    clearLocalGuestProfile();
    setCurrentUser(null);
    setIsGuest(false);
    setProfile(null);
    setActiveTab("home");
    setSubScreen(null);
    setPhase("auth");
  };

  const upsertSharedLocation = async (lat: number, lng: number) => {
    if (!supabase) {
      setLocationStatus("Add Supabase env values before sharing");
      return;
    }

    if (!userIdRef.current) {
      const { user: guestUser, error } = await ensureGuestUser();
      if (error || !guestUser) {
        setLocationStatus(error?.message || "Unable to create anonymous user");
        return;
      }
      userIdRef.current = guestUser.id;
    }

    const { error } = await supabase.from("user_locations").upsert(
      {
        user_id: userIdRef.current,
        latitude: lat,
        longitude: lng,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setLocationStatus(error ? error.message : "Sharing GPS location");
  };

  const startLocationSharing = async () => {
    if (watchIdRef.current !== null) return;

    if (!("geolocation" in navigator)) {
      setLocationStatus("Browser geolocation is not available on this device");
      setIsSharingLocation(false);
      localStorage.removeItem(GPS_SHARING_KEY);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setSharedLocation({ lat, lon: lng, name: "Your live location" });
        void upsertSharedLocation(lat, lng);
      },
      (error) => {
        setLocationStatus(error.message || "Unable to read GPS position");
        setIsSharingLocation(false);
        localStorage.removeItem(GPS_SHARING_KEY);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    watchIdRef.current = watchId;
    setIsSharingLocation(true);
    setLocationStatus("Starting GPS sharing");
    localStorage.setItem(GPS_SHARING_KEY, "true");
  };

  const stopLocationSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharingLocation(false);
    setLocationStatus("GPS sharing is off");
    localStorage.removeItem(GPS_SHARING_KEY);
  };

  const handleMapStyleChange = (style: MapStyle) => {
    setMapStyle(style);
    localStorage.setItem(MAP_STYLE_KEY, style);
  };

  const handleSettingChange = (id: keyof AppSettings, value: boolean) => {
    const nextSettings = { ...appSettings, [id]: value };
    setAppSettings(nextSettings);
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(nextSettings));

    if (id === "locationBg") {
      if (value) void startLocationSharing();
      else stopLocationSharing();
    }
  };

  const handleLocationSharingToggle = () => {
    handleSettingChange("locationBg", !isSharingLocation);
  };

  useEffect(() => {
    if (isSharingLocation && watchIdRef.current === null) {
      void startLocationSharing();
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center justify-center w-full h-full" style={{ background: "#0a0a0a" }}>
      <div
        className="relative overflow-hidden flex flex-col"
        style={{
          width: "100%",
          maxWidth: 390,
          height: "100%",
          maxHeight: 844,
          background: "#000",
          boxShadow: "0 0 60px rgba(0,0,0,0.8)",
        }}
      >
        {children}
      </div>
    </div>
  );

  if (phase === "splash") return <Shell><SplashScreen /></Shell>;
  if (phase === "onboarding") return <Shell><OnboardingScreen onComplete={() => setPhase("auth")} /></Shell>;
  if (phase === "auth") return (
    <Shell>
      <AuthScreen onOAuth={handleOAuth} onGuest={handleGuest} authError={authError} />
    </Shell>
  );

  return (
    <Shell>
      {subScreen === "tracking" && selectedVehicle ? (
        <LiveTrackingScreen vehicle={selectedVehicle} onBack={() => setSubScreen(null)} />
      ) : subScreen === "settings" ? (
        <SettingsScreen
          onBack={() => setSubScreen(null)}
          mapStyle={mapStyle}
          onMapStyleChange={handleMapStyleChange}
          settings={appSettings}
          onSettingChange={handleSettingChange}
        />
      ) : (
        <>
          <div className="flex-1 overflow-hidden">
            {activeTab === "home" && (
              <HomeScreen
                user={currentUser}
                flow={homeFlow}
                activeRouteIds={homeActiveRouteIds}
                isSharingLocation={isSharingLocation}
                userLocation={sharedLocation}
                locationStatus={locationStatus}
                mapStyle={mapStyle}
                settings={appSettings}
                onFlowChange={setHomeFlow}
                onActiveRouteIdsChange={setHomeActiveRouteIds}
                onToggleLocationSharing={handleLocationSharingToggle}
                onVehicleSelect={(v) => { setSelectedVehicle(v); setSubScreen("tracking"); }}
              />
            )}
            {activeTab === "routes" && (
              <RoutePlannerScreen
                activeRouteIds={homeActiveRouteIds}
                onSelectRoute={(routeId) => {
                  setHomeActiveRouteIds([routeId]);
                  setHomeFlow("map");
                  setActiveTab("home");
                }}
              />
            )}
            {activeTab === "notifications" && <NotificationsScreen activeRouteIds={homeActiveRouteIds} settings={appSettings} />}
            {activeTab === "saved" && (
              <SavedRoutesScreen
                activeRouteIds={homeActiveRouteIds}
                onSelectRoute={(routeId) => {
                  setHomeActiveRouteIds([routeId]);
                  setHomeFlow("map");
                  setActiveTab("home");
                }}
              />
            )}
            {activeTab === "profile" && (
              <ProfileScreen
                user={currentUser}
                isGuest={isGuest}
                profile={profile}
                isSharingLocation={isSharingLocation}
                userLocation={sharedLocation}
                locationStatus={locationStatus}
                onToggleLocationSharing={handleLocationSharingToggle}
                onSettings={() => setSubScreen("settings")}
                onSaveProfile={handleSaveProfile}
                onSignOut={handleSignOut}
              />
            )}
          </div>
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </>
      )}

      {/* Route map modal — rendered above everything including bottom nav */}
    </Shell>
  );
}
