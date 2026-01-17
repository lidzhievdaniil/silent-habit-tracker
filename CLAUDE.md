# SILENT Habit Tracker

Telegram Mini App для трекинга привычек с ежедневными напоминаниями.

## Технологии

**Frontend:** Чистый HTML/CSS/JS (index.html)
**Backend:** Node.js + Express + grammy (Telegram Bot) + sql.js (SQLite)

## Структура проекта

```
silent-habit-tracker/
├── index.html          # Frontend (Mini App)
├── CLAUDE.md           # Этот файл
└── backend/
    ├── index.js        # Express сервер + API + раздача статики
    ├── bot.js          # Telegram Bot (grammy)
    ├── scheduler.js    # Cron-задача для напоминаний (каждую минуту)
    ├── db.js           # SQLite база данных (sql.js)
    ├── .env            # Конфигурация (BOT_TOKEN, WEBAPP_URL)
    └── package.json
```

## Конфигурация

**backend/.env:**
```
BOT_TOKEN=<токен от @BotFather>
WEBAPP_URL=<публичный HTTPS URL>
PORT=3000
```

## API Endpoints

- `GET /health` — проверка работоспособности
- `GET /api/reminder` — получить настройки напоминания (требует auth)
- `POST /api/reminder` — сохранить напоминание `{reminder_time: "HH:MM"}` (требует auth)
- `DELETE /api/reminder` — удалить напоминание (требует auth)

Аутентификация: заголовок `X-Telegram-Init-Data` с initData от Telegram WebApp.

## Локальный запуск

1. Установить зависимости: `cd backend && npm install`
2. Настроить `.env` с реальным BOT_TOKEN
3. Запустить сервер: `node index.js`
4. Запустить туннель: `cloudflared tunnel --url http://localhost:3000`
5. Обновить WEBAPP_URL в `.env` на URL туннеля
6. Настроить Menu Button URL в @BotFather

## Telegram Bot

- **Username:** @SilentHabitBot
- **User ID владельца:** 609511513
- Команды: `/start`, `/help`

## Важные моменты

- Frontend раздаётся через backend (`express.static`)
- `API_URL` в index.html пустой (same origin)
- База sql.js хранит данные в памяти — при перезапуске сервера данные теряются
- Для production нужен persistent storage (файл SQLite или PostgreSQL)
- Scheduler проверяет время каждую минуту и отправляет напоминания
- Часовой пояс по умолчанию: Europe/Moscow

## TODO для production

- [ ] Деплой на хостинг (Railway, Render, VPS)
- [ ] Сделать persistent database (сохранение в файл)
- [ ] Настроить постоянный домен
- [ ] Обновить URL в @BotFather
