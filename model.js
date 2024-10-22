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

let t = 200

class Model {
  constructor(user) {
    const center = { x: 0, y: 0, z: 0 };
    this.map = {
      [user.level]: {
        center, 
        quadrant: t, 
        noiseWidth: t * 2, 
        noiseHeight: t,
        segments: 50,
        sop: {
            trees: t / 2,
            grasses: t / 3,
            grounds: 0,
            cliffs: t / 2
        },
        grasses: [],
        grounds: [],
        structures: [
          {
            name: 'castle',
            position: {
              foundation: {
                x: 0,
                y: 16,
                z: 0,
              },
              elevator: {
                x: 40 - 1.25,
                y: 1.5 + 3,
                z: -25 + 1.25,
                floor: {
                  x: 40 - 1.25,
                  y: 1.5 + 0.1,
                  z: -25 + 1.25,
                },
                ceiling: {
                  x: 40 - 1.25,
                  y: 1.5 + 3 - 0.1,
                  z: -25 + 1.25,
                },
                shaft: {
                  front: Array.from({ length: 20 }, (_, index) => {
                    const LEVEL = (15 / 2 * (_ + 1));
                    return {
                      x: 40 - 1.25,
                      y: 1.5 + LEVEL,
                      z: -25 + 2.5 - .1,
                      door: {
                        x: 40 - 1.25,
                        y: LEVEL - 1.5 + 1,
                        z: -25 + 2.5 - .1,
                      }
                    }
                  }),
                  right: {
                    x: 1.5 + 3, 
                    y: 1.5 + (15 * 20 / 2), 
                    z: -25 + 1.25 - 0.1
                  },
                  back: {},
                  left: {
                    x: 40 - 1.25,
                    y: 1.5 + (15 * 20),
                    z: -25 + 1.25
                  }
                }
                // buttons: {
                //   plate: {
                //     x: eFloor.position.x - 1, 
                //     floorYPosition + this.offsetY + 1,  // Y-position at this level
                //     eFloor.position.z - escalationCooridorDim / 2 - .12
                //   }
                // }
              }
            },
            rotation: {
              elevator: {
                shaft: {
                  right: {
                    y: Math.PI / 2
                  }
                }
              }
            },
            area: {
              foundation: {
                width: 20,
                height: 50,
                depth: 20
              },
              floor: {
                width: 20,
                height: 3,
                depth: 20
              },
              elevator: {
                width: 2.5,
                height: 3,
                depth: 2.5,
                floor: {
                  width: 2.5,
                  height: 0.2,
                  depth: 2.5
                },
                shaft: {
                  front: {},
                  right: {
                    width: 2.5, 
                    height: (15 * 19 + 3), 
                    depth: 0.2
                  }
                }
              },
              wall: {
                height: 30
              }
            },
            floors: 20,
            textures: {
              foundation: "/images/concrete"
            }
          }
        ],
        trees: [],
        Grass: [
            '#33462d', //
            '#435c3a', //
            '#4e5e3e', //
            '#53634c', //
            '#536c46', //
            '#5d6847', //
        ],
        treeCondition: `!inCastle && (Math.random() < 0.31 || (Math.random() < 0.3 && !isNearGrassPatch))`,
        grassPatchPersistence: 0.01,//0.03,
        textures: {
          barks: Array.from({ length: 7 }, (_, i) => `/images/trees/bark/bark-${i + 1}.jpg`),
          branches: Array.from({ length: 4 }, (_, i) => `/images/trees/foliage/branches/tree-branch-${i + 1}.png`),
          foliage: Array.from({ length: 7 }, (_, i) => `/images/trees/foliage/textures/foliage-${i + 1}.jpg`)
        },
        amplitude: 50,
        persistence: 0.15,
        altitudeVariance: 20,
        width: t * 2,
        height: t * 2,
        grassBladeDensity: 300
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
      offscreen: false
    },
  });

  // Load the main HTML file
  win.loadURL('app://./index.html');
  win.webContents.openDevTools();
}
app.disableHardwareAcceleration()
// app.commandLine.appendSwitch('use-angle', 'd3d11'); // Use DirectX 11
app.commandLine.appendSwitch('use-angle', 'gl');


app.whenReady().then(() => {
  // Register a custom protocol to handle app:// URLs
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6); // Strip 'app://' prefix
    let filePath = path.normalize(`${__dirname}/${url}`);

    console.log(url, filePath)

    // Serve files based on the URL
    if (url === 'three') {
      filePath = path.join(__dirname, 'node_modules/three/build/three.module.js');
    } else if (url.startsWith('node_modules')) {
      filePath = path.join(__dirname, url);
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