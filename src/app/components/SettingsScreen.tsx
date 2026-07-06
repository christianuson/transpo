import { ChevronLeft, Bell, Wifi, ChevronRight, Info, HelpCircle, MessageSquare, Smartphone } from "lucide-react";
import type { AppSettings } from "../App";

interface Props {
  onBack: () => void;
  mapStyle: "dark" | "light";
  onMapStyleChange: (style: "dark" | "light") => void;
  settings: AppSettings;
  onSettingChange: (id: keyof AppSettings, value: boolean) => void;
}

export function SettingsScreen({ onBack, mapStyle, onMapStyleChange, settings, onSettingChange }: Props) {
  const Toggle = ({ id }: { id: keyof AppSettings }) => (
    <button
      onClick={() => onSettingChange(id, !settings[id])}
      className="w-12 h-6 rounded-full relative shrink-0"
      style={{ background: settings[id] ? "#2FA4D7" : "#233D4D", transition: "background 0.2s" }}
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full"
        style={{
          background: "#fff",
          left: settings[id] ? "calc(100% - 22px)" : 2,
          transition: "left 0.2s",
        }}
      />
    </button>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-5">
      <p style={{ color: "#3A5060", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, paddingLeft: 4 }}>
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0E1E2A", border: "1px solid #1C3344" }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ icon: Icon, label, desc, right }: { icon: React.ElementType; label: string; desc?: string; right: React.ReactNode }) => (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1C3344] last:border-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#233D4D" }}>
        <Icon size={16} color="#8899A8" />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: "#EAECF0", fontSize: 14 }}>{label}</p>
        {desc && <p style={{ color: "#3A5060", fontSize: 11, marginTop: 1 }}>{desc}</p>}
      </div>
      {right}
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: "#000" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 pt-10 pb-4 px-4">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "#233D4D", border: "1px solid #1C3344" }}
        >
          <ChevronLeft size={20} color="#EAECF0" />
        </button>
        <h1 style={{ color: "#EAECF0", fontSize: 22, fontWeight: 800 }}>Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Notifications */}
        <Section title="Notifications">
          <Row
            icon={Bell}
            label="Vehicle Arriving"
            desc="Alert when vehicle is 2 stops away"
            right={<Toggle id="arriving" />}
          />
          <Row
            icon={Bell}
            label="Seat Availability"
            desc="Notify when seats open up"
            right={<Toggle id="seatUpdate" />}
          />
          <Row
            icon={Bell}
            label="Saved Route Status"
            desc="Updates on your saved trips"
            right={<Toggle id="savedRoute" />}
          />
        </Section>

        {/* Connectivity */}
        <Section title="Connectivity">
          <Row
            icon={Wifi}
            label="Offline Mode"
            desc="Show only selected routes and stations"
            right={<Toggle id="offlineMode" />}
          />
          <Row
            icon={Smartphone}
            label="Low-Data Mode"
            desc="Fetch vehicles only; hide hotspots"
            right={<Toggle id="lowData" />}
          />
          <Row
            icon={Smartphone}
            label="Background Location"
            desc="Track vehicles in background"
            right={<Toggle id="locationBg" />}
          />
        </Section>

        {/* Map style */}
        <Section title="Map Style">
          <div className="p-4">
            <div className="flex gap-3">
              {(["dark", "light"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => onMapStyleChange(style)}
                  className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl"
                  style={{
                    background: mapStyle === style ? "#2FA4D722" : "#233D4D",
                    border: `1.5px solid ${mapStyle === style ? "#2FA4D7" : "#1C3344"}`,
                  }}
                >
                  <div
                    className="w-12 h-8 rounded-lg"
                    style={{ background: style === "dark" ? "#0B1C28" : "#C8D8E4", border: "1px solid #1C3344" }}
                  />
                  <span style={{ color: mapStyle === style ? "#2FA4D7" : "#4A6070", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>
                    {style}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* About */}
        <Section title="About">
          <Row
            icon={Info}
            label="About Transpo"
            desc="Version 1.0.0 — Metro Manila"
            right={<ChevronRight size={16} color="#3A5060" />}
          />
          <Row
            icon={HelpCircle}
            label="Help Center"
            desc="FAQs and guides"
            right={<ChevronRight size={16} color="#3A5060" />}
          />
          <Row
            icon={MessageSquare}
            label="Send Feedback"
            desc="Help us improve the app"
            right={<ChevronRight size={16} color="#3A5060" />}
          />
        </Section>

        {/* App info */}
        <div className="text-center py-4">
          <p style={{ color: "#1C3344", fontSize: 11 }}>Transpo v1.0.0</p>
          <p style={{ color: "#1C3344", fontSize: 11 }}>Built for Metro Manila Commuters</p>
        </div>
      </div>
    </div>
  );
}
