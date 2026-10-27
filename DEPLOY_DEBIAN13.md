# Domain Drop на VPS с Debian 13

Да, проект можно полностью поднять на VPS с Debian 13. На хосте нужны только **Docker**, **Git** и reverse-proxy (**Caddy** или уже установленный **Nginx**). Python, Node.js, PostgreSQL и Redis на хосте ставить не нужно — они работают внутри Docker Compose.

> Команды ниже рассчитаны на пользователя с `sudo`. Если вы зашли как `root`, `sudo` можно не писать.

Итоговая схема:

```text
Интернет :443
   │
   ▼
Caddy / Nginx  (TLS)
   │ 127.0.0.1:3000
   ▼
frontend (nginx) ── /api ──► backend:8000
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                PostgreSQL            Redis
```

Наружу должны быть открыты только **22**, **80** и **443**. Порты `3000` и `8000` в актуальном `docker-compose.yml` привязаны к `127.0.0.1`, а база и Redis вообще не публикуются.

---

## 0. Что понадобится

- VPS Debian 13 с SSH-доступом.
- Домен или поддомен, например `drop.example.com`.
- A-запись домена на IP VPS (и AAAA, если используете IPv6).
- Открытые в панели VPS порты `22`, `80`, `443`.
- Желательно **2 ГБ RAM**. На 1 ГБ сборка фронтенда может упасть по памяти — тогда нужен swap (команда ниже).

Telegram Mini App **не работает по HTTP и по голому IP**. Нужен публичный HTTPS-домен.

> Если домена пока нет: купите дешёвый домен или используйте поддомен уже имеющегося. Для теста без домена можно взять `sslip.io`-имя вида `203.0.113.10.sslip.io`, но для постоянной работы лучше нормальный домен.

---

## 1. Сначала обследуйте старый сайт

**Ничего не удаляйте на этом шаге.** Сначала нужно понять, что занимает порты 80/443 и где лежат файлы.

```bash
cat /etc/os-release
hostname -I
sudo ss -tulpn | grep -E ':(80|443|3000|8000)\b'
sudo systemctl list-units --type=service --state=running | grep -Ei 'nginx|apache|php|mysql|maria|postgres|docker|node|pm2'
```

Если есть Nginx:

```bash
sudo nginx -T 2>/dev/null | grep -E 'server_name|root |proxy_pass' | less
ls -la /etc/nginx/sites-enabled /var/www
```

Если есть Apache:

```bash
sudo apachectl -S
ls -la /etc/apache2/sites-enabled /var/www
```

Если есть Docker:

```bash
sudo docker ps -a
sudo docker compose ls
```

Дополнительно проверьте базы, cron и сертификаты:

```bash
sudo crontab -l
ls -la /etc/cron.d
sudo certbot certificates 2>/dev/null

# MySQL/MariaDB, если установлены:
sudo mysql -e 'SHOW DATABASES;' 2>/dev/null

# PostgreSQL, если установлен:
sudo -u postgres psql -c '\l' 2>/dev/null
```

Запишите:

- какой домен/поддомен обслуживает старый сайт;
- где лежат файлы сайта;
- какая база используется;
- есть ли на сервере почта (Postfix/Dovecot) — её нельзя удалять вместе с сайтом;
- какие cron-задачи и systemd-сервисы относятся к старому сайту.

Если пришлёте вывод этих команд, можно точно сказать, что удалять, а что оставить.

> Если на VPS стоит панель управления (ISPmanager, Plesk, aaPanel, HestiaCP), удаляйте старый сайт **через панель**, а не вручную через `rm`: панель хранит свои конфиги, базы и DNS-зоны. В этом случае лучше не выполнять команды удаления из раздела 10 без проверки.

---

## 2. Сделайте резервные копии старого сайта

Создайте папку для бэкапов:

```bash
sudo mkdir -p /root/backups/$(date +%F)
sudo chmod 700 /root/backups
```

Файлы и конфиги:

```bash
STAMP=$(date +%F)
sudo tar -czf /root/backups/$STAMP/www.tar.gz /var/www 2>/dev/null
sudo tar -czf /root/backups/$STAMP/web-configs.tar.gz \
  /etc/nginx /etc/apache2 /etc/letsencrypt 2>/dev/null
sudo tar -czf /root/backups/$STAMP/cron.tar.gz /etc/cron.d /var/spool/cron 2>/dev/null
```

Базы данных — **только если они есть**:

```bash
# MySQL/MariaDB
sudo mysqldump --all-databases --single-transaction --routines --triggers --events \
  > /root/backups/$STAMP/mysql-all.sql

# PostgreSQL
sudo -u postgres pg_dumpall > /root/backups/$STAMP/postgres-all.sql
```

Проверьте, что архивы не пустые:

```bash
ls -lh /root/backups/$STAMP
tar -tzf /root/backups/$STAMP/www.tar.gz | head
```

**Обязательно скопируйте бэкап с VPS на свой компьютер или в облако.** Бэкап, лежащий только на том же диске, не защищает от поломки VPS:

```bash
# выполнять на своём компьютере
scp -r USER@VPS_IP:/root/backups ./vps-backups
```

Если старый сайт в Docker, сохраните и его данные:

```bash
sudo docker ps -a
sudo docker volume ls
```

Остановите старый сайт только после бэкапа и только когда новый уже готов к проверке.

---

## 3. DNS

В панели домена создайте:

| Тип | Имя | Значение |
|---|---|---|
| A | `drop` (или `@`) | IP вашего VPS |
| AAAA | `drop` (если есть IPv6) | IPv6 VPS |

Проверка:

```bash
dig +short A drop.example.com
dig +short AAAA drop.example.com
```

Должен вернуться IP VPS. Если используете Cloudflare, на время получения сертификата можно включить **DNS only** (серое облако), затем включить proxy и режим **Full (strict)**.

---

## 4. Установите Docker на Debian 13

Обновите систему:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl gnupg git ufw
```

Официальный репозиторий Docker:

```bash
sudo install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/debian/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

Включите Docker:

```bash
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

Если `apt update` вдруг не находит Docker-пакет для `trixie`, проверьте, что подходит codename:

```bash
. /etc/os-release && echo "$VERSION_CODENAME"
```

На момент установки репозиторий Docker должен поддерживать Debian 13. Если поддержки ещё нет, используйте пакеты Debian (`docker.io` + `docker-compose`) либо дождитесь обновления репозитория; не смешивайте произвольные версии из разных репозиториев.

Чтобы не писать `sudo` каждый раз:

```bash
sudo usermod -aG docker "$USER"
```

После этого **выйдите из SSH и зайдите снова** (или выполните `newgrp docker`).

### Если мало RAM

На VPS с 1 ГБ добавьте swap 2 ГБ:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

---

## 5. Код и `.env`

Создайте каталог и склонируйте репозиторий:

```bash
sudo mkdir -p /opt/domain-drop
sudo chown "$USER":"$USER" /opt/domain-drop
git clone https://github.com/kovpasio/siteharnesstest.git /opt/domain-drop
cd /opt/domain-drop
```

Если репозиторий приватный, настройте SSH-ключ или GitHub CLI. **Не вставляйте пароль или PAT в чат/репозиторий.**

Создайте `.env`:

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Пример production-файла:

```dotenv
BOT_TOKEN=123456789:AA...
WEBAPP_URL=https://drop.example.com

DEV_MODE=false
ENVIRONMENT=production
JWT_SECRET=<результат openssl rand -hex 32>
ADMIN_USERNAMES=anxiohalcy

POSTGRES_DB=roulette
POSTGRES_USER=roulette
POSTGRES_PASSWORD=<результат openssl rand -hex 24>

CORS_ORIGINS=https://drop.example.com
BIND_HOST=127.0.0.1
APP_PORT=3000
BACKEND_PORT=8000
```

Сгенерируйте секреты:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # POSTGRES_PASSWORD
```

Важно:

- `WEBAPP_URL` — **адрес самого Mini App**, без `/api` и без слэша на конце.
- `DEV_MODE=false` — в production вход только через Telegram `initData`.
- `POSTGRES_PASSWORD` лучше делать hex-строкой без `@`, `:` и `/`, потому что пароль подставляется в URL базы.
- `BOT_TOKEN` берите у `@BotFather`. Без него backend не сможет проверять Telegram-вход.
- `ADMIN_USERNAMES=anxiohalcy` — админка для этого Telegram-username.

---

## 6. Сборка и первый запуск

```bash
cd /opt/domain-drop
docker compose build --pull
docker compose up -d
```

Первый старт backend генерирует **100 500 доменов** и может занять 10–30 секунд. Проверьте:

```bash
docker compose ps
docker compose logs -f backend
```

Ждём `healthy` у backend. Затем:

```bash
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000
```

`3000/api/health` проверяет цепочку `frontend nginx → backend`, это важнее прямого `8000`.

Проверьте, что наружу не торчат лишние порты:

```bash
sudo ss -tulpn | grep -E ':(3000|8000|5432|6379)\b'
```

Должно быть только `127.0.0.1:3000` и `127.0.0.1:8000`. База и Redis — только внутри Docker-сети.

### Проверка до Telegram

Можно временно открыть приложение через SSH-туннель:

```bash
# на своём компьютере
ssh -L 3000:127.0.0.1:3000 USER@VPS_IP
```

Откройте `http://localhost:3000`. Для входа в dev-режиме можно временно поставить `DEV_MODE=true`, но перед production-запуском верните `false` и перезапустите:

```bash
docker compose up -d --force-recreate backend bot
```

---

## 7. HTTPS: Caddy или Nginx

Выберите **один** вариант. Нельзя одновременно держать Caddy и Nginx на портах 80/443.

### Вариант A — Caddy (чистый сервер)

Подходит, если старый сайт можно погасить на время переключения.

Сначала остановите старый веб-сервер, **не удаляя файлы**:

```bash
sudo systemctl stop nginx apache2 2>/dev/null
sudo systemctl disable nginx apache2 2>/dev/null
sudo ss -tulpn | grep -E ':(80|443)\b'
```

Последняя команда не должна показывать процессов на 80/443.

Установите Caddy из официального репозитория:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list

sudo apt update
sudo apt install -y caddy
```

Откройте `/etc/caddy/Caddyfile`:

```bash
sudo nano /etc/caddy/Caddyfile
```

Оставьте:

```caddyfile
drop.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Проверьте и запустите:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
sudo journalctl -u caddy -n 50 --no-pager
```

Проверка:

```bash
curl -I https://drop.example.com
curl -fsS https://drop.example.com/api/health
```

Caddy сам получит Let's Encrypt-сертификат. Если сертификат не выдаётся:

- A-запись ещё не обновилась (`dig +short`);
- закрыт порт 80 или 443 в панели VPS;
- включён Cloudflare proxy и мешает HTTP-01 — на время выключите proxy или используйте DNS challenge;
- на 80/443 остался старый Nginx/Apache.

### Вариант B — оставить Nginx (без простоя)

Если старый сайт уже работает на Nginx, его можно **не сносить сразу**. Добавьте новый сайт на поддомен, проверьте, а старый удалите позже.

Создайте `/etc/nginx/sites-available/domain-drop`:

```nginx
server {
    listen 80;
    server_name drop.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включите и проверьте:

```bash
sudo ln -s /etc/nginx/sites-available/domain-drop /etc/nginx/sites-enabled/domain-drop
sudo nginx -t
sudo systemctl reload nginx
```

Получите HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d drop.example.com
```

Проверьте `https://drop.example.com/api/health`.

В этом варианте Caddy **не устанавливайте** — Nginx уже занимает 80/443.

---

## 8. Telegram

1. Создайте бота у `@BotFather`, если его ещё нет.
2. Положите токен в `BOT_TOKEN` в `.env`.
3. Убедитесь, что в `.env`:

```dotenv
WEBAPP_URL=https://drop.example.com
DEV_MODE=false
ENVIRONMENT=production
BOT_TOKEN=...
```

4. Перезапустите backend и bot:

```bash
cd /opt/domain-drop
docker compose up -d --force-recreate backend bot
docker compose logs -f bot
```

5. Откройте бота в Telegram, отправьте `/start`. Бот сам настроит кнопку меню с `WEBAPP_URL`.
6. Откройте Mini App. Первый вход создаст пользователя. Аккаунт с Telegram username `anxiohalcy` получит админку.

Если бот пишет, что URL не HTTPS или Mini App не открывается — проверьте сертификат и `WEBAPP_URL`. Внутри Telegram `http://` и `localhost` не работают.

---

## 9. Firewall

Сначала убедитесь, что SSH-порт открыт, иначе можно потерять доступ.

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Если SSH работает на нестандартном порту, вместо `OpenSSH` разрешите именно его.

Порты `3000`, `8000`, `5432`, `6379` **не открывайте**. Docker не должен обходить firewall: в актуальном compose они привязаны к `127.0.0.1`; проверьте:

```bash
sudo ss -tulpn | grep -E ':(3000|8000|5432|6379)\b'
```

Также проверьте firewall в панели VPS-провайдера: там должны быть разрешены только SSH, 80 и 443.

---

## 10. Удаление старого сайта — по шагам

**Не удаляйте старый сайт, пока новый не открылся в Telegram и вы не проверили вход, спины, инвентарь и админку.**

### Шаг 1. Определите, что именно относится к старому сайту

```bash
sudo nginx -T 2>/dev/null | grep -nE 'server_name|root |proxy_pass'
# или
sudo apachectl -S

ls -la /var/www
sudo du -sh /var/www/*

sudo systemctl list-units --type=service --state=running | grep -Ei 'nginx|apache|php|mysql|maria|postgres|docker'
```

### Шаг 2. Остановите старый сайт, сохранив файлы

Если старый сайт на Nginx и вы **не** используете Caddy:

```bash
# Сначала найдите имя файла старого vhost
ls -la /etc/nginx/sites-enabled

# Уберите только старый сайт, не трогая новый domain-drop
sudo rm /etc/nginx/sites-enabled/OLD-SITE
sudo nginx -t
sudo systemctl reload nginx
```

Если старый сайт на отдельном сервисе:

```bash
sudo systemctl stop OLD-SERVICE
sudo systemctl disable OLD-SERVICE
```

Не удаляйте `/var/www` целиком. Переименуйте каталог старого сайта:

```bash
sudo mv /var/www/OLD-SITE /var/www/OLD-SITE.DISABLED
```

Так у вас будет возможность быстро откатиться.

### Шаг 3. Удалите старую базу только после дампа

```bash
# MySQL/MariaDB — список баз
sudo mysql -e 'SHOW DATABASES;'

# После проверки дампа:
sudo mysql -e 'DROP DATABASE `OLD_DATABASE`;'
```

PostgreSQL:

```bash
sudo -u postgres psql -c '\l'
sudo -u postgres dropdb OLD_DATABASE
```

Если старая база используется почтой или другими сервисами — **не удаляйте её**.

### Шаг 4. Удалите старые файлы и конфиги

Только после того, как новый сайт работает несколько дней:

```bash
# Проверьте путь дважды!
ls -la /var/www/OLD-SITE.DISABLED
sudo rm -rf /var/www/OLD-SITE.DISABLED

# Конфиг старого vhost, если он ещё остался
sudo rm -f /etc/nginx/sites-available/OLD-SITE

# Старые сертификаты, если домен больше не используется старым сайтом
sudo certbot delete --cert-name OLD-DOMAIN
```

Если старый сайт был в Docker:

```bash
cd /path/to/old-project
sudo docker compose down
# Только после бэкапа томов:
sudo docker compose down -v
```

Если вы перешли на Caddy и старый Nginx/Apache больше не нужен, его можно удалить только после проверки нового сайта:

```bash
sudo apt purge -y nginx nginx-common apache2 apache2-bin
sudo apt autoremove -y
```

Не выполняйте это, если решили оставить Nginx как reverse-proxy.

Удалите старые cron-задачи:

```bash
sudo crontab -e
ls -la /etc/cron.d
```

### Шаг 5. DNS и почта

- Если новый сайт использует тот же домен — A-запись уже указывает на VPS, менять не нужно.
- Не удаляйте **MX**, **TXT**, **SPF/DKIM/DMARC** записи, если на домене есть почта.
- Удалите только те поддомены, которые относились к старому сайту и больше не нужны.
- Если старый сайт использовал отдельный поддомен, уберите его A-запись после проверки.

---

## 11. Бэкапы и обновления

### Бэкап PostgreSQL

```bash
cd /opt/domain-drop
mkdir -p /root/backups/db
docker compose exec -T db pg_dump -U roulette roulette \
  | gzip > /root/backups/db/domain-drop-$(date +%F-%H%M).sql.gz

# Проверка
ls -lh /root/backups/db
gzip -t /root/backups/db/domain-drop-*.sql.gz
```

Ежедневный cron (пример):

```bash
sudo crontab -e
```

```cron
15 3 * * * cd /opt/domain-drop && docker compose exec -T db pg_dump -U roulette roulette | gzip > /root/backups/db/domain-drop-$(date +\%F).sql.gz
```

Не забывайте копировать бэкапы с VPS.

### Обновление приложения

```bash
cd /opt/domain-drop
git pull
docker compose build --pull
docker compose up -d
```

Данные PostgreSQL и Redis лежат в Docker volumes и при обычном обновлении сохраняются. При старте backend пересобирает каталог доменов (10–30 секунд) — это нормально.

### Логи

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f bot
docker compose logs -f frontend
sudo journalctl -u caddy -n 100 --no-pager
```

---

## 12. Если что-то не работает

| Симптом | Что проверить |
|---|---|
| `502 Bad Gateway` | `docker compose ps`; backend healthy; `curl 127.0.0.1:3000/api/health` |
| Telegram не открывает Mini App | HTTPS, `WEBAPP_URL`, валидный сертификат |
| `403` при входе | `BOT_TOKEN`, `DEV_MODE=false`, открытие именно внутри Telegram |
| Нет админки | войти под Telegram username `anxiohalcy`; проверить `ADMIN_USERNAMES` |
| Долгий первый запуск | генерация 100 500 доменов, 10–30 секунд |
| Caddy не получает сертификат | DNS, порты 80/443, Cloudflare proxy |
| Кончилась память при сборке | swap 2 ГБ, повторить `docker compose build` |
| Порт занят | `sudo ss -tulpn \| grep -E ':(80\|443\|3000)\b'` |

---

## 13. Короткий чек-лист

- [ ] Сделан бэкап старого сайта и базы, скачан с VPS.
- [ ] A-запись домена указывает на VPS.
- [ ] Установлены Docker и compose plugin.
- [ ] Заполнен `.env`, `chmod 600`.
- [ ] `docker compose up -d`, backend healthy.
- [ ] `http://127.0.0.1:3000/api/health` отвечает.
- [ ] Настроен HTTPS через Caddy или Nginx.
- [ ] В Telegram открывается Mini App.
- [ ] Вход работает, админка @anxiohalcy видна.
- [ ] UFW: открыты только SSH/80/443.
- [ ] Старый сайт остановлен, затем удалён после проверки.
- [ ] Настроен ежедневный бэкап PostgreSQL.
- [ ] Бэкап хранится вне VPS.

---

## Если нужен точный разбор старого сайта

Пришлите вывод (без паролей и приватных ключей):

```bash
cat /etc/os-release
sudo ss -tulpn | grep -E ':(80|443)\b'
sudo nginx -T 2>/dev/null | grep -E 'server_name|root |proxy_pass'
sudo apachectl -S 2>/dev/null
ls -la /var/www
sudo docker ps -a
```

По нему можно сказать, что именно занимает порты, где лежат файлы и какие команды безопасно выполнять для удаления.
