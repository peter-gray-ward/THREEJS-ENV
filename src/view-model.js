// const { ipcRenderer } = require('electron');

console.log("view-model");

export default class ViewModel {
    constructor() {
        this.user = null;
        this.map = null;
    }
    async init(username, view) {
        // Invokation
        // ----------
        // const model = await ipcRenderer.invoke('load-model', username);
        // console.log("model loaded", model);
        // this.user = model.user;
        // this.map = model.map;



        // this.map[this.user.level].grassBladeDensity = 390

        

        // await view.init();
        var xhr = new XMLHttpRequest();
        xhr.open("GET", `https://sleepy-tundra-44541-fc5db6787027.herokuapp.com/load/${username}`, true);
        xhr.addEventListener('load', async () => {
            const model = JSON.parse(xhr.response);
            console.log("model loaded", model);
            this.user = model.user;
            this.map = model.map[this.user.level];

            await view.init();
            
        });
        xhr.send();
    }
}