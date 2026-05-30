# Travel APIs setup

All travel data APIs used by this project are **free and public** (no Amadeus or paid keys required).

## 1. Database

Apply the schema to your Supabase project:

```bash
supabase link --project-ref YOUR_REF
supabase db push
```

Or paste `supabase/migrations/20250521000000_travel_schema.sql` and `20250521100000_storage_policies_fix.sql` into the SQL editor.

## 2. Edge Function secrets

**Supabase → Edge Functions → Secrets**

| Secret | Required | Purpose |
|--------|----------|---------|
| `GROQ_API_KEY` | Yes | Streaming chat, trip planner, voice transcription |
| `GEOAPIFY_API_KEY` | No | Enables Geoapify real hotel/place/restaurant search before OSM fallback |
| `LITEAPI_KEY` / `LITEAPI_API_KEY` | No | Optional paid hotel metadata fallback, used only when `LITEAPI_HOTELS_ENABLED=true` |
| `LITEAPI_HOTELS_ENABLED` | No | Set to `true` only when you intentionally want to use LiteAPI hotel search |
| `APIFY_TOKEN` or `INDIAN_RAIL_APIFY_TOKEN` | No | Enables real Indian Railways train search via the Apify/eRail scraper |
| `INDIAN_RAIL_APIFY_ACTOR` | No | Override the default Apify actor (`jungle_synthesizer/indian-railways-timetable-scraper`) |
| `TRANSITLAND_API_KEY` | No | Enables GTFS-based bus/transit routing and scheduled times where Transitland coverage exists |

| API | Key needed? | Used for |
|-----|-------------|----------|
| [Geoapify Places](https://apidocs.geoapify.com/docs/places/) | Optional key | Real hotels, restaurants, cafes, and places from POI data |
| [Open-Meteo](https://open-meteo.com/) | No | Weather forecasts |
| [Nominatim](https://nominatim.org/) | No | Geocoding (fair-use User-Agent) |
| [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | No | Hotels, restaurants, places, airports from OSM |
| [OpenStreetMap bus route data](https://wiki.openstreetmap.org/wiki/Tag:route%3Dbus) via Overpass | No | Real bus operators, route names/numbers, stops, and bus stations where mapped |
| [OSRM](https://project-osrm.org/) | No | Driving routes (client) |
| [Transitland Routing API](https://www.transit.land/plans-pricing) | Optional key | GTFS-based bus/transit routes and scheduled timings in supported regions |
| OSM/CARTO tiles | No | In-app map display |
| [Apify Indian Railways scraper](https://apify.com/jungle_synthesizer/indian-railways-timetable-scraper/api) | Optional token | Real Indian train names/numbers, station codes, scheduled timings, classes, and fares where available |
| [LiteAPI](https://docs.liteapi.travel/) | Optional paid key | Disabled by default; optional hotel metadata fallback for production booking-grade expansion |

**Hotel and restaurant/place identities** are real provider records when Geoapify, OSM/Overpass, or Nominatim returns a match. LiteAPI is intentionally disabled by default because production hotel inventory, live room prices, scalable usage, and booking-grade data are paid use-cases. **Hotel prices** are still **estimates** unless a provider row explicitly includes a usable price/fare field. Indian train data is real only when `APIFY_TOKEN` / `INDIAN_RAIL_APIFY_TOKEN` is configured and the route resolves to supported Indian Railways station codes. Bus data uses `TRANSITLAND_API_KEY` first for GTFS-based routes/timings where covered, then OpenStreetMap/Overpass for real bus operators/routes/stops. Bus fares remain estimates unless a provider returns fare data; fallback prompts explicitly forbid invented operators, route numbers, platforms, live seat availability, or precise departure boards.

## 3. Deploy functions

```bash
supabase functions deploy chat
supabase functions deploy travel-search
supabase functions deploy plan-trip
supabase functions deploy transcribe
```

Or run `./scripts/deploy-edge-functions.sh`.

## 4. Architecture

```
Expo app
  → Supabase Auth + Postgres (trips, messages, notifications)
  → Edge Functions (GROQ_API_KEY only)
       → Groq (chat stream, plan JSON, Whisper)
       → Geoapify + Open-Meteo + Nominatim + Overpass (hotels, places, weather, geocode, airports)
       → LiteAPI only when explicitly enabled for paid hotel metadata fallback
  → OSM/CARTO tiles + OSRM (client maps & routes)
```

## 5. Feature checklist

- **Streaming chat** — `fetch` + SSE to `chat` function (native + web)
- **Persistent messages** — `chat_conversations` / `chat_messages`
- **Trip wizard** — creates trip → `plan-trip` → itinerary/budget/packing + weather JSON on trip
- **Voice** — `expo-av` / MediaRecorder → `transcribe` (Groq Whisper)
- **Attachments** — Supabase Storage `chat-attachments` bucket
- **PDF** — `expo-print` + `expo-sharing`
- **Notifications** — DB rows + `expo-notifications` local schedules

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Hotels empty in remote area | Configure Geoapify for broader coverage; OSM/Nominatim fallback only returns mapped real records |
| Flights show estimates | Expected — no live booking API; set origin + start date |
| Chat stream fails | Deploy `chat`; sign in; check `GROQ_API_KEY` |
| DB errors | Run migrations; confirm RLS and user signed in |
| Upload fails | Run storage migration; sign in; check bucket `chat-attachments` |
