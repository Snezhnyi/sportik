# Деплой на свой сервер (Docker)

## Текущая установка

- Адрес: **https://snezhtaho.ru/sportik/** (nginx `location /sportik/` в `/etc/nginx/sites-available/snezhtaho.ru` → `127.0.0.1:8788`).
- Проект: `/opt/sportik` на `188.120.239.157`, настройки в `/opt/sportik/.env`, база в docker-томе `sportik_sportik_data`.
- Образ собирается из `deploy/Dockerfile.prebuilt`: интерфейс собирается локально, на сервере — только рантайм (на сервере мало памяти).
- Обновление с компьютера: `bash deploy/push.sh`.
- Копия исходного конфига nginx: `/root/nginx-backup-20261031-194910/`.

Ниже — общая инструкция для других серверов.

Нужно: Linux-сервер с Docker и Docker Compose v2, домен (или поддомен), указывающий на IP сервера.
Telegram открывает Mini App только по HTTPS с настоящим сертификатом.

## 1. Залить проект

С компьютера (из `D:\sportik`), без `node_modules`, `dist`, `data` и `.env`:

```bash
tar --exclude=node_modules --exclude=dist --exclude=data --exclude=.env --exclude=.claude -czf sportik.tgz .
scp sportik.tgz user@SERVER:/opt/sportik/
ssh user@SERVER "cd /opt/sportik && tar -xzf sportik.tgz && rm sportik.tgz"
```

## 2. Настроить окружение на сервере

```bash
cd /opt/sportik
cp deploy/.env.production.example .env
nano .env        # BOT_TOKEN, DOMAIN; ALLOW_DEV_AUTH=0
```

## 3. Запустить

**Вариант А — на сервере нет своего веб-сервера (порты 80/443 свободны).** Встроенный Caddy сам получит сертификат:

```bash
docker compose --profile caddy up -d --build
```

**Вариант Б — на сервере уже есть nginx/Caddy/Traefik.** Запускаем только приложение (слушает `127.0.0.1:8787`):

```bash
docker compose up -d --build
```

и проксируем домен на него, например для nginx:

```nginx
server {
    server_name sportik.example.com;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # listen 443 ssl; + сертификат (certbot --nginx -d sportik.example.com)
}
```

Проверка: `curl https://sportik.example.com/api/health` → `{"ok":true,...}`.

## 4. Обновление

```bash
# залить новые файлы (шаг 1), затем:
docker compose up -d --build        # с --profile caddy, если используется вариант А
```

База лежит в docker-томе `sportik_data` и при пересборке не теряется.

## 5. Резервные копии

```bash
sh deploy/backup.sh                 # → backups/sportik-ГГГГ-ММ-ДД_ЧЧММ.db
```

Для ежедневной копии добавьте в `crontab -e`:
`0 4 * * * cd /opt/sportik && sh deploy/backup.sh >/dev/null 2>&1`

## 6. Telegram

[@BotFather](https://t.me/BotFather) → `/mybots` → бот → **Bot Settings** → **Menu Button** → `https://sportik.example.com`.

Логи: `docker compose logs -f app`.
