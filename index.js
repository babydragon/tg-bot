const TelegramBot = require('node-telegram-bot-api');
const sqlite = require('sqlite3');
const ShutdownHook = require('shutdown-hook')
let shutdownHook = new ShutdownHook();

const token = '298256410:AAHqOLshyDTm1_A7d75nZU0HB51DyZJjwhc';

const db = new sqlite.Database('qiqi_io.db');

db.run('CREATE TABLE IF NOT EXISTS qiqi(id INTEGER PRIMARY KEY, action_time INTEGER, action TEXT, memo TEXT)');

const recordStmt = db.prepare('INSERT INTO qiqi VALUES(NULL, ?, ?, ?)');
const countStmt = db.prepare('SELECT count(*) from qiqi');
const supportedAction = ['大便', '小便', '吸奶', '喂奶'];
const recordUsage = '支持的记录项有：' + supportedAction.join('、');

// shutdown hook
shutdownHook.add(() => {
    countStmt.finalize();
    recordStmt.finalize();

    db.close();
})

let bot = new TelegramBot(token, {polling: true});

bot.onText(/\/about/, (msg) => {
    let chatId = msg.chat.id;

    bot.getMe().then((me) => {
        bot.sendMessage(chatId, `I'm ${me.username}`);
    })
})

bot.onText(/\/record/, (msg) => {
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

    recordStmt.run(date, action, memo);
    countStmt.all((err, rows) => {
        let resultRow = rows[0];
        let count = Object.values(resultRow)[0];
        bot.sendMessage(chatId, `记录成功，当前总记录条数： ${count}`);
    })

})

bot.on('polling_error', (error) => {
  console.log(error.code);
});
