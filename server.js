const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const dir = (filename) => path.resolve(filename);

var ii = 0
app
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
  .get('/tree1/:file', (req, res) => {
    res.writeHead(200, { 'Content-Type' : 'image/png'})
    return res.end(path.join(__dirname, 'Tree1', req.params.file))
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
.listen(8080, () => console.log('http://localhost:8080'));