# AI Travel Agent Platform

Cross-platform travel planning app (Expo + React Native + TypeScript + Supabase + live travel APIs).

## Get started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment template and add Supabase keys:

   ```bash
   cp .env.example .env
   ```

3. Configure Supabase (database, secrets, deploy functions) — see [docs/supabase-dashboard-setup.md](./docs/supabase-dashboard-setup.md).

4. Start the app:

   ```bash
   npx expo start -c
   ```

## What's included

- **Supabase** — auth, trips, chat history, notifications, itinerary/budget/packing
- **Groq** — streaming AI chat, trip planner, voice transcription (Edge Functions)
- **Open-Meteo + Nominatim + Overpass** — weather, geocoding, OSM hotels (no API key)
- **OpenStreetMap + OSRM** — maps, markers, and driving routes
- **Estimated fares** — flight/hotel prices when live booking APIs are unavailable
- **expo-print / expo-notifications** — PDF export and local trip reminders

## Environment variables (client)

| Variable | Required |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `EXPO_PUBLIC_OSRM_BASE_URL` | No |

Server secret (`GROQ_API_KEY`) goes in **Supabase Edge Functions**, not in the mobile `.env`.

## Project structure

```
src/
  app/           # Expo Router screens
  services/      # trips, chat, travel, auth, notifications
  hooks/         # React Query
  lib/           # supabase, edge streaming, pdf, notifications
supabase/
  migrations/    # Postgres schema + RLS
  functions/     # chat, travel-search, plan-trip, transcribe
docs/
  travel-apis-setup.md
  groq-chat-setup.md
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Supabase docs](https://supabase.com/docs)
- [Open-Meteo](https://open-meteo.com/)
- [OpenStreetMap](https://www.openstreetmap.org/)
