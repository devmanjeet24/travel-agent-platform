# AI Travel Agent Platform

Cross-platform travel planning app (Expo + React Native + TypeScript + Supabase + OpenStreetMap).

## Get started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment template and add your Supabase keys:

   ```bash
   cp .env.example .env
   ```

   See [docs/environment-setup.md](./docs/environment-setup.md) for all variables.

3. Start the app:

   ```bash
   npx expo start -c
   ```

## What's included

- **UI screens** — auth, dashboard, chat, trips, itinerary, budget, maps, admin
- **Supabase auth** — email/password sign-in, sign-up, password reset, session persistence
- **OpenStreetMap maps** — `react-native-maps` with OSM tiles + OSRM driving routes (no Google billing)
- **Environment setup** — `.env.example`, typed `src/lib/env.ts`, gitignored `.env`

## Environment variables (client)

| Variable | Required |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `EXPO_PUBLIC_MAP_TILE_URL` | No (defaults to OSM) |
| `EXPO_PUBLIC_OSRM_BASE_URL` | No (defaults to public OSRM) |

Server secrets (`OPENAI_API_KEY`, etc.) go in **Supabase Edge Functions**, not in the mobile `.env`.

## Project structure

```
src/
  app/           # Expo Router screens
  components/    # UI + maps
  constants/     # Design tokens, demo trip data
  hooks/
  lib/           # env, supabase, query client
  providers/     # Redux, React Query, Auth
  services/      # auth, osrm routing
docs/
  environment-setup.md
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Supabase docs](https://supabase.com/docs)
- [OpenStreetMap](https://www.openstreetmap.org/)
