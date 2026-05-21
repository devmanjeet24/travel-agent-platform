export type TripStatus = 'draft' | 'upcoming' | 'saved' | 'completed';

export type TripRow = {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  origin_city: string | null;
  destination_lat: number | null;
  destination_lon: number | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  travelers: number;
  budget_usd: number | null;
  status: TripStatus;
  image_url: string | null;
  weather_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  trips_count: number;
  countries_visited: number;
  ai_plans_generated: number;
  push_notifications_enabled: boolean;
  offline_sync_enabled: boolean;
};

export type ChatConversationRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments: { url: string; name: string; type: string }[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ItineraryDayRow = {
  id: string;
  trip_id: string;
  day_number: number;
  title: string | null;
};

export type ItineraryActivityRow = {
  id: string;
  day_id: string;
  activity_time: string | null;
  name: string;
  cost_usd: number | null;
  transport: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  sort_order: number;
};

export type BudgetCategoryRow = {
  id: string;
  trip_id: string;
  label: string;
  amount_usd: number;
  color: string | null;
  sort_order: number;
};

export type TripHotelRow = {
  id: string;
  trip_id: string;
  external_id: string | null;
  name: string;
  rating: number | null;
  price_per_night_usd: number | null;
  image_url: string | null;
  is_selected: boolean;
};

export type TripFlightRow = {
  id: string;
  trip_id: string;
  airline: string | null;
  route: string | null;
  depart_time: string | null;
  arrive_time: string | null;
  price_usd: number | null;
  stops: string | null;
  is_selected: boolean;
};

export type PackingItemRow = {
  id: string;
  trip_id: string;
  label: string;
  packed: boolean;
  sort_order: number;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  type: 'flight' | 'packing' | 'itinerary' | 'booking' | 'general';
  title: string;
  body: string;
  read: boolean;
  scheduled_at: string | null;
  created_at: string;
};

export type WeatherResult = {
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  daily: Array<{
    date: string;
    tempMaxC: number;
    tempMinC: number;
    precipitationMm: number;
    weatherCode: number;
  }>;
  summary: string;
};
