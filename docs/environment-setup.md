# Environment setup

## Quick start

1. Copy `.env.example` to `.env`.
2. Add Supabase URL and anon key from [Supabase](https://supabase.com) → **Settings → API**.
3. Restart Expo: `npx expo start -c`.

## Client variables (`.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Auth, database, storage |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public client key (not service role) |
| `EXPO_PUBLIC_MAP_TILE_URL` | No | OSM/MapTiler raster tiles for maps |
| `EXPO_PUBLIC_MAPTILER_API_KEY` | No | MapTiler key when using their tiles |
| `EXPO_PUBLIC_OSRM_BASE_URL` | No | Route lines & travel time (default: public OSRM) |
| `EXPO_PUBLIC_POSTHOG_KEY` | No | Product analytics (future) |

## Server secrets (never in `.env` on the phone)

Set in **Supabase → Edge Functions → Secrets** when you add AI tools:

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | Chat agent, itinerary generation |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-only server tasks |

## Maps (OpenStreetMap)

This project uses **react-native-maps** with **OpenStreetMap** tiles (no Google Maps billing).

- **iOS:** Apple MapKit under the hood; OSM tiles via `UrlTile`.
- **Android:** May need a [development build](https://docs.expo.dev/develop/development-builds/introduction/) for full map support outside Expo Go.
- **Web:** List + external map link (see `TripMap.web.tsx`).

Tile usage: respect [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/); use MapTiler free tier for heavier traffic.

## OAuth (Google / Apple)

Configure in **Supabase → Authentication → Providers**, not in `.env` for basic setup.
