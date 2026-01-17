const { Bot, InlineKeyboard } = require('grammy');

let bot = null;

function createBot(token, webAppUrl) {
    bot = new Bot(token);

    // /start command
    bot.command('start', async (ctx) => {
        const keyboard = new InlineKeyboard()
            .webApp('Открыть трекер', webAppUrl);

        await ctx.reply(
            'Привет! Я помогу тебе отслеживать привычки.\n\n' +
            'Нажми кнопку ниже, чтобы открыть трекер привычек.',
            { reply_markup: keyboard }
        );
    });

    // /help command
    bot.command('help', async (ctx) => {
        await ctx.reply(
            'SILENT — Habit Tracker\n\n' +
            'Команды:\n' +
            '/start — Открыть трекер\n' +
            '/help — Показать помощь\n\n' +
            'Настрой напоминания в приложении, чтобы не забывать отмечать привычки!'
        );
    });

    return bot;
}

// Send reminder to user
async function sendReminder(userId, webAppUrl) {
    if (!bot) {
        console.error('Bot not initialized');
        return false;
    }

    try {
        const keyboard = new InlineKeyboard()
            .webApp('Открыть', webAppUrl);

        await bot.api.sendMessage(
            userId,
            'Время отметить привычки!\n\nНе забудь выполнить свои ежедневные цели.',
            { reply_markup: keyboard }
        );
        return true;
    } catch (error) {
        console.error(`Failed to send reminder to ${userId}:`, error.message);
        return false;
    }
}

function getBot() {
    return bot;
}

module.exports = {
    createBot,
    sendReminder,
    getBot
};
