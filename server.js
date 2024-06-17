const express = require('express');
const app = express();
const mysql = require('mysql');
const fs = require('fs');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'enter123',
  database: 'fun',
  port: 3306 // Default MySQL port
});
const path = require('path');
const dir = (filename) => path.resolve(filename);

app
.use(express.json())
.use(express.urlencoded({ extended: true }))
.get('/', (req, res) => res.sendFile(dir('index.html')))
.get('/three', (req, res) => {
	var fp = path.join(__dirname, 'node_modules/three/build/three.module.js')
	console.log(fp)
	res.sendFile(fp)
})

.get('/:filename', (req, res) => res.sendFile(dir(req.params.filename)))
.listen(4200, () => console.log('http://localhost:4200'));