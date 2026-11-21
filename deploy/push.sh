#!/usr/bin/env bash
# Builds the client locally and deploys to the server (Git Bash or WSL).
# Usage: bash deploy/push.sh            (SERVER and DIR can be overridden via env)
set -euo pipefail
SERVER="${SERVER:-root@188.120.239.157}"
DIR="${DIR:-/opt/sportik}"
cd "$(dirname "$0")/.."

export MSYS_NO_PATHCONV=1   # keep "/sportik/" intact in Git Bash
npx tsc -b
npx vitest run
npx vite build --base=/sportik/

tar --exclude=node_modules --exclude=data --exclude=.env --exclude=.claude --exclude='*.log' -czf /tmp/sportik.tgz .
scp -q /tmp/sportik.tgz "$SERVER:$DIR/"
ssh "$SERVER" "cd $DIR && tar -xzf sportik.tgz && rm sportik.tgz && docker compose up -d --build app && docker image prune -f >/dev/null && sleep 5 && docker compose ps"
echo "Deployed: https://snezhtaho.ru/sportik/"
