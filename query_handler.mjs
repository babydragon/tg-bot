import Config from './config.mjs'

const config = new Config();

const pickTimeKeywords = ['今天', '近三天', '本周', '本月'];
const querySql = "select datetime(action_time, 'unixepoch', 'localtime') as t, action, memo from qiqi where action_time > ? and action = ?";
export default class QueryHandler {
    constructor(db) {
        console.log('query handler init!');
        this.db = db;
        this.Step = {
            START: 1,
            CHOOSE_ITEM: 2,
            PICK_TIME: 3
        }

        this._cache = {};
        this._dataCache = {};
    }

    async init() {
        this.queryStmt = await this.db.prepare(querySql);
    }

    static async create(db) {
        const handler = new QueryHandler(db);
        await handler.init();

        return handler;
    }

    newSession(chatId) {
        console.log("init new session");
        this._cache[chatId] = this.Step.START;

        return this.handle(chatId, null);
    }

    async handle(chatId, msg) {
        if(!this._cache.hasOwnProperty(chatId)) {
            return null;
        }

        let step = this._cache[chatId];
        switch (step) {
            case this.Step.START:
                step = this.Step.CHOOSE_ITEM;
                this._cache[chatId] = step;
                return {
                    message: '请选择查询项：',
                    keyboard: config.actionKeyboard()
                }
            case this.Step.CHOOSE_ITEM:
                let action = msg;
                if(! config.supportedAction().includes(action)) {
                    delete this._cache[chatId];
                    return {
                        message: '支持查询以下记录项： ' + config.supportedAction().join(',')
                    }
                }

                step = this.Step.PICK_TIME;
                this._cache[chatId] = step;
                this._dataCache[chatId] = action;
                return {
                    message: '请选择查询时间段：',
                    keyboard: [['今天', '近三天'],['本周', '本月']]
                }
            case this.Step.PICK_TIME:
                let time = msg;
                if(! pickTimeKeywords.includes(time)) {
                    delete this._cache[chatId];
                    return {
                        message: '支持以下时间段： ' + pickTimeKeywords.join(',')
                    }
                }

                const start = this.parseTimeKeyword(time);
                const chatAction = this._dataCache[chatId];
                const queryResult = await this.queryDB(chatAction, start);
                let resultMessage = `共查询到数据 ${queryResult.length} 条\n时间|项目|备注\n`;
                queryResult.forEach((row) => {
                    resultMessage += `${row['t']}|${row['action']}|${row['memo']}\n`
                })
                delete this._cache[chatId];
                delete this._dataCache[chatId];
                return {
                    message: resultMessage
                }
        }
    }

    parseTimeKeyword(time) {
        let t = new Date();
        t.setHours(0, 0, 0, 0);
        switch (time) {
            case '今天':
                break;
            case '近三天':
                t.setDate(t.getDate() - 2);
                break;
            case '本周':
                t.setDate(t.getDate() - t.getDay() + 1);
                break;
            case '本月':
                t.setDate(1);
                break;
        }

        return Math.floor(t.getTime() / 1000);
    }

    queryDB(action, startTime) {
        let that = this;
        return this.queryStmt.all(startTime, action);
    }

    destroy() {
        this.queryStmt.finalize();
    }
}
