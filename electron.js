// main.js (Electron main process)
const { app, BrowserWindow, protocol } = require('electron');
const fs = require('fs');
const path = require('path');


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
