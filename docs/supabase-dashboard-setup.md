# Supabase Dashboard setup (manual steps)

Complete these in order. Your app will not work fully until **secrets**, **database**, **storage**, and **Edge Functions** are configured.

---

## 1. Project API keys (Expo `.env`)

**Dashboard → Project Settings → API**

| Copy to `.env` | Value |
|----------------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |

Restart Expo after saving: `npx expo start -c`

---

## 2. Edge Function secrets

**Dashboard → Edge Functions → Secrets** (or Project Settings → Edge Functions)

Add:

| Secret name | Where to get it |
|-------------|-----------------|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |

`GROQ_API_KEY` is **required** for chat, voice, and trip planner.

Hotels, weather, and maps use **free public APIs** (Open-Meteo, Nominatim, Overpass, OSM) — no extra secrets.

Supabase injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` automatically — do not add those manually.

---

## 3. Database tables (migrations)

**Option A — CLI (recommended)**

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Option B — SQL Editor**

1. **Dashboard → SQL → New query**
2. Paste and run `supabase/migrations/20250521000000_travel_schema.sql`
3. Paste and run `supabase/migrations/20250521100000_storage_policies_fix.sql`

**Verify:** **Table Editor** should list `trips`, `chat_conversations`, `chat_messages`, `profiles`, etc.

---

## 4. Storage bucket

**Dashboard → Storage**

After migrations you should see bucket **`chat-attachments`** (public).

If missing:

1. **New bucket** → ID: `chat-attachments`, **Public**: ON
2. **Policies** → use policies from `20250521100000_storage_policies_fix.sql` (SQL Editor)

**Verify:** Upload a test file while signed in; path should be `{your-user-id}/filename`.

---

## 5. Row Level Security (RLS)

Migrations enable RLS on all app tables. **Do not disable RLS** in production.

**Verify:** **Authentication → Users** → sign in as a user → Table Editor → `trips` → only that user's rows visible.

---

## 6. Deploy Edge Functions

Functions in repo are **not live** until deployed.

```bash
supabase functions deploy chat
supabase functions deploy travel-search
supabase functions deploy plan-trip
supabase functions deploy transcribe
```

Or: `./scripts/deploy-edge-functions.sh`

**Verify:** **Dashboard → Edge Functions** lists all four with green/active status.

| Function | Purpose |
|----------|---------|
| `chat` | AI chat (stream + save messages) |
| `travel-search` | Weather, geocode, hotels, flights |
| `plan-trip` | Generate itinerary/budget/packing |
| `transcribe` | Voice → text (Groq Whisper) |

**JWT:** `config.toml` sets `verify_jwt = true` — users must be signed in.

---

## 7. Authentication

**Dashboard → Authentication → Providers**

- **Email** enabled (confirm email on/off for dev)
- Optional: Google/Apple later

**Dashboard → Authentication → URL configuration** (required for APK / deep links):

| Setting | Value |
|---------|--------|
| **Redirect URLs** | `travelagentplatform://auth/callback`, `travelagentplatform://**`, and `http://localhost:8081/auth/callback` for web dev |
| **Site URL** | `travelagentplatform://auth/callback` (mobile) or your deployed web origin — avoid `http://localhost:3000` for production |

**Verify:** Sign up in app → confirmation email → link opens the app (not localhost) → user can sign in.

---

## 8. Email templates (optional)

**Authentication → Email Templates** — customize confirm/sign-in emails.

---

## Checklist before testing chat

- [ ] `.env` has Supabase URL + anon key
- [ ] `GROQ_API_KEY` in Edge secrets
- [ ] Migrations applied (`trips`, `chat_messages` exist)
- [ ] Bucket `chat-attachments` exists
- [ ] All 4 functions deployed (no 404 in Network tab)
- [ ] Signed in inside the app

---

## Issue → cause (quick reference)

| Symptom | Type | Fix |
|---------|------|-----|
| `404` on `/functions/v1/transcribe` | **Deployment** | Deploy `transcribe` |
| CORS error on Edge Function | **Deployment + CORS** | Deploy function; OPTIONS must return 204 (fixed in code) |
| `Failed to fetch` on chat | **Deployment / secrets** | Deploy `chat`; set `GROQ_API_KEY` |
| `relation "trips" does not exist` | **Database** | Run migrations |
| `Bucket not found` | **Storage** | Run storage migration or create bucket |
| Chat works, amber warning | **Database** | History not saved — run migrations |
| Mic works on web but not phone | **Frontend / permissions** | Grant mic; use dev build if needed |
| Streaming stuck `…` | **Frontend / network** | Check `chat` deploy; falls back to non-streaming invoke if SSE fails |

---

## Related docs

- [groq-chat-setup.md](./groq-chat-setup.md)
- [travel-apis-setup.md](./travel-apis-setup.md)
- [environment-setup.md](./environment-setup.md)
