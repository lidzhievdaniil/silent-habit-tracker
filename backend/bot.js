const { Bot, InlineKeyboard } = require('grammy');
const { deleteAllUserData } = require('./db');

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
            '/help — Показать помощь\n' +
            '/deletedata — Удалить все мои данные\n\n' +
            'Настрой напоминания в приложении, чтобы не забывать отмечать привычки!'
        );
    });

    // /deletedata command
    bot.command('deletedata', async (ctx) => {
        const keyboard = new InlineKeyboard()
            .text('Да, удалить всё', 'confirm_delete')
            .text('Отмена', 'cancel_delete');

        await ctx.reply(
            '⚠️ Удаление всех данных\n\n' +
            'Будут удалены:\n' +
            '• Все твои привычки\n' +
            '• История выполнения\n' +
            '• Настройки напоминаний\n\n' +
            'Это действие необратимо. Продолжить?',
            { reply_markup: keyboard }
        );
    });

    // Callback: confirm deletion
    bot.callbackQuery('confirm_delete', async (ctx) => {
        const userId = ctx.from.id;
        try {
            await deleteAllUserData(userId);
            await ctx.editMessageText('✅ Все твои данные удалены. Спасибо, что пользовался SILENT!');
        } catch (err) {
            console.error('deletedata error:', err);
            await ctx.editMessageText('Произошла ошибка при удалении данных. Попробуй позже.');
        }
        await ctx.answerCallbackQuery();
    });

    // Callback: cancel deletion
    bot.callbackQuery('cancel_delete', async (ctx) => {
        await ctx.editMessageText('Отменено. Твои данные в сохранности.');
        await ctx.answerCallbackQuery();
    });

    // Register commands in Telegram UI
    bot.api.setMyCommands([
        { command: 'start', description: 'Открыть трекер привычек' },
        { command: 'help', description: 'Показать помощь' },
        { command: 'deletedata', description: 'Удалить все мои данные' },
    ]).catch(err => console.error('setMyCommands error:', err));

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
