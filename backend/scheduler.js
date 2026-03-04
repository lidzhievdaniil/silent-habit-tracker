const cron = require('node-cron');
const { getAllEnabledReminders } = require('./db');
const { sendReminder, deleteReminderMessage } = require('./bot');

const DELETE_AFTER_MS = 45 * 60 * 1000; // 45 minutes
const deletionQueue = []; // { userId, messageId, deleteAt }

let schedulerTask = null;

function getCurrentTimeInTimezone(timezone) {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        return formatter.format(now);
    } catch (error) {
        // Fallback to Moscow time if timezone is invalid
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Moscow',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        return formatter.format(now);
    }
}

function startScheduler(webAppUrl) {
    // Run every minute
    schedulerTask = cron.schedule('* * * * *', async () => {
        const now = Date.now();

        // Process auto-deletions
        const toDelete = deletionQueue.filter(item => item.deleteAt <= now);
        toDelete.forEach(item => {
            deleteReminderMessage(item.userId, item.messageId);
            deletionQueue.splice(deletionQueue.indexOf(item), 1);
        });

        // Send reminders
        try {
            const reminders = await getAllEnabledReminders();

            for (const reminder of reminders) {
                const currentTime = getCurrentTimeInTimezone(reminder.timezone);

                if (currentTime === reminder.reminder_time) {
                    console.log(`Sending reminder to user ${reminder.user_id} at ${currentTime}`);
                    const messageId = await sendReminder(reminder.user_id, webAppUrl);
                    if (messageId) {
                        deletionQueue.push({
                            userId: reminder.user_id,
                            messageId,
                            deleteAt: now + DELETE_AFTER_MS
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Scheduler error:', error);
        }
    });

    console.log('Reminder scheduler started');
    return schedulerTask;
}

function stopScheduler() {
    if (schedulerTask) {
        schedulerTask.stop();
        console.log('Reminder scheduler stopped');
    }
}

module.exports = {
    startScheduler,
    stopScheduler
};
