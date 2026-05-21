#!/usr/bin/env bash
# Deploy all Supabase Edge Functions for TravelAI
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Deploying Edge Functions..."
supabase functions deploy chat --no-verify-jwt=false
supabase functions deploy travel-search --no-verify-jwt=false
supabase functions deploy plan-trip --no-verify-jwt=false
supabase functions deploy transcribe --no-verify-jwt=false
echo "Done. Verify in Supabase Dashboard → Edge Functions."
