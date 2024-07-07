// main.js (Electron main process)
const { app, BrowserWindow } = require('electron');
const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');

const expressApp = express();

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'enter123',
  database: 'fun',
  port: 3306 // Default MySQL port
});

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
  .get('/perlin-noise', (req, res) => {
    var fp = path.join(__dirname, 'node_modules/perlin-noise/index.js')
    res.sendFile(fp)
  })
  .get('/housing', (req, res) => {
    res.sendFile(path.join(__dirname, 'buildings.js'))
  })
  .get('/random-image', (req, res) => {
    var tag = req.query.tag;
    connection.query(`
        SELECT image from fun.images i
        where i.tag = '${tag}'
        order by rand() limit 1`, (err, results) => {
          if (results && results.length) {
            res.end(results[0].image)
          }
    });
  })
  .get('/tree1/:file', (req, res) => {
    res.writeHead(200, { 'Content-Type' : 'image/jpeg'})
    return res.end(path.join(__dirname, 'Tree1', req.params.file))
  })
  .get('/rockwall', (req, res) => {
    res.writeHead(200, { 'Content-Type' : 'image/jpeg'})
    const fp = path.join(__dirname, 'rockwall.jpg')
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
  .get('/image-tags', (req, res) => {
    connection.query(`
      select distinct tag as name, count(tag) as countOf from fun.images 
      group by tag
      order by tag asc`, (err, results) => {
      if (results && results.length) {
        res.jsonp(results)
      }
    })
  })
  .get('/images', (req, res) => {
    var tag = req.query.tag;
    connection.query(`
      select id
      from fun.images
      where tag is not null and tag = '${tag}'`, (err, results) => {
      if (results && results.length) {
        res.jsonp(results.map(r => r.id))
      }
    })
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
  .get('/image', (req, res) => {
    var id = req.query.id;
    connection.query(`
      select image
      from fun.images
      where id = '${id}'`, (err, results) => {
        res.end(results[0].image)
      })
  })
  .get('/:filename', (req, res) => res.sendFile(dir(req.params.filename)))
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
    width: 800,
    height: 600,
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
