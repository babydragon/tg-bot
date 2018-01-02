import QueryHandler from './query_handler'
import TelegramBot from 'node-telegram-bot-api'
import sqlite from 'sqlite'
import ShutdownHook from 'shutdown-hook'
import Config from './config'
//const TelegramBot = require('node-telegram-bot-api');
//const sqlite = require('sqlite3');
//const ShutdownHook = require('shutdown-hook')

const shutdownHook = new ShutdownHook();
const token = '298256410:AAHqOLshyDTm1_A7d75nZU0HB51DyZJjwhc';
const config = new Config();

const supportedAction = config.supportedAction();
const recordUsage = '支持的记录项有：' + supportedAction.join('、');

async function main() {
    const db = await sqlite.open('qiqi_io.db', {Promise});
    const queryHandler = await QueryHandler.create(db);

    await db.run('CREATE TABLE IF NOT EXISTS qiqi(id INTEGER PRIMARY KEY, action_time INTEGER, action TEXT, memo TEXT)');

    const recordStmt = await db.prepare('INSERT INTO qiqi VALUES(NULL, ?, ?, ?)');
    const countStmt = await db.prepare('SELECT count(*) from qiqi');

    // shutdown hook
    shutdownHook.add(() => {
        countStmt.finalize().then(recordStmt.finalize())
            .then(queryHandler.destroy())
            .then(db.close());
    })

    let bot = new TelegramBot(token, {polling: true});

    bot.onText(/\/about/, (msg) => {
        let chatId = msg.chat.id;

        bot.getMe().then((me) => {
            bot.sendMessage(chatId, `I'm ${me.username}`);
        })
    })

    bot.onText(/\/record/, async (msg) => {
        let chatId = msg.chat.id;
        let date = msg.date;
        let content = msg.text;
        let contents = content.split(' ');
        let action = contents[1];
        let memo = null;
        if (contents.length > 2) {
            memo = contents[2];
        }
        if (!supportedAction.includes(action)) {
            bot.sendMessage(chatId, recordUsage);
            return;
        }

        await recordStmt.run(date, action, memo);
        let countResult = await countStmt.all();
        let count = Object.values(countResult[0])[0];
        bot.sendMessage(chatId, `记录成功，当前总记录条数： ${count}`);
    })

    bot.onText(/\/query/, async (msg) => {
        let chatId = msg.chat.id;
        let result = await queryHandler.newSession(chatId);
        if (!result) {
            return;
        }

        if(result.keyboard) {
            bot.sendMessage(chatId, result.message, {
                reply_markup: {
                    keyboard: result.keyboard
                }
            })
        } else {
            bot.sendMessage(chatId, result.message);
        }
    })

    bot.on('message', async (msg) => {
        if(msg.text.startsWith('/')) {
            return;
        }
        let chatId = msg.chat.id;
        let content = msg.text;

        let result = await queryHandler.handle(chatId, content);
        if (!result) {
            return;
        }

        if(result.keyboard) {
            bot.sendMessage(chatId, result.message, {
                reply_markup: {
                    keyboard: result.keyboard
                }
            })
        } else {
            bot.sendMessage(chatId, result.message, {
                reply_markup: {
                    remove_keyboard: true
                }
            });
        }
    });

    bot.on('polling_error', (error) => {
      console.log(error.code);
    });
}

main();
