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

class Model {
  constructor(user) {
    const center = { x: 0, y: 0, z: 0 };
    this.map = {
      [user.level]: {
        center, 
        quadrant: 100, 
        noiseWidth: 200, 
        noiseHeight: 100,
        segments: 50,
        sop: {
            trees: 100 * 3,
            grasses: 100 * .3
        },
        Grass: [
            '#33462d', //
            '#435c3a', //
            '#4e5e3e', //
            '#53634c', //
            '#536c46', //
            '#5d6847', //
        ],
        grassPatchPersistence: 0.03,
        textures: {
          barks: Array.from({ length: 7 }, (_, i) => `/images/trees/bark/bark-${i + 1}.jpg`),
          branches: Array.from({ length: 4 }, (_, i) => `/images/trees/foliage/branches/tree-branch-${i + 1}.png`),
          foliage: Array.from({ length: 7 }, (_, i) => `/images/trees/foliage/textures/foliage-${i + 1}.jpg`)
        },
        amplitude: 50,
        persistence: 0.15,
        altitudeVariance: 10,
        width: 200,
        height: 200,
        grassBladeDensity: 500,
        v0: { x: center.x - 100, y: center.y, z: center.z + 100 },
        v1: { x: center.x + 100, y: center.y, z: center.z + 100 }, 
        v2: { x: center.x + 100, y: center.y, z: center.z - 100 }, 
        v3: { x: center.x - 100, y: center.y, z: center.z - 100 }
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
