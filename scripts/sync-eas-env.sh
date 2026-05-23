#!/usr/bin/env bash
# Push EXPO_PUBLIC_* from .env into EAS Environment Variables.
# Usage: ./scripts/sync-eas-env.sh preview
#        ./scripts/sync-eas-env.sh production

set -euo pipefail

ENV_NAME="${1:-preview}"
ENV_FILE="${2:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.example first."
  exit 1
fi

echo "Syncing EXPO_PUBLIC_* from $ENV_FILE to EAS environment: $ENV_NAME"
echo

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [[ -z "$line" ]] && continue
  [[ "$line" != EXPO_PUBLIC_* ]] && continue

  name="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  if [[ -z "$value" ]]; then
    echo "  skip $name (empty)"
    continue
  fi

  visibility="plaintext"
  if [[ "$name" == *KEY* ]] || [[ "$name" == *SECRET* ]] || [[ "$name" == *TOKEN* ]]; then
    visibility="sensitive"
  fi

  echo "  set $name ($visibility)"
  eas env:create \
    --name "$name" \
    --value "$value" \
    --environment "$ENV_NAME" \
    --visibility "$visibility" \
    --force \
    --non-interactive
done < "$ENV_FILE"

echo
echo "Done. Verify at: https://expo.dev/accounts/saurabhkhatri2015/projects/travel-agent-platform/environment-variables"
