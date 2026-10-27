# DROP.ZONE

**Telegram Mini App — рулетка виртуальных доменов.**  
100 500 уникальных доменов, четыре зоны, индивидуальные цены, пять типов рулеток, автопродажа, массовая продажа и мультивыбор в апгрейдере.

> Все домены вымышленные. Приложение не регистрирует реальные имена, не принимает платежи, не использует реальные деньги и не поддерживает ставки.

![Рулетка](docs/screenshots/roulette.png)

## Содержание

- [Быстрый старт](#быстрый-старт)
- [GitHub Codespaces](#github-codespaces)
- [Каталог доменов](#каталог-доменов)
- [Рулетки](#рулетки)
- [Экономика и EV](#экономика-и-ev)
- [Автопродажа](#автопродажа)
- [Массовая продажа](#массовая-продажа)
- [Апгрейдер](#апгрейдер)
- [Палитра и интерфейс](#палитра-и-интерфейс)
- [Архитектура](#архитектура)
- [API](#api)
- [База данных](#база-данных)
- [Тесты](#тесты)
- [Переменные окружения](#переменные-окружения)
- [Production checklist](#production-checklist)
- [Источники словарей](#источники-словарей)

---

## Быстрый старт

Нужен Docker Compose v2.

```bash
cd C:\siteharnesstest
docker compose up --build
```

Первый запуск генерирует и записывает **100 500 доменов** в PostgreSQL. На обычном ноутбуке это занимает 10–30 секунд; backend в это время ещё не принимает запросы.

| Что | URL |
|---|---|
| Mini App | http://localhost:3000 |
| API | http://localhost:8000/api |
| Swagger | http://localhost:8000/api/docs |
| Health | http://localhost:8000/api/health |

Для браузера `DEV_MODE=true` включает demo-вход без Telegram. Внутри Telegram вход идёт через подписанный `initData`.

Остановка:

```bash
docker compose down          # сохранить базу
docker compose down -v       # удалить и пересоздать базу
docker compose up -d --build # пересобрать и запустить в фоне
```

### Telegram

1. Создайте бота у [@BotFather](https://t.me/BotFather).
2. Mini App должен открываться по публичному HTTPS.
3. Заполните `.env`:

```dotenv
BOT_TOKEN=123456789:AA...
WEBAPP_URL=https://ваш-публичный-https-адрес
DEV_MODE=false
ENVIRONMENT=production
JWT_SECRET=<случайная-строка>
```

4. Перезапустите:

```bash
docker compose up -d --force-recreate
```

5. Отправьте боту `/start` и нажмите **«Открыть DROP.ZONE»**.

`WEBAPP_URL` — это адрес **самого Mini App**, а не API. Без HTTPS Telegram не откроет приложение.

---

## GitHub Codespaces

В репозитории есть `.devcontainer/devcontainer.json` с Docker-in-Docker и проброшенными портами.

1. Загрузите проект в приватный GitHub-репозиторий.
2. **Code → Codespaces → Create codespace on main**.
3. В терминале:

```bash
cp .env.example .env
docker compose up -d --build
```

4. В панели **Ports** сделайте порт **3000** публичным:

```text
Port Visibility → Public
```

5. Получите адрес вида:

```text
https://ваш-codespace-3000.app.github.dev
```

6. Пропишите его в `.env` как `WEBAPP_URL`, добавьте `BOT_TOKEN`, поставьте `DEV_MODE=false`.
7. Перезапустите:

```bash
docker compose up -d --force-recreate
```

Codespaces подходит для теста, но не для постоянного хостинга: при простое среда останавливается, а удаление Codespace удаляет Docker volumes.

---

## Каталог доменов

При первом запуске создаётся **100 500 доменов** в зонах `.ru`, `.com`, `.io`, `.xyz`.

Сидер использует:

- 5 000 английских слов;
- 2 000 русских слов с транслитерацией;
- комбинации «слово + слово»;
- слова с цифрами;
- случайные строки;
- дефисные формы;
- палиндромы и повторы.

Файлы словарей лежат в `backend/app/data/`.

### Формула цены

```text
price = zone × length × readability × pattern × jitter
```

| Фактор | Значение |
|---|---|
| `zone` | `.com` = 100 · `.io` = 30 · `.ru` = 5 · `.xyz` = 0.3 |
| `length` | 2 = 5000 · 3 = 1000 · 4 = 300 · 5 = 100 · 6 = 30 · 7+ = 1 |
| `readability` | словарное слово = 50 · читаемая комбинация = 5 · мусор = 0.1 |
| `pattern` | палиндром = 20 · все символы одинаковые = 15 · дефис+цифры = 0.05 · иначе 1 |
| `jitter` | случайно 0.7…1.3 |

Цена округляется до целых монет и не может быть меньше 1.

Семь референсных доменов закреплены с точными ценами из ТЗ:

| Домен | Цена | Редкость |
|---|---:|---|
| `google.com` | 1 100 000 | Mythic |
| `microsoft.com` | 1 000 000 | Mythic |
| `neo.com` | 250 000 | Mythic |
| `ai.io` | 80 000 | Legendary |
| `vector.ru` | 5 000 | Epic |
| `pixelhub.io` | 1 200 | Epic |
| `lg-shd9uga.xyz` | 10 | Common |

Остальные цены вычисляются генератором и различаются даже внутри одной редкости.

### Редкость

| Цена | Редкость |
|---:|---|
| `< 100` | Common |
| `100–999` | Rare |
| `1 000–9 999` | Epic |
| `10 000–99 999` | Legendary |
| `100 000+` | Mythic |

### Вес в рулетке

```text
weight = 1 / log10(price + 10)
```

Чем дороже домен, тем реже он выпадает. Вес хранится в `domains.weight`.

Примерное распределение сгенерированного каталога:

| Редкость | Количество |
|---|---:|
| Common | 54 251 |
| Rare | 35 622 |
| Epic | 4 636 |
| Legendary | 3 577 |
| Mythic | 2 414 |

---

## Рулетки

| Тип | Пул | Стоимость |
|---|---|---:|
| Обычная | все редкости | 50 D |
| Необычная+ | Rare, Epic, Legendary, Mythic | 200 D |
| Редкая+ | Epic, Legendary, Mythic | 800 D |
| Эпическая+ | Legendary, Mythic | 3 000 D |
| Мифическая | только Mythic | 20 000 D |

Сервер фильтрует пул и делает взвешенный выбор по `weight`.

---

## Экономика и EV

### Две цены домена

У домена есть:

- **оценка** — индивидуальная рыночная цена (`domains.price`);
- **мгновенный выкуп** — сколько монет реально зачисляется при продаже.

Выкуп зависит от редкости:

| Редкость | Курс выкупа |
|---|---:|
| Common | 100% |
| Rare | 25% |
| Epic | 4% |
| Legendary | 0.5% |
| Mythic | 0.1% |

Это сделано осознанно. Если платить полную оценку, рулетки математически не смогут иметь EV ниже стоимости спина: например, Mythic-спин за 20 000 D гарантированно приносит домен дороже 100 000 D. Пришлось бы либо поднимать цену Mythic-спина до сотен тысяч, либо вводить шанс пустого спина. Вместо этого сохранены:

- все индивидуальные оценки доменов;
- ровно 100 500 доменов;
- указанные стоимости спинов;
- гарантированный домен за каждый спин.

А экономика сбалансирована через курс мгновенного выкупа.

### EV рулеток

Расчёт по сгенерированному пулу, весам и выкупу:

| Рулетка | Стоимость | EV выкупа | RTP | House edge |
|---|---:|---:|---:|---:|
| Обычная | 50 | **42.78** | 85.6% | 14.4% |
| Необычная+ | 200 | **133.12** | 66.6% | 33.4% |
| Редкая+ | 800 | **420.14** | 52.5% | 47.5% |
| Эпическая+ | 3 000 | **715.10** | 23.8% | 76.2% |
| Мифическая | 20 000 | **1 784.04** | 8.9% | 91.1% |

Условие **EV < цены спина** выполнено для всех пяти типов. Дорогие рулетки — это инструмент охоты за коллекционными доменами, а не источник быстрых монет.

### Апгрейдер

| Сектор | Множитель | EV в оценке |
|---:|---:|---:|
| 10% | ×9 | 0.900 |
| 25% | ×3.75 | 0.9375 |
| 50% | ×1.9 | 0.950 |
| 75% | ×1.2 | 0.900 |

Точный шанс генерируется сервером внутри сектора: например, 50% → 50.00…50.99%. Множитель определяется сектором, а не точным процентом. EV каждого сектора меньше 1.

---

## Автопродажа

Экран **Настройки → Автопродажа** (`/settings`).

Правила:

- продавать Common;
- продавать Rare;
- продавать Epic;
- продавать Legendary;
- продавать Mythic;
- продавать всё, если **оценка** ниже заданной цены.

После спина сервер проверяет настройки. Если домен подходит:

1. он не попадает в инвентарь;
2. на баланс зачисляется мгновенный выкуп;
3. в ответе спина приходит `auto_sold: true` и `auto_sold_price`;
4. в UI появляется уведомление об автопродаже.

API:

```http
GET /api/settings/autosell
PUT /api/settings/autosell
```

---

## Массовая продажа

В инвентаре:

- чекбоксы на карточках;
- «Выбрать все»;
- «Выбрать все Common»;
- «Выбрать до 100 D»;
- «Сбросить»;
- панель «Продать выбранные (N) → +X D»;
- модалка подтверждения.

```http
POST /api/inventory/sell-bulk
{ "ids": [12, 15, 19] }

→ { "sold": 3, "earned": 240, "balance": 1240, "ids": [...] }
```

Все выбранные домены проверяются на владельца и непроданность в одной транзакции.

---

## Апгрейдер

Экран `/upgrader`.

- можно выбрать от 1 до 50 доменов;
- стоимости складываются;
- слайдер секторов: 10 / 25 / 50 / 75%;
- точный шанс выбирает сервер;
- при успехе создаётся домен с оценкой около `сумма × множитель` (±20%);
- целевой домен выбирается из пула подходящей редкости;
- если цель дороже максимального Mythic, создаётся новый Mythic-домен;
- при провале **все** выбранные домены сгорают;
- Mythic-домены тоже можно улучшать.

```http
POST /api/upgrade
{
  "domain_ids": [4, 8, 15],
  "chance_sector": 50
}
```

Таблица `upgrades` хранит массив исходных ID, целевой домен, точный шанс, множитель и результат.

---

## Палитра и интерфейс

Тёмная сдержанная тема:

| Роль | Цвет |
|---|---|
| Фон | `#14161A` |
| Карточки | `#1E2128` |
| Основной текст | `#E6E8EB` |
| Вторичный текст | `#9AA0A8` |
| Акцент | `#6C8EBF` |
| Common | `#8A8F98` |
| Rare | `#5B8FB9` |
| Epic | `#8E6BB5` |
| Legendary | `#C9884A` |
| Mythic | `#B5545B` |

Без кислотных цветов, неоновых свечений и полноэкранных вспышек. Скругления 12–16 px, мягкие тени, короткие ease-анимации.

### Скриншоты

| Профиль | Инвентарь | Апгрейдер |
|---|---|---|
| ![Профиль](docs/screenshots/profile.png) | ![Инвентарь](docs/screenshots/inventory.png) | ![Апгрейдер](docs/screenshots/upgrader.png) |

| Автопродажа | Лента дропов | Рейтинг |
|---|---|---|
| ![Настройки](docs/screenshots/settings.png) | ![Дропы](docs/screenshots/drops.png) | ![Рейтинг](docs/screenshots/leaderboard.png) |

---

## Архитектура

```text
Telegram WebView
      │ initData (HMAC-SHA256)
      ▼
┌───────────────────────────────┐
│ frontend: React + TypeScript  │
│ Vite + Tailwind + framer      │
│ nginx: SPA + /api + WebSocket │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ backend: FastAPI              │
│ auth · spin · inventory       │
│ settings · upgrades · drops   │
│ SQLAlchemy async              │
│  ├─ PostgreSQL                │
│  └─ Redis                     │
│      • rate limit 1 spin / 2s │
│      • Pub/Sub для дропов     │
└──────────────┬────────────────┘
               │
        ┌──────┴────────┐
        ▼               ▼
   aiogram bot      WebSocket clients
```

Сервисы Compose:

- `db` — PostgreSQL 16;
- `redis` — Redis 7;
- `backend` — FastAPI/Uvicorn;
- `bot` — aiogram 3, polling;
- `frontend` — nginx + React build.

Серверный RNG используется внутри API. Seed-хеши и страница проверки удалены из интерфейса и API.

---

## API

База: `/api`. Авторизация: `Authorization: Bearer <JWT>`.

| Метод | Путь | Auth | Назначение |
|---|---|---|---|
| `POST` | `/auth/telegram` | нет | initData / dev-вход, JWT |
| `GET` | `/me` | да | Профиль и статистика |
| `GET` | `/meta` | нет | Типы рулеток, редкости, курсы выкупа |
| `GET` | `/domains` | да | Постраничный каталог |
| `GET` | `/domains/feed` | да | Случайная лента для анимации |
| `POST` | `/spin` | да | Спин `{ "roll_type": "normal" }` |
| `GET` | `/inventory` | да | Непроданные домены |
| `POST` | `/inventory/{id}/sell` | да | Одиночная продажа |
| `POST` | `/inventory/sell-bulk` | да | Массовая продажа |
| `GET` | `/settings/autosell` | да | Настройки автопродажи |
| `PUT` | `/settings/autosell` | да | Сохранить автопродажу |
| `POST` | `/upgrade` | да | Апгрейд доменов |
| `GET` | `/leaderboard` | да | Топ-20 + своя позиция |
| `GET` | `/drops/recent` | да | HTTP-снимок дропов |
| `WS` | `/drops/recent?token=JWT` | JWT | Live-лента |
| `POST` | `/daily-bonus` | да | +100 D раз в 24 ч |
| `GET` | `/health` | нет | Статус БД/Redis |

### Пример спина

```bash
curl -X POST http://localhost:8000/api/spin \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"roll_type":"normal"}'
```

Ответ:

```json
{
  "id": 42,
  "roll_type": "normal",
  "domain": { "full_name": "vector.ru", "price": 5000, "sell_price": 200, "rarity": "epic" },
  "price": 5000,
  "sell_price": 200,
  "balance": 950,
  "auto_sold": false,
  "auto_sold_price": null
}
```

Ошибки:

| Код | Когда |
|---|---|
| `401` | Нет/просрочен JWT |
| `402` | Недостаточно монет |
| `409` | Домен уже продан / не принадлежит |
| `422` | Неверный тип рулетки, сектор или пустой список |
| `429` | Rate limit спина или бонус уже получен |
| `503` | Redis/пул недоступны |

---

## База данных

```mermaid
erDiagram
    USERS ||--o{ SPINS : makes
    USERS ||--o{ INVENTORY : owns
    USERS ||--|| USER_SETTINGS : has
    USERS ||--o{ UPGRADES : performs
    DOMAINS ||--o{ SPINS : dropped
    DOMAINS ||--o{ INVENTORY : stored
    DOMAINS ||--o{ UPGRADES : target

    USERS {
        int id PK
        bigint telegram_id UK
        varchar username
        varchar display_name
        varchar avatar_url
        bigint balance
        int total_spins
        timestamptz last_daily_bonus
        timestamptz created_at
    }

    DOMAINS {
        int id PK
        varchar name
        varchar zone
        varchar rarity
        bigint price
        double weight
        boolean is_available
        timestamptz created_at
    }

    SPINS {
        int id PK
        int user_id FK
        int domain_id FK
        varchar roll_type
        varchar rarity
        bigint price
        boolean auto_sold
        bigint auto_sold_price
        timestamptz created_at
    }

    INVENTORY {
        int id PK
        int user_id FK
        int domain_id FK
        timestamptz acquired_at
        timestamptz sold_at
        bigint sold_price
    }

    USER_SETTINGS {
        int user_id PK
        boolean autosell_common
        boolean autosell_rare
        boolean autosell_epic
        boolean autosell_legendary
        boolean autosell_mythic
        bigint autosell_below_price
    }

    UPGRADES {
        int id PK
        int user_id FK
        bigint_array from_domain_ids
        int to_domain_id FK
        numeric chance
        numeric multiplier
        boolean success
        timestamptz created_at
    }
```

Индексы:

- `domains(name, zone)` — unique;
- `domains(is_available, rarity)`;
- `domains(price)`;
- `inventory(user_id, sold_at)`;
- `spins(user_id, created_at)`;
- `upgrades(user_id, created_at)`.

### Обновление старой базы

В `backend/app/migrations.py` есть идемпотентные `ALTER TABLE` для старого Docker volume: новые поля добавляются, старые 200 доменов убираются из пула, затем создаётся новый каталог. Для чистой установки:

```bash
docker compose down -v
docker compose up --build
```

---

## Тесты

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -q
```

Покрыто:

- 5 000 английских и 2 000 русских словарных строк;
- генерация 100 500 уникальных доменов;
- все четыре зоны;
- формула цены и границы редкостей;
- вес `1 / log10(price + 10)`;
- точные референсные цены;
- EV всех пяти рулеток < стоимости;
- отрицательный EV секторов апгрейда;
- полный API flow: вход → спин → rate limit → автоселл → инвентарь → массовая продажа → апгрейд → рейтинг.

Текущий прогон: **12 passed**.

Frontend:

```bash
cd frontend
pnpm install
pnpm typecheck
pnpm build
```

---

## Переменные окружения

| Переменная | Default | Описание |
|---|---|---|
| `APP_PORT` | `3000` | Порт Mini App |
| `BACKEND_PORT` | `8000` | Порт API |
| `POSTGRES_DB` | `roulette` | БД |
| `POSTGRES_USER` | `roulette` | Пользователь БД |
| `POSTGRES_PASSWORD` | `roulette` | Пароль БД |
| `JWT_SECRET` | dev | Заменить в production |
| `BOT_TOKEN` | пусто | Токен BotFather |
| `WEBAPP_URL` | localhost | Публичный HTTPS Mini App |
| `DEV_MODE` | `true` | Вход без Telegram |
| `ENVIRONMENT` | `development` | Окружение |
| `CORS_ORIGINS` | localhost | Разрешённые origins |

---

## Production checklist

- [ ] `DEV_MODE=false`
- [ ] Сильный `JWT_SECRET`
- [ ] Публичный HTTPS для `WEBAPP_URL`
- [ ] `BOT_TOKEN` действителен
- [ ] Postgres и Redis не открыты наружу
- [ ] Бэкапы volume `pgdata`
- [ ] Alembic вместо `create_all` при дальнейшем развитии
- [ ] Проверка Mini App на реальном телефоне
- [ ] Codespaces используется только для теста, не как постоянный хостинг

---

## Источники словарей

- English frequency list: [first20hours/google-10000-english](https://github.com/first20hours/google-10000-english)
- Russian frequency list: [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)

Из источников отобраны 5 000 английских и 2 000 русских слов. Русские слова транслитерируются в латиницу для доменных имён. В репозитории хранятся уже подготовленные списки `backend/app/data/words_en.txt` и `words_ru.txt`.

---

## Дисклеймер

DROP.ZONE — демонстрационный виртуальный продукт. Все домены, монеты, дропы и рейтинг существуют только внутри приложения. Реальные регистрации доменов, платежи, ставки и вывод средств отсутствуют.
