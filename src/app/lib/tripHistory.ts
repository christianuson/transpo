export const LOCAL_TRIP_HISTORY_KEY = "transpo_local_trip_history";

export type TripHistoryRecord = {
  id: string;
  user_id?: string | null;
  route_ids: string[];
  started_at: string;
  ended_at: string | null;
  status: string;
};

function byEndedAtDesc(a: TripHistoryRecord, b: TripHistoryRecord) {
  return new Date(b.ended_at || b.started_at).getTime() - new Date(a.ended_at || a.started_at).getTime();
}

export function readLocalTripHistory() {
  const stored = localStorage.getItem(LOCAL_TRIP_HISTORY_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((trip): trip is TripHistoryRecord => (
        typeof trip?.id === "string" &&
        Array.isArray(trip.route_ids) &&
        typeof trip.started_at === "string"
      ))
      .sort(byEndedAtDesc);
  } catch {
    return [];
  }
}

export function saveLocalCompletedTrip(trip: TripHistoryRecord) {
  const nextTrip = {
    ...trip,
    ended_at: trip.ended_at || new Date().toISOString(),
    status: "completed",
  };
  const trips = readLocalTripHistory().filter((item) => item.id !== nextTrip.id);
  localStorage.setItem(LOCAL_TRIP_HISTORY_KEY, JSON.stringify([nextTrip, ...trips].slice(0, 25)));
}

export function mergeTripHistory(...groups: TripHistoryRecord[][]) {
  const byId = new Map<string, TripHistoryRecord>();
  groups.flat().forEach((trip) => byId.set(trip.id, trip));
  return Array.from(byId.values())
    .filter((trip) => trip.status === "completed" && Boolean(trip.ended_at))
    .sort(byEndedAtDesc);
}
