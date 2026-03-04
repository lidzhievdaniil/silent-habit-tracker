# SILENT Habit Tracker

Telegram Mini App для трекинга привычек с ежедневными напоминаниями.

## Технологии

**Frontend:** Чистый HTML/CSS/JS (index.html)
**Backend:** Node.js + Express + grammy (Telegram Bot) + pg (PostgreSQL)
**База данных:** PostgreSQL на Supabase (free tier)
**Хостинг:** Render Starter ($7/мес)

## Структура проекта

```
silent-habit-tracker/
├── index.html          # Frontend (Mini App) — весь UI в одном файле
├── CLAUDE.md           # Этот файл
└── backend/
    ├── index.js        # Express сервер + все API endpoints
    ├── bot.js          # Telegram Bot (grammy)
    ├── scheduler.js    # Cron-задача для напоминаний (каждую минуту)
    ├── db.js           # PostgreSQL (pg) — habits, completions, reminders
    ├── .env            # Конфигурация (BOT_TOKEN, WEBAPP_URL, DATABASE_URL)
    └── package.json
```

## Расположение файлов

**ВАЖНО:** Основная рабочая копия — на D:\.
- `d:\Даня\Claude Code project\silent-habit-tracker\` — **основная** (привязана к GitHub)
- `C:\Users\lidgi_1kxoeqc\silent-habit-tracker\` — устаревшая копия (не использовать)

Все изменения делать на **D:\** и пушить отсюда.

## GitHub

- **Репозиторий:** https://github.com/lidzhievdaniil/silent-habit-tracker
- **Статус:** публичный

## Конфигурация

**backend/.env (локально) / Render Environment Variables:**
```
BOT_TOKEN=<токен от @BotFather>
WEBAPP_URL=<URL сервиса на Render>
DATABASE_URL=<Supabase Transaction Pooler connection string>
PORT=3000
```

**Supabase:**
- Project ID: `ogynpxsxcadpxmyahthh`
- Подключение через Transaction Pooler (порт 6543) — IPv4, работает с Render
- URL формат: `postgresql://postgres.ogynpxsxcadpxmyahthh:ПАРОЛЬ@aws-0-....pooler.supabase.com:6543/postgres`

## База данных — схема

```sql
CREATE TABLE habits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE completions (
    user_id BIGINT NOT NULL,
    habit_id BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL,
    PRIMARY KEY (user_id, habit_id, completed_date)
);

CREATE TABLE reminders (
    user_id BIGINT PRIMARY KEY,
    reminder_time TEXT NOT NULL,
    timezone TEXT DEFAULT 'Europe/Moscow',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Таблицы создаются автоматически при старте сервера (`initDb()`).

## API Endpoints

Все endpoints (кроме /health) требуют заголовок `X-Telegram-Init-Data`.

**Привычки:**
- `GET /api/habits` — список привычек пользователя
- `POST /api/habits` — создать привычку `{name, emoji}`
- `DELETE /api/habits/:id` — удалить привычку (cascade на completions)

**Выполнение:**
- `GET /api/completions?from=YYYY-MM-DD&to=YYYY-MM-DD` — история выполнения
- `POST /api/completions` — отметить/снять `{habit_id, date, completed}`

**Напоминания:**
- `GET /api/reminder` — настройки напоминания
- `POST /api/reminder` — сохранить `{reminder_time: "HH:MM"}`
- `DELETE /api/reminder` — удалить напоминание

**Служебное:**
- `GET /health` — проверка работоспособности

## Telegram Bot

- **Username:** @SilentHabitBot
- **User ID владельца:** 609511513
- Команды: `/start`, `/help`, `/deletedata`
- Команды зарегистрированы через `setMyCommands()` — видны в меню "/"
- При 409 Conflict (деплой) — автоматический retry до 5 раз с интервалом 10s
- Напоминания автоудаляются из чата через 45 мин (`deletionQueue` в scheduler.js)

## Функциональность frontend (index.html)

### Основные функции
- Добавление/удаление привычек с эмодзи-иконками (32 эмодзи)
- Удаление с подтверждением через `tg.showConfirm` (нативный Telegram диалог)
- Отметка выполнения с анимацией и фейерверками (оптимистичный UI)
- Недельный обзор с кружками дней (выполнено/частично/сегодня — совмещённые стили)
- Статистика: прогресс за день, максимальный стрик
- Настройка напоминаний (время в МСК, вкл/выкл)
- Haptic feedback через Telegram WebApp API
- Русский интерфейс, дата на русском

### Хранение данных
- **Привычки:** PostgreSQL на сервере (sync при каждом действии)
- **Выполнение:** PostgreSQL на сервере (последние 30 дней загружаются при старте)
- **Тема:** `localStorage` ключ `silent_theme` (только визуальная настройка)
- **Напоминания:** PostgreSQL на сервере

### Архитектура загрузки данных
При открытии приложения:
1. Показывается "Загрузка..."
2. Параллельно: `GET /api/habits` + `GET /api/completions?from=30_дней_назад&to=сегодня`
3. Данные нормализуются: `id` → Number, `emoji` → `icon`
4. Рендер всего UI

Все действия (добавить/удалить привычку, отметить выполнение) — **оптимистичный UI**: интерфейс обновляется мгновенно, запрос на сервер идёт в фоне.

### Система тем

Реализовано 3 цветовые темы с плавным переключением:

| Тема | Переменная | Фон | Текст | Акцент |
|------|-----------|-----|-------|--------|
| **Dark** (по умолчанию) | `dark` | `#000000` | `#ffffff` | iOS Blue `#007AFF` |
| **Light** | `light` | `#ffffff` | `#1c1c1e` | iOS Blue `#007AFF` |
| **Warm** (Claude/e-reader) | `warm` | `#FAF6F0` | `#2D2B27` | Amber `#C07D4F` |

- CSS переменные на `html[data-theme="..."]`
- Inline скрипт в `<head>` читает localStorage до рендера (нет мигания)
- 3 точки (`.theme-dot`) в левом верхнем углу

## Хостинг

### Статус: РАБОТАЕТ ✅

- **Render Starter** ($7/мес) — сервер не засыпает
- **Supabase** (free) — PostgreSQL база данных
- Автодеплой при пуше в `main` ветку GitHub

### Для локального тестирования

1. `cd backend && npm install && node index.js`
2. `cloudflared tunnel --url http://localhost:3000`
3. Обновить WEBAPP_URL в .env на новый URL туннеля
4. Или просто открыть index.html в браузере (без Telegram API — данные не сохранятся)

## Архитектура

- Frontend раздается через backend (`express.static` из корня проекта)
- `API_URL` в index.html — пустая строка (same origin)
- Backend валидирует Telegram initData через HMAC-SHA256
- Scheduler (node-cron) проверяет напоминания каждую минуту
- Часовой пояс по умолчанию: Europe/Moscow
- `pg.Pool` — connection pooling к Supabase

## Критические паттерны — НЕ НАРУШАТЬ

### Даты: только локальное время
**НИКОГДА** не использовать `date.toISOString().split('T')[0]` для ключей дат — возвращает UTC, ломает данные у пользователей UTC+3 после 21:00.

Всегда использовать хелпер `toLocalDateKey(d)`:
```javascript
function toLocalDateKey(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
```
Применяется в: `getTodayKey()`, `getDateBefore()`, `updateStreaks()`, `renderWeekView()`.

PostgreSQL `DATE` тип — timezone-independent, серверная сторона не затронута.

## Безопасность — текущее состояние

### Что уже защищено ✅
- **Telegram initData** — HMAC-SHA256 валидация на каждом API endpoint
- **SQL injection** — параметризованные запросы (`pg` placeholders `$1, $2...`)
- **Secrets** — BOT_TOKEN, DATABASE_URL только в `.env` / Render env vars (не в git)
- **User isolation** — каждый endpoint фильтрует данные по `user_id` из initData
- **Право на удаление** — `/deletedata` команда (GDPR/152-ФЗ)

### Известные уязвимости / технический долг 🔴
- **Supabase RLS отключён** — Row Level Security не настроен. При утечке `DATABASE_URL` все данные всех пользователей доступны напрямую. Единственная защита — backend валидация.
- **Нет rate limiting** — API не защищён от спама/brute-force (нет `express-rate-limit`)
- **Input validation на сервере слабая** — длина name/emoji привычки не ограничена на сервере (только UI)
- **Нет Privacy Policy** — обязательно для публичного запуска (152-ФЗ РФ, GDPR EU)
- **`/health` endpoint** — публичный, раскрывает что сервер жив (minor)

### Что проверить перед публичным запуском
- `git log --all --full-history -- backend/.env` — убедиться что .env никогда не попадал в историю
- Проверить `.gitignore` содержит `backend/.env` и `node_modules/`
- Проверить Render env vars: нет лишних переменных

## TODO

- [x] Добавить систему тем (dark/light/warm)
- [x] Задеплоить на Render (Starter plan)
- [x] Перенести все данные пользователя на сервер (PostgreSQL/Supabase)
- [x] Исправить 409 Conflict при деплое бота
- [x] Критические UI/UX баги:
  - UTC→Local date fix (toLocalDateKey хелпер)
  - Week view: today-кружок всегда виден + совмещённые стили today+completed/partial
  - Удаление привычки с подтверждением (tg.showConfirm)
  - Тайм-пикер: border + подпись "по московскому времени (МСК)"
- [x] Визуальный polish:
  - Активная тема-точка: scale(1.15)
  - Empty state через CSS класс `.habits-empty`
  - Hover-стили для карточек привычек (`.habit-card:hover`, `.habit-card.completed:hover`)
- [x] Добавить `/deletedata` команду в бота (право на удаление данных, 152-ФЗ/GDPR)
- [x] Автоудаление напоминаний из чата через 45 мин (deletionQueue в scheduler.js)
- [x] Прокрутка времени в стиле iOS Clock в разделе напоминаний (CSS scroll snap drum picker)

### 🔴 Критично (безопасность) — до публичного запуска
- [x] **Включить Supabase RLS** — политики на таблицах habits/completions/reminders (защита от утечки DATABASE_URL)
- [x] **Rate limiting** — добавить `express-rate-limit` на API endpoints (защита от спама)
- [x] **Валидация входных данных на сервере** — ограничить длину name (макс 100 символов), проверять допустимые emoji
- [ ] **Privacy Policy** — написать и разместить (152-ФЗ / GDPR), добавить ссылку в бота
- [ ] **Аудит git-истории** — проверить что секреты никогда не попадали в репозиторий

### Обычные задачи
- [ ] Улучшить UI/UX перед публичным запуском (оставшиеся шероховатости)
- [ ] Рассмотреть Liquid Glass эффекты (backdrop-filter: blur)
- [ ] Продумать систему целей: большая цель → ежедневные привычки как путь к ней (пока без реализации)
- [ ] Добавить аналитику при росте до 500+ MAU (рассмотреть PostHog self-hosted)
