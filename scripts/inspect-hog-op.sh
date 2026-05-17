#!/usr/bin/env bash
# Dumps the full HogAI response for a given operation ID (the jobId).
# Doesn't burn credits — just polls an existing operation.
#
# Usage:
#   ./scripts/inspect-hog-op.sh <jobId>
#
# Reads keys from .env.local in the project root.

set -e

JOBID="${1:-}"
if [ -z "$JOBID" ]; then
  echo "Usage: $0 <jobId>"
  echo "Find the jobId in the HogAI dashboard run URL, or in /tmp/burrow-dev.log"
  exit 1
fi

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE in current directory"
  exit 1
fi

AK=$(grep "^THEHOG_ACCESS_KEY=" "$ENV_FILE" | cut -d= -f2-)
SK=$(grep "^THEHOG_SECRET_KEY=" "$ENV_FILE" | cut -d= -f2-)
BASE=$(grep "^THEHOG_BASE_URL=" "$ENV_FILE" | cut -d= -f2-)
BASE="${BASE:-https://developer.thehog.ai}"

if [ -z "$AK" ] || [ -z "$SK" ]; then
  echo "Missing THEHOG_ACCESS_KEY or THEHOG_SECRET_KEY in $ENV_FILE"
  exit 1
fi

curl -sS "$BASE/api/operations/$JOBID" \
  -H "X-Access-Key: $AK" \
  -H "X-Secret-Key: $SK" \
  | python3 -m json.tool
