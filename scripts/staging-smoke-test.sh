#!/usr/bin/env bash
# Staging Smoke Test Script
# Run against a deployed Railway staging environment

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <API_URL> <WEB_URL>"
  echo "Example: $0 https://staging-api.up.railway.app https://staging-web.up.railway.app"
  exit 1
fi

API_URL="$1"
WEB_URL="$2"

echo "=== SBOS Staging Smoke Test ==="
echo "API:  $API_URL"
echo "WEB:  $WEB_URL"
echo ""

check_endpoint() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"

  echo -n "Checking $name ($url)... "
  if response=$(curl -s -w "\n%{http_code}" -m 10 "$url" 2>/dev/null); then
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)
    if [[ "$http_code" == "$expected_status" ]]; then
      echo "OK ($http_code)"
      echo "$body" | jq . 2>/dev/null || echo "$body"
      return 0
    else
      echo "FAIL (HTTP $http_code)"
      echo "$body"
      return 1
    fi
  else
    echo "FAIL (connection error)"
    return 1
  fi
}

echo "--- Health Checks ---"
check_endpoint "API Health" "$API_URL/api/v1/health" 200 || exit 1
check_endpoint "Web Health" "$WEB_URL/api/health" 200 || exit 1

echo ""
echo "--- API Health Details ---"
API_HEALTH=$(curl -s "$API_URL/api/v1/health" 2>/dev/null || echo '{}')
echo "$API_HEALTH" | jq . 2>/dev/null || echo "$API_HEALTH"

# Check database status from health endpoint
DB_STATUS=$(echo "$API_HEALTH" | jq -r '.database.status // "unknown"' 2>/dev/null || echo "unknown")
if [[ "$DB_STATUS" != "up" ]]; then
  echo "WARNING: Database status is '$DB_STATUS' (expected 'up')"
fi

echo ""
echo "--- CORS Check ---"
echo -n "Checking CORS preflight... "
CORS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  -H "Origin: $WEB_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  "$API_URL/api/v1/auth/login" 2>/dev/null || echo "000")
if [[ "$CORS_RESPONSE" == "200" || "$CORS_RESPONSE" == "204" ]]; then
  echo "OK ($CORS_RESPONSE)"
else
  echo "FAIL ($CORS_RESPONSE) - Check CORS_ORIGINS includes $WEB_URL"
fi

echo ""
echo "--- Auth Flow (requires valid credentials) ---"
echo "To test login, run:"
echo "  curl -X POST $API_URL/api/v1/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"<test@staging.example>\",\"password\":\"<testpass>\"}'"
echo ""
echo "Then use the returned accessToken to test authenticated endpoint:"
echo "  curl -H 'Authorization: Bearer <accessToken>' $API_URL/api/v1/platform/system-health"

echo ""
echo "=== Smoke test complete ==="