const { ipcRenderer } = require('electron');

console.log("view-model");

export default class ViewModel {
    constructor() {
        this.user = null;
        this.map = null;
    }
    async init(username, view) {
        // Invokation
        // ----------
        const model = await ipcRenderer.invoke('load-model', username);
        console.log("model loaded", model);
        this.user = model.user;
        this.map = model.map;
        await view.init();
        // var xhr = new XMLHttpRequest();
        // xhr.open("GET", `http://localhost:8080/load/${username}`, true);
        // xhr.addEventListener('load', () => {
        //     const model = JSON.parse(xhr.response);
        //     console.log("model loaded", model);
        //     this.user = model.user;
        //     this.map = model.map;

        //     callback();
            
        // });
        // xhr.send();
    }
}