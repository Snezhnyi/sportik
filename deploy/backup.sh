#!/bin/sh
# Consistent online backup of the SQLite database (safe while the app is running).
# Usage (on the server, next to docker-compose.yml): sh deploy/backup.sh
set -e
name="sportik-$(date +%Y-%m-%d_%H%M).db"
docker compose exec -T app node -e "
  const { DatabaseSync } = require('node:sqlite');
  new DatabaseSync('/app/data/sportik.db').exec(\"VACUUM INTO '/app/data/$name'\");
"
mkdir -p backups
docker compose cp "app:/app/data/$name" "backups/$name"
docker compose exec -T app rm "/app/data/$name"
echo "saved backups/$name"
