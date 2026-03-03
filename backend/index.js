require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { createBot, getBot } = require('./bot');
const { startScheduler } = require('./scheduler');
const {
    initDb,
    getHabits, addHabit, deleteHabit,
    getCompletions, toggleCompletion,
    getReminder, saveReminder, deleteReminder
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

if (!BOT_TOKEN) {
    console.error('BOT_TOKEN is required');
    process.exit(1);
}

if (!WEBAPP_URL) {
    console.error('WEBAPP_URL is required');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '..')));

// Validate Telegram initData
function validateInitData(initData) {
    if (!initData) return null;

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const params = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(BOT_TOKEN)
            .digest();

        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(params)
            .digest('hex');

        if (calculatedHash !== hash) return null;

        const userStr = urlParams.get('user');
        if (!userStr) return null;

        return JSON.parse(userStr);
    } catch (error) {
        console.error('initData validation error:', error);
        return null;
    }
}

// Auth middleware
function authMiddleware(req, res, next) {
    const initData = req.headers['x-telegram-init-data'];
    const user = validateInitData(initData);

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = user;
    next();
}

// ── Habits ──────────────────────────────────────────────

app.get('/api/habits', authMiddleware, async (req, res) => {
    try {
        const habits = await getHabits(req.user.id);
        res.json(habits);
    } catch (error) {
        console.error('Get habits error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/habits', authMiddleware, async (req, res) => {
    try {
        const { name, emoji } = req.body;
        if (!name || !emoji) {
            return res.status(400).json({ error: 'name and emoji are required' });
        }
        const habit = await addHabit(req.user.id, name.trim(), emoji);
        res.json(habit);
    } catch (error) {
        console.error('Add habit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/habits/:id', authMiddleware, async (req, res) => {
    try {
        await deleteHabit(req.user.id, parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        console.error('Delete habit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Completions ─────────────────────────────────────────

app.get('/api/completions', authMiddleware, async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ error: 'from and to query params are required' });
        }
        const completions = await getCompletions(req.user.id, from, to);
        res.json(completions);
    } catch (error) {
        console.error('Get completions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/completions', authMiddleware, async (req, res) => {
    try {
        const { habit_id, date, completed } = req.body;
        if (!habit_id || !date || completed === undefined) {
            return res.status(400).json({ error: 'habit_id, date and completed are required' });
        }
        await toggleCompletion(req.user.id, habit_id, date, completed);
        res.json({ success: true });
    } catch (error) {
        console.error('Toggle completion error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Reminders ───────────────────────────────────────────

app.get('/api/reminder', authMiddleware, async (req, res) => {
    try {
        const reminder = await getReminder(req.user.id);
        res.json({
            reminder_time: reminder?.reminder_time || null,
            enabled: reminder?.enabled === true || false
        });
    } catch (error) {
        console.error('Get reminder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/reminder', authMiddleware, async (req, res) => {
    try {
        const { reminder_time } = req.body;
        if (!reminder_time || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(reminder_time)) {
            return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
        }
        await saveReminder(req.user.id, reminder_time);
        res.json({ success: true, reminder_time });
    } catch (error) {
        console.error('Save reminder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/reminder', authMiddleware, async (req, res) => {
    try {
        await deleteReminder(req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete reminder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Health ───────────────────────────────────────────────

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ── Start ────────────────────────────────────────────────

function startBotWithRetry(bot, attempt = 1) {
    bot.start().catch(err => {
        if (err.error_code === 409 && attempt <= 5) {
            console.log(`Bot conflict (409), retry ${attempt}/5 in 10s...`);
            setTimeout(() => startBotWithRetry(bot, attempt + 1), 10000);
        } else {
            console.error('Bot polling error:', err.message);
        }
    });
}

async function start() {
    try {
        await initDb();

        if (BOT_TOKEN && BOT_TOKEN !== 'test_token_12345') {
            const bot = createBot(BOT_TOKEN, WEBAPP_URL);
            startBotWithRetry(bot);
            console.log('Telegram bot started');
            startScheduler(WEBAPP_URL);
        } else {
            console.log('Bot not started (test mode)');
        }

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
}

start();
