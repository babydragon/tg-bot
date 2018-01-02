export const supportedAction = ['大便', '小便', '吸奶', '喂奶'];
const keyboardTrunkSize = 2;

export default class Config {
    constructor() {
        this._supportedAction = supportedAction;
        let actionKeyboard = [];
        for(let i = 0; i < supportedAction.length; i += keyboardTrunkSize) {
            actionKeyboard.push(supportedAction.slice(i, i + keyboardTrunkSize));
        }
        this._actionKeyboard = actionKeyboard;
    }

    actionKeyboard() {
        return this._actionKeyboard;
    }

    supportedAction() {
        return this._supportedAction;
    }
}
