const cron = require('node-cron');
const { getAllEnabledReminders, saveLastMessageId, getPendingDeletions, clearLastMessageId } = require('./db');
const { sendReminder, deleteReminderMessage } = require('./bot');

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
        // Process auto-deletions (persisted in DB, survives restarts)
        try {
            const pending = await getPendingDeletions();
            for (const item of pending) {
                await deleteReminderMessage(item.user_id, item.last_message_id);
                await clearLastMessageId(item.user_id);
            }
        } catch (error) {
            console.error('Deletion error:', error);
        }

        // Send reminders
        try {
            const reminders = await getAllEnabledReminders();

            for (const reminder of reminders) {
                const currentTime = getCurrentTimeInTimezone(reminder.timezone);

                if (currentTime === reminder.reminder_time) {
                    console.log(`Sending reminder to user ${reminder.user_id} at ${currentTime}`);
                    const messageId = await sendReminder(reminder.user_id, webAppUrl);
                    if (messageId) {
                        await saveLastMessageId(reminder.user_id, messageId);
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
