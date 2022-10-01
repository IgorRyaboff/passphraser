const Telegraf = require('telegraf');
const fs = require('fs');
const path = require('path');
const markup = {
    reply_markup: {
        resize_keyboard: true,
        keyboard: [
            [Telegraf.Markup.button.text('🔑 Just 3 words')],
            [Telegraf.Markup.button.text('🔑 Word-digit-word-word')],
            [Telegraf.Markup.button.text('🔑 Word-digit-word-sign-word')],
        ]
    }
};
const signs = [...'!@#$%^&*()-=+\'";:<>,./\\~'];
const words = fs.readFileSync(path.resolve(__dirname, 'words.txt')).toString().replace(/\r/gm, '').split('\n').filter(w => w.length >= 5 && w.length <= 8).map(w => [w[0].toUpperCase(), ...w.slice(1).toLowerCase()].join(''));
console.log(`Loaded ${words.length} words`);
function randomWord() {
    return words[getRandomInt(0, words.length - 1)];
}
function randomSign() {
    return signs[getRandomInt(0, signs.length - 1)];
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

if (!fs.existsSync(path.resolve(__dirname, 'etc', 'telegraf.txt'))) {
    console.log('No telegraf.txt file');
    process.exit(1);
}

let bot = new Telegraf.Telegraf(fs.readFileSync(path.resolve(__dirname, 'etc', 'telegraf.txt')).toString());
bot.start(ctx => {
    ctx.reply('Press button below to generate passphrase', markup);
});

bot.command('stats', ctx => {
    const addSpaces = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    ctx.replyWithHTML(`<b>${addSpaces(words.length)}</b> words are in use`
        + `\nCombinations of "word-word-word": <b>${addSpaces(words.length ** 3)}</b>`
        + `\nCombinations of "word-digit-word-word": <b>${addSpaces(words.length ** 3 * 10)}</b>`
        + `\nCombinations of "word-digit-word-sign-word": <b>${addSpaces(words.length ** 3 * 10 * signs.length)}</b>`, markup);
});

/** @param {Telegraf.Context} ctx */
async function sendPhrase(ctx, passphrase) {
    let msg = await ctx.replyWithHTML(`Your passphrase is <code>${passphrase}</code>`);
    setTimeout(() => {
        bot.telegram.editMessageText(msg.chat.id, msg.message_id, undefined, 'Your passphrase is <code>REDACTED</code>', { parse_mode: 'HTML' });
    }, 30000);
}

bot.hears('🔑 Just 3 words', ctx => sendPhrase(ctx, `${randomWord()}${randomWord()}${randomWord()}`));
bot.hears('🔑 Word-digit-word-word', ctx => sendPhrase(ctx, `${randomWord()}${getRandomInt(0, 9)}${randomWord()}${randomWord()}`));
bot.hears('🔑 Word-digit-word-sign-word', ctx => sendPhrase(ctx, `${randomWord()}${getRandomInt(0, 9)}${randomWord()}${randomSign()}${randomWord()}`));
bot.on('text', ctx => ctx.reply('Unknown command', markup));
bot.launch().catch(e => {
    console.log('Error connecting to TG', e);
    process.exit(0);
}).then(() => console.log('TG connected'));