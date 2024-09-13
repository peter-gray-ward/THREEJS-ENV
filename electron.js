// main.js (Electron main process)
const { app, BrowserWindow } = require('electron');
const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');



const expressApp = express();

const dir = (filename) => path.resolve(filename);
var ii = 0
expressApp
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .get('/', (req, res) => res.sendFile(dir('index.html')))
  .get('/three', (req, res) => {
    var fp = path.join(__dirname, 'node_modules/three/build/three.module.js')
    res.sendFile(fp)
  })
  .get('/water', (req, res) => {
    var fp = path.join(__dirname, 'node_modules/three/examples/jsm/objects/Water.js')
    res.sendFile(fp)
  })
  .get('/waternormals', (req, res) => {
    var fp = path.join(__dirname, 'waternormals.jpg')
    res.sendFile(fp)
  })
  .get('/sky', (req, res) => {
    var fp = path.join(__dirname, 'node_modules/three/examples/jsm/objects/Sky.js')
    res.sendFile(fp)
  })
  .get('/perlin-noise', (req, res) => {
    var fp = path.join(__dirname, 'node_modules/perlin-noise/index.js')
    res.sendFile(fp)
  })
  .get('/noise', (req, res) => {
    var fp = path.join(__dirname, 'node_modules/simplex-noise/dist/esm/simplex-noise.js')
    res.sendFile(fp)
  })
  .get('/housing', (req, res) => {
    res.sendFile(path.join(__dirname, 'buildings.js'))
  })

  .get('/:filename', (req, res) => res.sendFile(dir(req.params.filename)))
  .get('/images/:file', (req, res) => {
    res.writeHead(200, { 'Content-Type' : 'image/jpeg'})
    const fp = path.join(__dirname, 'images', req.params.file)
    return res.end(fs.readFileSync(fp));
  })
  .get('/bark', (req, res) => {
    res.writeHead(200, { 'Content-Type' : 'image/jpeg'})
    return res.end(path.join(__dirname, 'Tree1', 'bark.jpg'))
  })
  .get('/rockwall', (req, res) => {
    res.writeHead(200, { 'Content-Type' : 'image/jpeg'})
    const fp = path.join(__dirname, 'rockwall.jpg')
    return res.end(fs.readFileSync(fp));
  })
  .get('/oak-leaf', (req, res) => {
    res.writeHead(200, { 'Content-Type' : 'image/png'})
    const fp = path.join(__dirname, 'Tree1', 'oak-leaf.png')
    return res.end(fs.readFileSync(fp));
  })
  .get('/cannon', (req, res) => {
    return res.sendFile(path.join(__dirname, 'node_modules', 'cannon-es', 'dist', 'cannon-es.js'))
  })
  .get('/moss', (req, res) => {
    res.writeHead(200, { 'Content-Type' : 'image/jpeg'})
    const mossFilepath = path.join(__dirname, 'moss.jpg')
    return res.end(fs.readFileSync(mossFilepath));
  })
  .get('/delaunator', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules/delaunator/index.js'))
  })
  .get('/robust-predicates', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules/robust-predicates/index.js'))
  })
  .get('/gltf-loader', (req, res) => {
    return res.sendFile(path.join(__dirname, '/node_modules/three-gltf-loader'))
  })
  .get('/mtl-loader', (req, res) => {
    return res.sendFile(path.join(__dirname, '/node_modules/three-mtl-loader'))
  })
  .get('/obj-loader', (req, res) => {
    return res.sendFile(path.join(__dirname, '/node_modules/three-obj-loader'))
  })
  .get('/tds-loader', (req, res) => {
    return res.sendFile(path.join(__dirname, '/node_modules/three/examples/jsm/loaders/TDSLoader.js'))
  })
  .get('/tree1', (req, res) => {
    return res.sendFile(path.join(__dirname, '/Tree1/Tree1.3ds'))
  })
 
  .post('/save', (req, res) => {
    var body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', function() {
      body = JSON.parse(body);
      fs.writeFileSync('./db.json', JSON.stringify(body, null, 2));
    })
  })
  .get('/load', (req, res) => {
    return fs.readFileSync('./db.json');
  })
  .listen(4200, () => console.log('http://localhost:4200'));

function createWindow() {
  const win = new BrowserWindow({
    width: 9999,
    height: 9999,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadURL('http://localhost:4200');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
