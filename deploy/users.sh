#!/bin/sh
# Manage who can use the Mini App (ALLOWED_USER_IDS in .env).
# Run on the server from the project directory:
#   sh deploy/users.sh list              current list + recent sign-ins (with IDs)
#   sh deploy/users.sh add 123 456       allow users
#   sh deploy/users.sh remove 123        revoke access
set -eu
cd "$(dirname "$0")/.."
ENV_FILE=.env

current() {
  grep -E '^ALLOWED_USER_IDS=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr ',; ' '\n\n\n' | grep -E '^[0-9]+$' || true
}

write_list() {
  ids=$(printf '%s\n' "$@" | grep -E '^[0-9]+$' | awk '!seen[$0]++' | paste -sd, -)
  if grep -qE '^ALLOWED_USER_IDS=' "$ENV_FILE"; then
    sed -i "s/^ALLOWED_USER_IDS=.*/ALLOWED_USER_IDS=$ids/" "$ENV_FILE"
  else
    printf 'ALLOWED_USER_IDS=%s\n' "$ids" >> "$ENV_FILE"
  fi
  # Recreates the container only because .env changed; data lives in the volume and is kept.
  docker compose up -d app >/dev/null 2>&1
  echo "Готово. Разрешены: ${ids:-<пусто — вход открыт ВСЕМ>}"
}

case "${1:-list}" in
  list)
    ids=$(current)
    echo "Разрешённые пользователи:"
    if [ -n "$ids" ]; then printf '  %s\n' $ids; else echo "  <пусто — вход открыт ВСЕМ>"; fi
    echo
    echo "Последние входы (с момента запуска контейнера):"
    docker compose logs app 2>/dev/null | grep -E '\[auth\] (allowed|DENIED)' | sed 's/^.*\[auth\] /  /' | tail -20 || true
    ;;
  add)
    shift
    [ $# -gt 0 ] || { echo "Использование: sh deploy/users.sh add <telegram_id> [...]"; exit 1; }
    for id in "$@"; do
      case "$id" in *[!0-9]*|'') echo "Это не числовой Telegram ID: $id"; exit 1;; esac
    done
    if [ -z "$(current)" ]; then
      echo "Внимание: список был пуст (вход для всех). Теперь войти смогут ТОЛЬКО перечисленные ID."
    fi
    # shellcheck disable=SC2046
    write_list $(current) "$@"
    ;;
  remove)
    shift
    [ $# -gt 0 ] || { echo "Использование: sh deploy/users.sh remove <telegram_id> [...]"; exit 1; }
    remaining=$(current)
    for id in "$@"; do remaining=$(printf '%s\n' $remaining | grep -vx "$id" || true); done
    if [ -z "$remaining" ]; then
      echo "Отказ: после удаления список станет пустым, а пустой список открывает приложение ВСЕМ."
      echo "Сначала добавьте другого пользователя или отредактируйте ALLOWED_USER_IDS в .env вручную."
      exit 1
    fi
    # shellcheck disable=SC2086
    write_list $remaining
    ;;
  *)
    echo "Использование: sh deploy/users.sh [list | add <id>... | remove <id>...]"
    exit 1
    ;;
esac
