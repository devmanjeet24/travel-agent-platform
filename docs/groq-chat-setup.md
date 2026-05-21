# Groq AI chat setup

Chat, trip planning, and voice transcription use **Groq** on Supabase Edge Functions.

## 1. Get an API key

1. Sign up at [console.groq.com](https://console.groq.com)
2. Create an API key
3. Add to **Supabase → Edge Functions → Secrets** as `GROQ_API_KEY`

## 2. Deploy the chat function

```bash
supabase functions deploy chat
supabase functions deploy transcribe
```

## 3. How it works

```
User message (Expo)
  → Edge Function `chat` (auth required)
  → Optional live context:
       Open-Meteo (weather)
       Nominatim (geocode)
       Overpass/OSM (hotel names)
       Distance-based flight estimates
  → Groq (llama-3.3-70b) streaming reply
  → Saved to chat_messages when DB tables exist
```

Trip-specific chat: open `/(tabs)/chat?tripId=<uuid>` after creating a trip from the wizard.

## 4. Client env

Only Supabase URL + anon key are required in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Never put `GROQ_API_KEY` in the Expo app.

## 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| "GROQ_API_KEY is not set" | Add secret in Supabase dashboard |
| "Chat function not deployed" | `supabase functions deploy chat` |
| History not saved | Run SQL migrations (`chat_conversations`, `chat_messages`) |
| Voice fails | Deploy `transcribe`; allow microphone permission |
