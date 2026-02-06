#!/bin/bash
# Creates the pangolin database and applies the schema.
# Usage: ./scripts/setup-db.sh

set -e

DB_NAME="pangolin"

echo "Creating database '$DB_NAME' (will skip if it already exists)..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  || psql -U postgres -c "CREATE DATABASE $DB_NAME"

echo "Applying schema..."
psql -U postgres -d "$DB_NAME" -f "$(dirname "$0")/../schema.sql"

echo "Done. Database '$DB_NAME' is ready."
