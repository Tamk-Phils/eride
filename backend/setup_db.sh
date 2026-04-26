#!/bin/bash
# =============================================
# eRide Database Setup Script
# Run ONCE as a user with sudo privileges
# Usage: bash setup_db.sh
# =============================================

set -e

CURRENT_USER=$(whoami)
DB_NAME="eride"

echo "==> Creating PostgreSQL role for: $CURRENT_USER"
sudo -u postgres psql -c "CREATE ROLE ${CURRENT_USER} WITH LOGIN SUPERUSER;" 2>/dev/null || echo "Role already exists."

echo "==> Creating database: $DB_NAME"
sudo -u postgres createdb "$DB_NAME" -O "$CURRENT_USER" 2>/dev/null || echo "Database already exists."

echo ""
echo "✅ Done! Your DATABASE_URL:"
echo "   postgresql://${CURRENT_USER}@localhost:5432/${DB_NAME}"
echo ""
echo "Next step: cd backend && npx prisma migrate dev --name init"
