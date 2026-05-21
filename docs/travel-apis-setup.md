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

| API | Key needed? | Used for |
|-----|-------------|----------|
| [Open-Meteo](https://open-meteo.com/) | No | Weather forecasts |
| [Nominatim](https://nominatim.org/) | No | Geocoding (fair-use User-Agent) |
| [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | No | Hotels & airports from OSM |
| [OSRM](https://project-osrm.org/) | No | Driving routes (client) |
| OSM tiles | No | Map display |

**Flight and hotel prices** are **estimates** when OSM does not provide live fares (no paid flight/hotel API). Groq uses this context for planning; labels in the app say "estimate".

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
       → Open-Meteo + Nominatim + Overpass (weather, geocode, hotels, airports)
  → OSRM + OSM tiles (client maps & routes)
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
| Hotels empty in remote area | OSM may have few tagged hotels; AI planner still generates options |
| Flights show estimates | Expected — no live booking API; set origin + start date |
| Chat stream fails | Deploy `chat`; sign in; check `GROQ_API_KEY` |
| DB errors | Run migrations; confirm RLS and user signed in |
| Upload fails | Run storage migration; sign in; check bucket `chat-attachments` |
