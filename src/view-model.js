// const { ipcRenderer } = require('electron');

console.log("view-model");

export default class ViewModel {
    constructor() {
        this.user = null;
        this.map = null;
    }
    async init(username, view) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", `/load/${username}`, true);
        xhr.addEventListener('load', async () => {
            const model = JSON.parse(xhr.response);
            console.log("model loaded", model);
            this.user = model.user;
            this.map = model.map[this.user.level];
            await view.init(model);
            
        });
        xhr.send();
    }
}