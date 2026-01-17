const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'reminders.db');

let db = null;

// Initialize database
async function initDb() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Create reminders table
    db.run(`
        CREATE TABLE IF NOT EXISTS reminders (
            user_id INTEGER PRIMARY KEY,
            reminder_time TEXT NOT NULL,
            timezone TEXT DEFAULT 'Europe/Moscow',
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    saveDb();
    return db;
}

// Save database to file
function saveDb() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

// Get reminder for user
function getReminder(userId) {
    if (!db) return null;
    const stmt = db.prepare('SELECT * FROM reminders WHERE user_id = ?');
    stmt.bind([userId]);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    stmt.free();
    return null;
}

// Save or update reminder
function saveReminder(userId, reminderTime, timezone = 'Europe/Moscow') {
    if (!db) return;

    // Check if exists
    const existing = getReminder(userId);

    if (existing) {
        db.run(
            'UPDATE reminders SET reminder_time = ?, timezone = ?, enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            [reminderTime, timezone, userId]
        );
    } else {
        db.run(
            'INSERT INTO reminders (user_id, reminder_time, timezone, enabled) VALUES (?, ?, ?, 1)',
            [userId, reminderTime, timezone]
        );
    }

    saveDb();
}

// Disable reminder
function disableReminder(userId) {
    if (!db) return;
    db.run('UPDATE reminders SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
    saveDb();
}

// Delete reminder
function deleteReminder(userId) {
    if (!db) return;
    db.run('DELETE FROM reminders WHERE user_id = ?', [userId]);
    saveDb();
}

// Get all enabled reminders for specific time (HH:MM format)
function getRemindersForTime(time) {
    if (!db) return [];
    const results = [];
    const stmt = db.prepare('SELECT * FROM reminders WHERE reminder_time = ? AND enabled = 1');
    stmt.bind([time]);
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// Get all enabled reminders
function getAllEnabledReminders() {
    if (!db) return [];
    const results = [];
    const stmt = db.prepare('SELECT * FROM reminders WHERE enabled = 1');
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

module.exports = {
    initDb,
    getReminder,
    saveReminder,
    disableReminder,
    deleteReminder,
    getRemindersForTime,
    getAllEnabledReminders
};
