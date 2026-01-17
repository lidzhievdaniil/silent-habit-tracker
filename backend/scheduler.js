const cron = require('node-cron');
const { getAllEnabledReminders } = require('./db');
const { sendReminder } = require('./bot');

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
        try {
            const reminders = getAllEnabledReminders();

            for (const reminder of reminders) {
                const currentTime = getCurrentTimeInTimezone(reminder.timezone);

                if (currentTime === reminder.reminder_time) {
                    console.log(`Sending reminder to user ${reminder.user_id} at ${currentTime}`);
                    await sendReminder(reminder.user_id, webAppUrl);
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
