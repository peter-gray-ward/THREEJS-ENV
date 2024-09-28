const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const dir = (filename) => path.resolve(filename);

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




var ii = 0
app
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .get('/', (req, res) => res.sendFile(dir('index.html')))
  .get('/three', (req, res) => {
    var fp = path.join(__dirname, 'node_modules/three/build/three.cjs')
    res.type("text/javascript");
    res.sendFile(fp)
  })
 .get('/images/trees/:treepart/*', (req, res) => {
    const { treepart } = req.params;
    const restOfPath = req.params[0]; // The wildcard part (everything after :treepart)

    // Construct the file path
    const filePath = path.join(__dirname, 'images', 'trees', treepart, restOfPath);
    res.sendFile(filePath);
  })
  .get('/load/:username', (req, res) => {
    res.json(new Model({
      name: req.params.username,
      level: LEVEL[1],
      position: { x: 0, y: 0, z: 0 }
    }));
  })
  .get('/lib/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'lib', req.params.filename);
    console.log("filePath", filePath);
    res.type("text/javascript");
    res.sendFile(filePath);
  })
  .get('/src/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'src', req.params.filename);
    console.log("filePath", filePath);
    res.type("text/javascript");
    res.sendFile(filePath);
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
.listen(8080, () => console.log('http://localhost:8080'));