// main.js (Electron main process)
const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const LEVEL = [
    null,
    "Heart of the Woods"
];


class User {
  constructor(options) {
    this.name = options.name;
    this.level = options.level;
    this.position = options.position;
  }
}

let t = 500

class Model {
  constructor(user) {
    const center = { x: 0, y: 0, z: 0 };
    this.map = {
      [user.level]: {
        center,
        scene_radius: t,
        quadrant: t, 
        noiseWidth: t * 2, 
        noiseHeight: t,
        segments: 32,
        sop: {
            trees: t / 3,
            grasses: t * .36
        },
        grasses: [],
        grass_triangles: [],
        trees: [],
        grounds: [],
        Grass: [
            '#33462d', //
            '#435c3a', //
            '#4e5e3e', //
            '#53634c', //
            '#536c46', //
            '#5d6847', //
        ],
        treeCondition: `!inCastle && (Math.random() < 0.81)`,
        grassPatchPersistence: 0.01,//0.03,
        grassBladeDensity: 500,
        textures: {
          barks: Array.from({ length: 7 }, (_, i) => `/images/trees/bark/bark-${i + 1}.jpg`),
          branches: Array.from({ length: 4 }, (_, i) => `/images/trees/foliage/branches/tree-branch-${i + 1}.png`),
          foliage: Array.from({ length: 7 }, (_, i) => `/images/trees/foliage/textures/foliage-${i + 1}.jpg`),
          art: Array.from({ length: 5 }, (_, i) => `/images/painting${i + 1}.jpg`),
          wall: Array.from({ length: 18 }, (_, i) => `/images/wall${i + 1}.jpg`),
          sunflower: Array.from({ length: 5 }, (_, i) => `/images/wall${i + 1}.jpg`),
        },
        amplitude: 50,
        persistence: 0.15,
        altitudeVariance: 10,
        width: t * 2,
        height: t * 2
      }
    };
    this.user = user;
  }
}

ipcMain.handle('load-model', async (event, username) => {
  let user = await new Promise((resolve) => {
    resolve({
      name: username,
      level: LEVEL[1],
      position: { x: 0, y: 0, z: 0 }
    });
  });
  return new Model(user);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load the main HTML file
  win.loadURL('app://./index.html');
  win.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Register a custom protocol to handle app:// URLs
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6); // Strip 'app://' prefix
    let filePath = path.normalize(`${__dirname}/${url}`);

    console.log(url, filePath)

    // Serve files based on the URL
    if (url === 'three') {
      filePath = path.join(__dirname, 'node_modules/three/build/three.module.js');
    } else if (url.startsWith('src/')) {
      filePath = path.join(__dirname, 'src', url.replace('src/', ''));
    } else if (url.startsWith('images/')) {
      filePath = path.join(__dirname, 'images', url.replace('images/', ''));
    } else if (url.startsWith('audio/')) {
      filePath = path.join(__dirname, 'audio', url.replace('audio/', ''));
    } else if (/^random/.test(url)) {
      var imgs = fs.readdirSync('./images')
      filePath = path.join(__dirname, 'images', imgs[Math.floor(Math.random() * imgs.length)])
    } else {
      filePath = path.join(__dirname, url);
    }


    console.log('>>>>>', filePath);

    // Return the file
    callback(filePath);
  });

  createWindow();
});

// Handle macOS behavior (reopen the app when clicking on its dock icon)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Quit the application when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
