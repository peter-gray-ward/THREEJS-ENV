// const { ipcRenderer } = require('electron');

console.log("view-model");

export default class ViewModel {
    constructor() {
        this.user = null;
        this.map = null;
    }
    init(username, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", `/load/${username}`, true);
        xhr.addEventListener('load', async () => {
            const model = JSON.parse(xhr.response);
            for (var key in model) {
                this[key] = model[key]
            }
            callback()
        });
        xhr.send();
    }
}