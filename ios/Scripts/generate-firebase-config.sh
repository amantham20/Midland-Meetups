#!/usr/bin/env bash
#
# Generates ios/MidlandMeetups/Config/Firebase.plist from .env.local.
#
# The iOS app reads the same NEXT_PUBLIC_FIREBASE_* credentials the web client
# uses. The plist is gitignored for the same reason .env.local is — run this once
# after cloning, and again whenever the Firebase project changes.
#
#   ./ios/Scripts/generate-firebase-config.sh [path/to/.env.local]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT="$ROOT/ios/MidlandMeetups/Config/Firebase.plist"

find_env_file() {
  if [ "$#" -ge 1 ] && [ -n "$1" ]; then
    printf '%s\n' "$1"
    return
  fi
  if [ -f "$ROOT/.env.local" ]; then
    printf '%s\n' "$ROOT/.env.local"
    return
  fi
  # In a git worktree, .env.local lives in the main checkout.
  local common_dir
  if common_dir="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
    local main_root
    main_root="$(dirname "$common_dir")"
    if [ -f "$main_root/.env.local" ]; then
      printf '%s\n' "$main_root/.env.local"
      return
    fi
  fi
  return 1
}

if ! ENV_FILE="$(find_env_file "${1:-}")"; then
  echo "error: no .env.local found. Copy .env.example to .env.local and fill it in." >&2
  exit 1
fi

echo "Reading $ENV_FILE"

read_var() {
  # Last assignment wins; strips optional quotes and trailing whitespace.
  sed -n "s/^$1=//p" "$ENV_FILE" \
    | tail -n 1 \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/" \
    | tr -d '\r' \
    | sed -e 's/[[:space:]]*$//'
}

API_KEY="$(read_var NEXT_PUBLIC_FIREBASE_API_KEY)"
PROJECT_ID="$(read_var NEXT_PUBLIC_FIREBASE_PROJECT_ID)"
AUTH_DOMAIN="$(read_var NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)"
APP_ID="$(read_var NEXT_PUBLIC_FIREBASE_APP_ID)"
SENDER_ID="$(read_var NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)"
ADMIN_UIDS="$(read_var NEXT_PUBLIC_ADMIN_UIDS)"

for pair in "NEXT_PUBLIC_FIREBASE_API_KEY:$API_KEY" \
            "NEXT_PUBLIC_FIREBASE_PROJECT_ID:$PROJECT_ID" \
            "NEXT_PUBLIC_FIREBASE_APP_ID:$APP_ID"; do
  name="${pair%%:*}"
  value="${pair#*:}"
  if [ -z "$value" ]; then
    echo "error: $name is missing from $ENV_FILE" >&2
    exit 1
  fi
done

escape_xml() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

mkdir -p "$(dirname "$OUT")"
cat > "$OUT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>apiKey</key>
	<string>$(escape_xml "$API_KEY")</string>
	<key>projectId</key>
	<string>$(escape_xml "$PROJECT_ID")</string>
	<key>authDomain</key>
	<string>$(escape_xml "$AUTH_DOMAIN")</string>
	<key>appId</key>
	<string>$(escape_xml "$APP_ID")</string>
	<key>messagingSenderId</key>
	<string>$(escape_xml "$SENDER_ID")</string>
	<key>adminUids</key>
	<string>$(escape_xml "$ADMIN_UIDS")</string>
</dict>
</plist>
PLIST

plutil -lint "$OUT" > /dev/null
echo "Wrote $OUT (project: $PROJECT_ID)"
