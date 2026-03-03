# SILENT Habit Tracker

Telegram Mini App для трекинга привычек с ежедневными напоминаниями.

## Технологии

**Frontend:** Чистый HTML/CSS/JS (index.html, ~1593 строки)
**Backend:** Node.js + Express + grammy (Telegram Bot) + sql.js (SQLite)

## Структура проекта

```
silent-habit-tracker/
├── index.html          # Frontend (Mini App) — весь UI в одном файле
├── CLAUDE.md           # Этот файл
└── backend/
    ├── index.js        # Express сервер + API + раздача статики
    ├── bot.js          # Telegram Bot (grammy)
    ├── scheduler.js    # Cron-задача для напоминаний (каждую минуту)
    ├── db.js           # SQLite база данных (sql.js)
    ├── .env            # Конфигурация (BOT_TOKEN, WEBAPP_URL)
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

**backend/.env:**
```
BOT_TOKEN=<токен от @BotFather>
WEBAPP_URL=<публичный HTTPS URL сервиса на Render>
PORT=3000
```

## API Endpoints

- `GET /health` — проверка работоспособности
- `GET /api/reminder` — получить настройки напоминания (требует auth)
- `POST /api/reminder` — сохранить напоминание `{reminder_time: "HH:MM"}` (требует auth)
- `DELETE /api/reminder` — удалить напоминание (требует auth)

Аутентификация: заголовок `X-Telegram-Init-Data` с initData от Telegram WebApp.

## Telegram Bot

- **Username:** @SilentHabitBot
- **User ID владельца:** 609511513
- Команды: `/start`, `/help`

## Функциональность frontend (index.html)

### Основные функции
- Добавление/удаление привычек с эмодзи-иконками (32 эмодзи)
- Отметка выполнения привычек с анимацией и фейерверками
- Недельный обзор с кружками дней (выполнено/частично/сегодня)
- Статистика: прогресс за день, максимальный стрик
- Настройка напоминаний (время, вкл/выкл)
- Haptic feedback через Telegram WebApp API
- Русский интерфейс, дата на русском

### Хранение данных
- **Привычки:** `localStorage` ключ `silent_habits`
- **Выполнение:** `localStorage` ключ `silent_completed`
- **Тема:** `localStorage` ключ `silent_theme`
- **Напоминания:** SQLite на сервере (backend/db.js)

### Система тем (ДОБАВЛЕНО)

Реализовано 3 цветовые темы с плавным переключением:

| Тема | Переменная | Фон | Текст | Акцент |
|------|-----------|-----|-------|--------|
| **Dark** (по умолчанию) | `dark` | `#000000` | `#ffffff` | iOS Blue `#007AFF` |
| **Light** | `light` | `#ffffff` | `#1c1c1e` | iOS Blue `#007AFF` |
| **Warm** (Claude/e-reader) | `warm` | `#FAF6F0` | `#2D2B27` | Amber `#C07D4F` |

**Как работает:**
- CSS переменные на `html[data-theme="..."]` — переопределяются все 14+ цветовых переменных
- Inline скрипт в `<head>` читает `localStorage('silent_theme')` и ставит `data-theme` на `<html>` до рендера (предотвращает мигание)
- Функция `setTheme(theme)` переключает тему с плавной анимацией (350мс через класс `.theme-transition`)
- Haptic feedback при переключении

**UI переключения:**
- 3 круглые точки (`.theme-dot`) в левом верхнем углу контейнера
- Зеркально кнопке напоминаний (колокольчик) в правом верхнем углу
- Каждая точка окрашена в цвет своей темы
- Активная тема обведена кольцом акцентного цвета (`outline`)

**CSS переменные каждой темы:**
```
--bg-primary, --bg-secondary, --bg-card, --bg-card-hover
--text-primary, --text-secondary, --text-muted
--accent, --accent-glow
--success, --success-glow
--streak-start, --streak-end
--border, --danger
--modal-overlay-bg, --card-shadow
```

**Дополнительные эффекты:**
- `--card-shadow` — тени карточек в светлых темах (в dark = none)
- `--modal-overlay-bg` — адаптивная прозрачность оверлея модальных окон
- Glass-inspired box-shadow на `.stats-bar` и `.week-view` в light/warm темах
- Класс `html.theme-transition` включает transition на все элементы только при клике (не при загрузке)

## Хостинг — ТЕКУЩАЯ ПРОБЛЕМА

### Статус: НЕ РАБОТАЕТ

**Причина:** В `backend/.env` указан мертвый URL Cloudflare quick tunnel:
```
WEBAPP_URL=https://push-andy-paragraphs-attachment.trycloudflare.com
```
Это временный URL от `cloudflared tunnel --url http://localhost:3000`. Он живет только пока процесс cloudflared запущен. Сейчас туннель не запущен — URL мертв — Mini App не открывается в Telegram.

### Что нужно сделать для запуска

**Рекомендуемый вариант — Render Starter ($7/мес):**

1. Зайти на https://dashboard.render.com
2. New → Web Service → подключить репозиторий `lidzhievdaniil/silent-habit-tracker`
3. Настройки:
   - **Name:** silent-habit-tracker
   - **Region:** Frankfurt (EU) или Oregon (US)
   - **Branch:** main
   - **Root Directory:** (оставить пустым)
   - **Runtime:** Node
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && node index.js`
   - **Plan:** Starter ($7/мес) — НЕ Free (Free засыпает через 15 мин)
4. Environment Variables:
   - `BOT_TOKEN` = токен бота из @BotFather
   - `WEBAPP_URL` = URL сервиса на Render (например `https://silent-habit-tracker.onrender.com`)
   - `PORT` = `3000`
5. Deploy
6. После деплоя обновить в @BotFather → Bot Settings → Menu Button URL → URL Render сервиса
7. Обновить `backend/.env` локально: `WEBAPP_URL=https://silent-habit-tracker.onrender.com`

**Альтернативы:**
- Hetzner/DigitalOcean VPS (~$4-6/мес) — нужна настройка nginx, pm2, SSL
- Railway ($5/мес + usage) — простой деплой, но непредсказуемые счета
- Free Render + keep-alive пинги — ненадежно, Render блокирует

### Для локального тестирования

1. `cd backend && npm install && node index.js`
2. `cloudflared tunnel --url http://localhost:3000`
3. Обновить WEBAPP_URL в .env на новый URL туннеля
4. Или просто открыть index.html в браузере (без Telegram API)

## Архитектура

- Frontend раздается через backend (`express.static` из корня проекта)
- `API_URL` в index.html пустой строкой (same origin)
- Backend валидирует Telegram initData через HMAC-SHA256
- Scheduler (node-cron) проверяет напоминания каждую минуту
- Часовой пояс по умолчанию: Europe/Moscow
- База sql.js — данные в памяти + файл reminders.db

## TODO

- [x] Добавить систему тем (dark/light/warm)
- [ ] Задеплоить на Render (Starter plan)
- [ ] Обновить WEBAPP_URL на URL Render
- [ ] Обновить Menu Button URL в @BotFather
- [x] Закоммитить и запушить изменения с темами на GitHub
- [x] Сделать persistent database (better-sqlite3 + Render Persistent Disk)
- [ ] Рассмотреть Liquid Glass эффекты (backdrop-filter: blur) — требует фоновый контент для видимого эффекта
