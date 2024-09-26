const { ipcRenderer } = require('electron');

export default class ViewModel {
    constructor() {
        this.user = null;
        this.map = null;
    }
    async init(username) {
        const model = await ipcRenderer.invoke('load-model', username);
        this.user = model.user;
        this.map = model.map;
    }
}