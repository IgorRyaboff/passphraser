const Telegraf = require('telegraf');
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const uuid = require('uuid').v4;
const markup = {
    reply_markup: {
        resize_keyboard: true,
        keyboard: [
            [Telegraf.Markup.button.text('🔑 Just 3 words')],
            [Telegraf.Markup.button.text('🔑 3 words and digit')],
            [Telegraf.Markup.button.text('🔑 3 words, digit and sign')],
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
        + `\nCombinations of "3 words": <b>${addSpaces(words.length ** 3)}</b>`
        + `\nCombinations of "3 words and digit": <b>${addSpaces(words.length ** 3 * 10 * 2)}</b>`
        + `\nCombinations of "3 words, digit and sign": <b>${addSpaces(words.length ** 3 * 10 * signs.length * 2)}</b>`, markup);
});

/** @param {Telegraf.Context} ctx */
async function sendPhrase(ctx, passphrase) {
    let msg = await ctx.replyWithHTML(`Your passphrase is <code>${passphrase}</code>`);
    db.models.ExpirableMessage.build({
        uuid: uuid(),
        chat: msg.chat.id,
        message: msg.message_id
    }).save();
}

setInterval(async () => {
    let found = await db.models.ExpirableMessage.findAll({
        where: {
            createdAt: { [Sequelize.Op.lt]: new Date - 30000 }
        }
    });
    for (const el of found) {
        await bot.telegram.editMessageText(el.chat, el.message, undefined, 'Your passphrase is <code>REDACTED</code>', { parse_mode: 'HTML' });
    }
    db.models.ExpirableMessage.destroy({
        where: {
            uuid: { [Sequelize.Op.in]: found.map(x => x.uuid) }
        }
    });
}, 10000);

bot.hears('🔑 Just 3 words', ctx => sendPhrase(ctx, `${randomWord()}${randomWord()}${randomWord()}`));
bot.hears('🔑 3 words and digit', ctx => {
    let digitPlacement = getRandomInt(0, 1);
    sendPhrase(ctx, `${randomWord()}${digitPlacement ? '' : getRandomInt(0, 9)}${randomWord()}${!digitPlacement ? '' : getRandomInt(0, 9)}${randomWord()}`);
});
bot.hears('🔑 3 words, digit and sign', ctx => {
    let digitPlacement = getRandomInt(0, 1);
    sendPhrase(ctx, `${randomWord()}${digitPlacement ? randomSign() : getRandomInt(0, 9)}${randomWord()}${!digitPlacement ? randomSign() : getRandomInt(0, 9)}${randomWord()}`);
});
bot.on('text', ctx => ctx.reply('Unknown command', markup));
bot.launch().catch(e => {
    console.log('Error connecting to TG', e);
    process.exit(0);
}).then(() => console.log('TG connected'));

let db = new Sequelize.Sequelize(require('./etc/db.json'));
db.define('ExpirableMessage', {
    uuid: {
        type: Sequelize.DataTypes.STRING,
        primaryKey: true
    },
    chat: {
        type: Sequelize.DataTypes.BIGINT
    },
    message: {
        type: Sequelize.DataTypes.BIGINT
    }
}, { updatedAt: false });
db.authenticate().catch(e => {
    console.log('Error connecting to DB', e);
    process.exit(0);
}).then(async () => {
    console.log('DB connected');
    await db.sync({ alter: true });
});