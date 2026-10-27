#!/usr/bin/env bash
#
# Domain Drop - первичное развёртывание на Debian 13 под root.
# Запускать только на своём сервере:
#
#   su -
#   bash /opt/domain-drop/deploy/bootstrap-root.sh kind-lion.vps.ktk-45.ru
#
# Скрипт НЕ удаляет старый сайт и НЕ трогает базы. Он добавляет отдельный
# nginx-vhost для нового домена и настраивает HTTPS через certbot.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите этот скрипт под root: su -" >&2
  exit 1
fi

DOMAIN="${1:-kind-lion.vps.ktk-45.ru}"
EMAIL="${2:-}"
APP_DIR="${APP_DIR:-/opt/domain-drop}"
REPO="${REPO:-https://github.com/kovpasio/siteharnesstest.git}"
APP_PORT="${APP_PORT:-3000}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/root/backups/domain-drop-$STAMP"

if [ -z "${BOT_TOKEN:-}" ]; then
  read -rsp "BOT_TOKEN от @BotFather: " BOT_TOKEN
  echo
fi

if [ -z "$BOT_TOKEN" ]; then
  echo "BOT_TOKEN обязателен: без него не работает вход через Telegram." >&2
  exit 1
fi

if [ -z "$EMAIL" ]; then
  read -rp "Email для Let's Encrypt (можно оставить пустым): " EMAIL
fi

echo "== Проверка системы =="
. /etc/os-release
if [ "${ID:-}" != "debian" ]; then
  echo "Ожидается Debian, обнаружено: ${PRETTY_NAME:-unknown}" >&2
  exit 1
fi
echo "OK: ${PRETTY_NAME}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "== Резервная копия nginx и .env =="
if [ -d /etc/nginx ]; then
  cp -a /etc/nginx "$BACKUP_DIR/nginx" 2>/dev/null || true
fi
if [ -f "$APP_DIR/.env" ]; then
  cp -a "$APP_DIR/.env" "$BACKUP_DIR/env" 2>/dev/null || true
fi

echo "== Установка базовых пакетов =="
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg git openssl nginx certbot python3-certbot-nginx

echo "== Установка Docker =="
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/debian \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker compose version >/dev/null
echo "OK: Docker готов"

echo "== Каталог проекта =="
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
elif [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
  echo "Каталог $APP_DIR существует и не пуст, но это не git-репозиторий." >&2
  echo "Выберите другой APP_DIR или перенесите старые файлы." >&2
  exit 1
else
  mkdir -p "$APP_DIR"
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

read_env_value() {
  local key="$1"
  [ -f .env ] || return 0
  sed -n "s/^${key}=//p" .env | head -n 1
}

OLD_JWT="$(read_env_value JWT_SECRET)"
OLD_DB_PASSWORD="$(read_env_value POSTGRES_PASSWORD)"
JWT_SECRET="${OLD_JWT:-$(openssl rand -hex 32)}"
DB_PASSWORD="${OLD_DB_PASSWORD:-$(openssl rand -hex 24)}"

echo "== Запись .env =="
cat > .env <<EOF
BOT_TOKEN=$BOT_TOKEN
WEBAPP_URL=https://$DOMAIN
DEV_MODE=false
ENVIRONMENT=production
JWT_SECRET=$JWT_SECRET
ADMIN_USERNAMES=anxiohalcy

POSTGRES_DB=roulette
POSTGRES_USER=roulette
POSTGRES_PASSWORD=$DB_PASSWORD

CORS_ORIGINS=https://$DOMAIN
BIND_HOST=127.0.0.1
APP_PORT=$APP_PORT
BACKEND_PORT=8000
EOF
chmod 600 .env

echo "== Сборка и запуск приложения =="
docker compose build --pull
docker compose up -d

echo "== Ожидание backend =="
ready=0
for _ in $(seq 1 50); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 3
done
if [ "$ready" -ne 1 ]; then
  echo "Backend не поднялся за отведённое время." >&2
  docker compose ps >&2 || true
  docker compose logs --tail=80 backend >&2 || true
  exit 1
fi
echo "OK: приложение отвечает на 127.0.0.1:${APP_PORT}"

echo "== Nginx vhost для $DOMAIN =="
cat > /etc/nginx/sites-available/domain-drop <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/domain-drop /etc/nginx/sites-enabled/domain-drop
nginx -t
systemctl reload nginx

echo "== HTTPS через certbot =="
CERTBOT_ARGS=(--nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
if [ -n "$EMAIL" ]; then
  CERTBOT_ARGS+=(--email "$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi
certbot "${CERTBOT_ARGS[@]}"

systemctl reload nginx
echo "== Проверка HTTPS =="
curl -fsS "https://$DOMAIN/api/health"
echo

echo "== Готово =="
echo "Mini App: https://$DOMAIN"
echo "Админка: @anxiohalcy"
echo "Backup: $BACKUP_DIR"
echo
echo "Старый сайт не удалён. Если он был на этом домене, сначала проверьте"
echo "новый сайт в Telegram, затем удаляйте старый vhost/файлы вручную."
echo "Логи: docker compose -f $APP_DIR/docker-compose.yml logs -f backend"
