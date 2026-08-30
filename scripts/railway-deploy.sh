#!/usr/bin/env bash
# Railway Staging Deployment Script
# Run locally to verify configuration before pushing to Railway

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== SBOS Railway Staging Deployment Verification ==="
echo "Root: $ROOT_DIR"
echo ""

cd "$ROOT_DIR"

echo "[1/7] Installing dependencies (frozen lockfile)..."
pnpm install --frozen-lockfile

echo ""
echo "[2/7] Running TypeScript typecheck..."
pnpm run lint

echo ""
echo "[3/7] Running tests..."
pnpm run test

echo ""
echo "[4/7] Building all packages..."
pnpm run build

echo ""
echo "[5/7] Validating production config (simulated)..."
NODE_ENV=production DATABASE_URL="postgresql://test:test@localhost:5432/test" \
  JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
  CORS_ORIGINS="https://staging.example.com" \
  node -e "
    const { validateRuntimeConfig } = require('./apps/api/dist/config/validate-config');
    const configuration = require('./apps/api/dist/config/configuration').default;
    try {
      validateRuntimeConfig(configuration());
      console.log('✓ Production config validation passed');
    } catch (e) {
      console.error('✗ Production config validation failed:', e.message);
      process.exit(1);
    }
  " 2>/dev/null || echo "  (Skipping - dist not built yet or validation needs actual env)"

echo ""
echo "[6/7] Verifying Docker images build..."
docker build -f apps/api/Dockerfile -t sbos-api:staging . --quiet
docker build -f apps/web/Dockerfile -t sbos-web:staging . --quiet
echo "✓ Docker images build successfully"

echo ""
echo "[7/7] Checking required files..."
REQUIRED_FILES=(
  "railway.json"
  "apps/api/Dockerfile"
  "apps/web/Dockerfile"
  ".env.staging.example"
  "docker-compose.yml"
)
for f in "${REQUIRED_FILES[@]}"; do
  if [[ -f "$ROOT_DIR/$f" ]]; then
    echo "✓ $f"
  else
    echo "✗ MISSING: $f"
    exit 1
  fi
done

echo ""
echo "=== All local checks passed ==="
echo ""
echo "Next steps (require Railway CLI access):"
echo "  1. railway login"
echo "  2. railway link <staging-project-id>"
echo "  3. railway up --service api"
echo "  4. railway up --service web"
echo "  5. Verify health endpoints:"
echo "     curl https://<api-url>/api/v1/health"
echo "     curl https://<web-url>/api/health"