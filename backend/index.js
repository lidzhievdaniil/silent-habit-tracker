require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { createBot, getBot } = require('./bot');
const { startScheduler } = require('./scheduler');
const { initDb, getReminder, saveReminder, deleteReminder } = require('./db');

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

        // Sort parameters
        const params = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Create secret key
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(BOT_TOKEN)
            .digest();

        // Calculate hash
        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(params)
            .digest('hex');

        if (calculatedHash !== hash) {
            return null;
        }

        // Parse user data
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

// API Routes

// Get reminder settings
app.get('/api/reminder', authMiddleware, (req, res) => {
    try {
        const reminder = getReminder(req.user.id);
        res.json({
            reminder_time: reminder?.reminder_time || null,
            enabled: reminder?.enabled === 1 || false
        });
    } catch (error) {
        console.error('Get reminder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save/update reminder
app.post('/api/reminder', authMiddleware, (req, res) => {
    try {
        const { reminder_time } = req.body;

        // Validate time format (HH:MM)
        if (!reminder_time || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(reminder_time)) {
            return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
        }

        saveReminder(req.user.id, reminder_time);
        res.json({ success: true, reminder_time });
    } catch (error) {
        console.error('Save reminder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete reminder
app.delete('/api/reminder', authMiddleware, (req, res) => {
    try {
        deleteReminder(req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete reminder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server and bot
async function start() {
    try {
        // Initialize database
        await initDb();
        console.log('Database initialized');

        // Create and start bot (only if valid token)
        if (BOT_TOKEN && BOT_TOKEN !== 'test_token_12345') {
            const bot = createBot(BOT_TOKEN, WEBAPP_URL);
            bot.start();
            console.log('Telegram bot started');

            // Start reminder scheduler
            startScheduler(WEBAPP_URL);
        } else {
            console.log('Bot not started (test mode)');
        }

        // Start Express server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
}

start();
