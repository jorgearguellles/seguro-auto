#!/bin/sh
set -e

# Compile TypeScript to dist/
npx tsc --skipLibCheck

# Copy JSON schema files (content-types, components) to dist/src/
# TypeScript compilation only emits .ts → .js; Strapi loads schemas from dist/src/
find src -name "*.json" | while read -r f; do
  dest="dist/src/${f#src/}"
  mkdir -p "$(dirname "$dest")"
  cp "$f" "$dest"
done

# strapi start reads dist without cleanup (unlike strapi develop)
exec npx strapi start
