const { ipcRenderer } = require('electron');

console.log("view-model");

export default class ViewModel {
    constructor() {
        this.user = null;
        this.map = null;
    }
    async init(username, view) {
        const model = await ipcRenderer.invoke('load-model', username);
        console.log("model loaded", model);
        this.user = model.user;
        this.map = model.map;
        await view.init();
    }
}