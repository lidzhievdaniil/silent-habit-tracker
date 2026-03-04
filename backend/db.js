const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ── Migrations ───────────────────────────────────────────

const MIGRATIONS = [
    {
        version: 1,
        name: 'initial_schema',
        async run(client) {
            await client.query(`
                CREATE TABLE IF NOT EXISTS habits (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    name TEXT NOT NULL,
                    emoji TEXT NOT NULL,
                    position INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS habits_user_idx ON habits(user_id)
            `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS completions (
                    user_id BIGINT NOT NULL,
                    habit_id BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
                    completed_date DATE NOT NULL,
                    PRIMARY KEY (user_id, habit_id, completed_date)
                )
            `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS reminders (
                    user_id BIGINT PRIMARY KEY,
                    reminder_time TEXT NOT NULL,
                    timezone TEXT DEFAULT 'Europe/Moscow',
                    enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);
        }
    },
    {
        version: 2,
        name: 'reminder_last_message',
        async run(client) {
            await client.query(`
                ALTER TABLE reminders
                ADD COLUMN IF NOT EXISTS last_message_id BIGINT DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ DEFAULT NULL
            `);
        }
    },
];

async function initDb() {
    // Таблица отслеживания миграций создаётся первой
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    const { rows } = await pool.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map(r => r.version));

    for (const migration of MIGRATIONS) {
        if (applied.has(migration.version)) continue;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await migration.run(client);
            await client.query(
                'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
                [migration.version, migration.name]
            );
            await client.query('COMMIT');
            console.log(`Migration ${migration.version} (${migration.name}) applied`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    console.log('Database initialized');
}

// ── Habits ──────────────────────────────────────────────

async function getHabits(userId) {
    const result = await pool.query(
        'SELECT id, name, emoji FROM habits WHERE user_id = $1 ORDER BY position, created_at',
        [userId]
    );
    return result.rows;
}

async function addHabit(userId, name, emoji) {
    const result = await pool.query(
        'INSERT INTO habits (user_id, name, emoji) VALUES ($1, $2, $3) RETURNING id, name, emoji',
        [userId, name, emoji]
    );
    return result.rows[0];
}

async function deleteHabit(userId, habitId) {
    await pool.query(
        'DELETE FROM habits WHERE id = $1 AND user_id = $2',
        [habitId, userId]
    );
}

// ── Completions ─────────────────────────────────────────

async function getCompletions(userId, from, to) {
    const result = await pool.query(
        `SELECT habit_id, TO_CHAR(completed_date, 'YYYY-MM-DD') AS completed_date
         FROM completions
         WHERE user_id = $1 AND completed_date BETWEEN $2 AND $3`,
        [userId, from, to]
    );
    return result.rows;
}

async function toggleCompletion(userId, habitId, date, completed) {
    if (completed) {
        await pool.query(
            `INSERT INTO completions (user_id, habit_id, completed_date)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [userId, habitId, date]
        );
    } else {
        await pool.query(
            'DELETE FROM completions WHERE user_id = $1 AND habit_id = $2 AND completed_date = $3',
            [userId, habitId, date]
        );
    }
}

// ── Reminders ───────────────────────────────────────────

async function getReminder(userId) {
    const result = await pool.query(
        'SELECT * FROM reminders WHERE user_id = $1',
        [userId]
    );
    return result.rows[0] || null;
}

async function saveReminder(userId, reminderTime, timezone = 'Europe/Moscow') {
    await pool.query(
        `INSERT INTO reminders (user_id, reminder_time, timezone, enabled)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (user_id) DO UPDATE
         SET reminder_time = $2, timezone = $3, enabled = TRUE, updated_at = NOW()`,
        [userId, reminderTime, timezone]
    );
}

async function disableReminder(userId) {
    await pool.query(
        'UPDATE reminders SET enabled = FALSE, updated_at = NOW() WHERE user_id = $1',
        [userId]
    );
}

async function deleteReminder(userId) {
    await pool.query('DELETE FROM reminders WHERE user_id = $1', [userId]);
}

async function getRemindersForTime(time) {
    const result = await pool.query(
        'SELECT * FROM reminders WHERE reminder_time = $1 AND enabled = TRUE',
        [time]
    );
    return result.rows;
}

async function getAllEnabledReminders() {
    const result = await pool.query('SELECT * FROM reminders WHERE enabled = TRUE');
    return result.rows;
}

async function saveLastMessageId(userId, messageId) {
    await pool.query(
        'UPDATE reminders SET last_message_id = $2, last_sent_at = NOW() WHERE user_id = $1',
        [userId, messageId]
    );
}

async function getPendingDeletions() {
    const result = await pool.query(
        `SELECT user_id, last_message_id FROM reminders
         WHERE last_message_id IS NOT NULL
         AND last_sent_at <= NOW() - INTERVAL '45 minutes'`
    );
    return result.rows;
}

async function clearLastMessageId(userId) {
    await pool.query(
        'UPDATE reminders SET last_message_id = NULL, last_sent_at = NULL WHERE user_id = $1',
        [userId]
    );
}

async function deleteAllUserData(userId) {
    // habits deletion cascades to completions
    await pool.query('DELETE FROM habits WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM reminders WHERE user_id = $1', [userId]);
}

module.exports = {
    initDb,
    getHabits,
    addHabit,
    deleteHabit,
    getCompletions,
    toggleCompletion,
    getReminder,
    saveReminder,
    disableReminder,
    deleteReminder,
    getRemindersForTime,
    getAllEnabledReminders,
    saveLastMessageId,
    getPendingDeletions,
    clearLastMessageId,
    deleteAllUserData
};
