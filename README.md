# DROP.ZONE

**Telegram Mini App — виртуальная рулетка доменов.** Тёмный неоновый интерфейс, provably fair, pity-система, live-лента дропов, WebSocket и полностью виртуальная экономика.

> Все домены вымышленные. Приложение не регистрирует реальные домены, не принимает платежи и не выводит деньги.

![Рулетка](docs/screenshots/roulette.png)

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Запуск в GitHub Codespaces](#запуск-в-github-codespaces)
- [Подключение Telegram](#подключение-telegram)
- [Экраны](#экраны)
- [Архитектура](#архитектура)
- [Provably Fair](#provably-fair)
- [Экономика и EV](#экономика-и-ev)
- [База данных](#база-данных)
- [API](#api)
- [Ключевые механики](#ключевые-механики)
- [Тесты](#тесты)
- [Структура проекта](#структура-проекта)
- [Переменные окружения](#переменные-окружения)
- [Production checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)

---

## Быстрый старт

Требуется Docker с Compose v2. Первый запуск соберёт образы — это нормально.

```bash
cp .env.example .env
# откройте .env и заполните BOT_TOKEN / WEBAPP_URL (можно позже)

docker compose up --build
```

Либо просто:

```bash
docker compose up
```

Compose сам соберёт отсутствующие образы.

После старта:

| Что | URL |
|---|---|
| Mini App (dev, браузер) | http://localhost:3000 |
| API | http://localhost:8000/api |
| Swagger | http://localhost:8000/api/docs |
| Healthcheck | http://localhost:8000/api/health |

В браузере приложение автоматически войдёт в **dev-режиме** (`DEV_MODE=true` в Compose). Это удобно для проверки UI без Telegram. Внутри Telegram авторизация идёт через настоящий `initData`, а dev-режим можно выключить.

Без `BOT_TOKEN` сервис `bot` пишет предупреждение и остаётся в ожидании, а API и Mini App работают. Для реального бота токен обязателен.

### Остановка и сброс

```bash
docker compose down          # остановить
docker compose down -v       # остановить и удалить Postgres/Redis volumes
```

При удалении volume каталог из 200 доменов создастся заново при следующем запуске.

---

## Запуск в GitHub Codespaces

Если локальный Docker не работает, проект можно запустить в облаке GitHub. В репозитории уже лежит `.devcontainer/devcontainer.json` с Docker-in-Docker и проброшенными портами.

1. Загрузите проект в **приватный** GitHub-репозиторий.
2. В репозитории нажмите **Code → Codespaces → Create codespace on main**.
3. Дождитесь первого запуска (5–15 минут).
4. В терминале Codespace:

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

5. Откройте вкладку **Ports** в нижней панели.
6. Найдите порт **3000**, нажмите правой кнопкой → **Port Visibility → Public**.
7. Скопируйте адрес вида:

```text
https://ваш-codespace-3000.app.github.dev
```

Это готовый HTTPS-адрес для Telegram. Порт **8000** публичным делать не нужно — nginx проксирует API внутри.

8. Пропишите адрес в `.env`:

```dotenv
BOT_TOKEN=токен_от_BotFather
WEBAPP_URL=https://ваш-codespace-3000.app.github.dev
DEV_MODE=false
ENVIRONMENT=production
```

9. Перезапустите:

```bash
docker compose up -d --force-recreate
```

Ограничения Codespaces:

- бесплатный Codespace останавливается после простоя, поэтому бот и сайт перестают работать;
- при удалении Codespace удаляются и Docker-volumes с базой;
- публичный порт виден в интернете — не оставляйте `DEV_MODE=true` навсегда;
- для постоянной работы нужен VPS или полноценный хостинг, а не Codespaces.

---

## Подключение Telegram

1. Создайте бота у [@BotFather](https://t.me/BotFather), получите `BOT_TOKEN`.
2. Mini App обязан открываться по **публичному HTTPS-адресу**. `http://localhost` внутри Telegram не подойдёт.
   Для локальной проверки можно поднять туннель, например:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   или `ngrok http 3000`.
3. Заполните `.env`:
   ```dotenv
   BOT_TOKEN=123456789:AA...
   WEBAPP_URL=https://your-public-url.example
   DEV_MODE=false
   ENVIRONMENT=production
   JWT_SECRET=<случайные 64 hex-символа>
   ```
4. Перезапустите:
   ```bash
   docker compose up -d --build
   ```
5. Откройте бота, отправьте `/start` и нажмите **«Открыть DROP.ZONE»**. Кнопка меню бота также настраивается автоматически.

В BotFather команда `/setmenubutton` не обязательна: бот сам вызывает `set_chat_menu_button`.

---

## Экраны

| Экран | Маршрут | Что внутри |
|---|---|---|
| Профиль | `/` | Аватар, ник, баланс, место в рейтинге, pity, состав коллекции, ежедневный бонус |
| Рулетка | `/roulette` | Горизонтальная лента, разгон/замедление 4.6 с, вспышка на Legendary/Mythic, тик-звук, haptic |
| Инвентарь | `/inventory` | Сетка доменов, фильтры по зоне и редкости, продажа через bottom sheet |
| Рейтинг | `/leaderboard` | Топ-20 по силе коллекции + подсветка своей позиции |
| Лента дропов | `/drops` | Последние 20 дропов, WebSocket, live-статус, переход к проверке |
| Проверка | `/verify` | Проверка по ID спина или вручную по `server_seed` / `client_seed` / `nonce` |

Дополнительно:

- ежедневный бонус — кнопка в профиле, 100 D раз в 24 часа;
- ссылка «Проверить» появляется на карточке выигрыша и в ленте дропов;
- нижняя навигация: Профиль · Инвентарь · Крутить · Топ · Дропы.

### Скриншоты

| Профиль | Проверка | Дропы |
|---|---|---|
| ![Профиль](docs/screenshots/profile.png) | ![Проверка](docs/screenshots/verify.png) | ![Дропы](docs/screenshots/drops.png) |

---

## Архитектура

```text
Telegram WebView
      │  initData (HMAC с BOT_TOKEN)
      ▼
┌───────────────────────────────┐
│ frontend: React + Vite +      │
│ Tailwind + framer-motion      │
│ nginx: SPA + /api proxy + WS  │
└──────────────┬────────────────┘
               │ /api
               ▼
┌───────────────────────────────┐
│ backend: FastAPI               │
│ auth · spin · inventory        │
│ leaderboard · drops · verify   │
│                               │
│ SQLAlchemy async ──► Postgres  │
│ redis.asyncio ─────► Redis     │
│   • cooldown SET NX EX 2s      │
│   • Pub/Sub канал дропов       │
└──────────────┬────────────────┘
               │
      ┌────────┴─────────┐
      ▼                  ▼
 Telegram Bot        WebSocket clients
 (aiogram polling)   (последние 20 дропов)
```

Сервисы Compose:

- `db` — PostgreSQL 16;
- `redis` — Redis 7 (rate limit + Pub/Sub);
- `backend` — FastAPI/Uvicorn, один процесс с in-process WebSocket hub;
- `bot` — aiogram 3, polling, кнопка WebApp;
- `frontend` — nginx со статикой React и проксированием `/api` и WebSocket.

---

## Provably Fair

### Commit → Spin → Reveal

1. Перед спином клиент вызывает `POST /api/spin/prepare`.
2. Сервер генерирует `server_seed = secrets.token_hex(32)` и возвращает **только** `sha256(server_seed)`.
3. Сервер сохраняет seed и commitment в БД, привязывает к пользователю и текущему nonce.
4. `POST /api/spin` с `commitment_id` фиксирует результат.
5. В ответе приходит раскрытый `server_seed`. Хеш можно проверить вручную.
6. `GET /api/verify/:spin_id` пересчитывает всё заново и сравнивает с записью.

`client_seed` по умолчанию генерируется сервером (`token_hex(8)`), но API принимает и свой.  
`nonce = total_spins + 1` на момент подготовки.

### Формулы

```text
rarityRoll  = int(HMAC_SHA256(server_seed, `${client_seed}:${nonce}`), 16) mod 10000

domainIndex = int(HMAC_SHA256(server_seed, `${client_seed}:${nonce}:domain`), 16)
              mod bucketSize
```

Сначала по `rarityRoll` выбирается редкость по накопительным весам:

```text
common     [   0 .. 5999]   6000
rare       [6000 .. 8499]   2500
epic       [8500 .. 9499]   1000
legendary  [9500 .. 9949]    450
mythic     [9950 .. 9999]     50
                            ─────
                            10000
```

Затем второй HMAC выбирает домен внутри пула выбранной редкости. Список пула стабилен и сортируется по `domains.id`. Размер пула сохраняется в спине (`bucket_size`), поэтому проверка не сломается, если каталог позже расширят.

### Pity и честность

Если `pity_counter >= 50`, редкость принудительно выбирается из Epic+:

```text
pityRoll = int(HMAC_SHA256(server_seed, `${client_seed}:${nonce}:pity`), 16)
           mod 1500
epic       [   0 ..  999]  1000
legendary  [1000 .. 1449]   450
mythic     [1450 .. 1499]    50
```

В записи спина хранятся:

- `base_rarity` — редкость из обычного ролла;
- `rarity` — фактическая (с учётом pity);
- `pity_applied` — был ли гарантированный Epic+;
- `rarity_roll`, `domain_roll`, `domain_index`, `bucket_size` (размер пула на момент спина);
- `server_seed_hash`, `server_seed`, `client_seed`, `nonce`.

Страница проверки показывает и базовую, и фактическую редкость, поэтому pity не скрывает результат обычного ролла. Ручная форма принимает `pity_counter`, чтобы воспроизвести такую же ситуацию.

### Что проверяется на `/verify`

- `sha256(server_seed) == server_seed_hash`;
- пересчитанная `base_rarity` совпадает с записью;
- пересчитанная фактическая редкость с учётом pity совпадает;
- `domain_index` и выбранный домен совпадают;
- отображается формула и все исходные значения.

Проверка по ID доступна без авторизации, чтобы результат можно было отправить кому угодно.

---

## Экономика и EV

### Важное противоречие в исходном ТЗ

Одновременно выполнить нельзя:

- цены продажи `10 / 50 / 200 / 1000 / 5000`;
- вероятности `60 / 25 / 10 / 4.5 / 0.5 %`;
- стоимость спина `50`;
- «EV спина меньше 50, house edge ~30%».

С исходными ценами:

| Редкость | Шанс | Цена | Вклад в EV |
|---|---:|---:|---:|
| Common | 60% | 10 | 6.00 |
| Rare | 25% | 50 | 12.50 |
| Epic | 10% | 200 | 20.00 |
| Legendary | 4.5% | 1000 | 45.00 |
| Mythic | 0.5% | 5000 | 25.00 |
| **Итого** | **100%** |  | **108.50 D** |

При спине за 50 D это **EV = 108.5**, RTP = 217%, игрок в плюсе на 117% в долгую. Игра сломана.

В проекте приоритет отдан явному требованию **EV < 50 и house edge ~30%**. Цены продажи отмасштабированы с сохранением соотношений:

| Редкость | Шанс | Новая цена | Вклад в EV |
|---|---:|---:|---:|
| Common | 60% | 5 | 3.00 |
| Rare | 25% | 20 | 5.00 |
| Epic | 10% | 60 | 6.00 |
| Legendary | 4.5% | 300 | 13.50 |
| Mythic | 0.5% | 1500 | 7.50 |
| **Итого** | **100%** |  | **35.00 D** |

```text
EV         = Σ(probability × sell_price) = 35.00 D
RTP        = 35.00 / 50 = 70%
House edge = 1 − 0.70 = 30%
```

Pity-система добавляет к EV около `+0.008 D` на спин (гарантия срабатывает крайне редко — нужно 50 спинов подряд без Epic+); итоговый house edge остаётся ≈ 30%.

Исходные цены можно вернуть в `backend/app/economy.py`, но тогда придётся менять стоимость спина или вероятности, иначе экономика станет прибыльной для игрока. При изменении цен на уже существующей базе нужно пересоздать volume или обновить `domains`.

### Стартовые условия

| Параметр | Значение |
|---|---:|
| Стартовый баланс | 1000 D |
| Спин | 50 D |
| Ежедневный бонус | 100 D / 24 ч |
| Pity-порог | 50 |
| Rate limit | 1 спин / 2 с на пользователя |
| Стартовый каталог | 200 доменов |

### Источники монет и стоки

- **Приход:** стартовый баланс, ежедневный бонус, продажа доменов.
- **Расход:** 50 D за спин.
- **Сток:** комиссия 30% в среднем за спин.
- **Коллекция:** непроданные домены формируют рейтинг, но не баланс.

Продажа удаляет домен из коллекции, поэтому игрок выбирает между монетами и местом в топе.

---

## База данных

```mermaid
erDiagram
    USERS ||--o{ SPINS : makes
    USERS ||--o{ INVENTORY : owns
    USERS ||--o{ SPIN_COMMITMENTS : prepares
    DOMAINS ||--o{ SPINS : dropped
    DOMAINS ||--o{ INVENTORY : stored
    SPIN_COMMITMENTS ||--o| SPINS : consumes

    USERS {
        int id PK
        bigint telegram_id UK
        varchar username
        varchar display_name
        varchar avatar_url
        int balance
        int pity_counter
        int total_spins
        timestamptz last_daily_bonus
        timestamptz created_at
        timestamptz updated_at
    }

    DOMAINS {
        int id PK
        varchar name
        varchar zone
        varchar rarity
        int weight
        int price
        timestamptz created_at
    }

    SPIN_COMMITMENTS {
        int id PK
        int user_id FK
        varchar server_seed
        varchar server_seed_hash
        varchar client_seed
        int nonce
        timestamptz created_at
        timestamptz used_at
    }

    SPINS {
        int id PK
        int commitment_id FK
        int user_id FK
        int domain_id FK
        varchar rarity
        varchar base_rarity
        varchar server_seed
        varchar server_seed_hash
        varchar client_seed
        int nonce
        int rarity_roll
        int domain_roll
        int domain_index
        int bucket_size
        bool pity_applied
        int price
        timestamptz created_at
    }

    INVENTORY {
        int id PK
        int user_id FK
        int domain_id FK
        timestamptz acquired_at
        timestamptz sold_at
        int sold_price
    }
```

Индексы:

- `users.telegram_id` — unique;
- `domains(name, zone)` — unique;
- `domains(rarity, id)` — выбор пула;
- `spin_commitments(user_id, nonce)`;
- `spins(user_id, created_at)`;
- `inventory(user_id, sold_at)`.

Уникальность `(name, zone)` гарантирует, что в каталоге нет двух одинаковых виртуальных доменов. Каждый домен привязан к одной зоне из `.ru`, `.com`, `.io`.

Таблицы создаются автоматически при старте (`Base.metadata.create_all`) и каталог сидируется 200 доменами. Для production рекомендуется заменить это на Alembic-миграции.

---

## API

База: `/api`. Авторизация: `Authorization: Bearer <JWT>`.

| Метод | Путь | Auth | Назначение |
|---|---|---|---|
| `POST` | `/auth/telegram` | нет | Проверка initData / dev-вход, выдача JWT |
| `GET` | `/me` | да | Профиль + статистика, pity, ранг, бонус |
| `GET` | `/domains` | да | Каталог 200 доменов, фильтры `zone`, `rarity` |
| `POST` | `/spin/prepare` | да | Commit: вернуть `sha256(server_seed)` |
| `POST` | `/spin` | да | Сделать спин (50 D), раскрыть seed |
| `GET` | `/inventory` | да | Непроданные домены, фильтры `zone`, `rarity` |
| `POST` | `/inventory/{id}/sell` | да | Продать домен |
| `GET` | `/leaderboard` | да | Топ-20 + своя позиция |
| `GET` | `/drops/recent` | да | HTTP-снимок последних 20 дропов |
| `WS` | `/drops/recent?token=JWT` | JWT | Live-лента через WebSocket |
| `GET` | `/verify/{spin_id}` | нет | Пересчёт и проверка спина |
| `POST` | `/verify` | нет | Пересчёт по сырым сидам (ручная форма) |
| `POST` | `/daily-bonus` | да | +100 D раз в 24 часа |
| `GET` | `/meta` | нет | Редкости, веса, цены, EV |
| `GET` | `/health` | нет | Статус БД и Redis |

### Пример спинов

```bash
# 1. Авторизация (в браузере dev-режима)
curl -X POST http://localhost:8000/api/auth/telegram \
  -H 'Content-Type: application/json' \
  -d '{"dev_user":{"id":900001,"username":"demo","first_name":"Demo"}}'

# 2. Commitment
curl -X POST http://localhost:8000/api/spin/prepare \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
# → {"commitment_id":1,"server_seed_hash":"...","client_seed":"...","nonce":1,...}

# 3. Спин
curl -X POST http://localhost:8000/api/spin \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"commitment_id":1}'
# → domain, rarity, server_seed, rolls, balance...
```

### Ошибки

| Код | Когда |
|---|---|
| `401` | Нет/просрочен JWT, неверный initData |
| `402` | Недостаточно монет для спина |
| `404` | Нет спина/домена в инвентаре |
| `409` | Commitment использован/устарел, домен уже продан |
| `429` | Rate limit спина или бонус уже получен |
| `503` | Redis/каталог недоступны |

`429` содержит заголовок `Retry-After`.

---

## Ключевые механики

### Авторизация Telegram

`initData` проверяется по официальной схеме:

```text
dataCheckString = "\n".join(sorted("key=value"))
secretKey       = HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN)
expectedHash    = HMAC_SHA256(secretKey, dataCheckString)
```

Дополнительно проверяется `auth_date` (не старше 24 часов и не в будущем). После успешной проверки выдаётся JWT на 7 дней.

`DEV_MODE=true` разрешает вход без initData. В production `DEV_MODE=false`.

### Rate limit

Redis:

```text
SET dropzone:spin:cooldown:{user_id} 1 NX EX 2
```

Если ключ уже есть — `429` с `Retry-After`. Ключ снимается при ошибке спина (кроме самого rate limit), чтобы неудачная попытка не блокировала игрока.

### Pity

- `pity_counter` увеличивается после каждого спина с редкостью ниже Epic.
- Сбрасывается в 0 при Epic/Epic+.
- Достигнув 50, следующий спин гарантированно Epic+.
- Факт срабатывания и базовая редкость сохраняются в спине.

### WebSocket

- Клиент подключается к `/api/drops/recent?token=<JWT>`.
- Сразу получает `{"type":"snapshot","drops":[...]}`.
- Дальше — `{"type":"drop","drop":{...}}` из Redis Pub/Sub (`dropzone:drops`).
- Клиент переподключается с экспоненциальной задержкой.
- Последние 20 дропов также доступны через HTTP.

### Звук и haptic

- `howler.js` проигрывает `tick.wav` при прокрутке; частота тиков замедляется вместе с лентой.
- `jackpot.wav` и вспышка — для Legendary/Mythic.
- `Telegram.WebApp.HapticFeedback` вызывается на старте, результате и особенно на Legendary/Mythic.
- Звук можно выключить кнопкой в шапке; выбор хранится в `localStorage`.

### Сиды

`backend/app/seed_data.py` содержит ровно 200 уникальных имён:

| Редкость | Кол-во | Длина |
|---|---:|---|
| Common | 120 | 8+ |
| Rare | 50 | 6–7 |
| Epic | 20 | 5 |
| Legendary | 7 | 3–4 |
| Mythic | 3 | 2 |

Зоны распределяются циклически `.ru → .com → .io`.

---

## Тесты

Бэкенд:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -q
```

Покрыто 11 тестами:

- HMAC-формула и детерминированность;
- границы весов редкостей;
- статистическое распределение на 30 000 роллов;
- pity-гарантия и счётчик;
- EV = 35, house edge = 30%;
- длины и уникальность 200 сидов;
- подпись Telegram initData, просрочка и подмена хеша;
- полный API-флоу: auth → prepare → spin → verify → inventory → sell → leaderboard → rate limit → pity → daily bonus.

Фронтенд:

```bash
cd frontend
pnpm install
pnpm typecheck
pnpm build
```

Production-сборка складывается в `frontend/dist`.

---

## Структура проекта

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, health
│   │   ├── config.py            # env settings
│   │   ├── database.py          # async engine/session
│   │   ├── models.py            # SQLAlchemy-модели
│   │   ├── schemas.py           # Pydantic-схемы
│   │   ├── economy.py           # веса, цены, EV
│   │   ├── seed.py              # идемпотентный сид
│   │   ├── seed_data.py         # 200 доменов
│   │   ├── security.py          # JWT dependency
│   │   ├── bot.py               # aiogram
│   │   ├── routers/             # auth, users, domains, spins, ...
│   │   └── services/
│   │       ├── fairness.py      # HMAC-математика
│   │       ├── telegram_auth.py # initData
│   │       ├── realtime.py      # WebSocket hub + Redis Pub/Sub
│   │       ├── redis_client.py
│   │       └── stats.py         # рейтинг
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/               # 6 экранов
│   │   ├── components/
│   │   ├── context/             # auth, sound, toast
│   │   ├── api/client.ts
│   │   └── lib/utils.ts         # редкости, форматирование
│   ├── public/sounds/           # tick / reveal / jackpot / coin
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Переменные окружения

| Переменная | Default | Описание |
|---|---|---|
| `APP_PORT` | `3000` | Порт Mini App на хосте |
| `BACKEND_PORT` | `8000` | Порт API на хосте |
| `POSTGRES_DB` | `roulette` | Имя БД |
| `POSTGRES_USER` | `roulette` | Пользователь БД |
| `POSTGRES_PASSWORD` | `roulette` | Пароль БД |
| `JWT_SECRET` | dev-значение | **Заменить в production** |
| `BOT_TOKEN` | пусто | Токен BotFather |
| `WEBAPP_URL` | `http://localhost:3000` | Публичный HTTPS URL для кнопки бота |
| `DEV_MODE` | `true` | Вход без Telegram initData |
| `ENVIRONMENT` | `development` | Окружение |
| `CORS_ORIGINS` | localhost:3000/5173 | Разрешённые origins |

### Локальная разработка без Docker

Нужны PostgreSQL и Redis.

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL=postgresql+asyncpg://roulette:roulette@localhost:5432/roulette
export REDIS_URL=redis://localhost:6379/0
uvicorn app.main:app --reload --port 8000

# frontend (второй терминал)
cd frontend
pnpm install
pnpm dev
```

Vite проксирует `/api` на `http://localhost:8000` и поддерживает WebSocket.

---

## Production checklist

- [ ] `JWT_SECRET` — случайный, не dev-значение.
- [ ] `DEV_MODE=false`.
- [ ] Публичный HTTPS для `WEBAPP_URL`.
- [ ] `BOT_TOKEN` задан, бот отвечает на `/start`.
- [ ] Postgres/Redis не торчат в интернет.
- [ ] Настроены бэкапы volume `pgdata`.
- [ ] Заменить `create_all` на Alembic-миграции.
- [ ] Ограничить `CORS_ORIGINS` реальным доменом.
- [ ] Добавить reverse-proxy rate limit для `/api/auth/telegram`.
- [ ] Проверить, что Telegram WebApp открывается на реальном устройстве.

Ограничения демо:

- один backend-контейнер (WebSocket hub живёт в процессе; мультиинстансы корректно работают через Redis Pub/Sub, но требуют настройки реплик);
- нет реальной интеграции с регистраторами доменов;
- нет платежей/вывода;
- `create_all` вместо миграций;
- JWT не отзывается (для демо достаточно короткого TTL).

---

## Troubleshooting

**Бот молчит.** Проверьте `BOT_TOKEN` и логи:
```bash
docker compose logs -f bot
```
Пустой токен — бот остаётся в ожидании, это ожидаемо.

**Telegram не открывает Mini App.** Нужен HTTPS. `WEBAPP_URL` должен совпадать с публичным адресом, а не `localhost`.

**Не работает вход в браузере.** Убедитесь, что `DEV_MODE=true` и backend healthy:
```bash
curl http://localhost:8000/api/health
```

**429 при спине.** Это rate limit: 1 спин / 2 секунды. Подождите и повторите.

**Недостаточно монет.** Заберите ежедневный бонус в профиле или продайте домен в инвентаре.

**Изменил цены, а в БД старые.** Каталог сидируется один раз. Удалите volume:
```bash
docker compose down -v
docker compose up --build
```

**WebSocket не подключается за прокси.** Прокси должен передавать `Upgrade`/`Connection`. Пример есть в `frontend/nginx.conf`.

---

## Лицензия и дисклеймер

Проект создан как демонстрационный продукт. Все домены, монеты, рейтинг и дропы виртуальны. Никакие реальные доменные имена не регистрируются, реальные деньги не принимаются и не выплачиваются.
